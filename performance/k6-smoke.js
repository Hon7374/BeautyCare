import http from 'k6/http';
import { Counter } from 'k6/metrics';
import { check, sleep } from 'k6';

const baseUrl = (__ENV.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const status200 = new Counter('http_status_200');
const status429 = new Counter('http_status_429');
const status3xx = new Counter('http_status_3xx');
const status4xx = new Counter('http_status_4xx');
const status5xx = new Counter('http_status_5xx');
const statusOther = new Counter('http_status_other');
export const options = { vus: 1, duration: '30s', summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)'], thresholds: { http_req_failed: ['rate<0.01'], http_req_duration: ['p(95)<1000'] } };
function recordStatus(response) {
  if (response.status === 200) status200.add(1);
  else if (response.status === 429) status429.add(1);
  else if (response.status >= 300 && response.status < 400) status3xx.add(1);
  else if (response.status >= 400 && response.status < 500) status4xx.add(1);
  else if (response.status >= 500) status5xx.add(1);
  else statusOther.add(1);
}
export default function () {
  const health = http.get(`${baseUrl}/api/health`);
  recordStatus(health);
  check(health, { 'health status is 200': (r) => r.status === 200 });
  const services = http.get(`${baseUrl}/api/services`);
  recordStatus(services);
  check(services, { 'services status is 200': (r) => r.status === 200 });
  sleep(1);
}

export function handleSummary(data) {
  return { 'results/k6-smoke-summary.json': JSON.stringify(data, null, 2) };
}
