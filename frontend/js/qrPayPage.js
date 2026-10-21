function qrAmountValue(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount) : 0;
}

function qrTransferContent(ref) {
  return `BC ${ref || 'DEMO'}`.trim();
}

function qrMoney(value) {
  const amount = qrAmountValue(value);
  return amount ? `${amount.toLocaleString('vi-VN')} ₫` : '-';
}

function qrConfirmUrl(ref, amount) {
  const base = window.FRONTEND_URL || window.location.origin;
  const url = new URL(`${base.replace(/\/+$/, '')}/user/qr-confirm.html`);
  if (ref) url.searchParams.set('ref', ref);
  if (amount) url.searchParams.set('amount', String(qrAmountValue(amount)));
  return url.toString();
}

function buildQrPayload(ref, amount) {
  return qrConfirmUrl(ref, amount);
}

function renderQrCode(ref, amount) {
  const box = document.getElementById('qrBox');
  if (!box) return;

  const payload = buildQrPayload(ref, amount);

  if (typeof qrcode !== 'function') {
    box.innerHTML = `
      <div class="qr-pay-loading">
        <div style="font-weight:700">Không tạo được mã QR</div>
        <div class="small muted" style="margin-top:6px">${escapeHtml(payload)}</div>
      </div>
    `;
    return;
  }

  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();

  const svg = qr
    .createSvgTag(7, 3)
    .replace('<svg ', '<svg class="qr-pay-svg" role="img" aria-label="Mã QR thanh toán BeautyCare" ');

  box.innerHTML = `
    <div class="qr-pay-code">${svg}</div>
  `;
  box.dataset.qrPayload = payload;
}

document.addEventListener('DOMContentLoaded', () => {
  const query = new URLSearchParams(window.location.search);
  const ref = query.get('ref') || '';
  const amount = query.get('amount') || '';

  const refEl = document.getElementById('ref');
  const ref2El = document.getElementById('ref2');
  const amountEl = document.getElementById('amt');
  const resultBtn = document.getElementById('resultBtn');

  if (refEl) refEl.textContent = ref || '-';
  if (ref2El) ref2El.textContent = ref || '-';
  if (amountEl) amountEl.textContent = qrMoney(amount);
  if (resultBtn) resultBtn.href = `payment-result.html?ref=${encodeURIComponent(ref)}&provider=qr`;

  renderQrCode(ref, amount);
});
