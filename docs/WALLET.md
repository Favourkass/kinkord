# KinkCoins: bank-transfer purchases and withdrawals

The Buy catalogue displays USD using the configured monthly Silver payment NGN/USD conversion. The payment page and bank transfers use NGN. All prices are integer kobo, balances are whole coins/stars/crowns. Rates and the withdrawal minimum have no default in production: transactions stay disabled until a founder configures them.

## Configuration

1. Open **Moderation → Payments** and set the receiving bank account using the existing Silver payment settings. Silver and wallet purchases share this bank account, but retain separate payment records, queues and decisions.
2. Open **Moderation → Wallet**. Set the NGN purchase and redemption rates for each currency and the minimum NGN withdrawal. Enable transactions after checking the values. Redemption rates cannot exceed purchase rates.
3. Only verified founder accounts can change rates or the receiving bank account, verify purchases (which credits coins) and approve, pay or reject withdrawals. Staff admins can see the queue but not decide. Another founder must review a founder's own wallet transactions.

Apply the committed Drizzle migration through the normal release process. The API applies migrations on boot when `RUN_MIGRATIONS=true`. No AWS infrastructure deployment is required for this feature.

## Purchase

**Wallet → Buy KinkCoins → choose a bundle → transfer to the displayed bank → enter sender name and transfer reference → upload receipt → submit.**

New purchase references use `KKCYYYYMMDDHHmmss` in Africa/Lagos time, with a wallet-only prefix distinct from Silver’s KIN codes. When wallet purchases share a second, the allocator uses the next free second under a database transaction lock. Existing references stay unchanged so previously issued bank transfer instructions remain valid.

The purchase saves its NGN price and bank details at creation, so later settings changes do not alter an existing checkout. Receipts upload to private S3 through a presigned URL. The server checks receipt ownership, existence, size and file type before submission. Only admins can obtain a download URL.

An admin finds the submitted purchase in **Moderation → Wallet → Coin purchases**, checks the actual bank statement against the member's receipt, amount and reference, then selects **Verify payment** and enters the actual bank transfer reference. Only this decision credits the wallet. Rejection requires a reason and does not credit coins. A receipt alone does not prove money arrived; there is no automatic bank reconciliation.

## Post gifts

Timeline, profile, saved and shared-post cards show icons and counts in separate rounded buttons. **Gift** appears for subscribed authors and opens the Coin, Star and Crown picker. Members review the recipient, available balance and whole quantity before sending. The original post's author receives the gift, including when the card is a repost. There is no conversion, fee or admin approval for gifts: 5 Stars deducts 5 Stars from the sender and credits 5 Stars to the author.

The authenticated API derives the recipient from a visible original post. Self gifts, inaccessible/deleted posts, invalid amounts, insufficient available funds and disabled wallet transactions are rejected. Funds reserved for withdrawals cannot be gifted. Gifts and withdrawals acquire the same member locks; two-member locks are acquired in stable order. Debit, credit and the immutable `wallet_gift` transfer journal commit together or roll back together. The journal records both participants, currency, quantity, original post, names at transfer time and timestamp, and is retained if the post disappears. Reconcile available balance using the purchase/withdrawal ledger plus incoming minus outgoing gift journal quantities.

A sender-scoped request key prevents retries and double-clicks from charging twice. Reusing a key with different contents is rejected. A delivered transfer can still be retrieved by the same retry after its post is hidden or deleted. Gifts are final; there is no user reversal flow. Both members see the transfer in Transaction History, with sent/received direction and counterparty. Wallet pages refresh on focus and every 15 seconds. The author can withdraw received units through the existing manual withdrawal approval flow, subject to configured NGN rates and minimums.

Apply migration `0020_post_gifts` before enabling the updated API. Local integration checks exercise all three currencies, retries, concurrent overspending, reserved-fund preservation and journal reconciliation against isolated test wallets. Production gifting uses existing verified wallet funds; there is no test-fund credit endpoint.

## Bank accounts

**Wallet → Bank Accounts** saves up to two accounts per member in PostgreSQL. Accounts have bank name, holder name and a ten-digit Nigerian account number. The first becomes default; the member can choose another default or remove an account. Removing the default promotes another account. Members cannot access or change another member's bank accounts.

Numbers are masked in the saved-account list and transaction history. A withdrawal stores a snapshot of the selected account, so later deletion/default changes cannot redirect an existing request. Account ownership is not automatically verified; staff must check destination details before transferring.

