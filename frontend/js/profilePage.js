function memberInfo(member) {
  const m = String(member || '').toLowerCase();
  if (m === 'premium') return { name: 'Premium', badge: 'good', rate: '20%' };
  if (m === 'gold') return { name: 'Vàng', badge: 'primary', rate: '10%' };
  return { name: 'Bạc', badge: 'warn', rate: '5%' };
}

function normalizePhoneClient(raw) {
  const digits = String(raw || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('84') && digits.length >= 10) {
    const rest = digits.slice(2);
    if (rest.startsWith('0')) return rest;
    return '0' + rest;
  }
  return digits;
}

function fmtMaybe(s, fallback = 'Chưa cập nhật') {
  const v = String(s || '').trim();
  return v ? escapeHtml(v) : `<span class="small" style="opacity:.85">${escapeHtml(fallback)}</span>`;
}

// Like fmtMaybe but returns plain text (no HTML).
function fmtPlain(s, fallback = 'Chưa cập nhật') {
  const v = String(s || '').trim();
  return v ? v : fallback;
}

function renderMemberPlan(data) {
  const sub = data?.subscription || null;
  const exp = data?.member_expires_at ? formatDateTime(data.member_expires_at) : null;

  if (sub && sub.plan) {
    const plan = sub.plan;
    const tier = memberInfo(plan.tier || data.member);
    return `
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
        <div>
          <div class="small">Gói hội viên</div>
          <div style="font-weight:800;font-size:18px;margin-top:4px">${escapeHtml(plan.name || plan.code || 'Gói hội viên')}</div>
          <div class="small" style="margin-top:6px">Hạng: <span class="badge ${tier.badge}">${tier.name}</span></div>
        </div>
        <span class="badge good">Đang hoạt động</span>
      </div>
      <div style="margin-top:12px" class="small">
        <div>Giá: <b>${formatVND(Number(plan.price || 0))}</b></div>
        <div>Hiệu lực: <b>${formatDateTime(sub.start_at)}</b> → <b>${formatDateTime(sub.end_at)}</b></div>
        <div>Tự gia hạn: <b>${sub.auto_renew ? 'Có' : 'Không'}</b> · Cổng: <b>${escapeHtml(sub.provider || '—')}</b></div>
      </div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:14px">
        <button class="btn ghost" id="btnGoMembership">Xem / đổi gói</button>
      </div>
    `;
  }

  return `
    <div class="small">Gói hội viên</div>
    <div style="font-weight:800;font-size:18px;margin-top:4px">Chưa mua gói hội viên</div>
    <div class="small" style="margin-top:8px">Bạn đang ở hạng <b>${escapeHtml(memberInfo(data.member).name)}</b>${exp ? ` · Hết hạn: <b>${escapeHtml(exp)}</b>` : ''}.</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:14px">
      <button class="btn ghost" id="btnGoMembership">Xem gói hội viên</button>
    </div>
  `;
}

