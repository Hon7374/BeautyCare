const axios = require('axios');

function paypalBaseUrl() {
  if (process.env.PAYPAL_API_BASE_URL) return String(process.env.PAYPAL_API_BASE_URL).replace(/\/+$/, '');
  const mode = String(process.env.PAYPAL_MODE || process.env.PAYMENTS_MODE || 'sandbox').toLowerCase();
  return mode === 'live' || mode === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function credentials() {
  return {
    clientId: process.env.PAYPAL_CLIENT_ID || '',
    clientSecret: process.env.PAYPAL_CLIENT_SECRET || ''
  };
}

function isConfigured() {
  const c = credentials();
  return Boolean(c.clientId && c.clientSecret);
}

function configMissingError() {
  const err = new Error('PAYPAL_CONFIG_MISSING');
  err.status = 500;
  return err;
}

async function getAccessToken() {
  const { clientId, clientSecret } = credentials();
  if (!clientId || !clientSecret) throw configMissingError();

  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const rs = await axios.post(`${paypalBaseUrl()}/v1/oauth2/token`, body.toString(), {
    timeout: 15000,
    auth: { username: clientId, password: clientSecret },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });

  if (!rs.data?.access_token) throw new Error('PAYPAL_ACCESS_TOKEN_MISSING');
  return rs.data.access_token;
}

function paypalCurrency() {
  return String(process.env.PAYPAL_CURRENCY || 'USD').trim().toUpperCase();
}

function amountForPayPal(amountVnd) {
  const currency = paypalCurrency();
  const originalAmount = Number(amountVnd || 0);
  if (!Number.isFinite(originalAmount) || originalAmount <= 0) {
    const err = new Error('PAYPAL_AMOUNT_INVALID');
    err.status = 400;
    throw err;
  }

  // BeautyCare stores prices in VND. PayPal commonly requires a supported international currency.
  // Default demo conversion: 25,000 VND = 1 USD. Override with PAYPAL_EXCHANGE_RATE in .env.
  const exchangeRate = Number(process.env.PAYPAL_EXCHANGE_RATE || (currency === 'VND' ? 1 : 25000));
  const converted = currency === 'VND' ? originalAmount : originalAmount / Math.max(exchangeRate, 1);
  const zeroDecimalCurrencies = new Set(['JPY', 'KRW', 'TWD']);
  const value = zeroDecimalCurrencies.has(currency)
    ? String(Math.max(1, Math.round(converted)))
    : Math.max(0.01, converted).toFixed(2);

  return { currency_code: currency, value };
}

function findApproveUrl(order) {
  const links = Array.isArray(order?.links) ? order.links : [];
  const approve = links.find((item) => String(item.rel || '').toLowerCase() === 'approve');
  return approve?.href || null;
}

async function createOrder({ amount, description, referenceId, returnUrl, cancelUrl }) {
  if (!isConfigured()) throw configMissingError();
  const accessToken = await getAccessToken();
  const requestId = String(referenceId || `BC-${Date.now()}`).slice(0, 108);
  const money = amountForPayPal(amount);

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: String(referenceId || ''),
        custom_id: String(referenceId || ''),
        description: String(description || 'BeautyCare payment').slice(0, 127),
        amount: money
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
          brand_name: process.env.PAYPAL_BRAND_NAME || 'BeautyCare',
          locale: process.env.PAYPAL_LOCALE || 'vi-VN',
          landing_page: 'LOGIN',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: String(returnUrl),
          cancel_url: String(cancelUrl)
        }
      }
    }
  };

  const rs = await axios.post(`${paypalBaseUrl()}/v2/checkout/orders`, payload, {
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': requestId
    }
  });

  return {
    ...rs.data,
    approveUrl: findApproveUrl(rs.data),
    gatewayAmount: money
  };
}

async function captureOrder(orderId) {
  if (!isConfigured()) throw configMissingError();
  const id = String(orderId || '').trim();
  if (!id) throw new Error('PAYPAL_ORDER_ID_MISSING');

  const accessToken = await getAccessToken();
  const rs = await axios.post(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(id)}/capture`, {}, {
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `CAPTURE-${id}`.slice(0, 108)
    }
  });

  return rs.data;
}

function isCaptureCompleted(capture) {
  if (String(capture?.status || '').toUpperCase() === 'COMPLETED') return true;
  const units = Array.isArray(capture?.purchase_units) ? capture.purchase_units : [];
  return units.some((unit) => {
    const captures = unit?.payments?.captures || [];
    return captures.some((item) => String(item.status || '').toUpperCase() === 'COMPLETED');
  });
}

module.exports = {
  isConfigured,
  createOrder,
  captureOrder,
  isCaptureCompleted,
  findApproveUrl,
  amountForPayPal
};