## Withdrawal

Buying and sending gifts are available to Basic and Silver members under the normal sign-up/access rules. Only members with an active Silver subscription can receive new gifts. Only coins received as gifts can be withdrawn: bought coins are for gifting, and a gift spends the sender's bought coins before their gift earnings. Redemption also requires an active Silver subscription **and the existing Silver verification badge**. The API checks `silverCheckStatus` when creating a withdrawal, including the account age, photos and any review hold; the UI shows the requirement and links to Silver when ineligible. Expired subscriptions and held/not-yet-issued badges cannot create withdrawals. Existing withdrawal requests remain reviewable and payable. Purchasing and gifting do not use this eligibility gate.

**Wallet → Withdraw / Redeem → choose currency → review quantity, NGN amount and saved bank → submit.**

The API validates current rates, minimum and the withdrawable (gift-earned) balance. Submission atomically moves the quantity from available and withdrawable to reserved and writes a ledger hold. Reserved coins cannot be spent or withdrawn again.

1. **Pending:** an admin checks the request and destination account.
2. **Approved:** an admin approves it. This does not send money or remove the reservation.
3. **Manual transfer:** the admin sends the displayed NGN amount to the saved destination using the bank.
4. **Paid:** after confirming the bank transfer succeeded, the admin selects **Mark paid** and records the actual transfer reference. The reserved quantity is consumed.

A pending or approved request can be rejected with a reason, which returns the reserved quantity to available, withdrawable again. Do not reject a transfer already sent; record it paid. Verified purchases and paid withdrawals cannot be decided again. There is no automatic payout integration, cancellation after submission, guaranteed settlement time or withdrawal fee in this version.

## Consistency and audit

Member-scoped request keys make network retries idempotent. Per-member transaction locks and conditional balance updates prevent concurrent withdrawals from overspending. Decisions and balance/ledger writes commit together. A bank transfer reference cannot be reused for two purchases or two payouts. Settings changes and decisions are recorded in the moderation audit log. Financial operations and ledger entries are retained when a saved bank account is removed.

**Transaction History** shows the latest 200 operations, current status, references and rejection reasons. Pending purchases can be resumed. Wallet screens refresh every 15 seconds and when focused; history remains the source for status updates. Only the member’s own profile displays available coin balance, excluding reserved coins. Other viewers never receive the balance.

## Local testing

Use local PostgreSQL, Mailpit and MinIO as described in ONBOARDING.md. Use a separate test database when an older notification preview has a different migration history. Set `NEXT_PUBLIC_WALLET_TEST_MODE=true` on the local/shared web preview to display a clear test banner. Configure dummy receiving bank details and test NGN rates only in that database. Never transfer real money to a test account.

Test with separate member and admin accounts: buy a bundle, upload a dummy image, verify as admin, check credit, submit a withdrawal, approve, record a dummy transfer reference and check paid status. Also reject a second request and confirm the reservation returns. Repeat decisions and simultaneous withdrawals must fail without changing balances twice. Production rates must be chosen by the lead; local test rates are not committed as defaults.

Unit tests cover validators, amounts, status transitions, ownership, retry behavior and presentation. The manual local integration check also covers receipt upload to MinIO and simultaneous PostgreSQL withdrawals. Existing Silver subscription tests remain passing.

The bank picker uses the pinned Nigerian Bank Logos directory's names, aliases and codes (660 institutions, including OPay and Kuda), and shows each bank's initials rather than loading logos from a third party. The source and MIT license are in `apps/web/public/banks`. It is a maintained directory snapshot, not live account-name resolution or proof that every listed institution currently accepts transfers. Refresh the snapshot when bank coverage changes.

Timeline actions display like, comment, share and gift counts. Gift counts reflect completed transfer records on the original post, not the quantity of currency sent; retried deliveries count once. Share counts record completed native shares or successful link copies, starting from deployment, once per member per post; they do not claim delivery or count cancelled share sheets. Counts persist on the original post, including when displayed through a repost.

Gift actions appear only on subscribed authors’ posts; receiving is also checked by the API before funds move. Expiry does not prevent replaying an already delivered gift. Post names and profiles show the Silver shield only under the existing silver/silverSince verification rules (including account age, email verification and review holds). The independent subscription flag controls gift eligibility, not the shield.