function renderProfile(data) {
  const box = document.getElementById('profileBox');
  if (!box) return;

  const m = memberInfo(data.member);
  const exp = data?.member_expires_at ? formatDateTime(data.member_expires_at) : null;
  const phoneText = fmtPlain(data.phone);
  const emailText = fmtPlain(data.email);
  const nameText = String(data.name || '').trim() || 'Tài khoản';

  box.innerHTML = `
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">${escapeHtml(nameText)}</div>
          <div class="chips" style="margin-top:10px">
            <span class="chip">SĐT: <b style="color:rgba(255,255,255,.9)">${escapeHtml(phoneText)}</b></span>
            <span class="chip">Email: <b style="color:rgba(255,255,255,.9)">${escapeHtml(emailText)}</b></span>
          </div>
        </div>
        <span class="badge ${m.badge}">Hạng: ${m.name}</span>
      </div>

      <div class="grid grid-2" style="padding:12px 0; align-items:start">
        <div class="card soft">
          <div class="small">Quyền</div>
          <div style="font-weight:700">${escapeHtml(data.role || 'user')}</div>
        </div>
        <div class="card soft">
          <div class="small">Ưu đãi hạng</div>
          <div style="font-weight:700">Giảm ${m.rate}</div>
          <div class="small">Áp dụng tự động khi thanh toán</div>
          ${exp ? `<div class="small" style="margin-top:6px">Hết hạn: <b>${escapeHtml(exp)}</b></div>` : ''}
        </div>
      </div>

      <div class="grid grid-2" style="padding:0;margin-top:16px;align-items:start">
        <div class="card soft">
          <div class="small">Thông tin tối thiểu</div>

          <label class="label">Họ và tên <span class="small" style="opacity:.8">*</span></label>
          <input class="input" id="pfName" type="text" value="${escapeHtml(data.name || '')}" />

          <label class="label">Số điện thoại <span class="small" style="opacity:.8">*</span></label>
          <input class="input" id="pfPhone" type="tel" value="${escapeHtml(data.phone || '')}" placeholder="vd: 0912345678" />

          <label class="label">Email <span class="small" style="opacity:.8">(không bắt buộc)</span></label>
          <input class="input" id="pfEmail" type="email" value="${escapeHtml(data.email || '')}" placeholder="vd: minh.anh@beautycare.vn" />

          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:12px">
            <div class="small" style="opacity:.8">* Email có thể để trống nếu bạn không muốn sử dụng.</div>
            <button class="btn primary" id="btnSaveProfile">Lưu thay đổi</button>
          </div>
        </div>

        <div class="card soft" id="memberPlanBox">
          ${renderMemberPlan(data)}
        </div>
      </div>

      <hr class="sep"/>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end">
        <button class="btn ghost" id="btnGoServices">Xem dịch vụ</button>
        <button class="btn danger js-logout">Đăng xuất</button>
      </div>
    </div>
  `;

  // Actions (must bind after render)
  const btnGoServices = document.getElementById('btnGoServices');
  if (btnGoServices) {
    btnGoServices.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/user/services.html';
    });
  }

  const btnGoMembership = document.getElementById('btnGoMembership');
  if (btnGoMembership) {
    btnGoMembership.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = '/user/membership.html';
    });
  }

  const btnSave = document.getElementById('btnSaveProfile');
  if (btnSave) {
    btnSave.addEventListener('click', async (e) => {
      e.preventDefault();
      const name = (document.getElementById('pfName')?.value || '').trim();
      const phoneRaw = (document.getElementById('pfPhone')?.value || '').trim();
      const phone = normalizePhoneClient(phoneRaw);
      const emailRaw = (document.getElementById('pfEmail')?.value || '').trim();
      const email = emailRaw ? emailRaw : null;

      if (!name || !phone) {
        toast('warn', 'Thiếu thông tin', 'Vui lòng nhập họ tên và số điện thoại.');
        return;
      }

      if (!phone.startsWith('0') || !(phone.length === 10 || phone.length === 11)) {
        toast('warn', 'SĐT không hợp lệ', 'Vui lòng nhập số điện thoại hợp lệ.');
        return;
      }

      btnSave.disabled = true;
      const oldText = btnSave.textContent;
      btnSave.textContent = 'Đang lưu...';
      try {
        const { res, data: updated } = await apiFetch('/auth/me', {
          method: 'PUT',
          body: JSON.stringify({ name, phone: phoneRaw, email })
        });

        if (!res.ok) {
          toast('bad', 'Không thể cập nhật', updated?.message || 'Có lỗi xảy ra.');
          return;
        }

        localStorage.setItem('user', JSON.stringify(updated));
        renderTopbarUser();
        toast('good', 'Đã cập nhật', 'Thông tin hồ sơ đã được lưu.');
        renderProfile(updated);
      } catch (err) {
        toast('bad', 'Không thể cập nhật', err?.message || 'Có lỗi xảy ra.');
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = oldText;
      }
    });
  }
}

async function load() {
  const box = document.getElementById('profileBox');
  if (box) box.innerHTML = `<div class="skeleton" style="height:160px"></div>`;

  const { res, data } = await apiFetch('/auth/me', { method: 'GET' });
  if (!res.ok) {
    toast('bad', 'Không tải được hồ sơ', 'Vui lòng đăng nhập lại.');
    return;
  }

  localStorage.setItem('user', JSON.stringify(data));
  renderTopbarUser();
  renderProfile(data);
}

document.addEventListener('DOMContentLoaded', load);
