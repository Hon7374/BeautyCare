// Mailer tests mock SMTP and must not require MySQL.
describe('Mailer utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('uses SMTP when configured', async () => {
    process.env.AUTH_DEMO_MODE = 'false';
    process.env.EMAIL_DELIVERY_MODE = 'smtp';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_FROM = 'noreply@example.com';
    process.env.SMTP_FROM_NAME = 'BeautyCare';

    const sendMail = jest.fn().mockResolvedValue({
      messageId: 'msg-1',
      accepted: ['user@example.com'],
      rejected: []
    });
    const createTransport = jest.fn(() => ({ sendMail }));
    const writeOutboxMessage = jest.fn();

    jest.doMock('nodemailer', () => ({ createTransport }));
    jest.doMock('../utils/outbox', () => ({ writeOutboxMessage }));

    const { sendEmail } = require('../utils/mailer');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Test subject',
      text: 'Plain body',
      html: '<b>Plain body</b>'
    });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Test subject',
        from: '"BeautyCare" <noreply@example.com>'
      })
    );
    expect(writeOutboxMessage).not.toHaveBeenCalled();
    expect(result.mode).toBe('smtp');
    expect(result.messageId).toBe('msg-1');
  });

  test('falls back to outbox when SMTP fails', async () => {
    process.env.AUTH_DEMO_MODE = 'false';
    process.env.EMAIL_DELIVERY_MODE = 'smtp';
    process.env.EMAIL_FALLBACK_TO_OUTBOX = 'true';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_PORT = '587';
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_FROM = 'noreply@example.com';

    const sendMail = jest.fn().mockRejectedValue(new Error('smtp unavailable'));
    const createTransport = jest.fn(() => ({ sendMail }));
    const writeOutboxMessage = jest.fn().mockResolvedValue({
      fileName: 'fallback.json',
      filePath: '/tmp/fallback.json'
    });

    jest.doMock('nodemailer', () => ({ createTransport }));
    jest.doMock('../utils/outbox', () => ({ writeOutboxMessage }));

    const { sendEmail } = require('../utils/mailer');

    const result = await sendEmail({
      to: 'user@example.com',
      subject: 'Fallback subject',
      text: 'Fallback body'
    });

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(writeOutboxMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        subject: 'Fallback subject'
      })
    );
    expect(result.mode).toBe('outbox_fallback');
    expect(result.fileName).toBe('fallback.json');
  });
});
