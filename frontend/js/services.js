let _services = [];
let _activeCat = 'all';

const DEFAULT_SERVICE_IMAGE = '/assets/services/default-service.svg';
const LOCAL_SERVICE_IMAGES = {
  'goi dau duong sinh': '/assets/services/goi-dau-duong-sinh.jpg',
  'cham soc mong chan': '/assets/services/cham-soc-mong-chan.svg'
};

function serviceFallbackImage(service) {
  return LOCAL_SERVICE_IMAGES[normalize(service?.name || '')] || DEFAULT_SERVICE_IMAGE;
}

function serviceImageUrl(service) {
  const name = normalize(service?.name || '');
  if (name === 'goi dau duong sinh') return LOCAL_SERVICE_IMAGES[name];

  const image = String(service?.imageUrl || service?.image_url || '').trim();
  return image || serviceFallbackImage(service);
}

function bindServiceImageFallbacks(root = document) {
  root.querySelectorAll('img[data-service-fallback]').forEach((img) => {
    img.addEventListener('error', () => {
      if (img.dataset.fallbackApplied === '1') return;
      img.dataset.fallbackApplied = '1';
      img.src = img.dataset.serviceFallback || DEFAULT_SERVICE_IMAGE;
    });
  });
}

function bookService(serviceId) {
  const service = _services.find((item) => Number(item.id) === Number(serviceId));
  if (!service) return;
  localStorage.setItem('booking_service', JSON.stringify(service));
  window.location.href = '/user/booking.html';
}

