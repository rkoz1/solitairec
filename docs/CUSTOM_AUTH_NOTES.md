# Custom Auth — What We Know

## The Problem
Wix's hosted login page has aggressive Google reCAPTCHA that drives users away. Wix support dismisses it as a Google problem.

## The Solution
The Wix SDK's `OAuthStrategy` supports **direct email/password login** without redirecting to Wix's hosted page. We built a working test page at `/dev/auth-test` that proves all three auth flows work.

## What Works

### 1. Email/Password Login (tested, working)
- `wix.auth.login({ email, password, captchaTokens })` — calls Wix's identity API directly
- Returns a state machine: `SUCCESS`, `FAILURE`, `CAPTCHA_REQUIRED`, etc.
- On success: `getMemberTokensForDirectLogin(sessionToken)` → member tokens
- **Captcha is required** but we use Google's invisible reCAPTCHA v3 (zero user friction)
- Site key comes from `wix.auth.captchaInvisibleSiteKey` (hardcoded in SDK)

### 2. Email/Password Registration (built, needs testing)
- `wix.auth.register({ email, password, captchaTokens, profile })` — same state machine
- `profile` accepts `firstName`, `lastName`, `nickname`, `phones`, etc.
- Possible outcomes: `ACTIVE` (instant login), `PENDING` (email verification or admin approval)
- Same invisible reCAPTCHA handling as login

### 3. Social Login via Popup (built, needs testing)
- `wix.auth.getAuthUrl(oauthData, { responseMode: 'web_message' })` opens Wix login in a popup
- Wix's popup shows Google/Facebook/Apple buttons (whatever's enabled in Wix dashboard)
- Social login does NOT trigger captcha (captcha is only for email/password)
- Wix posts auth code back via `postMessage` → exchange for tokens → popup closes
- No external API keys needed — uses Wix's own provider configuration

## Key Technical Details

### Token Flow
```
login/register → StateMachine(SUCCESS) → sessionToken
  → getMemberTokensForDirectLogin(sessionToken) → { accessToken, refreshToken }
  → setTokens(tokens) + localStorage.setItem('wix_tokens', tokens)
  → window.dispatchEvent(new Event('auth-changed'))
```

### State Machine States
| State | Meaning |
|-------|---------|
| `SUCCESS` | Auth succeeded, `data.sessionToken` available |
| `FAILURE` | Failed — check `errorCode` for details |
| `EMAIL_VERIFICATION_REQUIRED` | User must verify email first |
| `OWNER_APPROVAL_REQUIRED` | Admin must approve the account |
| `USER_CAPTCHA_REQUIRED` | Visible captcha needed (shouldn't happen with invisible) |
| `SILENT_CAPTCHA_REQUIRED` | Invisible captcha challenge failed |

### Error Codes (on FAILURE)
`invalidEmail`, `invalidPassword`, `resetPassword`, `emailAlreadyExists`, `missingCaptchaToken`, `invalidCaptchaToken`

### IOAuthStrategy Methods (from `@wix/sdk`)
```typescript
login(params: { email, password, captchaTokens? }) → StateMachine
register(params: { email, password, captchaTokens?, profile? }) → StateMachine
getMemberTokensForDirectLogin(sessionToken: string) → Tokens
getMemberTokensForExternalLogin(memberId: string, apiKey: string) → Tokens
sendPasswordResetEmail(email: string, redirectUri: string) → void
captchaInvisibleSiteKey: string  // Google reCAPTCHA v3 site key
captchaVisibleSiteKey: string    // Google reCAPTCHA v2 site key
```

## Future: Fully Custom Social Login (no Wix popup)
If we want Google/Apple buttons on OUR page (no popup to Wix at all):
1. Authenticate with Google/Apple using their SDK → get user's email
2. Server action: query Wix members by email (`members.queryMembers().eq('loginEmail', email)`)
3. Server action: `getMemberTokensForExternalLogin(memberId, WIX_API_KEY)` → tokens
4. Return tokens to browser
- Requires a Google Cloud Console OAuth Client ID
- Requires adding `members` module to server client (`src/lib/wix-server-client.ts`)

## Files
- **Test page**: `src/app/dev/auth-test/page.tsx` — hidden at `/dev/auth-test`, no links anywhere
- **Browser client**: `src/lib/wix-browser-client.ts` — unchanged, provides `getBrowserWixClient()`
- **Current OAuth flow**: `src/lib/wix-auth.ts` — redirect-based, still used by the rest of the app

## When Ready to Ship
1. Test all three flows on the test page
2. Build a production auth page (styled, proper URL like `/login`)
3. Update `startLogin()` in `wix-auth.ts` to use direct login instead of OAuth redirect
4. Add password reset flow (`sendPasswordResetEmail`)
5. Remove or keep the Wix popup as a fallback for social login
