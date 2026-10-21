function getId() {
  const url = new URL(window.location.href);
  return Number(url.searchParams.get('id') || 0);
}

function asText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => asText(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return asArray(parsed);
    } catch (_) {
      // Plain textarea-style content: one item per line.
    }
    return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  return [];
}

function asFaqs(value) {
  const parsed = typeof value === 'string' ? (() => {
    try {
      return JSON.parse(value);
    } catch (_) {
      return value;
    }
  })() : value;

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => ({
        question: asText(item?.question ?? item?.q),
        answer: asText(item?.answer ?? item?.a)
      }))
      .filter((item) => item.question && item.answer);
  }

  return [];
}

function asIds(value) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((item) => Number.isInteger(item) && item > 0);
  }

  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return asIds(parsed);
    } catch (_) {
      // Comma-separated IDs from older data.
    }
    return text.split(',').map((item) => Number(item.trim())).filter((item) => Number.isInteger(item) && item > 0);
  }

  return [];
}

function serviceName(service) {
  return asText(service?.name, 'Dịch vụ BeautyCare');
}

function serviceCategory(service) {
  return asText(service?.category, 'Chưa phân loại');
}

function serviceDuration(service) {
  const duration = Number(service?.durationMinutes ?? service?.duration_min ?? 60);
  return Number.isFinite(duration) && duration > 0 ? Math.trunc(duration) : 60;
}

const DEFAULT_SERVICE_IMAGE = '/assets/services/default-service.svg';
const LOCAL_SERVICE_IMAGES = {
  'goi dau duong sinh': '/assets/services/goi-dau-duong-sinh.jpg',
  'cham soc mong chan': '/assets/services/cham-soc-mong-chan.svg'
};

