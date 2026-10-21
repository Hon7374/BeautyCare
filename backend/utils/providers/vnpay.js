const crypto = require('crypto');

function sortObject(obj) {
  const sorted = {};
  Object.keys(obj)
    .sort()
    .forEach((k) => {
      if (obj[k] !== undefined && obj[k] !== null && obj[k] !== '') sorted[k] = obj[k];
    });
  return sorted;
}

// Encode giống PHP urlencode:
// - space => '+'
// - encode thêm ! ' ( ) * (vì encodeURIComponent KHÔNG encode mấy ký tự này)
function vnpEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
}

function buildQueryString(params) {
  return Object.keys(params)
    .map((k) => `${vnpEncode(k)}=${vnpEncode(params[k])}`)
    .join('&');
}

function hmacSha512(secret, data) {
  return crypto.createHmac('sha512', secret).update(data, 'utf8').digest('hex');
}

function createPaymentUrl({ amount, txnRef, orderInfo, ipAddr, returnUrl }) {
  const vnp_TmnCode = process.env.VNPAY_TMN_CODE || '';
  const vnp_HashSecret = process.env.VNPAY_HASH_SECRET || '';
  const vnp_Url = process.env.VNPAY_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

  if (!vnp_TmnCode || !vnp_HashSecret) {
    const err = new Error('VNPAY_CONFIG_MISSING');
    err.status = 500;
    throw err;
  }

  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const vnp_CreateDate =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  // VNPay khuyến nghị orderInfo không dấu và tránh ký tự đặc biệt
  const safeOrderInfo = String(orderInfo || 'Thanh toan don hang')
    .replace(/[^\w\s#-]/g, '')
    .trim();

  const params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: String(txnRef),
    vnp_OrderInfo: safeOrderInfo || 'Thanh toan don hang',
    vnp_OrderType: 'other',
    vnp_Amount: String(Math.round(Number(amount || 0)) * 100),
    vnp_ReturnUrl: String(returnUrl),
    vnp_IpAddr: String(ipAddr || '127.0.0.1'),
    vnp_CreateDate
  };

  const sorted = sortObject(params);

  // ✅ CHỈ ký trên params đã sort (chưa có SecureHash)
  const signData = buildQueryString(sorted);
  const secureHash = hmacSha512(vnp_HashSecret, signData);

  // ✅ add hash sau khi ký
  sorted.vnp_SecureHash = secureHash;

  // ✅ build URL final cũng cùng cách encode như lúc ký
  return `${vnp_Url}?${buildQueryString(sorted)}`;
}

function verifyReturn(query) {
  const vnp_HashSecret = process.env.VNPAY_HASH_SECRET || '';
  if (!vnp_HashSecret) return { ok: false, reason: 'VNPAY_CONFIG_MISSING' };

  // IMPORTANT: VNPay signs ONLY parameters that start with `vnp_`.
  // If you attach custom params (e.g. `front=`) to ReturnUrl, DO NOT include them in signature verification.
  const onlyVnp = {};
  for (const [k, v] of Object.entries(query || {})) {
    if (String(k).startsWith('vnp_')) onlyVnp[k] = v;
  }

  const secureHash = String(onlyVnp.vnp_SecureHash || '');
  delete onlyVnp.vnp_SecureHash;
  delete onlyVnp.vnp_SecureHashType;

  const sorted = sortObject(onlyVnp);
  const signData = buildQueryString(sorted);
  const expected = hmacSha512(vnp_HashSecret, signData);

  return { ok: expected.toLowerCase() === secureHash.toLowerCase(), expected, secureHash };
}

module.exports = { createPaymentUrl, verifyReturn };
