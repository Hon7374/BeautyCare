/*
async function sendResetLink() {
  const email = document.getElementById('email')?.value?.trim();
  if (!email) return toast('warn','Thiếu thông tin','Vui lòng nhập email.');

  const { res, data } = await apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });

  if (!res.ok) {
    return toast('bad','Thất bại', data?.message || 'Không gửi được yêu cầu.');
  }

  // Demo: backend returns token so user can paste.
  const tokenEl = document.getElementById('resetToken');
  if (data?.token) {
    if (tokenEl) tokenEl.value = data.actionUrl || data.token;
    toast('good','Đã tạo token','Demo: token đặt lại mật khẩu đã hiện ở ô bên dưới.');
  } else {
    if (tokenEl) tokenEl.value = '';
    toast('good','Đã gửi yêu cầu','Nếu email tồn tại, hệ thống sẽ gửi hướng dẫn.');
  }
}

async function doResetPassword() {
  const token = document.getElementById('token')?.value?.trim();
  const new_password = document.getElementById('new_password')?.value;
  if (!token || !new_password) return toast('warn','Thiếu thông tin','Vui lòng nhập token và mật khẩu mới.');

  const { res, data } = await apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password })
  });

  if (!res.ok) return toast('bad','Thất bại', data?.message || 'Không đặt lại được mật khẩu.');
  toast('good','Thành công','Đặt lại mật khẩu xong. Vui lòng đăng nhập lại.');
  setTimeout(()=>{ window.location.href='login.html'; }, 800);
}

// User security page helpers
async function requestVerifyEmail() {
  const { res, data } = await apiFetch('/auth/request-verify-email', { method: 'POST' });
  if (!res.ok) return toast('bad','Thất bại', data?.message || 'Không tạo được token.');
  if (data?.token) {
    const el = document.getElementById('verifyToken');
    if (el) el.value = data.token;
    toast('good','Đã tạo token','Demo: token xác minh email đã hiện ở ô bên dưới.');
  } else {
    toast('good','OK', data?.message || 'Đã gửi yêu cầu.');
  }
}

async function verifyEmailToken() {
  const token = document.getElementById('verifyToken')?.value?.trim();
  if (!token) return toast('warn','Thiếu token','Vui lòng nhập token xác minh.');
  const { res, data } = await apiFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token })
  });
  if (!res.ok) return toast('bad','Thất bại', data?.message || 'Token không đúng.');
  toast('good','Thành công','Email đã được xác minh.');
  // refresh user cache
  const me = await apiFetch('/auth/me');
  if (me.res.ok) localStorage.setItem('user', JSON.stringify(me.data));
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const verifyToken = params.get('verifyToken') || '';
  const path = String(window.location.pathname || '');

  const resetTokenEl = document.getElementById('token');
  if (resetTokenEl && token && !resetTokenEl.value) {
    resetTokenEl.value = token;
  }

  const verifyTokenEl = document.getElementById('verifyToken');
  if (verifyTokenEl && verifyToken && !verifyTokenEl.value) {
    verifyTokenEl.value = verifyToken;
  }

  if (path.endsWith('/forgot.html') || path.endsWith('forgot.html')) {
    document.title = 'Khoi phuc mat khau | BeautyCare';
    document.querySelector('.hero-card h1')?.replaceChildren(document.createTextNode('Khoi phuc mat khau'));
    document.querySelector('.hero-card p')?.replaceChildren(
      document.createTextNode('He thong tao yeu cau dat lai mat khau va gui lien ket theo cau hinh hien tai: email, outbox noi bo, hoac demo mode.')
    );
    document.querySelector('.auth-box h2')?.replaceChildren(document.createTextNode('Quen mat khau'));
    document.querySelector('.auth-box .small')?.replaceChildren(document.createTextNode('Nhap email de tao yeu cau dat lai mat khau.'));
    document.getElementById('btnSendReset')?.replaceChildren(document.createTextNode('Gui yeu cau'));
    document.getElementById('resetToken')?.setAttribute('placeholder', 'Neu AUTH_DEMO_MODE bat, token hoac link se hien o day');
  }

  if (path.endsWith('/reset.html') || path.endsWith('reset.html')) {
    document.title = 'Dat lai mat khau | BeautyCare';
    document.querySelector('.hero-card h1')?.replaceChildren(document.createTextNode('Dat lai mat khau'));
    document.querySelector('.hero-card p')?.replaceChildren(
      document.createTextNode('Nhap token hoac mo lien ket khoi phuc, sau do dat mat khau moi va dang nhap lai.')
    );
    document.querySelector('.auth-box h2')?.replaceChildren(document.createTextNode('Dat lai mat khau'));
    document.querySelector('.auth-box .small')?.replaceChildren(document.createTextNode('Token co the lay tu email, outbox noi bo, hoac che do demo.'));
    document.getElementById('token')?.setAttribute('placeholder', 'Dan token vao day');
    document.getElementById('new_password')?.setAttribute('placeholder', 'It nhat 8 ky tu, co chu hoa/thuong/so');
    document.getElementById('btnDoReset')?.replaceChildren(document.createTextNode('Doi mat khau'));
  }
});

async function setup2fa() {
  const { res, data } = await apiFetch('/auth/2fa/setup', { method: 'POST' });
  if (!res.ok) return toast('bad','Thất bại', data?.message || 'Không setup được 2FA.');
  document.getElementById('twofaSecret').value = data.secret || '';
  document.getElementById('twofaUrl').value = data.otpauth_url || '';
  toast('good','OK','Mở app Authenticator, thêm tài khoản bằng secret/URL.');
}

async function enable2fa() {
  const otp = document.getElementById('twofaOtp')?.value?.trim();
  if (!otp) return toast('warn','Thiếu mã','Nhập mã 6 số.');
  const { res, data } = await apiFetch('/auth/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ otp })
  });
  if (!res.ok) return toast('bad','Thất bại', data?.message || 'Không bật được 2FA.');
  toast('good','Thành công','2FA đã bật.');
  const me = await apiFetch('/auth/me');
  if (me.res.ok) localStorage.setItem('user', JSON.stringify(me.data));
}

async function disable2fa() {
  const otp = document.getElementById('twofaOtp')?.value?.trim();
  if (!otp) return toast('warn','Thiếu mã','Nhập mã 6 số.');
  const { res, data } = await apiFetch('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ otp })
  });
  if (!res.ok) return toast('bad','Thất bại', data?.message || 'Không tắt được 2FA.');
  toast('good','Thành công','2FA đã tắt.');
  const me = await apiFetch('/auth/me');
  if (me.res.ok) localStorage.setItem('user', JSON.stringify(me.data));
}

// Recovery pages load this module directly (without auth.js), so their
// buttons must be bound here.  Without these listeners a click is a no-op.
document.addEventListener('DOMContentLoaded', () => {
  const resetButton = document.getElementById('btnDoReset');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      void doResetPassword();
    });
  }

  const sendResetButton = document.getElementById('btnSendReset');
  if (sendResetButton) {
    sendResetButton.addEventListener('click', () => {
      void sendResetLink();
    });
  }
});
*/

