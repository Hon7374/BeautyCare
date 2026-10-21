const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const SERVICE_IMAGE_PUBLIC_PREFIX = '/assets/services';
const SERVICE_IMAGE_DIR = path.join(__dirname, '..', '..', 'frontend', 'assets', 'services');
const MAX_SERVICE_IMAGE_BYTES = 3 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif']
]);

function createValidationError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function sanitizeBaseName(fileName) {
  const parsed = path.parse(String(fileName || 'service-image').trim() || 'service-image');
  const baseName = String(parsed.name || 'service-image')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return baseName || 'service-image';
}

function parseServiceImageDataUrl(dataUrl) {
  const text = String(dataUrl || '').trim();
  const matched = text.match(/^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i);
  if (!matched) {
    throw createValidationError('Du lieu anh khong hop le.');
  }

  const mimeType = String(matched[1] || '').trim().toLowerCase();
  const extension = ALLOWED_IMAGE_TYPES.get(mimeType);
  if (!extension) {
    throw createValidationError('Chi ho tro JPG, PNG, WEBP hoac GIF.');
  }

  const base64 = matched[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    throw createValidationError('Khong doc duoc file anh.');
  }

  if (buffer.length > MAX_SERVICE_IMAGE_BYTES) {
    throw createValidationError('Anh vuot qua gioi han 3MB.');
  }

  return { buffer, mimeType, extension };
}

function buildStoredFileName(fileName, extension) {
  const safeBaseName = sanitizeBaseName(fileName);
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  return `${uniqueSuffix}-${safeBaseName}.${extension}`;
}

async function saveServiceImageUpload({ dataUrl, fileName }) {
  const parsed = parseServiceImageDataUrl(dataUrl);
  const storedFileName = buildStoredFileName(fileName, parsed.extension);
  const savedPath = path.join(SERVICE_IMAGE_DIR, storedFileName);

  await fs.mkdir(SERVICE_IMAGE_DIR, { recursive: true });
  await fs.writeFile(savedPath, parsed.buffer);

  return {
    fileName: storedFileName,
    url: `${SERVICE_IMAGE_PUBLIC_PREFIX}/${storedFileName}`,
    bytes: parsed.buffer.length,
    mimeType: parsed.mimeType
  };
}

function resolveServiceImagePath(publicUrl) {
  const normalized = String(publicUrl || '').trim();
  if (!normalized.startsWith(`${SERVICE_IMAGE_PUBLIC_PREFIX}/`)) return null;
  const fileName = path.basename(normalized);
  return path.join(SERVICE_IMAGE_DIR, fileName);
}

module.exports = {
  MAX_SERVICE_IMAGE_BYTES,
  SERVICE_IMAGE_PUBLIC_PREFIX,
  saveServiceImageUpload,
  resolveServiceImagePath
};
