const DEFAULT_PAYMENT_METHODS = ['VNPay', 'MoMo', 'QR', 'Tiền mặt'];

const SERVICE_DETAIL_COLUMNS = [
  ['short_description', 'TEXT NULL'],
  ['detail_description', 'LONGTEXT NULL'],
  ['benefits_json', 'LONGTEXT NULL'],
  ['preparation_notes_json', 'LONGTEXT NULL'],
  ['aftercare_notes_json', 'LONGTEXT NULL'],
  ['faqs_json', 'LONGTEXT NULL'],
  ['payment_methods_json', 'LONGTEXT NULL'],
  ['promotion_note', 'TEXT NULL'],
  ['status', "VARCHAR(20) NOT NULL DEFAULT 'visible'"],
  ['related_service_ids_json', 'TEXT NULL']
];

let schemaReady = false;

function safeString(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function truncateText(value, maxLength) {
  const text = safeString(value);
  if (!text || !Number.isFinite(maxLength) || maxLength <= 0) return text;
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function toPositiveInt(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.trunc(number);
}

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (value === undefined || value === null || value === '') return fallback;
  try {
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
}

function asArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => safeString(item)).filter(Boolean);
  }

  if (typeof value === 'string') {
    const parsed = parseJson(value, null);
    if (Array.isArray(parsed)) return asArray(parsed);
    return value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  return [];
}

function asFaqs(value) {
  const parsed = typeof value === 'string' ? parseJson(value, value) : value;
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => ({
        question: safeString(item?.question ?? item?.q),
        answer: safeString(item?.answer ?? item?.a)
      }))
      .filter((item) => item.question && item.answer);
  }

  if (typeof parsed === 'string') {
    return parsed
      .split(/\r?\n/)
      .map((line) => {
        const [question, ...rest] = line.split('|');
        return {
          question: safeString(question),
          answer: safeString(rest.join('|'))
        };
      })
      .filter((item) => item.question && item.answer);
  }

  return [];
}

function asIdArray(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item > 0);
  }

  const parsed = typeof value === 'string' ? parseJson(value, null) : null;
  if (Array.isArray(parsed)) return asIdArray(parsed);

  return String(value ?? '')
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function encodeJson(value) {
  return JSON.stringify(value ?? []);
}

async function ensureServiceSchema(pool) {
  if (schemaReady) return;

  const rows = await pool.query('SHOW COLUMNS FROM services');
  const existing = new Set((rows || []).map((row) => String(row.Field).toLowerCase()));

  for (const [name, ddl] of SERVICE_DETAIL_COLUMNS) {
    if (existing.has(name)) continue;
    await pool.query(`ALTER TABLE services ADD COLUMN ${name} ${ddl}`);
  }

  schemaReady = true;
}

function normalizeStatus(value) {
  const status = safeString(value, 'visible').toLowerCase();
  if (['hidden', 'inactive', 'draft', '0', 'false'].includes(status)) return 'hidden';
  return 'visible';
}

function normalizeService(row = {}) {
  const description = safeString(row.description);
  const shortDescription = safeString(row.short_description ?? row.shortDescription, description);
  const detailDescription = safeString(row.detail_description ?? row.detailDescription, description || shortDescription);
  const category = safeString(row.category, 'Chưa phân loại');
  const durationMinutes = Math.max(1, toPositiveInt(row.duration_min ?? row.durationMinutes, 60));
  const imageUrl = safeString(row.image_url ?? row.imageUrl, '/assets/services/default-service.svg');
  const paymentMethods = asArray(row.payment_methods_json ?? row.paymentMethods);

  return {
    id: Number(row.id),
    name: safeString(row.name),
    category,
    durationMinutes,
    duration_min: durationMinutes,
    price: toPositiveInt(row.price, 0),
    imageUrl,
    image_url: imageUrl,
    shortDescription,
    short_description: shortDescription,
    detailDescription,
    detail_description: detailDescription,
    description: shortDescription || detailDescription,
    benefits: asArray(row.benefits_json ?? row.benefits),
    preparationNotes: asArray(row.preparation_notes_json ?? row.preparationNotes),
    aftercareNotes: asArray(row.aftercare_notes_json ?? row.aftercareNotes),
    faqs: asFaqs(row.faqs_json ?? row.faqs),
    paymentMethods: paymentMethods.length ? paymentMethods : DEFAULT_PAYMENT_METHODS,
    promotionNote: safeString(row.promotion_note ?? row.promotionNote, 'Ưu đãi hội viên và voucher được áp dụng ở bước thanh toán.'),
    status: normalizeStatus(row.status),
    relatedServiceIds: asIdArray(row.related_service_ids_json ?? row.relatedServiceIds),
    is_featured: Number(row.is_featured || 0)
  };
}

