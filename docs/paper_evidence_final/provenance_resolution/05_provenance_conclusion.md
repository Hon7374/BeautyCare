# Provenance conclusion

## Run comparison

| Property | Run A | Run B | Run C | Evidence |
|---|---|---|---|---|
| Run ID | Unknown | Unknown | No manifest; current replication artifact | No historical identifiers |
| Timestamp | Not embedded; raw file absent | Not retained | Filesystem metadata only; no embedded timestamp | Insufficient for exact timing |
| Duration | ~300 s reported | ~14 s reported | 300.292853 s in JSON | Raw C verified |
| VUs | 400 | 400 | 400 | Reported / JSON |
| Requests | 1,244,906 reported | Unknown | 302,936 | A prose / C JSON |
| HTTP 200 | 91,742 reported | Unknown | 302,936 | A prose / C JSON |
| Failure rate | 92.6306% reported | Unknown; connection refused reported | 0% | A prose / C JSON |
| Target | Unknown | Unknown | Safe launcher target via host.docker.internal to localhost:3010 | C launcher |
| Script version | Unknown | Unknown | `DF0AE...6FFCD9` | C-era source hash |
| Backend version | Unknown | Unknown | package 1.2.0 | C-era package |
| Database config | Unknown | Unknown | Disposable MySQL test database on host port 13310 | C launcher |
| Historical provenance | Secondary report; raw absent | Secondary report; console absent | Raw metrics, incomplete manifest | Inventory |

## Required answers

1. A and B may be two distinct attempts, but this cannot be proven from retained evidence.
2. There is no evidence proving A and B were the same execution.
3. No configuration change can be confirmed as the cause of the difference. Several configuration differences are plausible, but unverified.
4. C has sufficient raw metric evidence to be reported as a separate local 400-VU observation, with its limitations. It does not resolve A/B and does not establish production capacity.
5. Raw metrics in C and the retained 500-VU current JSON are reliable at the metric level; A is only reported secondary evidence.
6. Exact commands, timestamps, k6 version, backend commit, host resources, DB pool, limiter, logging, and test-data state for A/B cannot be recovered.
7. The historical contradiction cannot be eliminated. The correct status is `PARTIALLY RESOLVED`.

The original files remain unchanged. A new manifest tool was added for future runs; it has a `Check` mode and never executes k6.
