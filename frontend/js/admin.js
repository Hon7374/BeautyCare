let _adminUsers = [];
let _adminServices = [];
let _adminVouchers = [];
const SERVICE_IMAGE_UPLOAD_MAX_BYTES = 3 * 1024 * 1024;
const SERVICE_IMAGE_UPLOAD_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ADMIN_SERVICE_FALLBACK_IMAGE = '/assets/services/default-service.svg';
let _serviceImageUploading = false;
let _userModalMode = 'view';

async function loadUsers() {
  const tbody = document.getElementById('usersBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6"><div class="skeleton" style="height:70px"></div></td></tr>`;

  const { res, data } = await apiFetch('/admin/users', { method:'GET' });
  if (!res.ok) {
    toast('bad', 'Lỗi', 'Không tải được danh sách người dùng.');
    tbody.innerHTML = '';
    return;
  }

  _adminUsers = Array.isArray(data) ? data : [];
  const q = (document.getElementById('searchUsers')?.value || '').trim().toLowerCase();
  const list = q
    ? _adminUsers.filter((u) => `${u.email || ''} ${u.name || ''} ${u.phone || ''}`.toLowerCase().includes(q))
    : _adminUsers;

  tbody.innerHTML = '';
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Không có người dùng phù hợp.</td></tr>`;
    return;
  }

  list.forEach(u => {
    const roleMeta = userRoleMeta(u.role);
    const memberMeta = userMemberMeta(u.member);

    tbody.innerHTML += `
      <tr>
        <td>#${u.id}</td>
        <td>${escapeHtml(u.name || '')}</td>
        <td>${escapeHtml(u.email || '')}</td>
        <td><span class="badge ${roleMeta.badge}">${escapeHtml(roleMeta.text)}</span></td>
        <td><span class="badge ${memberMeta.badge}">${memberMeta.text}</span></td>
        <td style="white-space:nowrap">
          <button class="btn ghost js-view-user" data-id="${Number(u.id)}">Xem</button>
          <button class="btn js-edit-user" data-id="${Number(u.id)}">Sửa</button>
          <button class="btn danger js-del-user" data-id="${Number(u.id)}">Xóa</button>
        </td>
      </tr>
    `;
  });
}

function userRoleMeta(roleRaw) {
  const role = String(roleRaw || 'user').toLowerCase();
  if (role === 'admin') return { badge: 'good', text: 'admin' };
  return { badge: '', text: 'user' };
}

function userMemberMeta(memberRaw) {
  const member = String(memberRaw || 'silver').toLowerCase();
  if (member === 'premium') return { badge: 'good', text: 'Premium' };
  if (member === 'gold') return { badge: 'primary', text: 'Vàng' };
  return { badge: 'warn', text: 'Bạc' };
}

function formatDateTimeSafe(value, fallback = 'Chưa có') {
  if (!value) return fallback;
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  const text = formatDateTime(normalized);
  return text || fallback;
}

function toDateTimeLocalValue(value) {
  if (!value) return '';
  const normalized = String(value).includes('T') ? String(value) : String(value).replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function normalizePhoneClient(raw) {
  return String(raw || '').replace(/\D+/g, '').trim();
}

function syncCurrentAdminUser(updatedUser) {
  const current = getUser?.();
  if (!current || Number(current.id) !== Number(updatedUser?.id)) return;
  const nextUser = {
    ...current,
    name: updatedUser.name,
    phone: updatedUser.phone,
    email: updatedUser.email,
    role: updatedUser.role,
    member: updatedUser.member
  };
  localStorage.setItem('user', JSON.stringify(nextUser));
  renderTopbarUser?.();
}

function setUserMetric(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value ?? '0');
}

function setUserModalText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '';
}

function syncUserMemberExpiryState() {
  const memberEl = document.getElementById('usrMember');
  const expiryEl = document.getElementById('usrMemberExpires');
  if (!memberEl || !expiryEl) return;
  const isSilver = String(memberEl.value || 'silver').toLowerCase() === 'silver';
  expiryEl.disabled = _userModalMode !== 'edit' || isSilver;
  if (isSilver) expiryEl.value = '';
}

function setUserModalMode(mode = 'view') {
  _userModalMode = mode === 'edit' ? 'edit' : 'view';
  const readOnly = _userModalMode !== 'edit';
  const currentUserId = Number(document.getElementById('usrId')?.value || 0);
  const selfUser = Number(getUser?.()?.id || 0) === currentUserId;

  ['usrName', 'usrPhone', 'usrEmail'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.readOnly = readOnly;
  });

  const memberExpiryEl = document.getElementById('usrMemberExpires');
  if (memberExpiryEl) memberExpiryEl.readOnly = readOnly;

  const roleEl = document.getElementById('usrRole');
  if (roleEl) roleEl.disabled = readOnly || selfUser;

  const memberEl = document.getElementById('usrMember');
  if (memberEl) memberEl.disabled = readOnly;

  const saveBtn = document.getElementById('btnSaveUser');
  if (saveBtn) saveBtn.hidden = readOnly;

  const editBtn = document.getElementById('btnEditUserMode');
  if (editBtn) editBtn.hidden = !readOnly;

  const deleteBtn = document.getElementById('btnDeleteUserModal');
  if (deleteBtn) {
    deleteBtn.disabled = selfUser;
    deleteBtn.title = selfUser ? 'Không thể xóa chính bạn' : '';
  }

  setUserModalText('userModalTitle', readOnly ? 'Xem người dùng' : 'Sửa người dùng');
  syncUserMemberExpiryState();
}

function fillUserModal(user = {}) {
  const roleMeta = userRoleMeta(user.role);
  const memberMeta = userMemberMeta(user.member);

  setValue('usrId', user.id || '');
  setValue('usrName', user.name || '');
  setValue('usrPhone', user.phone || '');
  setValue('usrEmail', user.email || '');
  setValue('usrRole', user.role || 'user');
  setValue('usrMember', user.member || 'silver');
  setValue('usrMemberExpires', toDateTimeLocalValue(user.member_expires_at || user.memberExpiresAt || ''));

  setUserModalText('usrSummaryName', user.name || 'Tài khoản');
  setUserModalText('usrSummaryEmail', user.email || 'Không có email');
  setUserModalText('usrSummaryPhone', user.phone || 'Không có SĐT');
  setUserModalText('usrRoleText', roleMeta.text);
  setUserModalText('usrMemberText', memberMeta.text);
  setUserModalText('usrEmailVerifiedText', user.email_verified ? 'Đã xác minh' : 'Chưa xác minh');
  setUserModalText('usrTwofaText', user.twofa_enabled ? 'Đã bật' : 'Chưa bật');
  setUserModalText('usrMemberExpiresText', formatDateTimeSafe(user.member_expires_at || user.memberExpiresAt, 'Chưa đặt'));

  const roleBadge = document.getElementById('usrRoleBadge');
  if (roleBadge) roleBadge.className = `badge ${roleMeta.badge}`.trim();

  const memberBadge = document.getElementById('usrMemberBadge');
  if (memberBadge) memberBadge.className = `badge ${memberMeta.badge}`.trim();

  const emailBadge = document.getElementById('usrEmailVerifiedBadge');
  if (emailBadge) emailBadge.className = `badge ${user.email_verified ? 'good' : 'warn'}`.trim();

  const twofaBadge = document.getElementById('usrTwofaBadge');
  if (twofaBadge) twofaBadge.className = `badge ${user.twofa_enabled ? 'good' : ''}`.trim();

  setUserMetric('usrBookingsCount', Number(user.bookings_count || 0));
  setUserMetric('usrOrdersCount', Number(user.orders_count || 0));
  setUserMetric('usrPaymentsCount', Number(user.payments_count || 0));
  setUserMetric('usrSubscriptionsCount', Number(user.subscriptions_count || 0));
  setUserMetric('usrTransactionsCount', Number(user.transactions_count || 0));
  syncUserMemberExpiryState();
}

function openUserModal(user, mode = 'view') {
  if (!user) return;
  fillUserModal(user);
  setUserModalMode(mode);
  openModal('modalUser');
}

function userPayloadFromForm() {
  const rawEmail = String(document.getElementById('usrEmail')?.value || '').trim();
  return {
    name: String(document.getElementById('usrName')?.value || '').trim(),
    phone: String(document.getElementById('usrPhone')?.value || '').trim(),
    email: rawEmail ? rawEmail : null,
    role: document.getElementById('usrRole')?.value || 'user',
    member: document.getElementById('usrMember')?.value || 'silver',
    memberExpiresAt: document.getElementById('usrMemberExpires')?.value || null
  };
}

function validateUserForm(payload) {
  const phone = normalizePhoneClient(payload.phone);
  if (!payload.name || payload.name.length < 2) return 'Ho ten phai tu 2 ky tu tro len.';
  if (!phone || !phone.startsWith('0') || !(phone.length === 10 || phone.length === 11)) return 'So dien thoai khong hop le.';
  if (payload.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) return 'Email khong hop le.';
  if (!['user', 'admin'].includes(payload.role)) return 'Role khong hop le.';
  if (!['silver', 'gold', 'premium'].includes(payload.member)) return 'Member khong hop le.';
  if (payload.member === 'silver') payload.memberExpiresAt = null;
  return '';
}

async function saveUser() {
  const id = Number(document.getElementById('usrId')?.value || 0);
  const payload = userPayloadFromForm();
  const message = validateUserForm(payload);
  if (message) {
    toast('warn', 'Du lieu chua hop le', message);
    return;
  }

  const { res, data } = await apiFetch(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    toast('bad', 'Không thể sửa người dùng', (data && data.message) ? data.message : 'Vui lòng thử lại.');
    return;
  }

  syncCurrentAdminUser(data?.user || payload);
  closeModal('modalUser');
  toast('good', 'Thanh cong', 'Da cap nhat nguoi dung.');
  loadUsers();
}

async function deleteUser(id) {
  const userId = Number(id || document.getElementById('usrId')?.value || 0);
  const user = _adminUsers.find((item) => Number(item.id) === userId);
  const label = user?.name || `#${userId}`;
  if (!userId) return;
  if (!confirm(`Xóa người dùng ${label}?`)) return;

  const { res, data } = await apiFetch(`/admin/users/${userId}`, { method:'DELETE' });
  if (!res.ok) {
    toast('bad', 'Không thể xóa người dùng', (data && data.message) ? data.message : 'Vui lòng thử lại.');
    return;
  }

  closeModal('modalUser');
  toast('good', 'Đã xóa', 'Người dùng đã được xóa.');
  loadUsers();
}

async function loadServicesAdmin() {
  const tbody = document.getElementById('servicesBody');
  if (!tbody) return;

  {
    tbody.innerHTML = `<tr><td colspan="6"><div class="skeleton" style="height:70px"></div></td></tr>`;

    const fetchResult = await apiFetch('/admin/services', { method: 'GET' });
    if (!fetchResult.res.ok) {
      toast('bad', 'Lỗi', 'Không tải được danh sách dịch vụ.');
      tbody.innerHTML = '';
      return;
    }

    _adminServices = Array.isArray(fetchResult.data) ? fetchResult.data : [];
    const serviceQuery = (document.getElementById('searchServices')?.value || '').trim().toLowerCase();
    const serviceItems = serviceQuery
      ? _adminServices.filter((service) => `${service.name || ''} ${service.category || ''}`.toLowerCase().includes(serviceQuery))
      : _adminServices;

    tbody.innerHTML = '';
    if (!serviceItems.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Không có dịch vụ phù hợp.</td></tr>`;
      return;
    }

    serviceItems.forEach((service) => {
      const statusMeta = serviceStatusMeta(service.status);
      tbody.innerHTML += `
        <tr>
          <td>
            <button class="admin-service-link js-view-service" type="button" data-id="${Number(service.id)}">
              <span class="admin-service-link__name">${escapeHtml(serviceText(service.name, 'Dịch vụ'))}</span>
              <span class="admin-service-link__meta">#${Number(service.id)}</span>
            </button>
          </td>
          <td>${escapeHtml(serviceText(service.category, 'Chưa phân loại'))}</td>
          <td>${serviceDurationValue(service)} phút</td>
          <td><b>${formatVND(serviceNumber(service.price, 0))}</b></td>
          <td><span class="badge ${statusMeta.badge}">${escapeHtml(statusMeta.text)}</span></td>
          <td style="white-space:nowrap">
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn ghost js-view-service" data-id="${Number(service.id)}">Xem</button>
              <button class="btn js-edit-service" data-id="${Number(service.id)}">Sửa</button>
              <button class="btn danger js-del-service" data-id="${Number(service.id)}">Xóa</button>
            </div>
          </td>
        </tr>
      `;
    });
    return;
  }

  tbody.innerHTML = `<tr><td colspan="6"><div class="skeleton" style="height:70px"></div></td></tr>`;

  const response = await apiFetch('/admin/services', { method: 'GET' });
  if (!response.res.ok) {
    toast('bad', 'Lỗi', 'Không tải được danh sách dịch vụ.');
    tbody.innerHTML = '';
    return;
  }

  _adminServices = Array.isArray(response.data) ? response.data : [];
  const query = (document.getElementById('searchServices')?.value || '').trim().toLowerCase();
  const filteredServices = query
    ? _adminServices.filter((service) => `${service.name || ''} ${service.category || ''}`.toLowerCase().includes(query))
    : _adminServices;

  tbody.innerHTML = '';
  if (!filteredServices.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Không có dịch vụ phù hợp.</td></tr>`;
    return;
  }

  filteredServices.forEach((service) => {
    const statusMeta = serviceStatusMeta(service.status);
    tbody.innerHTML += `
      <tr>
        <td>
          <button class="admin-service-link js-view-service" type="button" data-id="${Number(service.id)}">
            <span class="admin-service-link__name">${escapeHtml(serviceText(service.name, 'Dịch vụ'))}</span>
            <span class="admin-service-link__meta">#${Number(service.id)} - Xem chi tiết</span>
          </button>
        </td>
        <td>${escapeHtml(serviceText(service.category, 'Chưa phân loại'))}</td>
        <td>${serviceDurationValue(service)} phút</td>
        <td><b>${formatVND(serviceNumber(service.price, 0))}</b></td>
        <td><span class="badge ${statusMeta.badge}">${escapeHtml(statusMeta.text)}</span></td>
        <td style="white-space:nowrap">
          <button class="btn js-edit-service" data-id="${Number(service.id)}">Sửa</button>
          <button class="btn danger js-del-service" data-id="${Number(service.id)}">Xóa</button>
        </td>
      </tr>
    `;
  });
  return;

  tbody.innerHTML = `<tr><td colspan="6"><div class="skeleton" style="height:70px"></div></td></tr>`;

  const { res, data } = await apiFetch('/admin/services', { method:'GET' });
  if (!res.ok) {
    toast('bad', 'Lỗi', 'Không tải được danh sách dịch vụ.');
    tbody.innerHTML = '';
    return;
  }

  _adminServices = Array.isArray(data) ? data : [];
  const q = (document.getElementById('searchServices')?.value || '').trim().toLowerCase();
  const list = q
    ? _adminServices.filter(s => `${s.name || ''} ${s.category || ''}`.toLowerCase().includes(q))
    : _adminServices;

  tbody.innerHTML = '';
  list.forEach(s => {
    const status = String(s.status || 'visible').toLowerCase();
    const statusBadge = status === 'hidden'
      ? '<span class="badge warn">Ẩn</span>'
      : '<span class="badge good">Hiển thị</span>';

    tbody.innerHTML += `
      <tr>
        <td>
          <b>${escapeHtml(s.name || '')}</b>
          <div class="small muted">#${Number(s.id)}</div>
        </td>
        <td>${escapeHtml(s.category || 'Chưa phân loại')}</td>
        <td>${Number(s.durationMinutes || s.duration_min || 60)} phút</td>
        <td><b>${formatVND(s.price)}</b></td>
        <td>${statusBadge}</td>
        <td style="white-space:nowrap">
          <button class="btn js-edit-service" data-id="${Number(s.id)}">Sửa</button>
          <button class="btn danger js-del-service" data-id="${Number(s.id)}">Xóa</button>
        </td>
      </tr>
    `;
  });
}

function serviceText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function serviceNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function serviceArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => serviceText(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return serviceArray(parsed);
    } catch (_) {
      // Keep textarea-style content as line-separated data.
    }
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  return [];
}

function serviceFaqs(value) {
  const parsed = typeof value === 'string'
    ? (() => {
        try {
          return JSON.parse(value);
        } catch (_) {
          return [];
        }
      })()
    : value;

  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((item) => ({
      question: serviceText(item?.question ?? item?.q),
      answer: serviceText(item?.answer ?? item?.a)
    }))
    .filter((item) => item.question && item.answer);
}

function serviceIdArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0);
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return serviceIdArray(parsed);
    } catch (_) {
      // Older content may be comma-separated.
    }
    return text
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0);
  }

  return [];
}

