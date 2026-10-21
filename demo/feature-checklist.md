# BeautyCare Full Demo Checklist

## Public

- [x] Open public landing page
- [x] Show service-focused homepage sections
- [x] Navigate from public page into auth

## Auth

- [x] Register a new user from UI
- [x] Logout
- [x] Login with password only
- [x] Change password from security page
- [x] Login again with new password
- [x] Login again with 2FA OTP after enabling 2FA
- [x] Final logout

## User / Account

- [x] Open profile page
- [x] Update profile fields from UI

## Security

- [x] Request email verification token
- [x] Read verification token from outbox
- [x] Verify email on UI
- [x] Create 2FA secret
- [x] Enable 2FA with generated TOTP
- [x] Disable 2FA with generated TOTP

## Services

- [x] Open services listing
- [x] Filter/search services
- [x] Open service detail
- [x] Jump from service detail to booking

## Booking

- [x] Create booking from UI
- [x] View booking in "Lá»‹ch háº¹n cá»§a tÃ´i"
- [x] Confirm booking from admin
- [x] Return as user and see updated booking status
- [x] Cancel booking from user side

## Admin

- [x] Login as admin
- [x] Open admin users page
- [x] Search for the demo user
- [x] Open admin bookings page
- [x] Update booking status
- [x] Open admin services page

## Skipped In Automation

- [ ] Membership purchase / renewal
- [ ] External payment completion
- [ ] Discounts / reports / vouchers / subscriptions deeper CRUD
- [ ] Cart / product order flow

## Skip Reasons

- Membership and payment flows lead into provider-style checkout paths that are outside the stable local desktop demo path for this run.
- Discounts, reports, vouchers and subscriptions were left out to keep the recorded clip focused on the most important user + security + booking + admin flows.
- The active frontend in this repo is centered on service booking, not a stable cart/product-order journey, so cart/order was not part of the recorded happy path.
