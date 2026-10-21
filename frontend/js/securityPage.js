/*
// securityPage.js - change password (no inline handlers)

function isStrongPassword(pw) {
  const s = String(pw || '');
  if (s.length < 8) return false;
  const hasLower = /[a-z]/.test(s);
  const hasUpper = /[A-Z]/.test(s);
  const hasDigit = /[0-9]/.test(s);
  return hasLower && hasUpper && hasDigit;
}

async function changePassword() {
  const btn = document.getElementById('btnChangePassword');
  const cur = document.getElementById('currentPassword')?.value || '';
  const pw1 = document.getElementById('newPassword')?.value || '';
  const pw2 = document.getElementById('confirmNewPassword')?.value || '';

  if (!cur.trim() || !pw1) {
    toast('warn', 'Thiếu thông tin', 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.');
    return;
  }
  if (pw1 !== pw2) {
    toast('warn', 'Không khớp', 'Mật khẩu nhập lại không khớp.');
    return;
  }
  if (!isStrongPassword(pw1)) {
    toast('warn', 'Mật khẩu yếu', 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.');
    return;
  }

  const oldText = btn?.textContent;
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang đổi...';
  }

  try {
    const { res, data } = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: cur, new_password: pw1 })
    });

    if (!res.ok) {
      toast('bad', 'Không đổi được', data?.message || 'Có lỗi xảy ra.');
      return;
    }

    toast('good', 'Thành công', 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');

    // Clear local cache and redirect to login.
    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch (_) {}

    setTimeout(() => {
      window.location.href = '/login.html';
    }, 700);
  } catch (e) {
    toast('bad', 'Không đổi được', e?.message || 'Có lỗi xảy ra.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText || 'Đổi mật khẩu';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btnChangePassword');
  if (btn) {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      changePassword();
    });
  }

  const params = new URLSearchParams(window.location.search);
  const verifyToken = params.get('verifyToken') || '';
  const verifyInput = document.getElementById('verifyToken');
  if (verifyInput && verifyToken && !verifyInput.value) {
    verifyInput.value = verifyToken;
  }

  document.title = 'Bao mat tai khoan | BeautyCare';
  const verifyCard = document.getElementById('btnRequestVerifyEmail')?.closest('.card');
  verifyCard?.querySelector('h3')?.replaceChildren(document.createTextNode('Xac minh email'));
  verifyCard?.querySelector('p')?.replaceChildren(
    document.createTextNode('He thong gui ma xac minh theo cau hinh email/outbox; chi tra token truc tiep khi bat demo mode.')
  );
  document.getElementById('btnRequestVerifyEmail')?.replaceChildren(document.createTextNode('Gui yeu cau xac minh'));
  document.getElementById('btnVerifyEmailToken')?.replaceChildren(document.createTextNode('Xac minh'));
  document.getElementById('verifyToken')?.setAttribute('placeholder', 'Nhap token tu email, outbox, hoac demo mode');
});
*/

function isStrongPassword(password) {
  const value = String(password || '');
  if (value.length < 8) return false;
  return /[a-z]/.test(value) && /[A-Z]/.test(value) && /[0-9]/.test(value);
}

async function changePassword() {
  const button = document.getElementById('btnChangePassword');
  const currentPassword = document.getElementById('currentPassword')?.value || '';
  const newPassword = document.getElementById('newPassword')?.value || '';
  const confirmPassword = document.getElementById('confirmNewPassword')?.value || '';

  if (!currentPassword.trim() || !newPassword) {
    toast('warn', 'Thiếu thông tin', 'Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.');
    return;
  }

  if (newPassword !== confirmPassword) {
    toast('warn', 'Không khớp', 'Mật khẩu nhập lại không khớp.');
    return;
  }

  if (!isStrongPassword(newPassword)) {
    toast('warn', 'Mật khẩu yếu', 'Mật khẩu tối thiểu 8 ký tự, gồm chữ hoa, chữ thường và số.');
    return;
  }

  const oldText = button?.textContent;
  if (button) {
    button.disabled = true;
    button.textContent = 'Đang đổi...';
  }

  try {
    const { res, data } = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });

    if (!res.ok) {
      toast('bad', 'Không đổi được', data?.message || 'Có lỗi xảy ra.');
      return;
    }

    toast('good', 'Thành công', 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');

    try {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
    } catch (_) {}

    setTimeout(() => {
      window.location.href = '/login.html';
    }, 700);
  } catch (error) {
    toast('bad', 'Không đổi được', error?.message || 'Có lỗi xảy ra.');
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = oldText || 'Đổi mật khẩu';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnChangePassword')?.addEventListener('click', (event) => {
    event.preventDefault();
    changePassword();
  });

  const params = new URLSearchParams(window.location.search);
  const verifyToken = params.get('verifyToken') || '';
  const verifyInput = document.getElementById('verifyToken');
  if (verifyInput && verifyToken && !verifyInput.value) {
    verifyInput.value = verifyToken;
  }

  document.title = 'Bảo mật tài khoản | BeautyCare';

  const verifyCard = document.getElementById('btnRequestVerifyEmail')?.closest('.card');
  verifyCard?.querySelector('h3')?.replaceChildren(document.createTextNode('Xác minh email'));
  verifyCard?.querySelector('p')?.replaceChildren(
    document.createTextNode('Hệ thống gửi mã xác minh qua email hoặc outbox nội bộ; chỉ trả token trực tiếp khi bật chế độ demo.')
  );

  document.getElementById('btnRequestVerifyEmail')?.replaceChildren(document.createTextNode('Gửi yêu cầu xác minh'));
  document.getElementById('btnVerifyEmailToken')?.replaceChildren(document.createTextNode('Xác minh ngay'));
  document.getElementById('verifyToken')?.setAttribute('placeholder', 'Nhập token từ email, outbox hoặc chế độ demo');
});
