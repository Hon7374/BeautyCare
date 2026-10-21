import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3010').replace(/\/$/, '');
const workload = String(__ENV.WORKLOAD || 'B1').toUpperCase();
const password = String(__ENV.TEST_PASSWORD || '');
const emailPrefix = String(__ENV.EMAIL_PREFIX || 'iccIT-k6-booking-');
const serviceId = Number(__ENV.SERVICE_ID || 1);
const baseDate = String(__ENV.TEST_DATE || '2099-12-31');
const contentionTime = String(__ENV.TEST_TIME || '09:00');

// A saturated booking slot returns 409 by design; classify it as an expected
// response so k6's transport-failure metric does not mislabel capacity
// enforcement as an HTTP failure.
http.setResponseCallback(http.expectedStatuses(200, 201, 409));

export const options = workload === 'B2'
  ? {
      scenarios: {
        dynamic_booking: {
          executor: 'ramping-vus',
          startVUs: 10,
          stages: [
            { duration: '2m', target: 50 },
            { duration: '5m', target: 50 },
            { duration: '1m', target: 0 }
          ],
          gracefulRampDown: '10s'
        }
      },
      summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
      thresholds: { booking_unexpected: ['count==0'], auth_failures: ['count==0'], http_req_failed: ['rate<0.01'] }
    }
  : {
      scenarios: {
        one_slot_contention: {
          executor: 'per-vu-iterations',
          vus: 50,
          iterations: 1,
          maxDuration: '60s'
        }
      },
      summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
      thresholds: { booking_unexpected: ['count==0'], auth_failures: ['count==0'], http_req_failed: ['rate<0.01'] }
    };

const bookingSuccess = new Counter('booking_success');
const bookingRejected = new Counter('booking_rejected');
const bookingUnexpected = new Counter('booking_unexpected');
const authFailures = new Counter('auth_failures');
const bookingDuration = new Trend('booking_duration', true);

function cookieHeader(response) {
  const cookies = response.cookies;
  return Object.entries(cookies)
    .map(([name, values]) => `${name}=${values[0].value}`)
    .join('; ');
}

function login(email) {
  // Keep each setup login in an isolated jar. Reusing the previous user's
  // CSRF cookie would correctly trigger the application's CSRF defense.
  const jar = http.cookieJar();
  ['access_token', 'refresh_token', 'csrf_token'].forEach((name) => {
    jar.delete(baseUrl, name);
    jar.delete(`${baseUrl}/api/auth/login`, name);
  });
  const response = http.post(
    `${baseUrl}/api/auth/login`,
    JSON.stringify({ email, password }),
    { jar, headers: { 'Content-Type': 'application/json' }, tags: { operation: 'login' } }
  );
  const body = response.json() || {};
  if (response.status !== 200 || !body.token || !body.csrfToken) return null;
  return { token: body.token, csrfToken: body.csrfToken, cookies: cookieHeader(response) };
}

export function setup() {
  if (!password) fail('TEST_PASSWORD is required and must be supplied out-of-band');
  const clients = [];
  for (let index = 1; index <= 50; index += 1) {
    const suffix = String(index).padStart(3, '0');
    const credentials = login(`${emailPrefix}${suffix}@example.test`);
    if (!credentials) fail(`authenticated setup failed for client ${suffix}`);
    clients.push(credentials);
  }
  return { clients };
}

function addDays(iso, days) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dynamicSlot() {
  const sequence = Math.max(0, (__VU - 1) * 1000 + __ITER);
  const slotIndex = sequence % 17;
  const hour = 9 + Math.floor(slotIndex / 2);
  const minute = slotIndex % 2 === 0 ? '00' : '30';
  const dayOffset = Math.floor(sequence / 17);
  return { date: addDays(baseDate, dayOffset), time: `${String(hour).padStart(2, '0')}:${minute}` };
}

export default function (data) {
  const client = data.clients[(__VU - 1) % data.clients.length];
  const slot = workload === 'B1' ? { date: baseDate, time: contentionTime } : dynamicSlot();
  const started = Date.now();
  const response = http.post(
    `${baseUrl}/api/bookings`,
    JSON.stringify({ serviceId, date: slot.date, time: slot.time, note: `ICCIT-${workload}` }),
    {
      headers: {
        Authorization: `Bearer ${client.token}`,
        Cookie: client.cookies,
        'Content-Type': 'application/json',
        'X-CSRF-Token': client.csrfToken
      },
      tags: { operation: 'booking_create', workload }
    }
  );
  bookingDuration.add(Date.now() - started);

  const isSuccess = response.status === 201;
  const isExpectedConflict = response.status === 409;
  if (isSuccess) bookingSuccess.add(1);
  else if (isExpectedConflict) bookingRejected.add(1);
  else if (response.status === 401 || response.status === 403) authFailures.add(1);
  else bookingUnexpected.add(1);

  check(response, {
    'booking success or expected conflict': (r) => r.status === 201 || r.status === 409
  });

  if (workload === 'B2') sleep(1);
}

export function handleSummary(data) {
  const output = `results/k6-booking-${workload.toLowerCase()}-${__ENV.RUN_ID || 'run'}.json`;
  return { [output]: JSON.stringify(data, null, 2) };
}
