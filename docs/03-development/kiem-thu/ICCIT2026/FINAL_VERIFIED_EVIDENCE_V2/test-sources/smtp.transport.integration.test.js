const net = require('net');

function startLocalSmtpServer() {
  const sockets = new Set();
  const messages = [];
  let receiveMessage;
  const messageReceived = new Promise((resolve) => {
    receiveMessage = resolve;
  });

  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.setEncoding('utf8');
    socket.write('220 localhost BeautyCare test SMTP\r\n');

    let buffer = '';
    let dataMode = false;
    let message = '';

    socket.on('data', (chunk) => {
      buffer += chunk;
      let eol = buffer.indexOf('\r\n');
      while (eol >= 0) {
        const line = buffer.slice(0, eol);
        buffer = buffer.slice(eol + 2);
        eol = buffer.indexOf('\r\n');

        if (dataMode) {
          if (line === '.') {
            dataMode = false;
            messages.push(message);
            receiveMessage(message);
            message = '';
            socket.write('250 2.0.0 queued\r\n');
          } else {
            message += `${line}\r\n`;
          }
          continue;
        }

        if (/^(EHLO|HELO)\b/i.test(line)) {
          socket.write('250-localhost\r\n250-PIPELINING\r\n250-SIZE 10485760\r\n250 8BITMIME\r\n');
        } else if (/^MAIL FROM:/i.test(line) || /^RCPT TO:/i.test(line) || /^RSET$/i.test(line) || /^NOOP$/i.test(line)) {
          socket.write('250 2.1.0 OK\r\n');
        } else if (/^DATA$/i.test(line)) {
          dataMode = true;
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
        } else if (/^QUIT$/i.test(line)) {
          socket.write('221 2.0.0 Bye\r\n');
          socket.end();
        } else {
          socket.write('250 OK\r\n');
        }
      }
    });

    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve({
        port: server.address().port,
        messages,
        messageReceived,
        close: async () => {
          sockets.forEach((socket) => socket.destroy());
          await new Promise((done) => server.close(done));
        }
      });
    });
  });
}

describe('SMTP transport integration', () => {
  const originalEnv = process.env;
  let smtpServer;
  let closeTransporter;

  beforeEach(() => {
    jest.resetModules();
    jest.unmock('nodemailer');
    jest.unmock('../utils/outbox');
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    if (closeTransporter) closeTransporter();
    closeTransporter = null;
    if (smtpServer) await smtpServer.close();
    smtpServer = null;
    process.env = originalEnv;
  });

  test('Nodemailer negotiates SMTP and delivers a message over a real TCP SMTP session', async () => {
    smtpServer = await startLocalSmtpServer();
    process.env.AUTH_DEMO_MODE = 'false';
    process.env.EMAIL_DELIVERY_MODE = 'smtp';
    process.env.EMAIL_FALLBACK_TO_OUTBOX = 'false';
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = String(smtpServer.port);
    process.env.SMTP_SECURE = 'false';
    process.env.SMTP_REQUIRE_TLS = 'false';
    process.env.SMTP_FROM = 'noreply@example.test';
    process.env.SMTP_FROM_NAME = 'BeautyCare Test';
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;

    const { closeTransporter: close, sendEmail, verifySmtpConnection } = require('../utils/mailer');
    closeTransporter = close;

    await expect(verifySmtpConnection()).resolves.toEqual({ ok: true });
    const result = await sendEmail({
      to: 'recipient@example.test',
      subject: 'SMTP integration delivery',
      text: 'Plain SMTP transport body',
      html: '<p>HTML SMTP transport body</p>'
    });
    await smtpServer.messageReceived;

    expect(result).toEqual(
      expect.objectContaining({
        mode: 'smtp',
        accepted: ['recipient@example.test'],
        rejected: []
      })
    );
    expect(smtpServer.messages).toHaveLength(1);
    expect(smtpServer.messages[0]).toContain('Subject: SMTP integration delivery');
    expect(smtpServer.messages[0]).toContain('Plain SMTP transport body');
  });
});
