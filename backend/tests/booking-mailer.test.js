describe('Booking confirmation mailer', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('sends a customer-facing booking confirmation without unnecessary PII', async () => {
    const sendEmail = jest.fn().mockResolvedValue({ mode: 'smtp', messageId: 'booking-message-1' });
    jest.doMock('../utils/mailer', () => ({ sendEmail }));

    const { sendBookingConfirmationEmail } = require('../utils/bookingMailer');
    const result = await sendBookingConfirmationEmail({
      booking: {
        id: 42,
        user_id: 7,
        service_id: 3,
        booking_date: '2026-09-15',
        booking_time: '10:30:00',
        note: 'Please call before arriving'
      },
      user: {
        id: 7,
        name: 'Nguyễn Minh Anh',
        phone: '0912345678',
        email: 'customer@example.com'
      },
      service: { id: 3, name: 'Chăm sóc da' }
    });

    expect(result).toEqual(expect.objectContaining({ mode: 'smtp' }));
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'customer@example.com',
        subject: expect.stringContaining('#42'),
        meta: expect.objectContaining({
          type: 'booking_confirmation',
          bookingId: 42,
          userId: 7,
          serviceId: 3
        })
      })
    );

    const mail = sendEmail.mock.calls[0][0];
    expect(mail.text).toContain('Chăm sóc da');
    expect(mail.text).not.toContain('0912345678');
    expect(mail.text).not.toContain('Please call before arriving');
  });

  test('skips a customer confirmation when no usable customer address exists', async () => {
    const sendEmail = jest.fn();
    jest.doMock('../utils/mailer', () => ({ sendEmail }));

    const { sendBookingConfirmationEmail } = require('../utils/bookingMailer');
    const result = await sendBookingConfirmationEmail({
      booking: { id: 43 },
      user: { id: 8, email: 'not-an-email' },
      service: { id: 3, name: 'Facial' }
    });

    expect(result).toEqual({ mode: 'skipped', reason: 'invalid_customer_recipient' });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('keeps administrator notification separate from customer confirmation', async () => {
    process.env.ADMIN_NOTIFICATION_EMAILS = 'owner@example.com, manager@example.com';
    const sendEmail = jest.fn().mockResolvedValue({ mode: 'smtp' });
    jest.doMock('../utils/mailer', () => ({ sendEmail }));

    const { sendBookingCreatedNotification } = require('../utils/bookingMailer');
    await sendBookingCreatedNotification({
      booking: { id: 44, user_id: 9, service_id: 4, booking_date: '2026-09-16', booking_time: '14:00:00' },
      user: { id: 9, name: 'Customer', phone: '0900000000', email: 'customer@example.com' },
      service: { id: 4, name: 'Massage' }
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['owner@example.com', 'manager@example.com'],
        meta: expect.objectContaining({ type: 'booking_created', bookingId: 44 })
      })
    );
  });
});
