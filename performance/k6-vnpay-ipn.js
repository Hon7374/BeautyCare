import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3010').replace(/\/$/, '');
const workload = String(__ENV.WORKLOAD || 'P1').toUpperCase();
const fixture = JSON.parse(open(__ENV.FIXTURE_FILE || '../docs/03-development/kiem-thu/ICCIT2026/raw-results/vnpay-ipn/k6-ipn-fixtures-20261021.json'));
const duplicate = fixture.p1[0];
const independent = fixture.p2;

http.setResponseCallback(http.expectedStatuses(200));

export const options = {
  scenarios: {
    ipn_callbacks: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30s'
    }
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'],
  thresholds: {
    callback_unexpected: ['count==0'],
    http_req_failed: ['rate<0.01']
  }
};

const confirmed = new Counter('callback_confirmed');
const duplicateResponses = new Counter('callback_duplicate');
const unexpected = new Counter('callback_unexpected');
const callbackDuration = new Trend('callback_duration', true);

function queryString(fields) {
  return Object.keys(fields)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(fields[key]))}`)
    .join('&');
}

export default function () {
  // P2 is a one-callback-per-independent-payment workload. Keep VUs alive
  // for the 30-second measurement window without reusing a paid fixture.
  if (workload === 'P2' && __ITER > 0) {
    sleep(60);
    return;
  }
  const item = workload === 'P1' ? duplicate : independent[(__VU - 1) % independent.length];
  const response = http.get(`${baseUrl}/api/payments/vnpay/ipn?${queryString(item.callback)}`, { tags: { operation: 'vnpay_ipn', workload } });
  callbackDuration.add(response.timings.duration);
  let code = '';
  try { code = String(response.json('RspCode') || ''); } catch (_) { code = ''; }
  if (code === '00') confirmed.add(1);
  else if (workload === 'P1' && code === '02') duplicateResponses.add(1);
  else unexpected.add(1);
  check(response, {
    'IPN HTTP 200': (r) => r.status === 200,
    'IPN expected provider response': () => code === '00' || (workload === 'P1' && code === '02')
  });
  if (workload === 'P2') sleep(29);
}

export function handleSummary(data) {
  const output = `results/k6-vnpay-ipn-${workload.toLowerCase()}-${__ENV.RUN_ID || 'run'}.json`;
  return { [output]: JSON.stringify(data, null, 2) };
}
