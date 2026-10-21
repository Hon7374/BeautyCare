# Configuration comparison

| Hypothesis | Classification | Evidence |
|---|---|---|
| Different backend version | NO EVIDENCE | A and B have no backend version or commit metadata. C uses the current backend package version 1.2.0, but that does not identify A/B. |
| Different k6 script version | NO EVIDENCE | A/B have no script hash or embedded script version. Current `performance/k6-load.js` is hash `DF0AE...6FFCD9`. |
| Different duration | SUPPORTED BUT NOT CONFIRMED | A is reported as ~300 s and B as ~14 s; the raw A JSON and B console output are unavailable. |
| Different DB pool | NO EVIDENCE | A/B do not retain pool configuration. Current source uses performance pool default 25, capped at 50, queue limit 1000. |
| Different rate limiter | SUPPORTED BUT NOT CONFIRMED | Current performance mode uses a high localhost-only limiter; historical reports describe this change, but no per-run environment snapshot exists. |
| Different logging mode | SUPPORTED BUT NOT CONFIRMED | Current source suppresses per-request Morgan writes in performance mode; A/B have no process environment snapshot. |
| Backend not ready at load start | POSSIBLE ONLY | B's connection refusal is consistent with it, but no readiness transcript exists. The current launcher performs a health check before k6. |
| HTTP 500 versus connection refusal | NO EVIDENCE | A's missing raw JSON and B's prose do not provide a complete status/error distribution. Do not infer all failures were connection refused or HTTP 500. |
| Different machine/container resources | NO EVIDENCE | CPU, RAM, container limits, and k6 image digest are absent for A/B. |
| Different test data | NO EVIDENCE | No per-run database snapshot or row counts are retained. |

Source facts: `performance/k6-load.js` issues one public `GET /api/services` request per iteration. `backend/utils/runtime.js` enables performance mode only for non-production localhost URLs; `backend/db.js` selects the bounded performance pool; `backend/app.js` applies the limiter and routes.