function normalize(text = '') {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getCategory(service) {
  return String(service.category || 'Chưa phân loại').trim() || 'Chưa phân loại';
}

function uniqueCategories(services) {
  const seen = new Map();
  (services || []).forEach((service) => {
    const category = getCategory(service);
    if (!seen.has(category)) seen.set(category, true);
  });
  return Array.from(seen.keys());
}

function categoryBadge(category) {
  const key = normalize(category);
  if (key.includes('da')) return 'DA';
  if (key.includes('body')) return 'BD';
  if (key.includes('lam dep')) return 'SPA';
  if (key.includes('mong')) return 'MN';
  return 'DV';
}

function categoryDescription(category) {
  const key = normalize(category);
  if (key.includes('da')) return 'Làm sạch, phục hồi và nuôi dưỡng làn da theo từng nhu cầu.';
  if (key.includes('body')) return 'Massage và chăm sóc cơ thể để thư giãn, giảm mỏi và ngủ ngon hơn.';
  if (key.includes('lam dep')) return 'Các liệu trình làm đẹp hiện đại, an toàn và dễ đặt lịch nhanh.';
  if (key.includes('mong')) return 'Chăm sóc móng gọn gàng, sạch đẹp và phù hợp nhiều phong cách.';
  return 'Dịch vụ bổ sung với quy trình rõ ràng và giá minh bạch.';
}

function serviceDuration(service) {
  const duration = Number(service?.durationMinutes || service?.duration_min || 60);
  return Number.isFinite(duration) && duration > 0 ? Math.trunc(duration) : 60;
}

function shortLine(service) {
  const text = String(
    service?.shortDescription ||
      service?.short_description ||
      service?.description ||
      service?.detailDescription ||
      service?.detail_description ||
      ''
  ).trim();
  if (!text) return 'Liệu trình chuyên nghiệp, thời gian linh hoạt và phù hợp nhiều nhu cầu chăm sóc.';
  const first = text.split('\n').map((line) => line.trim()).find(Boolean) || text;
  return first.replace(/\s+/g, ' ').slice(0, 140);
}

function renderSidebar(categories) {
  const wrap = document.getElementById('svcCats');
  if (!wrap) return;

  const counts = {};
  (_services || []).forEach((service) => {
    const category = getCategory(service);
    counts[category] = (counts[category] || 0) + 1;
  });

  const items = [
    {
      key: 'all',
      label: 'Tất cả dịch vụ',
      icon: 'ALL',
      count: (_services || []).length,
      desc: 'Xem toàn bộ liệu trình đang có tại BeautyCare.'
    },
    ...categories.map((category) => ({
      key: category,
      label: category,
      icon: categoryBadge(category),
      count: counts[category] || 0,
      desc: categoryDescription(category)
    }))
  ];

  wrap.innerHTML = items
    .map(
      (item) => `
        <div class="cat-item ${_activeCat === item.key ? 'active' : ''}" data-cat="${escapeHtml(item.key)}">
          <div class="cat-left">
            <div class="cat-icon">${escapeHtml(item.icon)}</div>
            <div style="min-width:0">
              <div class="cat-name">${escapeHtml(item.label)}</div>
              <div class="muted small" style="margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(item.desc)}</div>
            </div>
          </div>
          <div class="cat-count">${Number(item.count)}</div>
        </div>
      `
    )
    .join('');

  wrap.querySelectorAll('.cat-item').forEach((item) => {
    item.addEventListener('click', () => {
      _activeCat = item.dataset.cat || 'all';
      wrap.querySelectorAll('.cat-item').forEach((node) => node.classList.toggle('active', node === item));
      applyFilters();
      document.querySelector('.svc-main')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function renderMainHead() {
  const head = document.getElementById('svcMainHead');
  if (!head) return;

  const keyword = (document.getElementById('q')?.value || '').trim();

  let title = 'Tất cả dịch vụ';
  let subtitle = 'Chọn liệu trình phù hợp, xem thông tin nhanh và đặt lịch ngay trong vài bước.';

  if (_activeCat !== 'all') {
    title = _activeCat;
    subtitle = categoryDescription(_activeCat);
  }

  if (keyword) {
    subtitle = `Kết quả tìm kiếm cho "${keyword}".`;
  }

  head.innerHTML = `
    <div>
      <div class="h2" style="margin:0">${escapeHtml(title)}</div>
      <div class="muted small" style="margin-top:4px">${escapeHtml(subtitle)}</div>
    </div>
  `;
}

function renderList(list) {
  const wrap = document.getElementById('serviceList');
  if (!wrap) return;

  if (!(list || []).length) {
    wrap.innerHTML = '<div class="card"><p class="muted">Không có dịch vụ phù hợp với bộ lọc hiện tại.</p></div>';
    return;
  }

  wrap.innerHTML = `
    <div class="service-grid">
      ${(list || [])
        .map((service) => {
          const duration = serviceDuration(service);
          const featured = Number(service.is_featured || 0) ? '<span class="badge primary">Nổi bật</span>' : '';
          const image = serviceImageUrl(service);
          const fallbackImage = serviceFallbackImage(service);
          return `
            <article class="service-card">
              <div class="service-card__media">
                <div class="service-card__thumb">
                  <img class="service-card__image" src="${escapeHtml(image)}" alt="${escapeHtml(service.name || 'Dịch vụ BeautyCare')}" loading="lazy" referrerpolicy="no-referrer" data-service-fallback="${escapeHtml(fallbackImage)}">
                </div>
                <div class="service-card__badges">
                  ${featured}
                  <span class="badge">${duration} phút</span>
                </div>
              </div>

              <div class="service-card__body">
                <div class="row-between" style="align-items:flex-start;gap:12px">
                  <div style="min-width:0">
                    <div class="h3" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(service.name || '')}</div>
                    <div class="muted small" style="margin-top:2px">${escapeHtml(shortLine(service))}</div>
                  </div>
                  <div class="badge">${Number(service.price || 0).toLocaleString('vi-VN')} đ</div>
                </div>

                <div class="service-card__actions">
                  <button class="btn primary js-book" data-id="${Number(service.id)}">Đặt lịch</button>
                  <a class="btn ghost" href="/user/service-detail.html?id=${Number(service.id)}">Xem chi tiết</a>
                </div>
              </div>
            </article>
          `;
        })
        .join('')}
    </div>
  `;

  wrap.querySelectorAll('.js-book').forEach((button) => {
    button.addEventListener('click', () => bookService(button.dataset.id));
  });
  bindServiceImageFallbacks(wrap);
}

function applyFilters() {
  const keyword = normalize(document.getElementById('q')?.value || '');

  const filtered = (_services || []).filter((service) => {
    const matchCategory = _activeCat === 'all' ? true : getCategory(service) === _activeCat;
    const matchName = !keyword ? true : normalize(service.name || '').includes(keyword);
    return matchCategory && matchName;
  });

  renderMainHead();
  renderList(filtered);
}

async function loadServices() {
  try {
    const data = await apiGet('/services');
    _services = (data?.services || data || []).filter(
      (service) => String(service?.status || 'visible').toLowerCase() !== 'hidden'
    );

    renderSidebar(uniqueCategories(_services));
    document.getElementById('q')?.addEventListener('input', applyFilters);
    applyFilters();
  } catch (error) {
    window.toast?.('bad', 'Lỗi', 'Không tải được danh sách dịch vụ.');
    console.error(error);
  }
}

loadServices();
