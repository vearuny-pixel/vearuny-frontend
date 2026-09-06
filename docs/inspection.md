# Phase 5B reconstruction and integration assessment

Observed 2026-09-07 (Asia/Phnom_Penh). Backend checkpoint:
`5189d698c5441547c5f4a15b02fde3be71d5bd43`.

## Recovered application

Source: https://vearuny.web.app/. Public HTTPS GETs only; no Firebase login,
project export, source repository access, bucket listing, or private asset probes.
This is recovered deployed source, not a claim to have recovered its original Git
history or build project. The deployed application is plain HTML, inline
JavaScript, CSS, global language dictionaries and nutrition data.

28 resources were successfully downloaded and hashed in `evidence/assets.json`:

- `index.html`, `style.css`, `lang-en.js`, `lang-kh.js`, `nutrition.js`, `manifest.json`.
- `graylogo.png`, S3 `LOGO+BG.png`, menu images `A.jpg`–`F.jpg` and `a.jpg`–`f.jpg`.
- Tailwind browser runtime, Telegram Web App SDK, html2canvas 1.4.1,
  jsPDF 2.5.1, QRCode.js, Google Fonts stylesheet and two Noto Sans Khmer fonts.

`recovered/` preserves the public bytes. `site/` is the maintained local copy:
inline checkout and fallback nutrition scripts are separated into `site/js/`,
referenced rendering assets/fonts/menu images are local, and the original
manifest icon is local. The inline CSS, bilingual strings, prices, form logic,
nutrition data, menu mapping and ticket behavior remain intact. No application
credentials or Firebase secrets were found. Public merchant links and analytics
identifiers are not authentication credentials.

Two Google Analytics tags and the Facebook pixel are recorded only in the raw
HTML; tracking libraries/pixels were not fetched and the maintained preview does
not load analytics. Public navigation links (maps, PayWay, social, Telegram) are
retained; no messages, payment requests, API POSTs or deployments were executed.
Vendored third-party libraries retain their upstream headers. They were copied
only to reproduce the app, not recursively crawled for optional dependencies.

## Exact package pricing

All amounts USD per subscription set, before subscriber discount or add-ons.
Frontend source: `recovered/index.html`, `PRICING` and
`FOCUS_JUICE_TO_PACKAGE` constants. API source: live GET `/api/plans` and
`/api/packages`, saved as timestamped-inspection evidence JSON files.

| Set | Focus | Juice | Frontend weekly | API weekly (ID) | Frontend monthly | API monthly (ID) |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| A | weight_loss | none | 19.00 | 17.00 (14) | 60.00 | 60.00 (8) |
| B | weight_loss | small | 23.00 | 21.00 (15) | 75.00 | 60.00 (9) |
| C | weight_loss | large | 25.50 | 23.50 (16) | 85.00 | 80.00 (10) |
| D | muscle | none | 20.00 | 18.00 (17) | 63.00 | 57.00 (11) |
| E | muscle | small | 24.00 | 22.00 (18) | 77.00 | 63.00 (12) |
| F | muscle | large | 27.00 | 25.50 (19) | 87.00 | 72.00 (13) |

**11 of 12 prices differ; only monthly A matches.** No UI price or database
price was changed. PostgreSQL is authoritative for the replacement frontend.
API plan IDs are WEEKLY=1 and MONTHLY=2, branch 1. CORPORATE=3 is also public but
has no returned packages and no deployed checkout option; do not fabricate one.
Resolve IDs from the loaded catalogs rather than assuming these IDs stay fixed.

The visible package names are Everyday Salad — Meal Only / + Small Juice /
+ Large Juice (A–C), and High-Protein Salad — Meal Only / + Small Juice /
+ Large Juice (D–F). The focus selector instead describes muscle as “Muscle Focus
(Mix Noodle & Rice)”; retain this existing wording discrepancy in the evidence.
Menu focus values: `weight_loss`, `muscle`. Juice values: `none`, `small`, `large`;
visible small/large sizes are **200 ml / 350 ml**. Juice choice selects the
package, not a separately priced add-on. Complete Khmer labels remain in source.

## Exact add-on names and effective charges

All four are labeled **+$1/meal**. The stored frontend values are exactly
`x2 Egg`, `x2 Meat`, `x2 Chicken`, `x2 Seafood`. Labels include emoji:

| Value | English label | Khmer label | Weekly A–C | Weekly D–F | Monthly A–C | Monthly D–F |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| x2 Egg | 🥚 x2 Egg | 🥚 ពងមាន់ x2 | 5 | 5 | 20 | 20 |
| x2 Meat | 🥩 x2 Meat | 🥩 សាច់ x2 | 5 | 5 | 20 | 20 |
| x2 Chicken | 🍗 x2 Chicken | 🍗 សាច់មាន់ x2 | 2 | 3 | 8 | 12 |
| x2 Seafood | 🦐 x2 Seafood | 🦐 គ្រឿងសមុទ្រ x2 | 2 | 1 | 8 | 4 |

