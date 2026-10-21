let _qrConfirm = {
  ref: '',
  amount: 0,
  status: 'created'
};

function qs(name) {
  return new URL(window.location.href).searchParams.get(name) || '';
}

function qrConfirmMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount > 0 ? `${Math.round(amount).toLocaleString('vi-VN')} ₫` : '-';
}

function qrConfirmContent(ref) {
  return `BC ${ref || ''}`.trim() || '-';
}

function qrStatusBadge(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'paid') return { cls: 'badge good', text: 'Đã thanh toán' };
  if (s === 'pending' || s === 'created') return { cls: 'badge warn', text: 'Chờ xác nhận' };
  if (s === 'failed') return { cls: 'badge bad', text: 'Thất bại' };
  if (s === 'cancelled') return { cls: 'badge bad', text: 'Đã hủy' };
  return { cls: 'badge', text: s || '—' };
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderQrConfirm(detail) {
  _qrConfirm = {
    ref: detail.ref || _qrConfirm.ref,
    amount: Number(detail.amount || _qrConfirm.amount || 0),
    status: detail.status || _qrConfirm.status,
    created_at: detail.created_at || ''
  };

  setText('confirmRef', _qrConfirm.ref || '-');
  setText('confirmAmount', qrConfirmMoney(_qrConfirm.amount));
  setText('confirmContent', detail.content || qrConfirmContent(_qrConfirm.ref));
  setText('confirmCreated', _qrConfirm.created_at ? formatDateTime(_qrConfirm.created_at) : '-');

  const badge = qrStatusBadge(_qrConfirm.status);
  const statusEl = document.getElementById('qrConfirmStatus');
  if (statusEl) {
    statusEl.className = badge.cls;
    statusEl.textContent = badge.text;
  }

  const resultLink = document.getElementById('confirmResultLink');
  if (resultLink && _qrConfirm.ref) {
    resultLink.href = `payment-result.html?ref=${encodeURIComponent(_qrConfirm.ref)}&provider=qr`;
  }

  const confirmBtn = document.getElementById('btnConfirmQrPayment');
  const msg = document.getElementById('confirmMessage');
  const status = String(_qrConfirm.status || '').toLowerCase();

  if (confirmBtn) {
    confirmBtn.disabled = !['pending', 'created'].includes(status);
    confirmBtn.textContent = status === 'paid' ? 'Đã thanh toán' : 'Xác nhận thanh toán';
  }

  if (msg) {
    if (status === 'paid') {
      msg.textContent = 'Giao dịch đã được ghi nhận thanh toán. Bạn có thể xem kết quả hoặc lịch sử giao dịch.';
      msg.classList.remove('muted');
    } else if (['pending', 'created'].includes(status)) {
      msg.textContent = 'Kiểm tra đúng mã giao dịch, số tiền và nội dung chuyển khoản trước khi xác nhận.';
      msg.classList.add('muted');
    } else {
      msg.textContent = 'Giao dịch không còn ở trạng thái có thể xác nhận.';
      msg.classList.remove('muted');
    }
  }
}

async function loadQrConfirm() {
  const ref = qs('ref');
  const amount = Number(qs('amount') || 0);

  _qrConfirm = { ref, amount, status: 'created' };
  renderQrConfirm({
    ref,
    amount,
    status: 'created',
    content: qrConfirmContent(ref)
  });

  if (!ref) {
    toast('warn', 'Thiếu mã giao dịch', 'Mã QR không có ref thanh toán.');
    return;
  }

  const { res, data } = await apiFetch(`/payments/qr/detail/${encodeURIComponent(ref)}`, { method: 'GET' });
  if (!res.ok) {
    toast('bad', 'Không tải được giao dịch', (data && data.message) ? data.message : 'Vui lòng thử lại.');
    return;
  }

  renderQrConfirm(data || {});
}

async function confirmQrPayment() {
  const btn = document.getElementById('btnConfirmQrPayment');
  if (!_qrConfirm.ref || btn?.disabled) return;

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang xác nhận...';
  }

  const { res, data } = await apiFetch('/payments/qr/confirm', {
    method: 'POST',
    body: JSON.stringify({
      ref: _qrConfirm.ref,
      amount: _qrConfirm.amount
    })
  });

  if (!res.ok) {
    toast('bad', 'Không thể xác nhận', (data && data.message) ? data.message : 'Vui lòng thử lại.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Xác nhận thanh toán';
    }
    return;
  }

  toast('good', 'Đã thanh toán', 'Trạng thái giao dịch đã được cập nhật.');
  renderQrConfirm({
    ..._qrConfirm,
    status: 'paid',
    paid_at: new Date().toISOString()
  });

  const target = (data && data.redirectUrl)
    ? data.redirectUrl
    : `payment-result.html?ref=${encodeURIComponent(_qrConfirm.ref)}&provider=qr&status=paid`;
  setTimeout(() => {
    window.location.href = target;
  }, 650);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnConfirmQrPayment')?.addEventListener('click', confirmQrPayment);
  loadQrConfirm();
});