async function sendResetLink() {
  const email = document.getElementById('email')?.value?.trim();
  if (!email) return toast('warn', 'Thiếu thông tin', 'Vui lòng nhập email.');

  const { res, data } = await apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });

  if (!res.ok) {
    return toast('bad', 'Thất bại', data?.message || 'Không gửi được yêu cầu.');
  }

  const tokenEl = document.getElementById('resetToken');
  if (data?.token) {
    if (tokenEl) tokenEl.value = data.actionUrl || data.token;
    toast('good', 'Đã tạo liên kết', 'Liên kết đặt lại mật khẩu đã hiển thị ở ô bên dưới trong chế độ demo.');
  } else {
    if (tokenEl) tokenEl.value = '';
    toast('good', 'Đã gửi yêu cầu', 'Nếu email tồn tại, hệ thống sẽ gửi hướng dẫn đặt lại mật khẩu.');
  }
}

async function doResetPassword() {
  const token = document.getElementById('token')?.value?.trim();
  const newPassword = document.getElementById('new_password')?.value;
  if (!token || !newPassword) {
    return toast('warn', 'Thiếu thông tin', 'Vui lòng nhập token và mật khẩu mới.');
  }

  const { res, data } = await apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword })
  });

  if (!res.ok) return toast('bad', 'Thất bại', data?.message || 'Không đặt lại được mật khẩu.');

  toast('good', 'Thành công', 'Đặt lại mật khẩu xong. Vui lòng đăng nhập lại.');
  setTimeout(() => {
    window.location.href = 'login.html';
  }, 800);
}

async function requestVerifyEmail() {
  const { res, data } = await apiFetch('/auth/request-verify-email', { method: 'POST' });
  if (!res.ok) return toast('bad', 'Thất bại', data?.message || 'Không tạo được yêu cầu xác minh.');

  if (data?.token) {
    const el = document.getElementById('verifyToken');
    if (el) el.value = data.token;
    toast('good', 'Đã tạo token', 'Token xác minh email đã hiển thị trong ô bên dưới ở chế độ demo.');
  } else {
    toast('good', 'Thành công', data?.message || 'Đã gửi yêu cầu xác minh email.');
  }
}