function normalizedServiceName(service) {
  return String(service?.name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function serviceFallbackImage(service) {
  return LOCAL_SERVICE_IMAGES[normalizedServiceName(service)] || DEFAULT_SERVICE_IMAGE;
}

function serviceImageUrl(service) {
  const name = normalizedServiceName(service);
  if (name === 'goi dau duong sinh') return LOCAL_SERVICE_IMAGES[name];

  return asText(service?.imageUrl ?? service?.image_url) || serviceFallbackImage(service);
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

function serviceShortDescription(service) {
  return asText(service?.shortDescription ?? service?.short_description ?? service?.description);
}

function serviceDetailDescription(service) {
  return asText(
    service?.detailDescription ?? service?.detail_description,
    serviceShortDescription(service) || 'Thông tin chi tiết của dịch vụ sẽ được BeautyCare cập nhật thêm.'
  );
}

function servicePaymentMethods(service) {
  const methods = asArray(service?.paymentMethods ?? service?.payment_methods_json ?? service?.payment_methods);
  return methods.length ? methods : ['VNPay', 'MoMo', 'QR', 'Tiền mặt'];
}

function servicePromotionNote(service) {
  return asText(
    service?.promotionNote ?? service?.promotion_note,
    'Ưu đãi hội viên và voucher được áp dụng ở bước thanh toán.'
  );
}

function normalizeService(service) {
  return {
    ...service,
    id: Number(service?.id),
    name: serviceName(service),
    category: serviceCategory(service),
    durationMinutes: serviceDuration(service),
    duration_min: serviceDuration(service),
    price: Number(service?.price || 0),
    imageUrl: serviceImageUrl(service),
    image_url: serviceImageUrl(service),
    shortDescription: serviceShortDescription(service),
    detailDescription: serviceDetailDescription(service),
    benefits: asArray(service?.benefits ?? service?.benefits_json),
    preparationNotes: asArray(service?.preparationNotes ?? service?.preparation_notes_json ?? service?.preparation_notes),
    aftercareNotes: asArray(service?.aftercareNotes ?? service?.aftercare_notes_json ?? service?.aftercare_notes),
    faqs: asFaqs(service?.faqs ?? service?.faqs_json),
    paymentMethods: servicePaymentMethods(service),
    promotionNote: servicePromotionNote(service),
    status: asText(service?.status, 'visible').toLowerCase(),
    relatedServiceIds: asIds(service?.relatedServiceIds ?? service?.related_service_ids_json ?? service?.related_service_ids)
  };
}

function bookService(service) {
  if (!service) return;
  localStorage.setItem('booking_service', JSON.stringify(service));
  window.location.href = '/user/booking.html';
}

function paragraphs(text) {
  const value = asText(text);
  if (!value) return [];
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function paragraphHtml(text) {
  const items = paragraphs(text);
  if (!items.length) {
    return '<p class="muted" style="margin:8px 0">Chưa có mô tả chi tiết cho dịch vụ này.</p>';
  }
  return items.map((line) => `<p class="muted" style="margin:8px 0">${escapeHtml(line)}</p>`).join('');
}

function listHtml(items, emptyText) {
  const list = asArray(items);
  if (!list.length) return `<div class="muted small">${escapeHtml(emptyText)}</div>`;
  return `<ul class="sd-list">${list.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
}

function faqHtml(faqs) {
  const list = asFaqs(faqs);
  if (!list.length) return '<div class="muted small">Chưa có câu hỏi thường gặp cho dịch vụ này.</div>';
  return `
    <div class="sd-faq">
      ${list
        .map(
          (item, index) => `
            <details ${index === 0 ? 'open' : ''}>
              <summary>${escapeHtml(item.question)}</summary>
              <div class="muted" style="margin-top:8px">${escapeHtml(item.answer)}</div>
            </details>
          `
        )
        .join('')}
    </div>
  `;
}

function relatedCard(service) {
  const fallbackImage = serviceFallbackImage(service);
  return `
    <a class="service-rel" href="/user/service-detail.html?id=${Number(service.id)}">
      <img class="service-rel__thumb" src="${escapeHtml(service.imageUrl)}" alt="${escapeHtml(service.name)}" loading="lazy" referrerpolicy="no-referrer" data-service-fallback="${escapeHtml(fallbackImage)}">
      <div style="min-width:0">
        <div class="service-rel__name">${escapeHtml(service.name)}</div>
        <div class="muted small">${escapeHtml(service.category)} • ${Number(service.durationMinutes)} phút</div>
      </div>
    </a>
  `;
}

function findRelatedServices(service, services) {
  const activeServices = (services || []).filter(
    (item) => Number(item.id) !== Number(service.id) && String(item.status || 'visible').toLowerCase() !== 'hidden'
  );

  const byId = service.relatedServiceIds
    .map((id) => activeServices.find((item) => Number(item.id) === Number(id)))
    .filter(Boolean);

  if (byId.length) return byId.slice(0, 5);

  return activeServices
    .filter((item) => item.category === service.category)
    .slice(0, 5);
}

function renderDetail(service, related = []) {
  const wrap = document.getElementById('detailWrap');
  if (!wrap) return;

  const price = Number(service.price || 0).toLocaleString('vi-VN');
  const fallbackImage = serviceFallbackImage(service);
  const paymentMethods = service.paymentMethods.join(' • ');

  wrap.innerHTML = `
    <div class="card hero-card service-detail">
      <div class="service-detail__head">
        <div>
          <h2 style="margin:0">${escapeHtml(service.name)}</h2>
          <div class="muted" style="margin-top:6px">${escapeHtml(service.category)} • ${Number(service.durationMinutes)} phút</div>
          ${service.shortDescription ? `<p class="muted" style="margin:10px 0 0">${escapeHtml(service.shortDescription)}</p>` : ''}
        </div>
        <div class="service-detail__cta">
          <div class="badge">${price} đ</div>
          <button class="btn primary" id="btnBook">Đặt lịch</button>
          <a class="btn ghost" href="/user/services.html">Quay lại</a>
        </div>
      </div>

      <div class="service-detail__media">
        <img class="service-detail__image" src="${escapeHtml(service.imageUrl)}" alt="${escapeHtml(service.name)}" loading="lazy" referrerpolicy="no-referrer" data-service-fallback="${escapeHtml(fallbackImage)}">
      </div>

      <div class="service-detail__grid">
        <div>
          <h3>Mô tả chi tiết</h3>
          ${paragraphHtml(service.detailDescription)}

          <div class="sd-block">
            <h3>Lợi ích nổi bật</h3>
            ${listHtml(service.benefits, 'Chưa có lợi ích nổi bật được cập nhật.')}
          </div>

          <div class="sd-block">
            <h3>Chuẩn bị trước khi đến</h3>
            ${listHtml(service.preparationNotes, 'Chưa có hướng dẫn chuẩn bị riêng cho dịch vụ này.')}
          </div>

          <div class="sd-block">
            <h3>Chăm sóc sau dịch vụ</h3>
            ${listHtml(service.aftercareNotes, 'Chưa có lưu ý chăm sóc sau dịch vụ.')}
          </div>

          <div class="sd-block">
            <h3>Câu hỏi thường gặp</h3>
            ${faqHtml(service.faqs)}
          </div>
        </div>

        <aside class="sd-aside">
          <div class="sd-panel">
            <div class="h3">Thông tin nhanh</div>
            <div style="margin-top:10px" class="muted">
              <div><b>Danh mục:</b> ${escapeHtml(service.category)}</div>
              <div style="margin-top:6px"><b>Thời lượng:</b> ${Number(service.durationMinutes)} phút</div>
              <div style="margin-top:6px"><b>Giá:</b> ${price} đ</div>
              <div style="margin-top:6px"><b>Thanh toán:</b> ${escapeHtml(paymentMethods)}</div>
              <div style="margin-top:6px"><b>Ưu đãi:</b> ${escapeHtml(service.promotionNote)}</div>
            </div>
            <button class="btn primary" style="margin-top:14px;width:100%" id="btnBook2">Đặt lịch ngay</button>
          </div>

          <div class="sd-panel sd-panel--spaced">
            <div class="h3">Dịch vụ liên quan</div>
            <div class="sd-related" style="margin-top:10px">
              ${related.length ? related.map(relatedCard).join('') : '<div class="muted small">Chưa có dịch vụ liên quan.</div>'}
            </div>
          </div>
        </aside>
      </div>
    </div>
  `;

  document.getElementById('btnBook')?.addEventListener('click', () => bookService(service));
  document.getElementById('btnBook2')?.addEventListener('click', () => bookService(service));
  bindServiceImageFallbacks(wrap);
}

async function loadDetail() {
  const id = getId();
  const wrap = document.getElementById('detailWrap');
  if (!wrap) return;

  if (!id) {
    wrap.innerHTML = '<div class="card"><p class="muted">Thiếu tham số id.</p></div>';
    return;
  }

  try {
    const data = await apiGet('/services');
    const list = (data?.services || data || []).map(normalizeService);
    const service = list.find((item) => Number(item.id) === Number(id));
    if (!service) {
      wrap.innerHTML = '<div class="card"><p class="muted">Không tìm thấy dịch vụ.</p></div>';
      return;
    }

    renderDetail(service, findRelatedServices(service, list));
  } catch (error) {
    console.error(error);
    wrap.innerHTML = '<div class="card"><p class="muted">Không tải được dữ liệu dịch vụ.</p></div>';
  }
}

document.addEventListener('DOMContentLoaded', loadDetail);
