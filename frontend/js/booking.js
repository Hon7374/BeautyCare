function statusBadge(statusRaw) {
  const st = String(statusRaw || '').toLowerCase();
  if (st === 'confirmed') return `<span class="badge primary">Đã xác nhận</span>`;
  if (st === 'paid') return `<span class="badge good">Đã thanh toán</span>`;
  if (st === 'completed') return `<span class="badge good">Hoàn thành</span>`;
  if (st === 'cancelled') return `<span class="badge bad">Đã hủy</span>`;
  return `<span class="badge warn">Chờ xác nhận</span>`;
}

function toISODateInput(d) {
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeHHMM(t) {
  const s = String(t || '');
  const m = s.match(/(\d{2}:\d{2})/);
  return m ? m[1] : s.slice(0, 5);
}

function buildTimeOptions() {
  const opts = [];
  for (let h = 9; h <= 19; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 19 && m > 0) continue;
      opts.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return opts;
}

// ===== Date formatting (force vi-VN to always dd/mm) =====
function weekdayShort(dateStr){
  const d = new Date(`${dateStr}T00:00:00`);
  const w = d.getDay();
  return ['CN','T2','T3','T4','T5','T6','T7'][w] || '';
}

function fmtVN(dateStr, opts){
  try{
    const d = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('vi-VN', opts).format(d);
  }catch(e){
    return '';
  }
}

function ddmm(dateStr){
  return fmtVN(dateStr, { day:'2-digit', month:'2-digit' }) || '';
}

function ddmmyyyy(dateStr){
  return fmtVN(dateStr, { day:'2-digit', month:'2-digit', year:'numeric' }) || '';
}



function syncDateText(){
  const dateEl = document.getElementById('bkDate');
  const txtEl  = document.getElementById('bkDateText');
  if (!dateEl || !txtEl) return;
  const iso = String(dateEl.value || '').slice(0, 10);
  txtEl.value = iso ? ddmmyyyy(iso) : '';
}
function getSelectedServiceId() {
  const sel = document.getElementById('bkService');
  if (!sel) return null;

  const raw = sel.value;
  let n = Number(raw);
  if (Number.isFinite(n) && n > 0) return n;

  const opt = sel.selectedOptions && sel.selectedOptions[0];
  if (opt) {
    const v2 = opt.getAttribute('value');
    n = Number(v2);
    if (Number.isFinite(n) && n > 0) return n;

    const v3 = opt.getAttribute('data-id') || opt.dataset?.id;
    n = Number(v3);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function loadAvailabilityCalendar() {
  const sel = document.getElementById('bkService');
  const dateEl = document.getElementById('bkDate');
  const wrap = document.getElementById('bkCalendar');
  if (!sel || !dateEl || !wrap) return;

  const serviceId = getSelectedServiceId();
  if (!serviceId) { wrap.innerHTML = ''; return; }

  // ✅ dùng ngày đang chọn làm mốc, không dùng "today" cố định
  const selectedISO = String(dateEl.value || '').slice(0, 10);
  const baseDate = selectedISO
    ? new Date(`${selectedISO}T00:00:00`)
    : new Date();

  // fallback nếu date bị invalid
  const base = Number.isNaN(baseDate.getTime()) ? new Date() : baseDate;

  // ✅ render 14 ngày tính từ base
  const from = toISODateInput(base);
  const to = toISODateInput(new Date(base.getTime() + 13 * 24 * 3600 * 1000));

  const { res, data } = await apiFetch(
    `/bookings/availability-calendar?serviceId=${encodeURIComponent(serviceId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { method: 'GET' }
  );

  if (!res.ok) {
    wrap.innerHTML = `<div class="muted small">Không tải được lịch trống.</div>`;
    return;
  }

  const days = Array.isArray(data?.days) ? data.days : [];

  // ✅ đảm bảo selected nằm trong range hiện tại
  let selected = selectedISO || from;

  // nếu selected không nằm trong list days (do user chọn xa hơn), thì nhảy range theo selected
  const hasSelected = days.some(x => x.date === selected);
  if (!hasSelected && selectedISO) {
    // gọi lại theo selectedISO làm mốc
    const base2 = new Date(`${selectedISO}T00:00:00`);
    const from2 = toISODateInput(base2);
    const to2 = toISODateInput(new Date(base2.getTime() + 13 * 24 * 3600 * 1000));

    const r2 = await apiFetch(
      `/bookings/availability-calendar?serviceId=${encodeURIComponent(serviceId)}&from=${encodeURIComponent(from2)}&to=${encodeURIComponent(to2)}`,
      { method: 'GET' }
    );

    if (r2.res.ok) {
      const days2 = Array.isArray(r2.data?.days) ? r2.data.days : [];
      // replace
      selected = selectedISO || from2;

      wrap.innerHTML = days2.map(d => {
        const full = d.isFull ? 'full' : '';
        const selCls = d.date === selected ? 'selected' : '';
        const line3 = d.isFull ? 'Hết chỗ' : `${d.availableSlots} khung giờ`;
        return `
          <div class="day-chip ${full} ${selCls}" data-date="${d.date}">
            <div class="d1">${weekdayShort(d.date)} • ${ddmmyyyy(d.date)}</div>
            <div class="d2">${d.isFull ? 'Đã đầy' : 'Còn trống'}</div>
            <div class="d3"><span class="day-dot"></span><span>${escapeHtml(line3)}</span></div>
          </div>
        `;
      }).join('');

      wrap.querySelectorAll('.day-chip').forEach(chip => {
        chip.addEventListener('click', async () => {
          const d = chip.getAttribute('data-date');
          if (!d) return;
          dateEl.value = d;
      syncDateText();
      await loadAvailability();
          wrap.querySelectorAll('.day-chip').forEach(x => x.classList.remove('selected'));
          chip.classList.add('selected');
        });
      });

      return;
    }
  }

  // ===== phần render chip y như bạn đang có =====
  // If selected is full -> jump to next available
  const selectedObj = days.find(x => x.date === selected);
  if (selectedObj && selectedObj.isFull) {
    const nextAvailDay = days.find(x => !x.isFull);
    if (nextAvailDay) {
      dateEl.value = nextAvailDay.date;
      selected = nextAvailDay.date;
    }
  }

  wrap.innerHTML = days.map(d => {
    const full = d.isFull ? 'full' : '';
    const selCls = d.date === selected ? 'selected' : '';
    const line3 = d.isFull ? 'Hết chỗ' : `${d.availableSlots} khung giờ`;
    return `
      <div class="day-chip ${full} ${selCls}" data-date="${d.date}">
        <div class="d1">${weekdayShort(d.date)} • ${ddmmyyyy(d.date)}</div>
        <div class="d2">${d.isFull ? 'Đã đầy' : 'Còn trống'}</div>
        <div class="d3"><span class="day-dot"></span><span>${escapeHtml(line3)}</span></div>
      </div>
    `;
  }).join('');

  wrap.querySelectorAll('.day-chip').forEach(chip => {
    chip.addEventListener('click', async () => {
      const d = chip.getAttribute('data-date');
      if (!d) return;
      dateEl.value = d;
      syncDateText();
      await loadAvailability();
      wrap.querySelectorAll('.day-chip').forEach(x => x.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });
}


async function loadServicesIntoSelect() {
  const sel = document.getElementById('bkService');
  if (!sel) return;

  sel.innerHTML = `<option>Đang tải...</option>`;
  const { res, data } = await apiFetch('/services', { method: 'GET', headers: {} });
  if (!res.ok) {
    sel.innerHTML = `<option value="">Không tải được dịch vụ</option>`;
    toast('bad', 'Lỗi', 'Không tải được danh sách dịch vụ.');
    return;
  }

  const services = Array.isArray(data) ? data : [];
  sel.innerHTML = services
    .map(s => `<option value="${Number(s.id)}">${escapeHtml(s.name)} — ${formatVND(s.price)}</option>`)
    .join('');

  const chosenRaw = localStorage.getItem('booking_service');
  if (chosenRaw) {
    try {
      const chosen = JSON.parse(chosenRaw);
      const id = Number(chosen?.id);
      if (id) sel.value = String(id);
    } catch (e) {}
  }
}

async function loadAvailability() {
  const dateEl = document.getElementById('bkDate');
  const timeEl = document.getElementById('bkTime');
  const note = document.getElementById('bkAvailabilityNote');
  if (!dateEl || !timeEl) return;

  const serviceId = getSelectedServiceId();
  const date = String(dateEl.value || '').slice(0,10);
  if (!serviceId || !date) return;

  const { res, data } = await apiFetch(
    `/bookings/availability?serviceId=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(date)}`,
    { method: 'GET' }
  );

  if (!res.ok) {
    const opts = buildTimeOptions();
    timeEl.innerHTML = opts.map(t => `<option value="${t}">${t}</option>`).join('');
    if (note) note.innerHTML = `<span class="muted">Không tải được lịch trống • Bạn vẫn có thể thử đặt, hệ thống sẽ kiểm tra trùng lịch.</span>`;
    return;
  }

  const slots = Array.isArray(data?.slots) ? data.slots : [];
  const capacity = Number(data?.capacity || 1);

  timeEl.innerHTML = slots.map(s => {
    const disabled = !s.available ? 'disabled' : '';
    const label = s.available ? `${s.time} (còn ${s.remaining})` : `${s.time} (đã đầy)`;
    return `<option value="${s.time}" ${disabled}>${label}</option>`;
  }).join('');

  const current = String(timeEl.value || '').slice(0,5);
  const currentSlot = slots.find(x => x.time === current);
  if (!currentSlot || !currentSlot.available) {
    const firstAvail = slots.find(x => x.available);
    if (firstAvail) timeEl.value = firstAvail.time;
  }

  if (note) {
    note.innerHTML = `<span class="muted">Sức chứa mỗi khung giờ: <b>${capacity}</b> • Các khung giờ đã đầy sẽ bị khóa.</span>`;
  }
}

function initDateAndTime() {
  const dateEl = document.getElementById('bkDate');
  const timeEl = document.getElementById('bkTime');

  if (dateEl) {
    const today = new Date();
    const todayISO = toISODateInput(today);
    dateEl.min = todayISO;
    dateEl.value = todayISO;
    syncDateText();
  }

  if (timeEl) {
    const opts = buildTimeOptions();
    timeEl.innerHTML = opts.map(t => `<option value="${t}">${t}</option>`).join('');
    timeEl.value = '10:00';
  }
}

async function loadMyBookings() {
  const tbody = document.getElementById('myBookingsBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7"><div class="skeleton" style="height:60px"></div></td></tr>`;
  const { res, data } = await apiFetch('/bookings/my', { method: 'GET' });
  if (!res.ok) {
    tbody.innerHTML = '';
    toast('bad', 'Lỗi', 'Không tải được lịch hẹn.');
    return;
  }

  const list = Array.isArray(data) ? data : [];
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Chưa có lịch hẹn nào.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  list.forEach(b => {
    // ✅ NO Date() to avoid timezone shift
    const isoDate = b.booking_date ? String(b.booking_date).slice(0,10) : '';
    const date = ddmmyyyy(isoDate) || isoDate;

    const time = formatTimeHHMM(b.booking_time);
    const when = `${date} ${time}`.trim();

    const st = String(b.status || '').toLowerCase();
    const canCancel = ['pending', 'confirmed'].includes(st);
    const canPay = ['pending', 'confirmed'].includes(st);

    // ✅ Khi đã thanh toán: hiển thị nút "Xem" để mở hóa đơn
    const paySt = String(b.payment_status || '').toLowerCase();
    const payRef = b.payment_ref ? String(b.payment_ref) : '';
    const canView = (['paid','completed'].includes(st) || paySt === 'paid') && payRef;
    const viewBtn = canView
      ? `<a class="btn ghost js-view" href="/user/payment-result.html?ref=${encodeURIComponent(payRef)}&provider=${encodeURIComponent(b.payment_provider || 'vnpay')}">Xem</a>`
      : '';

    const qty = Math.max(1, Number(b.quantity || 1));

    const note = [b.note, b.admin_note].filter(Boolean).map(x => escapeHtml(x)).join('<br>');

    tbody.innerHTML += `
      <tr>
        <td>#${Number(b.id)}</td>
        <td>${escapeHtml(b.service_name || '')}</td>
        <td><b>${escapeHtml(when)}</b></td>
        <td><span class="qty-circle">${qty}</span></td>
        <td>${statusBadge(b.status)}</td>
        <td class="small">${note || '<span class="muted">—</span>'}</td>
        <td>
          <div class="cell-actions">
            ${canPay ? `<button class="btn primary js-pay" data-id="${Number(b.id)}">Thanh toán</button>` : ''}
            ${canCancel ? `<button class="btn danger js-cancel" data-id="${Number(b.id)}">Hủy</button>` : ''}
            ${viewBtn}
          </div>
        </td>
      </tr>
    `;
  });

  tbody.querySelectorAll('.js-cancel').forEach(btn => {
    btn.addEventListener('click', () => cancelBooking(btn.dataset.id));
  });

  tbody.querySelectorAll('.js-pay').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      localStorage.setItem('booking_pay_id', String(id));
      window.location.href = `/user/payment.html?bookingId=${encodeURIComponent(id)}`;
    });
  });
}

