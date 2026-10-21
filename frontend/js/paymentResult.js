function qs(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function badgeForStatus(stRaw){
  const s = String(stRaw||'').toLowerCase();
  if(s === 'paid') return { text: 'Đã thanh toán', cls: 'badge good' };
  if(s === 'pending' || s === 'created') return { text: 'Đang xử lý', cls: 'badge warn' };
  if(s === 'failed') return { text: 'Thất bại', cls: 'badge bad' };
  if(s === 'cancelled') return { text: 'Đã hủy', cls: 'badge warn' };
  return { text: s ? `Trạng thái: ${s}` : '—', cls: 'badge' };
}

function setText(id, val){
  const el = document.getElementById(id);
  if(el) el.textContent = val;
}

function setHTML(id, val){
  const el = document.getElementById(id);
  if(el) el.innerHTML = val;
}

function fmtBooking(booking){
  if(!booking) return '';
  const d = booking.date ? String(booking.date).slice(0,10) : '';
  const t = booking.time ? String(booking.time).match(/(\d{2}:\d{2})/)?.[1] : '';
  if(!d && !t) return '';
  const when = [d, t].filter(Boolean).join(' ');
  return when ? `Lịch hẹn: <b>${escapeHtml(when)}</b>` : '';
}

function moneyRows(detail){
  // Checkout: ưu tiên order breakdown
  if(detail?.order){
    const op = Number(detail.order.original_price || 0);
    const dc = Number(detail.order.discount || 0);
    const fp = Number(detail.order.final_price || 0);
    const vc = detail.order.voucher_code ? `<span class="badge primary">${escapeHtml(detail.order.voucher_code)}</span>` : `<span class="badge">—</span>`;
    return `
      <tr><td class="muted">Giá gốc</td><td style="text-align:right">${formatVND(op)}</td></tr>
      <tr><td class="muted">Giảm</td><td style="text-align:right">-${formatVND(dc)}</td></tr>
      <tr><td class="muted">Voucher</td><td style="text-align:right">${vc}</td></tr>
      <tr><td><b>Tổng thanh toán</b></td><td style="text-align:right"><b>${formatVND(fp)}</b></td></tr>
    `;
  }

  if(String(detail?.purpose || '').toLowerCase() === 'subscription_change'){
    return `
      <tr><td class="muted">Khoản thu</td><td style="text-align:right">Phần chênh lệch đổi gói</td></tr>
      <tr><td><b>Tổng thanh toán</b></td><td style="text-align:right"><b>${formatVND(Number(detail?.amount || 0))}</b></td></tr>
    `;
  }

  // Subscription: fallback
  if(detail?.plan){
    const price = Number(detail.plan.price || detail.amount || 0);
    return `
      <tr><td class="muted">Gói thành viên</td><td style="text-align:right">${escapeHtml(detail.plan.tier || '')}</td></tr>
      <tr><td><b>Tổng thanh toán</b></td><td style="text-align:right"><b>${formatVND(price)}</b></td></tr>
    `;
  }

  // Generic
  return `
    <tr><td class="muted">Số tiền</td><td style="text-align:right"><b>${formatVND(Number(detail?.amount || 0))}</b></td></tr>
  `;
}

async function fetchDetail(ref){
  const { res, data } = await apiFetch(`/payments/detail/${encodeURIComponent(ref)}`, { method:'GET' });
  if(!res.ok) return null;
  return data;
}

async function refresh(ref){
  const server = document.getElementById('serverStatus');
  const help = document.getElementById('payHelp');

  setText('invRef', ref);

  const detail = await fetchDetail(ref);
  if(!detail){
    if(server) server.textContent = 'Không lấy được chi tiết hóa đơn từ server.';
    if(help) help.textContent = 'Nếu bạn vừa hoàn tất thanh toán, hãy đợi vài giây rồi tải lại trang.';
    return null;
  }

  // Status badge
  const b = badgeForStatus(detail.status);
  const stEl = document.getElementById('invStatus');
  if(stEl){
    stEl.className = b.cls;
    stEl.textContent = b.text;
  }

  // Date
  const date = detail.paid_at || detail.created_at;
  setText('invDate', date ? formatDateTime(date) : '—');

  // Title
  let title = 'Thanh toán';
  let sub = '';
  if(String(detail.purpose||'').toLowerCase() === 'checkout'){
    title = detail.service?.name ? `Dịch vụ: ${detail.service.name}` : 'Thanh toán dịch vụ';
    const bk = fmtBooking(detail.booking);
    const dur = detail.service?.duration_min ? `Thời lượng: <b>${Number(detail.service.duration_min)} phút</b>` : '';
    sub = [bk, dur].filter(Boolean).join('<br>') || '—';
  } else if(String(detail.purpose||'').toLowerCase() === 'subscription'){
    title = detail.plan?.name ? `Gói thành viên: ${detail.plan.name}` : 'Thanh toán gói thành viên';
    const tier = detail.plan?.tier ? `Hạng: <b>${escapeHtml(detail.plan.tier)}</b>` : '';
    const days = detail.plan?.duration_days ? `Thời hạn: <b>${Number(detail.plan.duration_days)} ngày</b>` : '';
    sub = [tier, days].filter(Boolean).join('<br>') || '—';
  } else if(String(detail.purpose||'').toLowerCase() === 'subscription_change'){
    title = detail.plan?.name ? `Đổi gói thành viên: ${detail.plan.name}` : 'Đổi gói thành viên';
    const tier = detail.plan?.tier ? `Gói mới: <b>${escapeHtml(detail.plan.tier)}</b>` : '';
    const diff = `Thanh toán thêm: <b>${formatVND(Number(detail.amount || 0))}</b>`;
    sub = [tier, diff].filter(Boolean).join('<br>') || '—';
  }
  setText('invTitle', title);
  setHTML('invSub', sub);

  // Provider
  setText('invProvider', String(detail.provider || '').toUpperCase());

  // Money breakdown
  setHTML('invMoney', moneyRows(detail));

  // Server status (compact)
  if(server){
    server.innerHTML = `
      Provider: <b>${escapeHtml(detail.provider)}</b><br/>
      Mục đích: <b>${escapeHtml(detail.purpose)}</b><br/>
      Trạng thái: <b>${escapeHtml(detail.status)}</b>
    `;
  }

  // Help text + cleanup
  const st = String(detail.status || '').toLowerCase();
  if(help){
    if(st === 'paid'){
      help.textContent = 'Đã ghi nhận thanh toán. Bạn có thể in hóa đơn hoặc xem lịch sử giao dịch.';
      if(String(detail.purpose||'').toLowerCase() === 'checkout'){
        localStorage.removeItem('service');
        localStorage.removeItem('booking_pay_id');
        localStorage.removeItem('booking_service');
      }
      if(['subscription', 'subscription_change'].includes(String(detail.purpose || '').toLowerCase())){
        const meRs = await apiFetch('/auth/me', { method:'GET' });
        if(meRs.res?.ok && meRs.data){
          localStorage.setItem('user', JSON.stringify(meRs.data));
          renderTopbarUser?.();
        }
      }
    } else if(st === 'pending' || st === 'created'){
      help.textContent = 'Hệ thống đang chờ xác nhận. Trang sẽ tự cập nhật.';
    } else {
      help.textContent = 'Nếu bạn bị trừ tiền nhưng hệ thống chưa ghi nhận, hãy liên hệ quản trị viên.';
    }
  }

  return st;
}

document.addEventListener('DOMContentLoaded', async ()=>{
  const ref = qs('ref');
  if(!ref){
    toast('warn','Thiếu mã giao dịch','Không tìm thấy ref trong URL.');
    return;
  }

  document.getElementById('btnPrint')?.addEventListener('click', ()=> window.print());

  // Poll up to ~30 seconds for pending/created
  let tries = 0;
  const timer = setInterval(async ()=>{
    tries++;
    const st = await refresh(ref);
    if(st && !['pending','created'].includes(st)){
      clearInterval(timer);
    }
    if(tries >= 15) clearInterval(timer);
  }, 2000);

  await refresh(ref);
});
