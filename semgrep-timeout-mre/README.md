# Semgrep Fixpoint Timeout MRE

This is the smallest target-level reproduction found for the current BeautyCare source. The pair `backend/routes/admin.js` + `backend/routes/auth.js` reproduces fixpoint timeouts under the original `p/owasp-top-ten` ruleset with Semgrep `1.182.0`; each file scanned alone completes without a timeout.

## Reproduction

The reproduction uses Docker image `semgrep/semgrep:1.182.0` with digest `sha256:4a34048c04fef049f71665047f074cffb00cc3d89482f965a5cd151d589237af`.

```text
docker run --rm -v "<repository>:/src" -w /src/semgrep-timeout-mre/source semgrep/semgrep:1.182.0 semgrep scan --config p/owasp-top-ten --no-git-ignore --timeout 0 --timeout-threshold 0 --error --json --output /src/semgrep-timeout-mre/results/owasp-admin-auth.json backend/routes/admin.js backend/routes/auth.js
```

Observed output:

- Semgrep `1.182.0`
- 2 targets
- 0 findings
- 0 scanner errors
- 2 `time.fixpoint_timeouts`, at the copied `admin.js` and `auth.js` targets

Control scans of `admin.js` alone and `auth.js` alone each returned 0 findings, 0 errors and 0 timeouts. The isolated `raw-html-format` rule snapshot also completed on the pair; the timeout requires the original OWASP rule set interaction, not that rule in isolation.

## Root-cause boundary

Verified by this MRE: the timeout is target-set dependent and appears only when the two route files are analyzed together under the OWASP ruleset. The lower-level internal convergence mechanism is not observable from Semgrep JSON, so it is not claimed as proven. The evidence supports a multi-target taint/fixpoint interaction; it does not prove a particular individual source sink or a specific upstream engine defect.

This is a minimum target-level reproduction, not a line-level synthetic reduction. Removing either complete route removes the condition, while reducing production statements would no longer be a faithful reproduction of the observed analysis state. No secrets, credentials or personal data are included.
