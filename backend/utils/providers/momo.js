const crypto = require('crypto');
const axios = require('axios');

function hmacSha256(secret, data) {
  return crypto.createHmac('sha256', secret).update(data, 'utf8').digest('hex');
}

async function createPayment({ amount, orderId, orderInfo, returnUrl, notifyUrl }) {
  const partnerCode = process.env.MOMO_PARTNER_CODE || '';
  const accessKey = process.env.MOMO_ACCESS_KEY || '';
  const secretKey = process.env.MOMO_SECRET_KEY || '';
  const endpoint = process.env.MOMO_ENDPOINT || 'https://test-payment.momo.vn/v2/gateway/api/create';

  if (!partnerCode || !accessKey || !secretKey) {
    const err = new Error('MOMO_CONFIG_MISSING');
    err.status = 500;
    throw err;
  }

  // NOTE: This is the common MoMo v2 create signature.
  // In case MoMo changes fields, update according to official docs.
  const requestId = String(orderId);
  const requestType = process.env.MOMO_REQUEST_TYPE || 'captureWallet';
  const extraData = '';

  const rawSignature =
    `accessKey=${accessKey}` +
    `&amount=${amount}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${notifyUrl}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&partnerCode=${partnerCode}` +
    `&redirectUrl=${returnUrl}` +
    `&requestId=${requestId}` +
    `&requestType=${requestType}`;

  const signature = hmacSha256(secretKey, rawSignature);

  const payload = {
    partnerCode,
    partnerName: 'BeautyCare',
    storeId: 'BeautyCareStore',
    requestId,
    amount: Number(amount),
    orderId: String(orderId),
    orderInfo: String(orderInfo || 'Thanh toan don hang'),
    redirectUrl: String(returnUrl),
    ipnUrl: String(notifyUrl),
    lang: 'vi',
    requestType,
    autoCapture: true,
    extraData,
    signature
  };

  const rs = await axios.post(endpoint, payload, { timeout: 15000 });
  return rs.data;
}

function verifyIpn(body) {
  const secretKey = process.env.MOMO_SECRET_KEY || '';
  const accessKey = process.env.MOMO_ACCESS_KEY || '';
  if (!secretKey || !accessKey) return { ok: false, reason: 'MOMO_CONFIG_MISSING' };

  // The raw signature fields depend on the MoMo requestType.
  // Here we implement a common verification format for v2 IPN.
  const {
    amount,
    extraData,
    message,
    orderId,
    orderInfo,
    orderType,
    partnerCode,
    payType,
    requestId,
    responseTime,
    resultCode,
    transId,
    signature
  } = body || {};

  const rawSignature =
    `accessKey=${accessKey}` +
    `&amount=${amount}` +
    `&extraData=${extraData}` +
    `&message=${message}` +
    `&orderId=${orderId}` +
    `&orderInfo=${orderInfo}` +
    `&orderType=${orderType}` +
    `&partnerCode=${partnerCode}` +
    `&payType=${payType}` +
    `&requestId=${requestId}` +
    `&responseTime=${responseTime}` +
    `&resultCode=${resultCode}` +
    `&transId=${transId}`;

  const expected = hmacSha256(secretKey, rawSignature);
  return { ok: String(expected) === String(signature), expected, signature };
}

module.exports = { createPayment, verifyIpn };
