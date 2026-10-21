let _service = null;
let _preview = null;
let _booking = null;
let _bookingId = null;

function memberLabel(member){
  const m = String(member||'').toLowerCase();
  if(m==='premium') return { text:'Premium', badge:'good', rate:20 };
  if(m==='gold') return { text:'Vàng', badge:'primary', rate:10 };
  return { text:'Bạc', badge:'warn', rate:5 };
}

function renderPreview(p){
  const info = document.getElementById('serviceInfo');
  const bill = document.getElementById('bill');
  if(!info || !bill) return;

  const ml = memberLabel(p.user?.member);
  const bookingLine = _booking
    ? `Lịch hẹn #${escapeHtml(_booking.id)} • ${escapeHtml(_booking.when)} • Trạng thái: ${escapeHtml(_booking.statusText)}`
    : 'Dịch vụ đã chọn';

  info.innerHTML = `
    <div class="card-header">
      <div>
        <div class="card-title">${escapeHtml(p.service?.name || '')}</div>
        <div class="card-subtitle">${bookingLine} • ID #${escapeHtml(p.service?.id)}</div>
      </div>
      <span class="badge primary">${formatVND(p.originalPrice)}</span>
    </div>
    <div class="hero-meta">
      <span class="badge ${ml.badge}">Hạng: ${ml.text}</span>
      ${
        p.voucherCode
          ? `<span class="badge primary">Voucher: ${escapeHtml(p.voucherCode)} (${Math.round(p.voucherRate*100)}%)</span>`
          : `<span class="badge">Voucher: chưa áp dụng</span>`
      }
    </div>
  `;

  bill.innerHTML = `
    <div class="grid grid-2">
      <div class="card soft">
        <div class="small">Giá gốc</div>
        <div style="font-size:20px;font-weight:700">${formatVND(p.originalPrice)}</div>
      </div>
      <div class="card soft">
        <div class="small">Giảm giá</div>
        <div style="font-size:20px;font-weight:700">-${formatVND(p.discountAmount)}</div>
        <div class="small">Hạng: ${Math.round(p.memberRate*100)}% • Voucher: ${Math.round(p.voucherRate*100)}%</div>
      </div>
    </div>
    <hr class="sep"/>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
      <div>
        <div class="small">Tổng thanh toán</div>
        <div style="font-size:28px;font-weight:800">${formatVND(p.finalPrice)}</div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn ghost" id="btnResetVoucher">Bỏ voucher</button>
        ${_booking ? '' : '<button class="btn primary" id="btnPay">Thanh toán</button>'}
        <button class="btn primary" id="btnPayOnline">Thanh toán online</button>
      </div>
    </div>
  `;
}

async function preview(){
  const voucherCode = (document.getElementById('voucherCode')?.value || '').trim();

  if(!_service){
    window.location.href = 'services.html';
    return;
  }

  const { res, data } = await apiFetch('/payment/preview', {
    method:'POST',
    body: JSON.stringify({ serviceId: _service.id, voucherCode })
  });

  if(!res.ok){
    toast('bad','Không thể tính toán', (data && data.message) ? data.message : 'Vui lòng thử lại.');
    return;
  }

  _preview = data;
  renderPreview(data);
}

function resetVoucher(){
  const vc = document.getElementById('voucherCode');
  if(vc) vc.value = '';
  preview();
}

async function pay(){
  const voucherCode = (document.getElementById('voucherCode')?.value || '').trim();

  if(!_service){
    toast('warn','Chưa chọn dịch vụ','Vui lòng chọn dịch vụ trước.');
    window.location.href = 'services.html';
    return;
  }

  const btns = document.querySelectorAll('button');
  btns.forEach(b=>b.disabled=true);

  try{
    const { res, data } = await apiFetch('/payment', {
      method:'POST',
      body: JSON.stringify({ serviceId: _service.id, voucherCode })
    });

    if(!res.ok){
      toast('bad','Thanh toán thất bại', (data && data.message) ? data.message : 'Vui lòng thử lại.');
      return;
    }

    toast('good','Thanh toán thành công', `Bạn đã thanh toán ${formatVND(data.finalPrice)}.`);
    localStorage.removeItem('service');
    setTimeout(()=> window.location.href = 'history.html', 800);
  } finally {
    setTimeout(()=>btns.forEach(b=>b.disabled=false), 600);
  }
}

