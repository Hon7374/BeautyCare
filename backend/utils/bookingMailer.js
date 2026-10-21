const { sendEmail } = require('./mailer');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function adminNotificationEmails() {
  return String(process.env.ADMIN_NOTIFICATION_EMAILS || '')
    .split(/[,\n;]/)
    .map((email) => email.trim())
    .filter(Boolean);
}

function isDeliverableEmail(value) {
  // This is a guard against an empty/corrupt stored address. Nodemailer still
  // performs the final RFC-aware envelope validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function formatDate(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value);
  const matched = text.match(/\d{4}-\d{2}-\d{2}/);
  return matched ? matched[0] : text.slice(0, 10);
}

function formatTime(value) {
  if (!value) return '';
  const text = String(value);
  const matched = text.match(/(\d{2}:\d{2})(?::\d{2})?/);
  return matched ? matched[1] : text.slice(0, 5);
}

function formatDateTime(value) {
  if (!value) return new Date().toISOString();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function line(label, value) {
  return `${label}: ${value || '-'}`;
}

function htmlRow(label, value) {
  return `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f3dce5;color:#7b6070;width:160px">${escapeHtml(label)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3dce5;color:#33262d;font-weight:600">${escapeHtml(value || '-')}</td>
    </tr>
  `;
}

async function sendBookingCreatedNotification({ booking, user, service }) {
  const recipients = adminNotificationEmails();
  if (!recipients.length) {
    console.warn('[booking-mailer] ADMIN_NOTIFICATION_EMAILS is empty; booking notification skipped.');
    return { mode: 'skipped', reason: 'missing_admin_recipients' };
  }

  const bookingId = booking?.id;
  const bookingDate = formatDate(booking?.booking_date);
  const bookingTime = formatTime(booking?.booking_time);
  const createdAt = formatDateTime(booking?.created_at);
  const note = String(booking?.note || '').trim();

  const customerName = String(user?.name || '').trim();
  const customerPhone = String(user?.phone || '').trim();
  const customerEmail = String(user?.email || '').trim();
  const serviceName = String(service?.name || '').trim();

  const subject = '[BeautyCare] Có lịch hẹn dịch vụ mới';
  const text = [
    'BeautyCare vừa có lịch hẹn dịch vụ mới.',
    '',
    line('Booking ID', bookingId),
    line('Tên khách', customerName),
    line('Số điện thoại', customerPhone),
    line('Email khách', customerEmail),
    line('Tên dịch vụ', serviceName),
    line('Ngày đặt lịch', bookingDate),
    line('Giờ đặt lịch', bookingTime),
    line('Ghi chú', note),
    line('Thời điểm tạo booking', createdAt)
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.55;color:#33262d;background:#fff8fa;padding:20px">
      <div style="max-width:640px;background:#ffffff;border:1px solid #f3dce5;border-radius:16px;overflow:hidden">
        <div style="padding:18px 20px;background:#d97792;color:#ffffff">
          <h2 style="margin:0;font-size:20px">BeautyCare có lịch hẹn mới</h2>
          <p style="margin:6px 0 0;color:#fff4f7">Vui lòng kiểm tra và xác nhận lịch hẹn cho khách.</p>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${htmlRow('Booking ID', bookingId)}
          ${htmlRow('Tên khách', customerName)}
          ${htmlRow('Số điện thoại', customerPhone)}
          ${htmlRow('Email khách', customerEmail)}
          ${htmlRow('Tên dịch vụ', serviceName)}
          ${htmlRow('Ngày đặt lịch', bookingDate)}
          ${htmlRow('Giờ đặt lịch', bookingTime)}
          ${htmlRow('Ghi chú', note)}
          ${htmlRow('Thời điểm tạo booking', createdAt)}
        </table>
      </div>
    </div>
  `.trim();

  return sendEmail({
    to: recipients,
    subject,
    text,
    html,
    meta: {
      type: 'booking_created',
      bookingId,
      userId: user?.id || booking?.user_id || null,
      serviceId: service?.id || booking?.service_id || null
    }
  });
}

/**
 * Customer-facing confirmation sent immediately after a booking is persisted.
 * It deliberately omits the customer's note and phone number from the email to
 * reduce unnecessary exposure of personal data in a mailbox.
 */
async function sendBookingConfirmationEmail({ booking, user, service }) {
  const recipient = String(user?.email || '').trim();
  if (!recipient) {
    console.warn('[booking-mailer] customer booking confirmation skipped: missing customer email.');
    return { mode: 'skipped', reason: 'missing_customer_recipient' };
  }
  if (!isDeliverableEmail(recipient)) {
    console.warn('[booking-mailer] customer booking confirmation skipped: invalid customer email.');
    return { mode: 'skipped', reason: 'invalid_customer_recipient' };
  }

  const bookingId = booking?.id;
  const customerName = String(user?.name || '').trim() || 'Quý khách';
  const serviceName = String(service?.name || '').trim() || 'Dịch vụ BeautyCare';
  const bookingDate = formatDate(booking?.booking_date);
  const bookingTime = formatTime(booking?.booking_time);
  const subject = `[BeautyCare] Xác nhận đã nhận lịch hẹn #${bookingId}`;

  const text = [
    `Xin chào ${customerName},`,
    '',
    'BeautyCare đã nhận lịch hẹn của bạn. Nhân viên sẽ liên hệ khi lịch hẹn được xác nhận.',
    '',
    line('Mã lịch hẹn', bookingId),
    line('Dịch vụ', serviceName),
    line('Ngày hẹn', bookingDate),
    line('Giờ hẹn', bookingTime),
    line('Trạng thái', 'Đang chờ xác nhận'),
    '',
    'Nếu cần thay đổi lịch hẹn, vui lòng liên hệ BeautyCare.'
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.55;color:#33262d;background:#fff8fa;padding:20px">
      <div style="max-width:640px;background:#ffffff;border:1px solid #f3dce5;border-radius:16px;overflow:hidden">
        <div style="padding:18px 20px;background:#d97792;color:#ffffff">
          <h2 style="margin:0;font-size:20px">BeautyCare đã nhận lịch hẹn của bạn</h2>
          <p style="margin:6px 0 0;color:#fff4f7">Nhân viên sẽ liên hệ khi lịch hẹn được xác nhận.</p>
        </div>
        <div style="padding:18px 20px">
          <p>Xin chào <strong>${escapeHtml(customerName)}</strong>,</p>
          <p>Thông tin lịch hẹn đã được ghi nhận:</p>
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            ${htmlRow('Mã lịch hẹn', bookingId)}
            ${htmlRow('Dịch vụ', serviceName)}
            ${htmlRow('Ngày hẹn', bookingDate)}
            ${htmlRow('Giờ hẹn', bookingTime)}
            ${htmlRow('Trạng thái', 'Đang chờ xác nhận')}
          </table>
          <p style="margin:18px 0 0">Nếu cần thay đổi lịch hẹn, vui lòng liên hệ BeautyCare.</p>
        </div>
      </div>
    </div>
  `.trim();

  return sendEmail({
    to: recipient,
    subject,
    text,
    html,
    meta: {
      type: 'booking_confirmation',
      bookingId,
      userId: user?.id || booking?.user_id || null,
      serviceId: service?.id || booking?.service_id || null
    }
  });
}

module.exports = {
  adminNotificationEmails,
  sendBookingCreatedNotification,
  sendBookingConfirmationEmail
};
