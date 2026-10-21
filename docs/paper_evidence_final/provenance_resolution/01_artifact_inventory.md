# Artifact inventory

## Scope and method

The repository, `results/`, `performance/`, `docs/`, `backend/logs/`, `tools/`, available PowerShell PSReadLine history, and available Docker metadata were inspected on 2026-10-17. Original artifacts were not modified. Hashes below are SHA-256. File times are supporting metadata only and are not treated as experiment timestamps.

| Record | Artifact / source | Present now | Evidence summary | Provenance strength |
|---|---|---:|---|---|
| A | `results/k6-load-400vus.json` | No | Historical documents report 400 VU, ~300 s, 1,244,906 requests/iterations, 91,742 HTTP 200, 92.6306% failed/other. The raw JSON is absent from the current repository, so its hash and metadata cannot be independently recomputed now. | Reported secondary evidence only |
| B | `docs/EXPERIMENT_RESULTS.md:79`, `docs/PAPER_UPDATE_GUIDE.md:33` | Yes, prose only | 400 VU attempt reportedly stopped after ~14 s, with 12,486 observed iterations and connection refused. No raw console log or manifest is retained. | Prose observation |
| C | `results/iccIT-replication/k6-load-400vus-run1.json` | Yes | New 400 VU artifact: 300.292853 s, 302,936 requests/iterations, 302,936 HTTP 200, 0% HTTP failure. SHA-256 `B6FB5F2DDAC61D84C48E6422D39C8140D87270D92E08E22E2D684E9916CA4D3C`; 5,200 bytes; modified 2026-10-17T08:45:41.5049917Z. | Raw metrics, incomplete provenance |
| C500 | `results/k6-load-500vus.json` | Yes | Current aborted 500 VU summary: 6.530285 s, 6,442 requests/iterations, 3,627 HTTP 200, 43.6976% HTTP failure, 2,815 failed checks. SHA-256 `72078BB7354D193F3971F10D513C841D54C02954DEFED8A29FECA7A976F90643`; 5,450 bytes; modified 2026-10-17T08:46:13.7801197Z. | Raw metrics for aborted current attempt |
| Script | `performance/k6-load.js` | Yes | Constant VU; one unauthenticated `GET /api/services` per iteration; default 60 s; threshold HTTP failure <1%, p95 <1.5 s, p99 <3 s. SHA-256 `DF0AE695461104CC024F21BE57317F1420261652F06C4B4D131D193DDB6FFCD9`. | Source evidence |
| Launcher | `tools/run-iccit-safe-benchmark.ps1` | Yes | Disposable MySQL, localhost backend on port 3010, containerized k6, test-only environment variables. SHA-256 `D9538DF9B34D7B6EFDAC8A6267B34FF12DB6C063929D63ED9BB89168DF5C43AF`. | Current launcher evidence |

The 400-VU historical raw JSON named by the documents is not available; the repository contains no file at that path. This is a material provenance gap, not evidence that the historical record was fabricated.
