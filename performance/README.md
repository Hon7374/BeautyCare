# k6 performance tests

These scripts only exercise public read endpoints by default. They do not create bookings or payments. Start the app in a separate local process with the benchmark-only switch:

```powershell
$env:PERF_TEST='true'
$env:PUBLIC_APP_URL='http://127.0.0.1:3001'
npm start
```

`PERF_TEST=true` is accepted only when `NODE_ENV` is not production and the configured public URL is localhost/127.0.0.1. Authentication, RBAC, CSRF and the login-specific limiter are not bypassed.

```powershell
k6 run performance/k6-smoke.js
k6 run -e VUS=20 -e DURATION=30s performance/k6-load.js
k6 run -e VUS=50 -e DURATION=30s performance/k6-load.js
k6 run -e VUS=100 -e DURATION=30s performance/k6-load.js
k6 run -e VUS=200 -e DURATION=30s performance/k6-load.js
k6 run -e VUS=500 -e DURATION=30s performance/k6-load.js
```

Set `BASE_URL` when the app is not at `http://127.0.0.1:3000`. Each run writes a raw k6 JSON summary under `results/`, including p99 and status counters for 200/3xx/4xx/429/5xx. Run levels in order and stop if CPU/RAM or error rate degrades materially.
