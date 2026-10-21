# Agile/Scrum Alignment

This document maps the prototype to the Agile/Scrum research item in the proposal.

## Product Goal

Build a secure web prototype for beauty-care service commerce focused on:

- account management and token security
- online payment
- CRM and loyalty management
- multi-tier discount policies

## Suggested Roles

- Product Owner: BeautyCare business/stakeholder representative
- Scrum Master: sprint coordination and risk tracking
- Development Team: frontend, backend, database, testing

## Epic Backlog

1. Secure account and token lifecycle
2. CRM and loyalty features
3. Booking and service checkout
4. Online payment integration
5. Multi-tier discount engine
6. Audit, monitoring, and admin reporting
7. Testing and experimental evidence

## Sample User Stories

- As a customer, I want secure login and refresh-token based sessions so my account is protected.
- As a loyalty member, I want tier-based discounts and vouchers applied automatically at checkout.
- As an admin, I want to review transactions, bookings, and audit logs to detect abnormal behavior.
- As a beauty-service owner, I want to manage membership tiers and retention campaigns to increase repeat visits.
- As a user, I want to pay online through VNPay, MoMo, or Stripe to complete service purchases quickly.

## Sprint Suggestion

### Sprint 1
- analyze CRM/loyalty requirements
- define user stories and backlog
- design API and database model

### Sprint 2
- implement auth, refresh rotation, RBAC, CSRF
- implement profile, membership, voucher
- add smoke and security tests

### Sprint 3
- integrate booking and payment providers
- complete reporting, metrics, audit logging
- finalize testing evidence and report artifacts

## Definition of Done

- feature works in the prototype
- test or evidence exists
- config and usage docs exist
- known risks and limitations are documented