function serviceStatusMeta(statusRaw) {
  const status = String(statusRaw || 'visible').toLowerCase();
  if (status === 'hidden') return { badge: 'warn', text: 'Ẩn' };
  return { badge: 'good', text: 'Hiển thị' };
}

function serviceDurationValue(service) {
  const duration = serviceNumber(service?.durationMinutes ?? service?.duration_min, 60);
  return duration > 0 ? Math.trunc(duration) : 60;
}

function serviceImageValue(service) {
  return serviceText(service?.imageUrl ?? service?.image_url, ADMIN_SERVICE_FALLBACK_IMAGE);
}

function serviceShortText(service) {
  return serviceText(
    service?.shortDescription ?? service?.short_description ?? service?.description,
    'Chưa có mô tả ngắn cho dịch vụ này.'
  );
}

function serviceDetailText(service) {
  return serviceText(service?.detailDescription ?? service?.detail_description, serviceShortText(service));
}

function serviceParagraphHtml(text, emptyText) {
  const items = serviceText(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!items.length) {
    return `<div class="muted small">${escapeHtml(emptyText)}</div>`;
  }

  return items.map((line) => `<p class="muted" style="margin:8px 0">${escapeHtml(line)}</p>`).join('');
}

function serviceListHtml(items, emptyText) {
  const list = serviceArray(items);
  if (!list.length) return `<div class="muted small">${escapeHtml(emptyText)}</div>`;
  return `<ul class="sd-list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function serviceFaqHtml(items) {
  const list = serviceFaqs(items);
  if (!list.length) return '<div class="muted small">Chưa có FAQ cho dịch vụ này.</div>';
  return `
    <div class="sd-faq">
      ${list.map((item, index) => `
        <details ${index === 0 ? 'open' : ''}>
          <summary>${escapeHtml(item.question)}</summary>
          <div class="muted" style="margin-top:8px">${escapeHtml(item.answer)}</div>
        </details>
      `).join('')}
    </div>
  `;
}

function findAdminRelatedServices(service) {
  const currentId = Number(service?.id || 0);
  const others = _adminServices.filter((item) => Number(item.id) !== currentId);
  const relatedIds = serviceIdArray(
    service?.relatedServiceIds ?? service?.related_service_ids_json ?? service?.related_service_ids
  );

  const explicit = relatedIds
    .map((id) => others.find((item) => Number(item.id) === Number(id)))
    .filter(Boolean);
  if (explicit.length) return explicit.slice(0, 5);

  const category = serviceText(service?.category).toLowerCase();
  return others
    .filter((item) => serviceText(item.category).toLowerCase() === category)
    .slice(0, 5);
}

function adminRelatedServiceCard(service) {
  const duration = serviceDurationValue(service);
  return `
    <div class="service-rel">
      <img
        class="service-rel__thumb"
        src="${escapeHtml(serviceImageValue(service))}"
        alt="${escapeHtml(serviceText(service.name, 'Dịch vụ'))}"
        loading="lazy"
        referrerpolicy="no-referrer"
        onerror="this.onerror=null;this.src='${escapeHtml(ADMIN_SERVICE_FALLBACK_IMAGE)}';"
      >
      <div style="min-width:0">
        <div class="service-rel__name">${escapeHtml(serviceText(service.name, 'Dịch vụ'))}</div>
        <div class="muted small">${escapeHtml(serviceText(service.category, 'Chưa phân loại'))} - ${duration} phút</div>
        <div class="muted small" style="margin-top:6px">${formatVND(serviceNumber(service.price, 0))}</div>
        <button class="btn ghost js-view-service" type="button" data-id="${Number(service.id)}" style="margin-top:10px">Xem chi tiết</button>
      </div>
    </div>
  `;
}

function fillServiceDetail(service) {
  const content = document.getElementById('serviceDetailContent');
  const title = document.getElementById('serviceDetailTitle');
  const detailId = document.getElementById('serviceDetailId');
  if (!content || !title || !detailId || !service) return;

  const statusMeta = serviceStatusMeta(service.status);
  const duration = serviceDurationValue(service);
  const category = serviceText(service.category, 'Chưa phân loại');
  const paymentMethods = serviceArray(
    service?.paymentMethods ?? service?.payment_methods_json ?? service?.payment_methods
  );
  const related = findAdminRelatedServices(service);
  const imageUrl = serviceImageValue(service);

  title.textContent = `Chi tiết: ${serviceText(service.name, 'Dịch vụ')}`;
  detailId.value = String(Number(service.id) || '');

  content.innerHTML = `
    <div class="service-detail__head">
      <div>
        <h2 style="margin:0">${escapeHtml(serviceText(service.name, 'Dịch vụ'))}</h2>
        <div class="muted" style="margin-top:6px">${escapeHtml(category)} - ${duration} phút - #${Number(service.id)}</div>
        <p class="muted" style="margin:10px 0 0">${escapeHtml(serviceShortText(service))}</p>
      </div>
      <div class="service-detail__cta">
        <span class="badge ${statusMeta.badge}">${escapeHtml(statusMeta.text)}</span>
        <span class="badge">${formatVND(serviceNumber(service.price, 0))}</span>
      </div>
    </div>

    <div class="admin-service-detail-summary">
      <div class="admin-service-detail-stat">
        <div class="small muted">Danh mục</div>
        <b>${escapeHtml(category)}</b>
      </div>
      <div class="admin-service-detail-stat">
        <div class="small muted">Thời lượng</div>
        <b>${duration} phút</b>
      </div>
      <div class="admin-service-detail-stat">
        <div class="small muted">Trạng thái</div>
        <b>${escapeHtml(statusMeta.text)}</b>
      </div>
      <div class="admin-service-detail-stat">
        <div class="small muted">Giá</div>
        <b>${formatVND(serviceNumber(service.price, 0))}</b>
      </div>
    </div>

    <div class="service-detail__media">
      <img
        class="service-detail__image"
        src="${escapeHtml(imageUrl)}"
        alt="${escapeHtml(serviceText(service.name, 'Dịch vụ'))}"
        loading="lazy"
        referrerpolicy="no-referrer"
        onerror="this.onerror=null;this.src='${escapeHtml(ADMIN_SERVICE_FALLBACK_IMAGE)}';"
      >
    </div>

    <div class="service-detail__grid">
      <div>
        <h3>Mô tả chi tiết</h3>
        ${serviceParagraphHtml(serviceDetailText(service), 'Chưa có mô tả chi tiết cho dịch vụ này.')}

        <div class="sd-block">
          <h3>Lợi ích nổi bật</h3>
          ${serviceListHtml(service?.benefits ?? service?.benefits_json, 'Chưa có lợi ích nổi bật được cập nhật.')}
        </div>

        <div class="sd-block">
          <h3>Chuẩn bị trước khi đến</h3>
          ${serviceListHtml(
            service?.preparationNotes ?? service?.preparation_notes_json ?? service?.preparation_notes,
            'Chưa có hướng dẫn chuẩn bị riêng cho dịch vụ này.'
          )}
        </div>

        <div class="sd-block">
          <h3>Chăm sóc sau dịch vụ</h3>
          ${serviceListHtml(
            service?.aftercareNotes ?? service?.aftercare_notes_json ?? service?.aftercare_notes,
            'Chưa có lưu ý chăm sóc sau dịch vụ.'
          )}
        </div>

        <div class="sd-block">
          <h3>Câu hỏi thường gặp</h3>
          ${serviceFaqHtml(service?.faqs ?? service?.faqs_json)}
        </div>
      </div>

      <aside class="sd-aside">
        <div class="sd-panel">
          <div class="h3">Thông tin nhanh</div>
          <div style="margin-top:10px" class="muted">
            <div><b>Mã dịch vụ:</b> #${Number(service.id)}</div>
            <div style="margin-top:6px"><b>Danh mục:</b> ${escapeHtml(category)}</div>
            <div style="margin-top:6px"><b>Thanh toán:</b> ${escapeHtml(paymentMethods.length ? paymentMethods.join(', ') : 'VNPay, MoMo, QR, Tiền mặt')}</div>
            <div style="margin-top:6px"><b>Ưu đãi:</b> ${escapeHtml(serviceText(service?.promotionNote ?? service?.promotion_note, 'Chưa có ghi chú ưu đãi.'))}</div>
          </div>
        </div>

        <div class="sd-panel sd-panel--spaced">
          <div class="h3">Dịch vụ liên quan</div>
          <div class="sd-related" style="margin-top:10px">
            ${related.length ? related.map(adminRelatedServiceCard).join('') : '<div class="admin-service-detail-empty">Chưa có dịch vụ liên quan.</div>'}
          </div>
        </div>
      </aside>
    </div>
  `;
}

function openServiceDetail(service) {
  if (!service) return;
  fillServiceDetail(service);
  openModal('modalServiceDetail');
}

function linesFromText(id) {
  return String(document.getElementById(id)?.value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function setLines(id, values) {
  const el = document.getElementById(id);
  if (el) el.value = Array.isArray(values) ? values.join('\n') : '';
}

function clearFaqEditor() {
  const box = document.getElementById('svcFaqs');
  if (box) box.innerHTML = '';
}

function addFaqRow(question = '', answer = '') {
  const box = document.getElementById('svcFaqs');
  if (!box) return;
  const row = document.createElement('div');
  row.className = 'faq-row';
  row.innerHTML = `
    <input class="input faq-question" placeholder="Câu hỏi" value="${escapeHtml(question)}" />
    <textarea class="textarea faq-answer" rows="2" placeholder="Câu trả lời">${escapeHtml(answer)}</textarea>
    <button class="icon-btn js-remove-faq" type="button">✕</button>
  `;
  box.appendChild(row);
}

function readFaqs() {
  return Array.from(document.querySelectorAll('#svcFaqs .faq-row'))
    .map((row) => ({
      question: row.querySelector('.faq-question')?.value?.trim() || '',
      answer: row.querySelector('.faq-answer')?.value?.trim() || ''
    }))
    .filter((item) => item.question && item.answer);
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được file ảnh.'));
    reader.readAsDataURL(file);
  });
}

function showServiceImagePlaceholder(message = 'Chưa có ảnh') {
  const preview = document.getElementById('svcImagePreview');
  const empty = document.getElementById('svcImagePreviewEmpty');
  if (preview) {
    preview.hidden = true;
    preview.removeAttribute('src');
  }
  if (empty) {
    empty.hidden = false;
    empty.textContent = message;
  }
}

function updateServiceImagePreview(url) {
  const value = String(url || '').trim();
  const preview = document.getElementById('svcImagePreview');
  const empty = document.getElementById('svcImagePreviewEmpty');
  if (!preview || !empty) return;

  if (!value) {
    showServiceImagePlaceholder();
    return;
  }

  preview.onload = () => {
    preview.hidden = false;
    empty.hidden = true;
  };
  preview.onerror = () => {
    showServiceImagePlaceholder('Không tải được ảnh');
  };
  preview.hidden = false;
  empty.hidden = true;
  preview.src = value;
}

function setServiceImageUploadState(uploading, message = '', state = 'muted') {
  _serviceImageUploading = Boolean(uploading);

  const uploadButton = document.getElementById('btnUploadServiceImage');
  if (uploadButton) {
    uploadButton.disabled = _serviceImageUploading;
    uploadButton.textContent = _serviceImageUploading ? 'Dang tai...' : 'Tai anh len';
  }

  const saveButton = document.getElementById('btnSaveService');
  if (saveButton) saveButton.disabled = _serviceImageUploading;

  const status = document.getElementById('svcImageUploadStatus');
  if (status) {
    status.textContent = message || '';
    if (state && state !== 'muted') status.dataset.state = state;
    else delete status.dataset.state;
  }
}

function syncServiceImagePreviewFromInput() {
  updateServiceImagePreview(document.getElementById('svcImageUrl')?.value || '');
}

function clearServiceImage() {
  setValue('svcImageUrl', '');
  const fileInput = document.getElementById('svcImageFile');
  if (fileInput) fileInput.value = '';
  setServiceImageUploadState(false, '');
  showServiceImagePlaceholder();
}

async function uploadServiceImageFile(file) {
  if (!file) return;

  if (!SERVICE_IMAGE_UPLOAD_ALLOWED_TYPES.has(file.type)) {
    toast('warn', 'Sai dinh dang', 'Chi ho tro JPG, PNG, WEBP hoac GIF.');
    return;
  }

  if (file.size > SERVICE_IMAGE_UPLOAD_MAX_BYTES) {
    toast('warn', 'Ảnh quá lớn', 'Vui lòng chọn ảnh tối đa 3MB.');
    return;
  }

  const previousUrl = document.getElementById('svcImageUrl')?.value?.trim() || '';

  try {
    const dataUrl = await readFileAsDataUrl(file);
    updateServiceImagePreview(dataUrl);
    setServiceImageUploadState(true, `Dang tai ${file.name}...`);
    const { res, data } = await apiFetch('/admin/services/upload-image', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        dataUrl
      })
    });

    if (!res.ok) {
      setValue('svcImageUrl', previousUrl);
      updateServiceImagePreview(previousUrl);
      setServiceImageUploadState(false, (data && data.message) ? data.message : 'Không thể tải ảnh.', 'bad');
      toast('bad', 'Không thể tải ảnh', (data && data.message) ? data.message : 'Vui lòng thử lại.');
      return;
    }

    const uploadedUrl = String(data?.url || '').trim();
    setValue('svcImageUrl', uploadedUrl);
    updateServiceImagePreview(uploadedUrl);
    setServiceImageUploadState(false, 'Da tai anh len thanh cong.', 'good');
    toast('good', 'Thanh cong', 'Da tai anh len cho dich vu.');
  } catch (error) {
    setValue('svcImageUrl', previousUrl);
    updateServiceImagePreview(previousUrl);
    setServiceImageUploadState(false, error?.message || 'Không thể tải ảnh.', 'bad');
    toast('bad', 'Không thể tải ảnh', error?.message || 'Vui lòng thử lại.');
  } finally {
    const fileInput = document.getElementById('svcImageFile');
    if (fileInput) fileInput.value = '';
  }
}

function servicePayloadFromForm() {
  return {
    name: document.getElementById('svcName')?.value?.trim() || '',
    category: document.getElementById('svcCategory')?.value?.trim() || '',
    durationMinutes: Number(document.getElementById('svcDuration')?.value || 0),
    price: Number(document.getElementById('svcPrice')?.value || 0),
    imageUrl: document.getElementById('svcImageUrl')?.value?.trim() || '',
    shortDescription: document.getElementById('svcShortDescription')?.value?.trim() || '',
    detailDescription: document.getElementById('svcDetailDescription')?.value?.trim() || '',
    benefits: linesFromText('svcBenefits'),
    preparationNotes: linesFromText('svcPreparationNotes'),
    aftercareNotes: linesFromText('svcAftercareNotes'),
    paymentMethods: linesFromText('svcPaymentMethods'),
    faqs: readFaqs(),
    promotionNote: document.getElementById('svcPromotionNote')?.value?.trim() || '',
    status: document.getElementById('svcStatus')?.value || 'visible',
    relatedServiceIds: String(document.getElementById('svcRelatedIds')?.value || '')
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item > 0)
  };
}

function validateServiceForm(payload) {
  if (!payload.name) return 'Tên dịch vụ không được rỗng.';
  if (!payload.category) return 'Danh mục không được rỗng.';
  if (!Number.isFinite(payload.price) || payload.price <= 0) return 'Giá phải lớn hơn 0.';
  if (!Number.isFinite(payload.durationMinutes) || payload.durationMinutes <= 0) return 'Thời lượng phải lớn hơn 0.';
  return '';
}

function openServiceForm(service = null) {
  const editing = Boolean(service);
  document.getElementById('serviceModalTitle').textContent = editing ? 'Sửa dịch vụ' : 'Thêm dịch vụ';
  setValue('svcId', editing ? service.id : '');
  setValue('svcName', service?.name || '');
  setValue('svcCategory', service?.category || '');
  setValue('svcDuration', service?.durationMinutes || service?.duration_min || 60);
  setValue('svcPrice', service?.price || '');
  setValue('svcStatus', service?.status || 'visible');
  setValue('svcImageUrl', service?.imageUrl || service?.image_url || '');
  setValue('svcShortDescription', service?.shortDescription || service?.short_description || service?.description || '');
  setValue('svcDetailDescription', service?.detailDescription || service?.detail_description || '');
  setLines('svcBenefits', service?.benefits || []);
  setLines('svcPreparationNotes', service?.preparationNotes || []);
  setLines('svcAftercareNotes', service?.aftercareNotes || []);
  setLines('svcPaymentMethods', service?.paymentMethods || ['VNPay', 'MoMo', 'QR', 'Tiền mặt']);
  setValue('svcPromotionNote', service?.promotionNote || '');
  setValue('svcRelatedIds', Array.isArray(service?.relatedServiceIds) ? service.relatedServiceIds.join(', ') : '');
  const fileInput = document.getElementById('svcImageFile');
  if (fileInput) fileInput.value = '';
  setServiceImageUploadState(false, '');
  updateServiceImagePreview(service?.imageUrl || service?.image_url || '');
  clearFaqEditor();
  const faqs = Array.isArray(service?.faqs) && service.faqs.length ? service.faqs : [{ question: '', answer: '' }];
  faqs.forEach((item) => addFaqRow(item.question, item.answer));
  openModal('modalService');
  setTimeout(() => document.getElementById('svcName')?.focus(), 0);
}

async function saveService() {
  if (_serviceImageUploading) {
    toast('warn', 'Dang tai anh', 'Cho anh tai xong roi luu dich vu.');
    return;
  }

  const id = Number(document.getElementById('svcId')?.value || 0);
  const payload = servicePayloadFromForm();
  const message = validateServiceForm(payload);
  if (message) {
    toast('warn', 'Thiếu thông tin', message);
    return;
  }

  const { res, data } = await apiFetch(id ? `/admin/services/${id}` : '/admin/services', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    toast('bad', id ? 'Không thể sửa dịch vụ' : 'Không thể thêm dịch vụ', (data && data.message) ? data.message : 'Vui lòng thử lại.');
    return;
  }

  closeModal('modalService');
  toast('good', 'Thành công', id ? 'Đã cập nhật dịch vụ.' : 'Đã thêm dịch vụ.');
  loadServicesAdmin();
}

async function delService(id) {
  if (!confirm('Xóa dịch vụ này?')) return;
  const { res } = await apiFetch(`/admin/services/${id}`, { method:'DELETE' });
  if(!res.ok){
    toast('bad','Không thể xóa','Vui lòng thử lại.');
    return;
  }
  toast('good','Đã xóa','Dịch vụ đã được xóa.');
  loadServicesAdmin();
}

async function loadVouchers() {
  const tbody = document.getElementById('vouchersBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5"><div class="skeleton" style="height:70px"></div></td></tr>`;

  const { res, data } = await apiFetch('/admin/vouchers', { method:'GET' });
  if (!res.ok) {
    toast('bad', 'Lỗi', 'Không tải được danh sách voucher.');
    tbody.innerHTML = '';
    return;
  }

  _adminVouchers = Array.isArray(data) ? data : [];
  const q = (document.getElementById('searchVouchers')?.value || '').trim().toLowerCase();
  const list = q ? _adminVouchers.filter(v => String(v.code||'').toLowerCase().includes(q)) : _adminVouchers;

  tbody.innerHTML = '';
  list.forEach(v => {
    const exp = v.expired_at ? new Date(v.expired_at) : null;
    const expText = exp ? exp.toISOString().slice(0,10) : '—';
    const today = new Date(new Date().toDateString());
    const expBadge = (!exp || exp >= today) ? 'good' : 'bad';
    const expLabel = (!exp || exp >= today) ? 'Còn hạn' : 'Hết hạn';

    tbody.innerHTML += `
      <tr>
        <td><b>${escapeHtml(v.code)}</b></td>
        <td>${Number(v.discount)}%</td>
        <td>${expText}</td>
        <td><span class="badge ${expBadge}">${expLabel}</span></td>
        <td style="white-space:nowrap">
          <button class="btn js-edit-voucher" data-code="${escapeHtml(v.code)}">Sửa</button>
          <button class="btn danger js-del-voucher" data-code="${escapeHtml(v.code)}">Xóa</button>
        </td>
      </tr>
    `;
  });
}

