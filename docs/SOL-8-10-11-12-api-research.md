# Account Page API Research — SOL-8, SOL-10, SOL-11, SOL-12

## Packages Installed
- `@wix/loyalty` — accounts, programs, earning-rules, rewards, tiers, transactions
- `@wix/members` — member profiles, addresses, authentication
- `@wix/contacts` — contact/address management (alternative)

---

## SOL-12: My Addresses (@wix/members)

**Read:** `getCurrentMember()` → `member.contact.addresses[]`
**Add/Edit:** `updateMember(id, { contact: { addresses: [...all] } })` — overwrites entire array, must include all existing
**Delete all:** `deleteMemberAddresses(id)`
**Delete one:** `updateMember()` with filtered array

Address shape: `{ addressLine, addressLine2, city, subdivision, country, postalCode, streetAddress: { number, name } }`

---

## SOL-11: My Rewards / SOL-8: Points System (@wix/loyalty)

**Member's account:** `getCurrentMemberAccount()` → `{ points: { balance, earned, redeemed, expired }, tier, rewardAvailable }`
**Program info:** `getLoyaltyProgram()` → status, expiration settings
**Earning rules:** `listEarningRules()` → how points are earned (fixed amount or conversion rate, per tier)
**Available rewards:** `listRewards()` → what can be redeemed (discount amount or coupon), cost in points
**Tiers:** `listTiers()` → tier names, required points, descriptions
**Transaction history:** `queryLoyaltyTransactions()` → EARN, REDEEM, ADJUST, REFUND, EXPIRE

---

## SOL-10: My Wallet

"My Wallet" = stored payment methods / credit cards. The Wix SDK has `@wix/ecom.giftVouchers` for gift cards but NO API for listing saved payment methods. Payment methods are managed by the payment provider (Stripe, etc.) and only accessible during checkout.

Options:
1. Show gift card balance check (enter code → see balance)
2. Link to Wix hosted page for payment method management
3. Skip wallet for now — payment methods aren't accessible via headless API

---

## Server vs Browser Client

- Loyalty, members, contacts APIs need to be added to the **server client** (API Key auth) for read operations
- For member-specific data (getCurrentMember, getCurrentMemberAccount), need **browser client** with member OAuth tokens
- Some APIs may need both depending on the operation
