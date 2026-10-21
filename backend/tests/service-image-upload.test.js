const fs = require('fs/promises');
const path = require('path');

const express = require('express');
const request = require('supertest');

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+KDvY1gAAAABJRU5ErkJggg==';
const SVG_DATA_URL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjwvc3ZnPg==';

function createApp() {
  const router = require('../routes/admin');
  const app = express();
  app.use(express.json({ limit: '6mb' }));
  app.use('/api/admin', router);
  return app;
}

describe('Admin service image upload', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('uploads a PNG image and returns a public asset URL', async () => {
    jest.resetModules();
    jest.doMock('../middleware/auth', () => ({
      verify(req, res, next) {
        req.user = { id: 1, role: 'admin' };
        next();
      },
      admin(req, res, next) {
        next();
      }
    }));
    jest.doMock('../utils/audit', () => ({
      audit: jest.fn().mockResolvedValue()
    }));

    const app = createApp();
    const res = await request(app).post('/api/admin/services/upload-image').send({
      fileName: 'sample-service.png',
      dataUrl: PNG_DATA_URL
    });

    expect(res.status).toBe(201);
    expect(String(res.body?.url || '')).toMatch(/^\/assets\/services\/.+\.png$/);

    const savedPath = path.join(
      __dirname,
      '..',
      '..',
      'frontend',
      ...String(res.body.url).replace(/^\/+/, '').split('/')
    );

    try {
      await expect(fs.stat(savedPath)).resolves.toBeDefined();
    } finally {
      await fs.unlink(savedPath).catch(() => {});
    }
  });

  test('rejects unsupported image types', async () => {
    jest.resetModules();
    jest.doMock('../middleware/auth', () => ({
      verify(req, res, next) {
        req.user = { id: 1, role: 'admin' };
        next();
      },
      admin(req, res, next) {
        next();
      }
    }));
    jest.doMock('../utils/audit', () => ({
      audit: jest.fn().mockResolvedValue()
    }));

    const app = createApp();
    const res = await request(app).post('/api/admin/services/upload-image').send({
      fileName: 'vector.svg',
      dataUrl: SVG_DATA_URL
    });

    expect(res.status).toBe(400);
    expect(String(res.body?.message || '')).toMatch(/JPG|PNG|WEBP|GIF/i);
  });
});