function openVoucherForm(voucher = null) {
  const editing = Boolean(voucher);
  const title = document.getElementById('voucherModalTitle');
  if (title) title.textContent = editing ? 'Sửa voucher' : 'Thêm voucher';
  const original = document.getElementById('vouOriginalCode');
  if (original) original.value = editing ? String(voucher.code || '') : '';
  const code = document.getElementById('vouCode');
  const discount = document.getElementById('vouDiscount');
  const expired = document.getElementById('vouExpiredAt');
  if (code) code.value = editing ? String(voucher.code || '') : '';
  if (discount) discount.value = editing ? Number(voucher.discount || 0) : '';
  if (expired) {
    const exp = voucher?.expired_at ? new Date(voucher.expired_at) : null;
    expired.value = exp && !Number.isNaN(exp.getTime()) ? exp.toISOString().slice(0, 10) : '';
  }
  openModal('modalVoucher');
  setTimeout(() => code?.focus(), 0);
}

function validateVoucherForm(code, discount) {
  if (!/^[A-Za-z0-9_-]{3,50}$/.test(code)) return 'Mã voucher phải từ 3-50 ký tự và chỉ gồm chữ, số, _ hoặc -.';
  if (!Number.isFinite(discount) || discount < 1 || discount > 100) return '% giảm phải trong khoảng 1-100.';
  return '';
}