These are USD per one ordered set, computed by deployed `getAddOnCost`:
weekly applicable days are Egg=5, Meat=5, Chicken=2 for A–C / 3 for D–F,
Seafood=2 for A–C / 1 for D–F; monthly multiplies by four. Costs sum across
all selected add-ons and all sets, including mixed-package sets. The app does
not derive those days from a dated menu/calendar or actual service start date.

GET `/api/addons` is currently empty. **Nothing was seeded.** The exact public
names and displayed unit charge are now recovered, but a single $1 unit price
alone does not capture server-authoritative applicability or billable quantity.
Current API add-on `quantity` is supplied by the client (1–100), so allowing the
browser to decide menu days could still undercharge despite authoritative unit
prices. Full parity needs server-derived day/set quantities and validated catalog
codes; frontend values contain spaces and cannot directly be API codes under the
current code validator. Numeric catalog IDs would map once entries exist.

## Delivery, pickup and subscriber behavior

- Weekly = 5 meals, Monday–Friday; monthly = 20 meals, five per week.
- Quantity defaults to 1. Friendly buttons offer 1, 2, 3, 4+; original input has
  min=1 but no max. At quantity >1, customers may choose a different A–F package
  for each set. The API supports one package per order and quantity 1–100.
- Delivery is the default method; pickup is available at the linked Vearuny
  Kitchen location: https://maps.app.goo.gl/XePtBJKT8hGEPaiw6.
- Delivery validates address only; district is labeled optional in English;
  commune exists in the DOM but is hidden, optional and normally blank.
- District/commune dictionaries have 11 districts in both languages; their
  values are localized strings, without shared IDs. Language switches may reset
  geographic/time selections because values are language-specific.
- Actual delivery slots (overridden by inline runtime in both languages):
  **8:00 AM–10:00 AM, 10:00 AM–12:00 PM, 3:00 PM–5:00 PM, 4:00 PM–6:00 PM**.
  Language-file `time_slots` still includes 2:00 PM–4:00 PM instead of 3–5;
  this is stale data, not the runtime selection.
- Pickup slots: **10:00 AM, 12:00 PM, 3:00 PM, 5:00 PM**, with Khmer equivalents
  `10:00 ព្រឹក`, `12:00 ថ្ងៃ`, `3:00 រសៀល`, `5:00 ល្ងាច`.
- Start date is required, minimum tomorrow. Quick buttons: tomorrow, day after
  tomorrow, next Monday. Quick-date code uses UTC `toISOString` after local date
  arithmetic while minimum-date code uses local fields; timezone boundary risk
  is pre-existing. Weekends are not excluded by the date picker.
- Required original fields: package, plan, quantity, start date, customer name,
  phone, plus address for delivery. Phone has no strict format validation.
- Subscriber values: `none`, `new`, `old`. Friendly buttons display new/returning;
  underlying placeholder `none` remains. `old` requires a nonempty previous
  subscription number; frontend does not verify ownership or existence.
- Remarks include free text and toggles: `double_sauce` / Double Sauce,
  `no_cutlery` / No Cutlery, `no_seafood` / No Seafood, `no_beef` / No Beef.
  These append localized text to `remark`. No separate nutrition-notes input is
  present; nutrition modal is informational.

## Discounts and promotions

Friday in **Asia/Phnom_Penh** gets 10% off package subtotal for any subscriber,
with precedence over other discounts. Otherwise `new` gets 8%, and `old` with
any nonempty subscription number gets 5%. They do not stack. Add-ons are excluded.
The formula is `(package subtotal - discount) + delivery + add-ons`.

Delivery is always zero in current executable code. Comments say free until
2027, but there is **no implemented expiry condition**. No coupon engine found.
The production API currently fixes both delivery fee and discount to zero,
ignoring submitted values. Thus net totals also differ even where a base price
matches. Do not silently carry frontend promotions into API totals or change
production pricing. Server promotion eligibility/quote support is needed to
preserve current promotions faithfully.

## QR/payment and order behavior

Submit currently creates a local ticket/modal only: no customer/order API calls,
no durable backend order, no authoritative order code or paid state. Text and
HTML tickets independently recalculate totals from browser state.

`generateQRCodes` encodes two fixed public PayWay URLs:
USD https://link.payway.com.kh/Ji386167m and
KHR https://link.payway.com.kh/ra386168n. Hidden ticket payment placeholders also
exist. These URLs are not dynamically bound to the ticket amount/order; the
source does not create a KHQR payload, set an exchange rate, or verify payment.
Merchant settlement details were not verified by opening a payment flow.