function normalizeServiceInput(body = {}) {
  const durationMinutes = toPositiveInt(body.durationMinutes ?? body.duration_min, 0);
  const shortDescription = safeString(body.shortDescription ?? body.short_description ?? body.description);
  const detailDescription = safeString(body.detailDescription ?? body.detail_description, shortDescription);

  return {
    name: safeString(body.name),
    category: safeString(body.category),
    durationMinutes,
    price: toPositiveInt(body.price, 0),
    imageUrl: safeString(body.imageUrl ?? body.image_url),
    shortDescription,
    detailDescription,
    benefits: asArray(body.benefits),
    preparationNotes: asArray(body.preparationNotes ?? body.preparation_notes),
    aftercareNotes: asArray(body.aftercareNotes ?? body.aftercare_notes),
    faqs: asFaqs(body.faqs),
    paymentMethods: asArray(body.paymentMethods ?? body.payment_methods),
    promotionNote: safeString(body.promotionNote ?? body.promotion_note),
    status: normalizeStatus(body.status),
    relatedServiceIds: asIdArray(body.relatedServiceIds ?? body.related_service_ids)
  };
}

function validateServiceInput(service) {
  if (!service.name) return 'Tên dịch vụ không được rỗng';
  if (!service.category) return 'Danh mục không được rỗng';
  if (!Number.isFinite(service.price) || service.price <= 0) return 'Giá phải lớn hơn 0';
  if (!Number.isFinite(service.durationMinutes) || service.durationMinutes <= 0) return 'Thời lượng phải lớn hơn 0';
  return null;
}

function bindServiceInput(request, service) {
  return request
    .input('name', service.name)
    .input('category', service.category)
    .input('duration_min', service.durationMinutes)
    .input('price', service.price)
    .input('image_url', service.imageUrl || null)
    .input('short_description', service.shortDescription || null)
    .input('detail_description', service.detailDescription || null)
    .input('description', truncateText(service.shortDescription || service.detailDescription, 255) || null)
    .input('benefits_json', encodeJson(service.benefits))
    .input('preparation_notes_json', encodeJson(service.preparationNotes))
    .input('aftercare_notes_json', encodeJson(service.aftercareNotes))
    .input('faqs_json', encodeJson(service.faqs))
    .input('payment_methods_json', encodeJson(service.paymentMethods.length ? service.paymentMethods : DEFAULT_PAYMENT_METHODS))
    .input('promotion_note', service.promotionNote || null)
    .input('status', service.status)
    .input('related_service_ids_json', encodeJson(service.relatedServiceIds));
}

const SERVICE_SELECT_FIELDS = `
  id,
  name,
  price,
  description,
  category,
  duration_min,
  image_url,
  is_featured,
  short_description,
  detail_description,
  benefits_json,
  preparation_notes_json,
  aftercare_notes_json,
  faqs_json,
  payment_methods_json,
  promotion_note,
  status,
  related_service_ids_json
`;

module.exports = {
  DEFAULT_PAYMENT_METHODS,
  SERVICE_SELECT_FIELDS,
  ensureServiceSchema,
  normalizeService,
  normalizeServiceInput,
  validateServiceInput,
  bindServiceInput,
  encodeJson
};
