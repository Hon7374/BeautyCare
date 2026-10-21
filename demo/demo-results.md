# BeautyCare Full Demo Results

- Run time: `2026-04-25 15:27:43`
- Recording tool: `ffmpeg gdigrab desktop capture`
- App URL: `http://localhost:3000`
- Demo DB port: `3407`
- Browser: `C:\Program Files\Google\Chrome\Application\chrome.exe`
- Video: `D:\BeautyCare-Demo\demo\beautycare-full-demo.mkv`
- Script: `D:\BeautyCare-Demo\demo\run-full-demo.ps1`

## Passed

- `public` Landing page: Opened the public homepage and showed featured sections.
- `auth` Register: Created `demo.full@beautycare.local` via the real register form.
- `services` Browse and filter services: Filtered service categories and search on the user services page.
- `services` Service detail: Opened a real service detail page from the listing.
- `booking` Create booking: Created a user booking with note `Full demo booking`.
- `account` Update profile: Updated the profile name to `Demo Full User Updated`.
- `security` Verify email: Requested a verification token from outbox and completed email verification.
- `security` Enable 2FA: Generated a TOTP secret and enabled 2FA from the account security page.
- `security` Change password: Changed the password through the UI and was redirected to login.
- `auth` Login with 2FA: Logged in again using the new password plus a live OTP code.
- `security` Disable 2FA: Disabled 2FA after proving the OTP login flow.
- `auth` Logout: Logged out cleanly before switching to the admin flow.
- `admin` Admin login: Signed in as `khucmai51@gmail.com`.
- `admin` Find demo user: Searched the admin users table for the newly registered account.
- `admin` Confirm booking: Confirmed the user's booking and saved an admin note from the admin console.
- `admin` View service management: Opened the admin services management table.
- `auth` Login after disabling 2FA: Logged in with password only after turning 2FA off.
- `booking` See confirmed booking: Returned as the user and saw the admin-confirmed booking with its note.
- `booking` Cancel booking: Cancelled the booking from the user booking page.
- `auth` Final logout: Finished the demo on the login page while the app kept running.

## Failed

- None

## Skipped

- `cart/order/payment` External checkout completion: Skipped in automation because the active repo flow depends on payment-provider style checkout and no provider callback was required for this local desktop demo.
- `membership` Membership purchase flow: Skipped because it leads into payment/provider flows that are outside the stable local demo path.
- `admin` Discounts, subscriptions, reports, vouchers CRUD: Skipped to keep the recorded flow compact after covering the more critical user + booking + security + admin-confirmation path.
