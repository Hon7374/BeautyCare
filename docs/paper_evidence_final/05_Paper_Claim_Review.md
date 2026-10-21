# Review of ICCIT paper claims

The manuscript itself was not found, so exact page/section wording cannot be verified. The table below reviews claims visible in repository research documents and the requested claim set.

| Area / claim | Classification | Required treatment |
|---|---|---|
| 100/200/300 VU completed five-minute profiles with 0% HTTP errors | SUPPORTED | Cite historical k6 JSON and label environment/date |
| 400 VU completed capacity pass | CONTRADICTED | Remove; retain as failed/overload observation and unresolved conflict |
| 500 VU completed capacity pass | CONTRADICTED | Remove; retained run was partial and failed |
| k6 benchmark measures complete BeautyCare performance | UNSUPPORTED | Limit to public `GET /api/services` workload |
| CSRF is signed and session-bound | CONTRADICTED | Replace with naive double-submit-cookie description |
| CSRF missing/mismatch rejection | SUPPORTED | Cite source and existing tests; historical unless rerun |
| 19/19 security regression tests passed | SUPPORTED | Label existing historical evidence; not a new run |
| 5/5 isolated MySQL-backed tests passed | SUPPORTED | Label historical isolated DB evidence |
| ZAP baseline proves full penetration-test coverage | UNSUPPORTED | Describe as baseline scan with High 0, Medium 4, Low 2, Informational 3 |
| Voucher and membership features are fully tested | UNSUPPORTED | Source shows implementation, but retained runtime matrix is absent |
| Discount calculation rules exist in code | PARTIALLY SUPPORTED | Cite static source; do not convert into runtime PASS |
| 11 VNPay sandbox records, 10 paid and 1 failed | SUPPORTED | Cite retained transaction summary and scope it to sandbox evidence |
| Reference [20] title/authors/metadata | SUPPORTED | Use corrected citation in `04_Reference_20_Verification.md` |
| Current hardware equals historical test hardware | NEEDS CLARIFICATION | Historical hardware was not recorded |

