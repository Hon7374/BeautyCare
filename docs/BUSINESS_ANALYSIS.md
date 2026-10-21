# Business Analysis Alignment

This document maps the product to the proposal's business-analysis direction: account management, token authentication, online payment, customer retention, and multi-tier discount policies.

## Domain

- industry: beauty-care / spa / customer service
- objective: improve customer retention through CRM, loyalty, membership, voucher, and booking workflows

## Main Actors

- guest
- registered customer
- loyalty member
- admin
- payment gateway

## Main Flows

### 1. Account and token flow

- register account
- login
- issue access token and refresh token
- rotate refresh token
- verify email, reset password, enable 2FA

### 2. Loyalty and discount flow

- identify membership tier
- apply tier discount
- validate voucher
- calculate final price with stacking limit

### 3. Booking and checkout flow

- choose service
- book appointment
- create order
- choose payment provider
- update payment status and customer history

### 4. Admin control flow

- manage users, services, vouchers, bookings, transactions, subscriptions
- review audit logs, metrics, reports
- adjust discount policy

## Security Mapping

- authentication: JWT, refresh tokens, 2FA
- authorization: RBAC user/admin
- session safety: HttpOnly cookie, CSRF
- payment safety: provider redirect/webhook/IPN validation
- monitoring: request log, audit log, health profile

## Report Mapping

This document can support:

- business requirement analysis
- use-case and flow descriptions
- token flow explanation
- payment and loyalty workflow explanation
