# OWASP ZAP baseline scan

Start BeautyCare locally, then run from the repository root:

```powershell
.\security\zap-baseline.ps1
```

The script uses Docker and writes the real HTML/JSON reports to `results/zap/`. To scan a different reachable URL:

```powershell
.\security\zap-baseline.ps1 -BaseUrl http://host.docker.internal:3000
```

Alert counts must be read from the generated JSON/HTML report. No result file is committed or pre-filled by the repository.
