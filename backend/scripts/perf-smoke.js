const { performance } = require('perf_hooks');
const request = require('supertest');

const app = require('../app');

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function summarize(name, values) {
  const total = values.reduce((sum, value) => sum + value, 0);
  const avg = total / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const p95 = percentile(values, 95);

  return {
    name,
    samples: values.length,
    avgMs: avg.toFixed(2),
    minMs: min.toFixed(2),
    maxMs: max.toFixed(2),
    p95Ms: p95.toFixed(2)
  };
}

async function runCase(name, fn, iterations) {
  const values = [];
  for (let i = 0; i < iterations; i += 1) {
    const started = performance.now();
    const response = await fn();
    const ended = performance.now();
    if (response.status < 200 || response.status >= 400) {
      throw new Error(`${name} failed with status ${response.status}`);
    }
    values.push(ended - started);
  }
  return summarize(name, values);
}

async function main() {
  const cases = [];
  cases.push(await runCase('GET /api/health', () => request(app).get('/api/health'), 40));
  cases.push(await runCase('GET /api/auth/csrf', () => request(app).get('/api/auth/csrf'), 40));
  cases.push(await runCase('GET /', () => request(app).get('/').set('Accept', 'text/html'), 30));

  console.log('Performance smoke summary');
  console.table(cases);
  console.log('Note: this is an in-process smoke measurement for report evidence, not a full load test.');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
