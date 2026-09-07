# Phase 5B frontend API integration

Implemented against backend `748131b60bb1ae63256b02dd06bef6be56ef30f4`.
Reconstructed history: `98e3452`, formatting preservation `8ae6e6c`;
pre-change Git checkpoint: `5bef3cf`.

## Public API and pricing

Base URL: `https://api.vearuny.com`. Browser requests omit credentials.

| Method | Route | Use |
| --- | --- | --- |
| GET | `/api/plans` | Resolve active WEEKLY/MONTHLY IDs and branch |
| GET | `/api/packages` | Resolve active A–F IDs and display database prices |
| GET | `/api/addons` | Load four confirmed add-ons and applicable pricing rules |
| POST | `/api/customers` | Create/upsert customer, retain returned ID |
| POST | `/api/orders` | Create commercial order with `Idempotency-Key` |

The pre-submit package subtotal multiplies the API unit price by selected sets;
it is not a final payable total. Add-on and final total placeholders remain `—`
until the receipt. Discounts are never calculated in browser code. Receipt,
copy, Telegram fallback and order QR all use the saved authoritative response.
The original price/discount implementations remain only in immutable `recovered/`
and historical reconstruction tests; they are not served.

**Contract limitation:** GET `/api/addons` returns `price_per_meal` and
`applicable_meal_count`, not a calculated set/order charge. The UI displays these
returned operands, without multiplying them. Calculated charges are displayed
from `items[].addons[].total_amount` and `order.addon_total` after creation.
An authoritative pre-submit add-on/final quote would require a backend quote or
calculated-charge field; no backend or pricing modifications were made here.

## Payload

Customer POST body:

```json
{
  "name": "Customer name",
  "phone": "Customer phone",
  "branch_id": 1,
  "language": "KH",
  "source": "web",
  "nutrition_notes": "Optional nutrition notes"
}
```

Order example (IDs are illustrative; runtime resolves the loaded catalogs):

```json
{
  "customer_id": 123,
  "meal_plan_id": 1,
  "items": [
    {"package_id": 14, "quantity": 2, "menu_focus": "weight_loss", "juice_option": "none", "addons": [{"id": 1}]},
    {"package_id": 19, "quantity": 1, "menu_focus": "muscle", "juice_option": "large", "addons": [{"id": 4}]}
  ],
  "fulfillment_method": "delivery",
  "district": "Selected district",
  "commune": "Selected commune",
  "address": "Delivery address",
  "fulfillment_time": "8:00 AM - 10:00 AM",
  "start_date": "2026-09-15",
  "menu_focus": "weight_loss",
  "juice_option": "none",
  "subscriber_type": "old",
  "previous_subscription_number": "Previous subscription number",
  "customer_remarks": "Optional remarks",
  "nutrition_notes": "Optional nutrition notes",
  "source": "web"
}
```

Identical sets with identical add-ons are grouped into one item with quantity.
Mixed packages or different add-ons remain separate items. Total quantity is
limited to 1–100. No price, billable add-on quantity, discount, payment status or
verification flag is submitted. Single-package orders use the same `items` shape.
Order-level menu/juice describes the first item; each item has its own values.
For pickup, district/commune/address are null and are not required; the selected
pickup time is sent in `fulfillment_time`.

## Submission and receipt

The client creates a cryptographically random UUID once per checkout attempt,
then stores the exact customer/order snapshot and key in `sessionStorage` before
any POST. After customer success, it saves the customer ID before posting the
order. Pending submission locks the form and submit button synchronously.

Timeouts (25 seconds), network failures, unreadable/incomplete responses, 409 and
server errors retain the same snapshot/key. Retry reuses both, including after a
same-tab reload; completed attempts reopen their saved receipt without a POST.
The persisted form is restored when catalog loading succeeds. Validation
rejections (400/404/413/415/422) allow corrections and a new attempt. A key conflict is
shown with the server explanation and never silently replaced. Storage failure
blocks network submission instead of proceeding without a saved key.

Storage is scoped to this tab session. Closing/clearing it or starting an
independent tab is not cross-tab order recovery. There is no public receipt
lookup endpoint, and no browser admin lookup is attempted. An unresolved attempt
cannot be reset through the UI. Explicitly starting another order is available
after success or a definitive validation rejection.

Receipt fields: order code, plan, package codes/quantities, item base amounts,
individual add-on charges, order base amount, discount amount/rule/percentage,
add-on amount, delivery fee, total/currency, customer contact, fulfillment method,
delivery location or pickup kitchen, time, start date, subscriber metadata,
remarks, nutrition notes, and returned payment status. API/user strings are
escaped before HTML rendering. English/Khmer labels, menu images, nutrition
modal, fulfillment controls, ticket flip and QR download controls are retained.