async function saveVoucher() {
  const originalCode = document.getElementById('vouOriginalCode')?.value?.trim();
  const code = document.getElementById('vouCode')?.value?.trim();
  const discount = Number(document.getElementById('vouDiscount')?.value || 0);
  const expired_at = document.getElementById('vouExpiredAt')?.value;

  const message = validateVoucherForm(code, discount);
  if (message) {
    toast('warn','Dữ liệu chưa hợp lệ', message);
    return;
  }

  const url = originalCode
    ? `/admin/vouchers/${encodeURIComponent(originalCode)}`
    : '/admin/vouchers';
  const { res, data } = await apiFetch(url, {
    method: originalCode ? 'PUT' : 'POST',
    body: JSON.stringify({ code, discount: Number(discount), expired_at: expired_at || null })
  });

  if (!res.ok) {
    toast('bad', originalCode ? 'Không thể sửa voucher' : 'Không thể thêm voucher', (data && data.message) ? data.message : 'Vui lòng thử lại.');
    return;
  }

  closeModal('modalVoucher');
  document.getElementById('vouOriginalCode').value = '';
  document.getElementById('vouCode').value = '';
  document.getElementById('vouDiscount').value = '';
  document.getElementById('vouExpiredAt').value = '';
  toast('good','Thành công', originalCode ? 'Đã cập nhật voucher.' : 'Đã thêm voucher.');
  loadVouchers();
}

