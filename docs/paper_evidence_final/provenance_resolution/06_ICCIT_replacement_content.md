# ICCIT replacement content

## Experimental provenance

The retained historical records do not include run identifiers, exact timestamps, k6 version, backend commit, host resource metadata, or per-run configuration snapshots. Accordingly, the historical 400-VU records are treated as separate observations whose relationship cannot be established. A later local replication produced an independent 400-VU JSON artifact under a disposable MySQL test database and a localhost performance configuration.

## Historical 400-VU observations

One historical record is reported as approximately 300 seconds with 1,244,906 requests and a 92.6306% failure rate. A separate report describes a 400-VU attempt interrupted after approximately 14 seconds with connection-refused errors and 12,486 observed iterations. The raw JSON and console transcript needed to link these records are not both retained; neither record should be presented as a successful capacity pass.

## New 400-VU evidence

The independent local replication completed 300.293 seconds at 400 VUs, producing 302,936 requests, all with HTTP 200 responses and a 0% k6 HTTP failure rate. Mean request duration was 396.072 ms and p95 was 446.824 ms. This result describes the tested public `GET /api/services` workload under the recorded localhost configuration; it is not evidence of production capacity or end-to-end transaction capacity.

## Threats to validity and reproducibility

The workload excludes authentication, booking, payment, voucher, membership, CSRF, ramping, think time, and mixed API traffic. Historical provenance is incomplete, and the new run lacked a contemporaneous manifest. Future runs should use the manifest tool to capture hashes, environment, timestamps, result hashes, and status without recording secrets.
