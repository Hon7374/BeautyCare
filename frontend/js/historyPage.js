let _tx = [];
let _visibleTx = [];
let _selectedTx = null;
let _selectedInvoiceHtml = '';

function txStatusText(stRaw) {
  const s = String(stRaw || '').toLowerCase();
  if (s === 'paid') return 'Đã thanh toán';
  if (s === 'pending' || s === 'created') return 'Đang xử lý';
  if (s === 'failed') return 'Thất bại';
  if (s === 'cancelled') return 'Đã hủy';
  return s || '—';
}

function txStatusBadge(stRaw) {
  const s = String(stRaw || '').toLowerCase();
  if (s === 'paid') return `<span class="badge good">Đã thanh toán</span>`;
  if (s === 'pending' || s === 'created') return `<span class="badge warn">Đang xử lý</span>`;
  if (s === 'failed' || s === 'cancelled') return `<span class="badge bad">${txStatusText(s)}</span>`;
  return `<span class="badge">—</span>`;
}

function providerLabel(value) {
  const key = String(value || '').toLowerCase();
  const map = {
    vnpay: 'VNPay',
    momo: 'MoMo',
    stripe: 'Stripe',
    paypal: 'PayPal',
    qr: 'QR / Chuyển khoản',
    cash: 'Tiền mặt',
    legacy: 'Giao dịch cũ'
  };
  return map[key] || (value ? String(value).toUpperCase() : '—');
}

function purposeLabel(value) {
  const key = String(value || '').toLowerCase();
  if (key === 'checkout') return 'Thanh toán dịch vụ';
  if (key === 'subscription') return 'Thanh toán thành viên';
  if (key === 'subscription_change') return 'Đổi gói thành viên';
  if (key === 'booking') return 'Thanh toán lịch hẹn';
  if (key === 'legacy') return 'Giao dịch cũ';
  return value || 'Thanh toán';
}

function formatBookingDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('vi-VN');
  return String(value).slice(0, 10);
}

function formatBookingTime(value) {
  if (!value) return '';
  return String(value).match(/(\d{2}:\d{2})/)?.[1] || String(value);
}

function txTitle(tx) {
  if (tx.service_name) return `Dịch vụ: ${tx.service_name}`;
  if (String(tx.purpose || '').toLowerCase() === 'subscription_change' && tx.plan_name) {
    return `Đổi gói thành viên: ${tx.plan_name}`;
  }
  if (tx.plan_name) return `Gói thành viên: ${tx.plan_name}`;
  if (String(tx.voucher_code || '').toUpperCase().startsWith('SUBSCRIPTION:')) return 'Gói thành viên BeautyCare';
  if (String(tx.purpose || '').toLowerCase() === 'subscription') return 'Gói thành viên BeautyCare';
  return purposeLabel(tx.purpose);
}

function txSubTitle(tx) {
  const rows = [];
  if (tx.service_name && tx.duration_min) rows.push(`Thời lượng: ${Number(tx.duration_min)} phút`);
  if (tx.booking_id) {
    const when = [formatBookingDate(tx.booking_date), formatBookingTime(tx.booking_time)].filter(Boolean).join(' ');
    rows.push(`Lịch hẹn #${tx.booking_id}${when ? ` - ${when}` : ''}`);
  }
  if (tx.plan_tier) rows.push(`Hạng thành viên: ${tx.plan_tier}`);
  if (tx.duration_days) rows.push(`Thời hạn: ${Number(tx.duration_days)} ngày`);
  if (String(tx.purpose || '').toLowerCase() === 'subscription_change') {
    rows.push(`Khoản thu: <b>Phần chênh lệch đổi gói</b>`);
  }
  return rows.length ? rows.join('<br>') : '—';
}

function receiptNumber(tx) {
  return tx.provider_ref || tx.ref || (tx.transaction_id ? `LEGACY-${tx.transaction_id}` : '—');
}

function moneyRows(tx) {
  if (String(tx.purpose || '').toLowerCase() === 'subscription_change') {
    return `
      <tr><td class="muted">Khoản thu</td><td style="text-align:right">Phần chênh lệch đổi gói</td></tr>
      <tr><td><b>Tổng thanh toán</b></td><td style="text-align:right"><b>${formatVND(tx.final_price || tx.amount)}</b></td></tr>
    `;
  }

  const voucher = tx.voucher_code
    ? `<span class="badge primary">${escapeHtml(tx.voucher_code)}</span>`
    : `<span class="badge">—</span>`;

  return `
    <tr><td class="muted">Giá gốc</td><td style="text-align:right">${formatVND(tx.original_price)}</td></tr>
    <tr><td class="muted">Giảm</td><td style="text-align:right">-${formatVND(tx.discount)}</td></tr>
    <tr><td class="muted">Voucher</td><td style="text-align:right">${voucher}</td></tr>
    <tr><td><b>Tổng thanh toán</b></td><td style="text-align:right"><b>${formatVND(tx.final_price || tx.amount)}</b></td></tr>
  `;
}

