# Execution history

## Recoverable sources

| Source | Result |
|---|---|
| PowerShell PSReadLine history | `HISTORY NOT AVAILABLE` for matching `k6 run`, `VUS=400`, `DURATION=300`, `--summary-export`, `PERF_TEST`, and the current launcher. The file exists but contains no matching recoverable commands. |
| VS Code terminal history | No persisted VS Code terminal history was found in the repository/workspace. |
| Git history | `git log` is unavailable because the workspace is not a Git working tree. |
| Docker metadata | Only the stopped user container `beautycare-mysql-app` remains; no historical benchmark container, labels, command, or logs identify A or B. |
| Repository reports | B is documented in `docs/EXPERIMENT_RESULTS.md:79` and `docs/PAPER_UPDATE_GUIDE.md:33`. |
| Current launcher | The safe launcher is available, but it was added after the historical records and does not prove their original command line. |

## Commands and timestamps

No exact historical command, start timestamp, end timestamp, k6 version, backend commit, or resource snapshot for A or B is recoverable. The current C artifact has a filesystem modified time, but that is not an embedded test timestamp. The current C run was launched through the safe launcher with a disposable MySQL database, localhost backend port 3010, and containerized `grafana/k6`; the launcher did not write a run manifest at that time, so its provenance remains incomplete.

No secrets, tokens, cookies, or credentials were copied into this report.