async function delVoucher(code) {
  if (!confirm('Xóa voucher này?')) return;
  const { res } = await apiFetch(`/admin/vouchers/${encodeURIComponent(code)}`, { method:'DELETE' });
  if(!res.ok){
    toast('bad','Không thể xóa','Vui lòng thử lại.');
    return;
  }
  toast('good','Đã xóa','Voucher đã được xóa.');
  loadVouchers();
}

async function loadTransactions(){
  const tbody = document.getElementById('transactionsBody');
  if(!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6"><div class="skeleton" style="height:70px"></div></td></tr>`;
  const { res, data } = await apiFetch('/admin/transactions', { method:'GET' });

  if(!res.ok){
    toast('bad','Lỗi','Không tải được giao dịch.');
    tbody.innerHTML='';
    return;
  }

  const tx = Array.isArray(data) ? data : [];
  const q = (document.getElementById('searchTransactions')?.value || '').trim().toLowerCase();
  const list = q ? tx.filter(t => String(t.user_email||'').toLowerCase().includes(q) || String(t.voucher_code||'').toLowerCase().includes(q)) : tx;

  tbody.innerHTML = '';
  list.forEach(t=>{
    const when = formatDateTime(t.created_at);
    const voucher = t.voucher_code ? `<span class="badge primary">${escapeHtml(t.voucher_code)}</span>` : `<span class="badge">—</span>`;
    tbody.innerHTML += `
      <tr>
        <td>#${t.id}</td>
        <td>${escapeHtml(t.user_email || '')}</td>
        <td>${formatVND(t.original_price)}</td>
        <td>-${formatVND(t.discount)}</td>
        <td><b>${formatVND(t.final_price)}</b></td>
        <td>${voucher}<div class="small">${escapeHtml(when)}</div></td>
      </tr>
    `;
  });
}

// ===== BOOKINGS (ADMIN) =====
function bookingStatusLabel(stRaw){
  const st = String(stRaw || '').toLowerCase();
  if (st === 'confirmed') return { badge: 'primary', text: 'Đã xác nhận' };
  if (st === 'completed') return { badge: 'good', text: 'Hoàn thành' };
  if (st === 'cancelled') return { badge: 'bad', text: 'Đã hủy' };
  return { badge: 'warn', text: 'Chờ xác nhận' };
}

function bookingStatusSelect(id, current){
  const st = String(current||'pending').toLowerCase();
  const opts = [
    {v:'pending', t:'Chờ xác nhận'},
    {v:'confirmed', t:'Đã xác nhận'},
    {v:'completed', t:'Hoàn thành'},
    {v:'cancelled', t:'Đã hủy'}
  ];
  return `<select class="input" id="bkSt_${id}" style="min-width:150px">` +
    opts.map(o => `<option value="${o.v}" ${o.v===st?'selected':''}>${o.t}</option>`).join('') +
    `</select>`;
}

async function loadBookings(){
  const tbody = document.getElementById('bookingsBody');
  if(!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7"><div class="skeleton" style="height:70px"></div></td></tr>`;
  const { res, data } = await apiFetch('/admin/bookings', { method:'GET' });
  if(!res.ok){
    toast('bad','Lỗi','Không tải được lịch hẹn.');
    tbody.innerHTML='';
    return;
  }

  const all = Array.isArray(data) ? data : [];
  const q = (document.getElementById('searchBookings')?.value || '').trim().toLowerCase();
  const stFilter = (document.getElementById('filterBookingStatus')?.value || '').trim().toLowerCase();

  let list = all;
  if(q){
    list = list.filter(b => `${b.user_email||''} ${b.service_name||''} ${b.user_name||''}`.toLowerCase().includes(q));
  }
  if(stFilter){
    list = list.filter(b => String(b.status||'').toLowerCase() === stFilter);
  }

  tbody.innerHTML = '';
  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="7" class="muted">Không có lịch hẹn phù hợp.</td></tr>`;
    return;
  }

  list.forEach(b => {
    const date = b.booking_date ? new Date(b.booking_date).toISOString().slice(0,10) : '';
    const timeMatch = String(b.booking_time||'').match(/(\d{2}:\d{2})/);
    const time = timeMatch ? timeMatch[1] : String(b.booking_time||'').slice(0,5);
    const when = `${date} ${time}`.trim();
    const st = bookingStatusLabel(b.status);
    const note = [b.note, b.admin_note].filter(Boolean).map(x => escapeHtml(x)).join('<br>');

    tbody.innerHTML += `
      <tr>
        <td>#${Number(b.id)}</td>
        <td>${escapeHtml(b.user_email||'')}<div class="small muted">${escapeHtml(b.user_name||'')}</div></td>
        <td>${escapeHtml(b.service_name||'')}</td>
        <td><b>${escapeHtml(when)}</b></td>
        <td><span class="badge ${st.badge}">${st.text}</span></td>
        <td class="small">${note || '<span class="muted">—</span>'}</td>
        <td style="min-width:300px">
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            ${bookingStatusSelect(Number(b.id), b.status)}
            <input class="input" id="bkNote_${Number(b.id)}" placeholder="Ghi chú admin" value="${escapeHtml(b.admin_note||'')}" style="min-width:180px" />
            <button class="btn primary js-update-booking" data-id="${Number(b.id)}">Lưu</button>
          </div>
        </td>
      </tr>
    `;
  });
}

async function updateBooking(id){
  const st = document.getElementById(`bkSt_${id}`)?.value;
  const admin_note = document.getElementById(`bkNote_${id}`)?.value?.trim();

  const { res, data } = await apiFetch(`/admin/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: st, admin_note })
  });

  if(!res.ok){
    toast('bad','Không thể cập nhật', (data && data.message) ? data.message : 'Vui lòng thử lại.');
    return;
  }
  toast('good','Thành công','Đã cập nhật lịch hẹn.');
  loadBookings();
}

