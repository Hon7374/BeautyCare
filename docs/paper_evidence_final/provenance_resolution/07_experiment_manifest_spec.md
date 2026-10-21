# Experiment Manifest specification

The new `tools/new-experiment-manifest.ps1` tool supports three modes:

- `Check`: validates required project files, prints redacted environment metadata, and explicitly performs no load test.
- `Start`: creates a unique run directory and writes `manifest.json`, `environment.json`, `script-sha256.txt`, `backend-version.txt`, and `run-notes.md` before k6 is launched.
- `Finalize`: records end time, status, error summary, result SHA-256, and console-log SHA-256 after k6 exits.

Example future workflow:

```powershell
$id = "BC-K6-$(Get-Date -Format yyyyMMdd-HHmmss)-400VU-R01"
powershell -ExecutionPolicy Bypass -File .\tools\new-experiment-manifest.ps1 -Mode Check
powershell -ExecutionPolicy Bypass -File .\tools\new-experiment-manifest.ps1 -Mode Start -RunId $id -Vus 400 -DurationSeconds 300 -ResultPath "results\$id\k6-summary.json" -ConsoleLogPath "results\$id\k6-console.log"
# Run k6 separately, with stdout/stderr redirected to the declared console log.
powershell -ExecutionPolicy Bypass -File .\tools\new-experiment-manifest.ps1 -Mode Finalize -RunId $id -Vus 400 -DurationSeconds 300 -Status PASS -ResultPath "results\$id\k6-summary.json" -ConsoleLogPath "results\$id\k6-console.log"
```

The tool does not read secret values into artifacts, does not alter business logic, and does not invoke Docker, Node server startup, or k6. If a run is interrupted, finalize it with `-Status INTERRUPTED` and an explicit error summary.