The visible reverse-side **order QR** encodes a `t.me/vearuny?text=...` URL with a
compact order summary (customer/contact, options, browser total), not a payment
confirmation QR. Telegram button copies a summary and opens a prefilled chat;
the customer sends it. Telegram Web App navigation is used when available. No
bot secret or automatic message API is present. QR ticket download uses
html2canvas; legacy PDF/PNG support loads jsPDF too. No message was sent.

## API field mapping

| Frontend | API target | Assessment |
| --- | --- | --- |
| customer_name, phone | customers.name, phone | Clean; trim as backend does |
| currentLanguage en/kh | customers.language EN/KH | Normalize explicitly |
| plan_type weekly/monthly | orders.meal_plan_id | Resolve plan code from GET plans |
| package A–F | orders.package_id | Resolve code within selected plan |
| quantity | orders.quantity | Clean for identical sets; enforce 1–100 |
| start_date | orders.start_date | Clean YYYY-MM-DD; fix timezone handling |
| method | orders.fulfillment_method | delivery/pickup map directly |
| district, commune, address | orders.district, commune, address | Names map; delivery must expose/require all three |
| time_slot / pickup_time | orders.fulfillment_time | Choose by method; preserve normalized semantics |
| menu_focus, juice_option | same-named order fields | Direct; backend does not validate their package consistency |
| subscriber_type | orders.subscriber_type | Direct metadata; no server promotion eligibility |
| subscription_number | orders.previous_subscription_number | Rename; no backend verification |
| remark | orders.remark and/or customer_remarks | Clean; use one canonical value |
| selected add-ons | orders.addons [{id,quantity}] | Catalog/applicability gaps described above |
| customer response | orders.customer_id | Use returned customer.id |
| plan.branch_id | customers.branch_id | Derive from selected API plan |
| server response | confirmation order_code, total_amount, currency | Render response; never recompute final total |

No authoritative `price`, `unit_price`, subtotal, add-on total, discount, delivery
fee, total, paid status or verification flag should be sent in checkout payloads.
No admin credential belongs in the browser. Public catalog/checkout routes are
already public; protected payment confirmation must remain absent/disabled.

## Remaining backend and integration gaps

1. **Idempotency/recovery:** orders POST has no idempotency key or public receipt
   recovery endpoint. A lost success response followed by retry can duplicate
   orders. Add server idempotency before promising safe automatic POST retries.
   Disable submit, freeze the submitted payload and reuse one attempt identity;
   after an ambiguous failure show an uncertain-status message and do not POST
   again automatically. A frontend flag alone cannot cover reloads/multiple tabs.
2. **Mixed-package checkout:** current API has one package per order. Preserving
   one mixed ticket needs transactional order items/batch checkout and one
   idempotent receipt, not a browser loop with partial-success risk.
3. **Add-on catalog and applicability:** empty catalog, no backend derivation of
   per-menu-day quantities; do not accept a browser's chargeable-day authority.
4. **Promotions:** no backend eligibility, date rules, subscription verification
   or quote endpoint; current zero-discount API cannot preserve 10/8/5% offers.
5. **Delivery parity:** expose district/commune validation; time slots, fulfillment
   dates and focus/juice consistency are presently stored rather than enforced.
6. **Payments:** no order-bound KHQR or currency-conversion/settlement integration.
   Show only verified manual instructions after authoritative order creation;
   do not represent Telegram/order QR as payment proof.
7. **Rendering:** recovered ticket HTML interpolates raw form values into
   `innerHTML`; escape values/use textContent when integrating authoritative
   receipt rendering. Repeated pricing implementations must be replaced together
   (summary, ticket, copy/Telegram, QR), including language-switch rerendering.
8. **Customer endpoint:** public phone upsert returns a full customer row. Render
   only the ID needed for checkout and review its existing data-minimization /
   ownership model before introducing public recovery by phone.

## Validation and next implementation checkpoint

Seven offline Node tests pass: all public-asset hashes, checkout logic preserved
verbatim apart from local image URL templates, all eleven pricing mismatches,
package/day add-on math, discount precedence, English/Khmer data preservation,
and local asset references. Maintained application JS passes Node 22 syntax
checks in a disposable Docker container. Browser rendering/mobile/Telegram/PDF
parity has not yet been verified; this checkpoint does not claim pixel parity.

No Firebase config/deploy target is included. No DNS, production API/database,
Traefik, n8n, Telegram, Nextcloud or payment settings were changed. API integration
is not implemented in this inspection checkpoint. The next implementation should
load the three catalogs, create customer then order, render only returned order
code/total, show manual payment instructions, and make Telegram optional after
success. Mock/disposable integration tests must precede any staging POSTs to the
production API. Resolve the full-parity gaps above rather than silently dropping
mixed sets/promotions/add-ons or inventing a retry guarantee.