// bind searches
document.addEventListener('DOMContentLoaded', ()=>{
  document.getElementById('searchUsers')?.addEventListener('input', loadUsers);
  document.getElementById('searchServices')?.addEventListener('input', loadServicesAdmin);
  document.getElementById('searchVouchers')?.addEventListener('input', loadVouchers);
  document.getElementById('searchTransactions')?.addEventListener('input', loadTransactions);
  document.getElementById('searchBookings')?.addEventListener('input', loadBookings);
  document.getElementById('filterBookingStatus')?.addEventListener('change', loadBookings);
  document.getElementById('btnEditUserMode')?.addEventListener('click', () => setUserModalMode('edit'));
  document.getElementById('btnSaveUser')?.addEventListener('click', saveUser);
  document.getElementById('btnDeleteUserModal')?.addEventListener('click', () => deleteUser());
  document.getElementById('usrMember')?.addEventListener('change', syncUserMemberExpiryState);
  document.getElementById('svcImageUrl')?.addEventListener('input', syncServiceImagePreviewFromInput);
  document.getElementById('svcImageFile')?.addEventListener('change', (event) => {
    const file = event.target?.files?.[0];
    if (file) uploadServiceImageFile(file);
  });

  document.getElementById('btnAddService')?.addEventListener('click', () => openServiceForm());
  document.getElementById('btnSaveService')?.addEventListener('click', saveService);
  document.getElementById('btnEditServiceFromDetail')?.addEventListener('click', () => {
    const serviceId = Number(document.getElementById('serviceDetailId')?.value || 0);
    const service = _adminServices.find((item) => Number(item.id) === serviceId);
    if (!service) return;
    closeModal('modalServiceDetail');
    openServiceForm(service);
  });
  document.getElementById('btnAddFaq')?.addEventListener('click', () => addFaqRow());
  document.getElementById('btnUploadServiceImage')?.addEventListener('click', () => {
    if (_serviceImageUploading) return;
    document.getElementById('svcImageFile')?.click();
  });
  document.getElementById('btnClearServiceImage')?.addEventListener('click', clearServiceImage);

  document.getElementById('btnAddVoucher')?.addEventListener('click', () => openVoucherForm());
  document.getElementById('btnSaveVoucher')?.addEventListener('click', saveVoucher);

  loadUsers();
  loadServicesAdmin();
  loadVouchers();
  loadTransactions();
  loadBookings();
});