function invoiceHtml(tx) {
  const user = getUser?.() || {};
  const ref = receiptNumber(tx);
  const created = tx.paid_at || tx.created_at;
  const subtotal = Number(tx.original_price || tx.amount || 0);
  const discount = Number(tx.discount || 0);
  const total = Number(tx.final_price || tx.amount || 0);

  return `
    <div class="invoice-brandline">
      <div>
        <div class="invoice-logo">BeautyCare</div>
        <div class="small muted">Hóa đơn thanh toán dịch vụ làm đẹp</div>
      </div>
      <div>${txStatusBadge(tx.status)}</div>
    </div>

    <div class="invoice-meta-grid">
      <div>
        <div class="label">Mã hóa đơn</div>
        <b>${escapeHtml(ref)}</b>
      </div>
      <div>
        <div class="label">Thời gian</div>
        <b>${escapeHtml(created ? formatDateTime(created) : '—')}</b>
      </div>
      <div>
        <div class="label">Khách hàng</div>
        <b>${escapeHtml(user.name || user.email || 'Khách hàng BeautyCare')}</b>
        ${user.email ? `<div class="small muted">${escapeHtml(user.email)}</div>` : ''}
      </div>
      <div>
        <div class="label">Phương thức</div>
        <b>${escapeHtml(providerLabel(tx.provider))}</b>
      </div>
    </div>

    <hr class="sep"/>

    <div class="invoice-section">
      <div class="label">Nội dung giao dịch</div>
      <h3>${escapeHtml(txTitle(tx))}</h3>
      <div class="small muted">${txSubTitle(tx)}</div>
      <div class="small muted" style="margin-top:8px">Loại: <b>${escapeHtml(purposeLabel(tx.purpose))}</b></div>
    </div>

    <hr class="sep"/>

    <table class="invoice-money">
      <tbody>
        ${moneyRows({ ...tx, original_price: subtotal, discount, final_price: total })}
      </tbody>
    </table>

    <div class="invoice-note">
      Cảm ơn bạn đã sử dụng dịch vụ tại BeautyCare. Vui lòng giữ hóa đơn này để đối chiếu khi cần hỗ trợ.
    </div>
  `;
}