async function payOnline(){
  const voucherCode = (document.getElementById('voucherCode')?.value || '').trim();
  const provider = (document.getElementById('payProvider')?.value || 'vnpay').trim();

  if(!_service){
    toast('warn','Chưa chọn dịch vụ','Vui lòng chọn dịch vụ trước.');
    window.location.href = 'services.html';
    return;
  }

  const btns = document.querySelectorAll('button');
  btns.forEach(b=>b.disabled=true);

  try{
    const endpoint = _booking ? '/payments/booking-checkout' : '/payments/checkout';
    const payload = _booking
      ? { provider, bookingId: _bookingId, voucherCode, returnBase: window.FRONTEND_URL }
      : { provider, serviceId: _service.id, voucherCode, returnBase: window.FRONTEND_URL };

    const { res, data } = await apiFetch(endpoint, {
      method:'POST',
      body: JSON.stringify(payload)
    });

    if(!res.ok){
      toast('bad','Không thể tạo thanh toán online', (data && data.message) ? data.message : 'Vui lòng thử lại.');
      return;
    }

    if(data && data.redirectUrl){
      toast('good','Đang chuyển đến cổng thanh toán','Vui lòng hoàn tất thanh toán.');
      setTimeout(()=> window.location.href = data.redirectUrl, 400);
      return;
    }

    toast('warn','Thiếu redirectUrl','Không tạo được link thanh toán.');
  } finally {
    setTimeout(()=>btns.forEach(b=>b.disabled=false), 600);
  }
}

/**
 * ✅ FIX ĐƠ NÚT: Event delegation
 * Không cần bindPaymentButtons nữa, render innerHTML bao nhiêu lần vẫn bấm được.
 */
document.addEventListener('click', (e) => {
  if (e.target.closest('#btnResetVoucher')) {
    e.preventDefault();
    resetVoucher();
    return;
  }

  if (e.target.closest('#btnPay')) {
    e.preventDefault();
    pay();
    return;
  }

  if (e.target.closest('#btnPayOnline')) {
    e.preventDefault();
    payOnline();
    return;
  }

  if (e.target.closest('#applyVoucher')) {
    e.preventDefault();
    preview();
    return;
  }
});

document.addEventListener('DOMContentLoaded', ()=>{
  (async ()=>{
    const params = new URLSearchParams(window.location.search || '');
    const qId = params.get('bookingId') || localStorage.getItem('booking_pay_id');

    if (qId) {
      _bookingId = Number(qId);
      localStorage.removeItem('booking_pay_id');

      const { res, data } = await apiFetch(`/bookings/${encodeURIComponent(_bookingId)}`, { method: 'GET' });
      if (!res.ok) {
        toast('bad','Không tải được lịch hẹn','Vui lòng quay lại trang Lịch hẹn.');
        setTimeout(()=> window.location.href = 'booking.html', 700);
        return;
      }

      const date = data.booking_date ? String(data.booking_date).slice(0,10) : '';
      const time = String(data.booking_time||'').match(/(\d{2}:\d{2})/)?.[1] || String(data.booking_time||'').slice(0,5);
      const when = `${date} ${time}`.trim();

      const st = String(data.status||'').toLowerCase();
      const statusText =
        st==='paid' ? 'Đã thanh toán' :
        st==='confirmed' ? 'Đã xác nhận' :
        st==='cancelled' ? 'Đã hủy' :
        st==='completed' ? 'Hoàn thành' :
        'Chờ xác nhận';

      _booking = { id: data.id, when, status: st, statusText };
      _service = { id: data.service_id, name: data.service_name };
    } else {
      const raw = localStorage.getItem('service');
      _service = raw ? (()=>{ try{return JSON.parse(raw);}catch(e){return null;} })() : null;
    }

    if(!_service){
      toast('warn','Chưa chọn','Hãy chọn dịch vụ hoặc lịch hẹn trước khi thanh toán.');
      setTimeout(()=> window.location.href = 'services.html', 600);
      return;
    }

    // Không cần addEventListener applyVoucher ở đây nữa vì delegation đã lo
    preview();
  })();
});