document.addEventListener('click', (e) => {
  const t = e.target;
  if (!(t instanceof HTMLElement)) return;
  const btnViewUser = t.closest('.js-view-user');
  if (btnViewUser) {
    e.preventDefault();
    const user = _adminUsers.find((item) => Number(item.id) === Number(btnViewUser.dataset.id));
    if (user) openUserModal(user, 'view');
    return;
  }
  const btnEditUser = t.closest('.js-edit-user');
  if (btnEditUser) {
    e.preventDefault();
    const user = _adminUsers.find((item) => Number(item.id) === Number(btnEditUser.dataset.id));
    if (user) openUserModal(user, 'edit');
    return;
  }
  const btnViewService = t.closest('.js-view-service');
  if (btnViewService) {
    e.preventDefault();
    const service = _adminServices.find((item) => Number(item.id) === Number(btnViewService.dataset.id));
    if (service) openServiceDetail(service);
    return;
  }
  const btnEditService = t.closest('.js-edit-service');
  if (btnEditService) {
    e.preventDefault();
    const service = _adminServices.find((item) => Number(item.id) === Number(btnEditService.dataset.id));
    if (service) openServiceForm(service);
    return;
  }
  const btnRemoveFaq = t.closest('.js-remove-faq');
  if (btnRemoveFaq) {
    e.preventDefault();
    btnRemoveFaq.closest('.faq-row')?.remove();
    if (!document.querySelector('#svcFaqs .faq-row')) addFaqRow();
    return;
  }
  const btnEditVoucher = t.closest('.js-edit-voucher');
  if (btnEditVoucher) {
    e.preventDefault();
    const voucher = _adminVouchers.find((item) => String(item.code) === String(btnEditVoucher.dataset.code));
    if (voucher) openVoucherForm(voucher);
    return;
  }
  const btnDeleteUser = t.closest('.js-del-user');
  if (btnDeleteUser) { e.preventDefault(); deleteUser(btnDeleteUser.dataset.id); return; }
  const btnService = t.closest('.js-del-service');
  if (btnService) { e.preventDefault(); delService(btnService.dataset.id); return; }
  const btnVoucher = t.closest('.js-del-voucher');
  if (btnVoucher) { e.preventDefault(); delVoucher(btnVoucher.dataset.code); return; }
  const btnUpd = t.closest('.js-update-booking');
  if (btnUpd) { e.preventDefault(); updateBooking(btnUpd.dataset.id); return; }
});