async function submitBooking() {
  const serviceId = getSelectedServiceId();
  const date = String(document.getElementById('bkDate')?.value || '').slice(0, 10);
  const timeRaw = String(document.getElementById('bkTime')?.value || '');
  const time = timeRaw.match(/(\d{2}:\d{2})/)?.[1] || timeRaw.slice(0, 5);
  const note = document.getElementById('bkNote')?.value?.trim() || '';

  if (!serviceId) {
    toast('warn', 'Thiếu thông tin', 'Vui lòng chọn dịch vụ.');
    return;
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !time) {
    toast('warn', 'Thiếu thông tin', 'Vui lòng chọn ngày và giờ hợp lệ.');
    return;
  }

  // ✅ Send both styles to be compatible with backend versions
  const payload = {
    serviceId: Number(serviceId),
    date,                   // original expected
    time,                   // original expected
    booking_date: date,     // new / tolerant
    booking_time: time,     // new / tolerant
    note
  };

  const { res, data } = await apiFetch('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (res.status === 409) {
    toast('warn', 'Trùng lịch', (data && data.message) ? data.message : 'Khung giờ này đã có người đặt.');
    return;
  }
  if (!res.ok) {
    toast('bad', 'Không thể đặt lịch', (data && data.message) ? data.message : 'Vui lòng thử lại.');
    return;
  }

  toast('good', 'Thành công', 'Đã tạo lịch hẹn. Vui lòng chờ admin xác nhận.');
  const noteEl = document.getElementById('bkNote');
  if (noteEl) noteEl.value = '';

  await loadMyBookings();
  await loadAvailability();

  // ✅ reload chips to reflect selected day + remaining slots
  await loadAvailabilityCalendar();
}

