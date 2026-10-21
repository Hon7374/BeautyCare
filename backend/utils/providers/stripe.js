const Stripe = require('stripe');

function secretKey() {
  return String(process.env.STRIPE_SECRET_KEY || '').trim();
}

function isConfigured() {
  return Boolean(secretKey());
}

function getStripe() {
  const key = secretKey();
  if (!key) {
    const err = new Error('STRIPE_CONFIG_MISSING');
    err.status = 500;
    throw err;
  }
  return new Stripe(key);
}

function requirePositiveIntegerAmount(amount) {
  const value = Number(amount);
  if (!Number.isSafeInteger(value) || value <= 0) {
    const err = new Error('STRIPE_AMOUNT_INVALID');
    err.status = 400;
    throw err;
  }
  return value;
}

function normalizedMetadata(metadata) {
  return Object.entries(metadata || {}).reduce((result, [key, value]) => {
    if (value !== undefined && value !== null) result[String(key)] = String(value);
    return result;
  }, {});
}

async function createCheckoutSession({ amount, currency, description, successUrl, cancelUrl, metadata }) {
  const stripe = getStripe();
  const unitAmount = requirePositiveIntegerAmount(amount);
  const sessionMetadata = normalizedMetadata(metadata);

  // NOTE: Stripe uses the smallest currency unit. For VND it's 1 unit = 1 VND.
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: sessionMetadata.providerRef || undefined,
    line_items: [
      {
        price_data: {
          currency: currency || 'vnd',
          product_data: { name: description || 'BeautyCare Checkout' },
          unit_amount: unitAmount
        },
        quantity: 1
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Store the reference both on the Checkout Session and on the PaymentIntent
    // so a signed webhook can be reconciled without trusting browser input.
    metadata: sessionMetadata,
    payment_intent_data: { metadata: sessionMetadata }
  });
  return session;
}

async function createSubscriptionCheckoutSession({ customerEmail, priceId, successUrl, cancelUrl, metadata }) {
  const stripe = getStripe();
  const sessionMetadata = normalizedMetadata(metadata);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: customerEmail,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: sessionMetadata.providerRef || undefined,
    metadata: sessionMetadata,
    subscription_data: { metadata: sessionMetadata }
  });
  return session;
}

async function retrieveCheckoutSession(sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) {
    const err = new Error('STRIPE_SESSION_ID_MISSING');
    err.status = 400;
    throw err;
  }
  const stripe = getStripe();
  return stripe.checkout.sessions.retrieve(id);
}

function constructEvent(rawBody, signature) {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  if (!whSecret) {
    const err = new Error('STRIPE_WEBHOOK_SECRET_MISSING');
    err.status = 500;
    throw err;
  }
  return stripe.webhooks.constructEvent(rawBody, signature, whSecret);
}

module.exports = {
  isConfigured,
  createCheckoutSession,
  createSubscriptionCheckoutSession,
  retrieveCheckoutSession,
  constructEvent
};