async function verifyEmailToken() {
  const token = document.getElementById('verifyToken')?.value?.trim();
  if (!token) return toast('warn', 'Thiếu token', 'Vui lòng nhập token xác minh.');

  const { res, data } = await apiFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token })
  });

  if (!res.ok) return toast('bad', 'Thất bại', data?.message || 'Token không hợp lệ.');

  toast('good', 'Thành công', 'Email đã được xác minh.');
  const me = await apiFetch('/auth/me');
  if (me.res.ok) localStorage.setItem('user', JSON.stringify(me.data));
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token') || '';
  const verifyToken = params.get('verifyToken') || '';
  const path = String(window.location.pathname || '');

  const resetTokenEl = document.getElementById('token');
  if (resetTokenEl && token && !resetTokenEl.value) {
    resetTokenEl.value = token;
  }

  const verifyTokenEl = document.getElementById('verifyToken');
  if (verifyTokenEl && verifyToken && !verifyTokenEl.value) {
    verifyTokenEl.value = verifyToken;
  }

  if (path.endsWith('/forgot.html') || path.endsWith('forgot.html')) {
    document.title = 'Khôi phục mật khẩu | BeautyCare';
    document.querySelector('.hero-card h1')?.replaceChildren(document.createTextNode('Khôi phục mật khẩu'));
    document.querySelector('.hero-card p')?.replaceChildren(
      document.createTextNode('Hệ thống tạo yêu cầu đặt lại mật khẩu và gửi liên kết theo cấu hình hiện tại: email, outbox nội bộ hoặc chế độ demo.')
    );
    document.querySelector('.auth-box h2')?.replaceChildren(document.createTextNode('Quên mật khẩu'));
    document.querySelector('.auth-box .small')?.replaceChildren(document.createTextNode('Nhập email để tạo yêu cầu đặt lại mật khẩu.'));
    document.getElementById('btnSendReset')?.replaceChildren(document.createTextNode('Gửi yêu cầu'));
    document.getElementById('resetToken')?.setAttribute('placeholder', 'Nếu bật chế độ demo, token hoặc liên kết sẽ hiển thị ở đây');
  }

  if (path.endsWith('/reset.html') || path.endsWith('reset.html')) {
    document.title = 'Đặt lại mật khẩu | BeautyCare';
    document.querySelector('.hero-card h1')?.replaceChildren(document.createTextNode('Đặt lại mật khẩu'));
    document.querySelector('.hero-card p')?.replaceChildren(
      document.createTextNode('Nhập token hoặc mở liên kết khôi phục, sau đó đặt mật khẩu mới và đăng nhập lại.')
    );
    document.querySelector('.auth-box h2')?.replaceChildren(document.createTextNode('Đặt lại mật khẩu'));
    document.querySelector('.auth-box .small')?.replaceChildren(document.createTextNode('Token có thể lấy từ email, outbox nội bộ hoặc chế độ demo.'));
    document.getElementById('token')?.setAttribute('placeholder', 'Dán token vào đây');
    document.getElementById('new_password')?.setAttribute('placeholder', 'Ít nhất 8 ký tự, có chữ hoa, chữ thường và số');
    document.getElementById('btnDoReset')?.replaceChildren(document.createTextNode('Đổi mật khẩu'));
  }
});

async function setup2fa() {
  const { res, data } = await apiFetch('/auth/2fa/setup', { method: 'POST' });
  if (!res.ok) return toast('bad', 'Thất bại', data?.message || 'Không thiết lập được 2FA.');

  document.getElementById('twofaSecret').value = data.secret || '';
  document.getElementById('twofaUrl').value = data.otpauth_url || '';
  toast('good', 'Thành công', 'Mở ứng dụng Authenticator và thêm tài khoản bằng secret hoặc OTPAuth URL.');
}

async function enable2fa() {
  const otp = document.getElementById('twofaOtp')?.value?.trim();
  if (!otp) return toast('warn', 'Thiếu mã', 'Nhập mã OTP gồm 6 số.');

  const { res, data } = await apiFetch('/auth/2fa/enable', {
    method: 'POST',
    body: JSON.stringify({ otp })
  });

  if (!res.ok) return toast('bad', 'Thất bại', data?.message || 'Không bật được 2FA.');

  toast('good', 'Thành công', '2FA đã được bật.');
  const me = await apiFetch('/auth/me');
  if (me.res.ok) localStorage.setItem('user', JSON.stringify(me.data));
}

async function disable2fa() {
  const otp = document.getElementById('twofaOtp')?.value?.trim();
  if (!otp) return toast('warn', 'Thiếu mã', 'Nhập mã OTP gồm 6 số.');

  const { res, data } = await apiFetch('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ otp })
  });

  if (!res.ok) return toast('bad', 'Thất bại', data?.message || 'Không tắt được 2FA.');

  toast('good', 'Thành công', '2FA đã được tắt.');
  const me = await apiFetch('/auth/me');
  if (me.res.ok) localStorage.setItem('user', JSON.stringify(me.data));
}