async function cancelBooking(id) {
  if (!confirm('Hủy lịch hẹn này?')) return;
  const { res, data } = await apiFetch(`/bookings/${id}/cancel`, { method: 'PATCH' });
  if (!res.ok) {
    toast('bad', 'Không thể hủy', (data && data.message) ? data.message : 'Vui lòng thử lại.');
    return;
  }
  toast('good', 'Đã hủy', 'Lịch hẹn đã được hủy.');
  await loadMyBookings();
  await loadAvailability();
  await loadAvailabilityCalendar();
}

function resetForm() {
  initDateAndTime();
  const noteEl = document.getElementById('bkNote');
  if (noteEl) noteEl.value = '';
}

document.addEventListener('DOMContentLoaded', async () => {
  initDateAndTime();
  await loadServicesIntoSelect();

  await loadAvailability();
  await loadAvailabilityCalendar();
  await loadMyBookings();

  
  // ✅ mở date picker khi bấm vào ô dd/mm/yyyy
  document.getElementById('bkDateText')?.addEventListener('click', () => {
    const d = document.getElementById('bkDate');
    if (!d) return;
    if (typeof d.showPicker === 'function') d.showPicker();
    else d.focus();
  });
document.getElementById('bkSubmit')?.addEventListener('click', submitBooking);
  document.getElementById('bkReset')?.addEventListener('click', resetForm);

  document.getElementById('bkService')?.addEventListener('change', async ()=> {
    await loadAvailability();
    await loadAvailabilityCalendar();
  });

  // ✅ Key change: changing date should reload chips too
  document.getElementById('bkDate')?.addEventListener('change', async ()=> {
    syncDateText();
    await loadAvailability();
    await loadAvailabilityCalendar();
  });
});
