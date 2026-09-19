# Registration and Login

Supports account registration, forgotten password reset, account password login, and one-click login with Passkey and various third-party OAuth providers. Please complete registration before your first use.

## Login

### Account Password Login

1. Open the platform homepage, click the "Login" button in the top right corner, or directly visit `/sign-in`.
2. Enter your username or email and password.
3. If Cloudflare Turnstile is displayed on the page, you need to complete the human verification.
4. First, click to confirm you have read and agree to the user agreement and privacy policy, then click "Login".
5. When 2FA is enabled for the account, login will additionally require entering a one-time verification code or backup code.

<img alt="Login Page" src="01-login.webp" />

### Passkey and Third-Party OAuth Login

The login page will display icons for third-party platforms such as GitHub, Discord, LinuxDO, or Passkey, which are enabled by the platform. To log in using a third-party account or Passkey:

1. Click to confirm you have read and agree to the user agreement and privacy policy.
2. Click the icon of the corresponding platform (GitHub, Discord, LinuxDO, etc.) or the Passkey icon at the bottom of the page.
3. When using a third-party account, you will be redirected to the third-party authorization page to complete authorization; when using Passkey, complete verification as prompted by your browser or device.

<img alt="OAuth Login Page" src="02-login.webp" />

<Callout type="info">
  Passkey and third-party OAuth login methods, as well as whether human verification is enabled, are configured by the platform's super administrator (Root) in "System Settings" → "Authentication". Disabled methods will not appear on the login page.
</Callout>

## Registration

### Registration Process

1. On the login page, click "Register", or directly visit `/sign-up`.
2. Fill in your username, password, and confirm password.
3. If platform settings require email verification, enter your email, send the verification code, and input the received code.
4. If Cloudflare Turnstile is enabled on the platform, you need to complete the human verification.
5. First, click to confirm you have read and agree to the user agreement and privacy policy, then click "Create Account" to complete registration.

<img alt="Registration Page" src="03-register.webp" />

<Callout type="info">
  Whether password registration, OAuth registration, email verification, and email domain/alias restrictions are allowed is determined by the Root's authentication settings.
</Callout>

### Login Session Management

Upon successful login, an independent session will be established. Logged-in users can click "Profile" → "Login Sessions" in the left sidebar to view current login sessions with other devices, revoke individual sessions, or log out of all other sessions at once; revoking the current session will return you to the login page.

<img alt="Login Session Page" src="04-login-session.webp" />

## Forgot Password Reset

1. On the login page, click "Forgot Password".
2. Enter the email associated with your account and submit.
3. Open the reset link sent by the system.
4. Set a new password on the reset page, then log in again.

<img alt="Forgot Password Page" src="05-forgot-password.webp" />
