# ICCIT replacement content

## Experimental Environment

Historical evidence describes a Windows PowerShell environment using Node.js v24.12.0, npm v11.12.1, and Docker MySQL 8.4.11 exposed at 127.0.0.1:3310. The benchmark server was reported at 127.0.0.1:3001 with a localhost-only, non-production performance mode. CPU model, core counts, RAM, container limits, and k6 version were not recorded and are therefore not specified here.

## Load Testing Methodology

The k6 scenario used a constant virtual-user workload. Each iteration issued one unauthenticated `GET /api/services` request and did not include ramp-up, ramp-down, request payloads, authentication, or think time. The script measured request duration and k6 HTTP failure rate, while recording status counters. Accordingly, the experiment evaluates a public read endpoint rather than the end-to-end BeautyCare transaction workload.

## Performance Results

Historical five-minute profiles at 100, 200, and 300 VUs recorded 294,163, 287,191, and 286,276 requests, respectively, with HTTP failure rates of 0%. Their mean request durations were 101.835, 208.797, and 314.271 ms. A 400-VU JSON artifact recorded 1,244,906 requests over approximately 300 s, but 92.631% failed; a separate report describes a 400-VU attempt stopped after approximately 14 s. Because the relationship between these two records cannot be established from the retained provenance, the 400-VU evidence is treated as an unresolved conflict and an overload observation, not as a completed capacity result. The 500-VU artifact was also partial and failure-affected.

## Threats to Validity

The results are limited by a single public-read endpoint, localhost execution, missing historical hardware metadata, missing k6 version and run manifests, and the absence of authenticated or transactional workload. The retained 400-VU records are internally inconsistent. Therefore, the measurements should not be generalized to production capacity or to booking, payment, voucher, membership, or security workloads.

## Discussion

The completed 100-, 200-, and 300-VU profiles provide evidence of the tested endpoint’s behavior under the recorded local configuration. Increasing VU levels increased mean latency, while the higher-load attempts exposed connection-failure behavior. These observations are useful for reproducibility and capacity-boundary discussion, but they do not establish a system-wide capacity limit. Separately, source inspection indicates a conventional double-submit-cookie CSRF design and a server-side discount calculation path; source presence is not treated as runtime verification.

## Reference [20] correction

S. Qadir, E. Waheed, A. Khanum, and S. Jehan, “Comparative evaluation of approaches & tools for effective security testing of Web applications,” *PeerJ Computer Science*, vol. 11, Art. no. e2821, 2025, doi: 10.7717/peerj-cs.2821.