Existing PayWay USD/KHR links and QR codes appear only after order creation.
They do not bind or verify payment, convert currency, or change the unpaid state.
Telegram is optional and customer-initiated; its fallback includes the created
order code. No messages were sent during development/testing.

## Validation results

- `npm run test:syntax`: 12 maintained JavaScript files passed syntax checks.
- `npm test`: 43 tests passed, including four tests executing actual HTML/scripts
  in jsdom. No real API calls occur in the offline suite.
- Coverage: three catalogs; Weekly/Monthly A–F; quantities; mixed items and
  per-item add-ons; Friday/new/returning server response rendering; delivery and
  pickup; both languages; preserved geography on language switch; nutrition/menu
  UI; escaped receipts; PayWay/order QR payloads; pending lock; double clicks;
  saved retry after reload; API errors, timeout, malformed response, storage
  failure, key conflicts, and completed-order deduplication.
- Live disposable smoke: two customer/order creations; same-key replay verified;
  changed-payload same-key requests rejected with 409; invalid delivery, package
  and add-on rejected with 400; public CORS permits `Idempotency-Key`.
- Weekly mixed pickup: `VRN-20260907-000002`, customer 3, base $42.50,
  new-subscriber discount $3.40, add-ons $13.00, total $52.10, unpaid.
- Monthly delivery: `VRN-20260907-000003`, customer 4, base $144.00,
  returning-subscriber discount $7.20, add-ons $112.00, total $248.80, unpaid.
- Friday was tested with offline authoritative-response fixtures; no clock or
  promotion override was used against production.
- Test records use synthetic non-contact phone values, year-2099 start dates,
  and explicit DO NOT FULFILL / DO NOT CONTACT remarks. They remain pending/unpaid;
  no protected cancellation or administrative cleanup was performed.
- Public snapshots and sanitized smoke results: `evidence/integration-*.json`.
  Live replay identities are kept outside the repository in
  `/tmp/phase5b-smoke-state/` and are not printed in reports.
- Loopback staging server: `http://127.0.0.1:4173`, verified by HTTP asset
  comparison and listening-socket inspection. No external port exposure.

Remaining acceptance: real Chromium/Firefox/Safari rendering, narrow mobile
layouts and Khmer font wrapping, real iOS/Android Telegram webviews, keyboard and
screen-reader navigation, real camera QR scans, clipboard/download permissions,
PNG export and ticket flipping. jsdom verifies behavior, not pixels or canvas.
Review retained merchant policies separately before publication; this integration
does not rewrite the historical policy content. Review the pre-submit quote
limitation above with the checkout acceptance owner.

## Firebase preview/staging plan — not executed

No Firebase login, deployment, target mutation or infrastructure change was run.
Use an already approved Firebase staging project/site. Their IDs are not present
in this reconstructed repository and must be verified rather than inferred from
the production web.app hostname.

After explicit authorization to publish a preview, on the release workstation:

1. Check out the integration commit. Run `npm ci`, `npm run test:syntax`,
   `npm test`, and the real-browser acceptance checks above.
2. Verify the approved project/site with read-only
   `firebase projects:list` and `firebase hosting:sites:list --project "$STAGING_PROJECT_ID"`.
   Both `STAGING_PROJECT_ID` and `STAGING_SITE_ID` must name the approved existing
   staging resources. Creating infrastructure is a separate action.
3. Create this local `firebase.preview.json` at repository root:

   ```json
   {
     "hosting": {
       "target": "phase5b",
       "public": "site",
       "ignore": ["**/.*", "**/node_modules/**"],
       "headers": [{"source": "**", "headers": [{"key": "Cache-Control", "value": "no-store"}]}]
     }
   }
   ```

4. Configure the local target, then deploy only the expiring preview channel:

   ```sh
   firebase target:apply hosting phase5b "$STAGING_SITE_ID" --project "$STAGING_PROJECT_ID"
   firebase hosting:channel:deploy phase5b --only phase5b --expires 7d --project "$STAGING_PROJECT_ID" --config firebase.preview.json
   ```

5. Record the returned preview URL and tested commit; verify catalog CORS, the
   five public routes, browser acceptance and disposable-only checkout/retry on
   that origin. This frontend still talks to the production API, so preview order
   submissions create real database records. Do not submit customer orders or
   make payments during staging tests. Stop after preview acceptance.

Only `site/` is hosted: no recovered source, evidence, tests, secrets or backend
files. No DNS change, live-channel release, production payment activation,
functions/rules/database deploy or automatic production CI is part of this plan.

Firebase references checked 2026-09-07:
[Preview channels](https://firebase.google.com/docs/hosting/test-preview-deploy),
[site-specific preview targets](https://firebase.google.com/docs/hosting/multisites).
