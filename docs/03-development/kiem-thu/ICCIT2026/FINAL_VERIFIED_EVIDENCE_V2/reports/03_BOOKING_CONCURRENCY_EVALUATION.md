# Booking Concurrency Evaluation

## Threat and fix

The original booking path performed a capacity `COUNT(*)` followed by `INSERT` without serializing concurrent requests. The current path acquires a MySQL named lock keyed by `service_id + date + time`, performs the service lookup, capacity count and insert while holding that lock, and releases it in `finally`. Lock acquisition timeout returns HTTP 503; a full slot returns HTTP 409.

This protects the check-and-insert race across application workers sharing the same MySQL instance. It is not a replacement for a database transaction or a suitable cleanup policy for cancelled bookings; the counted statuses remain `pending`, `confirmed`, and `paid` as defined by the application.

## Experimental Setup and Executed Results

The isolated test is `backend/tests/booking-concurrency.integration.test.js`. It issues 50 concurrent booking requests to one service/date/time with capacity 3 and expects three HTTP 201 responses, 47 HTTP 409 responses, and a final database count of 3. The test uses a future date and must run only against `beautycare_test` or another disposable database.

## Execution status

**VERIFIED.** The test ran against isolated `beautycare_test` on MySQL 8.4. A 50-request concurrent run produced exactly **3 HTTP 201**, **47 HTTP 409**, and a final counted capacity of **3**. The test completed in 0.89 seconds in the recorded run.

## Required rerun

The run used `npm run db:test` to recreate the isolated schema, followed by `jest --runInBand tests/booking-concurrency.integration.test.js` with `DB_NAME=beautycare_test`. The production database was not used.

Machine-readable Jest output is retained at `raw-results/booking-concurrency-20261021-result.json`.