function invoiceDocument(html, title = 'Hoa don BeautyCare') {
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>
    body{font-family:Poppins,Arial,sans-serif;margin:0;background:#fff7fa;color:#2f2530}
    .wrap{max-width:760px;margin:28px auto;padding:26px;background:#fff;border:1px solid #efd5de;border-radius:18px}
    .invoice-brandline{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
    .invoice-logo{font-size:26px;font-weight:800}
    .muted{color:#796775}.small{font-size:12px}.label{font-size:11px;color:#9a7d8a;text-transform:uppercase;font-weight:700}
    .badge{display:inline-flex;padding:7px 11px;border-radius:999px;background:#fff1f5;color:#7f4056;font-size:12px}
    .good{background:#e7f4ef;color:#316657}.warn{background:#fff2dd;color:#98651e}.bad{background:#ffe7ea;color:#a13e4b}
    .invoice-meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:22px}
    .sep{border:0;border-top:1px solid #f0d9e1;margin:20px 0}
    h3{margin:6px 0 4px}.invoice-money{width:100%;border-collapse:collapse}.invoice-money td{padding:10px 0;border-bottom:1px solid #f6e8ed}
    .invoice-note{margin-top:18px;padding:13px;border-radius:14px;background:#fff7fa;color:#796775;font-size:13px}
    @media print{body{background:#fff}.wrap{margin:0;border:0;border-radius:0}.no-print{display:none!important}}
  </style>
</head>
<body><div class="wrap">${html}</div></body>
</html>`;
}

async function fetchPaymentDetail(tx) {
  if (!tx.provider_ref) return tx;
  const { res, data } = await apiFetch(`/payments/detail/${encodeURIComponent(tx.provider_ref)}`, { method: 'GET' });
  if (!res.ok || !data) return tx;

  return {
    ...tx,
    provider: data.provider || tx.provider,
    purpose: data.purpose || tx.purpose,
    status: data.status || tx.status,
    created_at: data.created_at || tx.created_at,
    paid_at: data.paid_at || tx.paid_at,
    amount: data.amount ?? tx.amount,
    currency: data.currency || tx.currency,
    original_price: data.order?.original_price ?? data.plan?.price ?? tx.original_price,
    discount: data.order?.discount ?? tx.discount,
    final_price: data.order?.final_price ?? data.amount ?? tx.final_price,
    voucher_code: data.order?.voucher_code ?? tx.voucher_code,
    service_id: data.service?.id ?? tx.service_id,
    service_name: data.service?.name ?? tx.service_name,
    duration_min: data.service?.duration_min ?? tx.duration_min,
    booking_id: data.booking?.id ?? tx.booking_id,
    booking_date: data.booking?.date ?? tx.booking_date,
    booking_time: data.booking?.time ?? tx.booking_time,
    booking_status: data.booking?.status ?? tx.booking_status,
    plan_name: data.plan?.name ?? tx.plan_name,
    plan_tier: data.plan?.tier ?? tx.plan_tier,
    duration_days: data.plan?.duration_days ?? tx.duration_days
  };
}

function render(list) {
  const body = document.getElementById('txBody');
  const empty = document.getElementById('emptyState');
  if (!body) return;

  _visibleTx = list;
  body.innerHTML = '';
  if (!list.length) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  list.forEach((t, index) => {
    const when = formatDateTime(t.created_at);
    const voucher = t.voucher_code ? `<span class="badge primary">${escapeHtml(t.voucher_code)}</span>` : `<span class="badge">—</span>`;
    body.innerHTML += `
      <tr>
        <td>
          ${escapeHtml(when)}
          <div class="small muted">${escapeHtml(providerLabel(t.provider))}</div>
        </td>
        <td>${formatVND(t.original_price)}</td>
        <td>-${formatVND(t.discount)}</td>
        <td>${voucher}</td>
        <td><b>${formatVND(t.final_price || t.amount)}</b></td>
        <td>${txStatusBadge(t.status)}</td>
        <td><button class="btn ghost js-view-tx" type="button" data-index="${index}">Chi tiết</button></td>
      </tr>
    `;
  });
}

function applyFilter() {
  const f = document.getElementById('filter')?.value || 'all';
  let list = [..._tx];
  if (f === '7d') {
    const since = Date.now() - 7 * 24 * 3600 * 1000;
    list = list.filter((x) => new Date(x.created_at).getTime() >= since);
  } else if (f === '30d') {
    const since = Date.now() - 30 * 24 * 3600 * 1000;
    list = list.filter((x) => new Date(x.created_at).getTime() >= since);
  }
  render(list);
}

async function openTransactionDetail(index) {
  const base = _visibleTx[Number(index)];
  if (!base) return;

  const box = document.getElementById('invoiceDetail');
  if (box) box.innerHTML = '<div class="skeleton" style="height:260px"></div>';
  openModal('txDetailModal');

  _selectedTx = await fetchPaymentDetail(base);
  _selectedInvoiceHtml = invoiceHtml(_selectedTx);
  if (box) box.innerHTML = _selectedInvoiceHtml;
}

function printSelectedInvoice() {
  if (!_selectedInvoiceHtml) return;
  const ref = receiptNumber(_selectedTx || {});
  const win = window.open('', '_blank', 'width=920,height=760');
  if (!win) {
    toast('warn', 'Không mở được cửa sổ in', 'Trình duyệt đang chặn popup in hóa đơn.');
    return;
  }
  win.document.open();
  win.document.write(invoiceDocument(_selectedInvoiceHtml, `Hoa don ${ref}`));
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 250);
}

function exportSelectedInvoice() {
  if (!_selectedInvoiceHtml) return;
  const ref = receiptNumber(_selectedTx || {}).replace(/[^a-z0-9_-]+/gi, '-');
  const blob = new Blob([invoiceDocument(_selectedInvoiceHtml, `Hoa don ${ref}`)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `beautycare-invoice-${ref || 'transaction'}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function load() {
  const body = document.getElementById('txBody');
  if (body) {
    body.innerHTML = `<tr><td colspan="7"><div class="skeleton" style="height:80px"></div></td></tr>`;
  }

  const { res, data } = await apiFetch('/transactions/my', { method: 'GET' });
  if (!res.ok) {
    toast('bad', 'Không tải được lịch sử', 'Vui lòng thử lại.');
    if (body) body.innerHTML = '';
    return;
  }
  _tx = Array.isArray(data) ? data : [];
  applyFilter();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('filter')?.addEventListener('change', applyFilter);
  document.getElementById('btnPrintInvoice')?.addEventListener('click', printSelectedInvoice);
  document.getElementById('btnExportInvoice')?.addEventListener('click', exportSelectedInvoice);

  document.addEventListener('click', (event) => {
    const btn = event.target?.closest?.('.js-view-tx');
    if (!btn) return;
    openTransactionDetail(btn.dataset.index);
  });

  load();
});
