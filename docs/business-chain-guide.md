# Business chain guide - incorporation to price tier

Five user-owned steps stand between the finished app and a submission that can
actually be sent. They are a **chain**: each one needs the output of the one
before it, so the only way to shorten the total is to start the first one today.

Nothing here is code, and nothing here can be done by an agent. The two
checklist blockers this closes are:

- **Pass 8b (anonymity, hard blocker).** An Individual membership publishes the
  member's legal name as the App Store seller. Only an Organization membership
  can publish a corporation's name instead, and Apple will not grant one without
  a real legal entity and its D-U-N-S Number.
- **Pass 8a (paid app).** Apple requires a Canadian GST/HST number before the
  Paid Apps Agreement goes Active, and no price can be set until it does. A
  corporation gets its own Business Number, which is the cleanest way to supply
  one.

Fee figures, processing times and form names change. Everything marked
**verify current** below should be checked against the official page linked
beside it before you rely on it. This is a practical guide, not legal or tax
advice; an accountant's hour before step 1 is cheap next to restructuring later.

## The chain at a glance

| # | Step | Typical lead time | Blocked by | Blocks |
|---|------|-------------------|------------|--------|
| 1 | Incorporate the brand entity | same day to a few days online (**verify current**) | nothing - **start now** | everything below |
| 2 | D-U-N-S Number for the corporation | ~1-2 weeks | step 1 | step 3 |
| 3 | Convert Apple membership to Organization | up to ~3 weeks after submitting | steps 1 + 2 | submission |
| 4 | CRA Business Number + GST/HST, then the App Store Connect tax form | BN days; GST/HST registration same day online (**verify current**) | step 1 | Paid Apps Agreement going Active |
| 5 | Choose the price tier | minutes | step 4 | submission (as a paid app) |

Steps 2 and 4 can run in parallel once step 1 is done. Step 3 is the long pole
after that, and it is the one that gates **Submit for Review**.

What this chain does **not** block: the real-device TestFlight pass, the
screenshots, and any remaining code work. Do those while you wait.

---

## Step 1 - Incorporate the brand entity

The entity's legal name becomes the public App Store seller name, so pick the
name you want on the store and on future apps under the same brand.

### Ontario vs federal (CBCA)

| | **Ontario** (Business Corporations Act) | **Federal** (Canada Business Corporations Act) |
|---|---|---|
| Where to file | [Ontario Business Registry](https://www.ontario.ca/page/ontario-business-registry) | [Corporations Canada](https://ised-isde.canada.ca/site/corporations-canada/en) |
| Government fee | ~$300 online (**verify current**) | ~$200 online (**verify current**) |
| Name protection | Ontario only | Canada-wide |
| Name search | NUANS report required for a named corporation (~$13-75 from a private provider, valid 90 days - **verify current**); Ontario does not vet the name for you | NUANS report required; Corporations Canada actually reviews the name and can refuse a confusing one |
| Director residency | No Canadian-residency requirement | At least 25% of directors must be resident Canadians; with fewer than four directors, at least one must be (a solo Canadian-resident founder satisfies this) |
| Directors' public visibility | On the public record, but reached through a paid Corporation Profile Report search rather than a free name lookup | Names published in the free, immediately searchable Corporations Canada database |
| Ongoing filings | One annual return, through the Ontario Business Registry | Federal annual return **plus** extra-provincial registration in Ontario (Initial Return under the Corporations Information Act, generally within 60 days of starting business in the province) and an Ontario annual return |
| Same-day certificate | Normal for an online filing (**verify current**) | Normal for an online filing (**verify current**) |

**Recommended: Ontario.** For a solo founder shipping one app under a brand
name, Ontario is one filing instead of two overlapping registrations, one annual
return instead of a federal return plus an Ontario extra-provincial layer, no
director-residency rule to keep satisfied if a co-founder or director is ever
added from outside Canada, and it keeps directors' names behind a paid search
rather than a free public lookup. That last point matters here specifically:
anonymity is a hard requirement for this launch.

**Choose federal instead if** Canada-wide name protection is the point - you
expect to trade under this brand outside Ontario, or you want the strongest
claim to the name against a similarly-named company in another province. Note
that federal incorporation does not remove the Ontario paperwork; it adds to it,
because a federal corporation carrying on business in Ontario still registers
extra-provincially here.

Either route gives a corporation whose name Apple can publish as the seller,
which is the actual goal.

### What you will need either way

- **The corporate name.** Distinctive element + descriptive element + legal
  ending (e.g. `<Brand> Software Inc.`). Numbered companies are cheaper and
  skip NUANS, but a numbered company is a poor public seller name.
- **A NUANS name search report** for a named corporation, from a private search
  house, valid 90 days (**verify current**).
- **A registered office address in the jurisdiction.** This address is on the
  public record. If you do not want your home address published, use a
  registered-office / agent service or a commercial mailbox that accepts legal
  mail - decide this **before** filing, because changing it later is another
  filing.
- **Director, incorporator and officer details** - for a solo founder, you.
- A payment method.

File online, print the certificate and articles as PDFs, and keep them: Apple
may ask for exactly these documents at step 3.

---

## Step 2 - D-U-N-S Number for the corporation

Apple requires a D-U-N-S Number for every Organization enrollment, and it must
belong to the **corporation**, not to you personally. It is free.

1. Once the corporation exists, use Apple's lookup-request page:
   <https://developer.apple.com/enroll/duns-lookup/>. Dun & Bradstreet may
   already have a record for the entity - look it up before requesting a new one.
2. If there is no record, submit the request from that page. It goes to Dun &
   Bradstreet, and the number comes back free of charge.
3. Apple's guidance: up to **5 business days** for D&B to issue the number, plus
   up to **2 business days** for Apple to receive it from D&B; if it takes more
   than two weeks, contact D&B (**verify current** at
   <https://developer.apple.com/support/D-U-N-S/>).
4. Paying to expedite does **not** shorten Apple's side of the wait.

The entity details you give D&B - legal name, address - should match the
articles of incorporation exactly. A mismatch here surfaces as a rejected
Organization enrollment weeks later.

---

## Step 3 - Convert the Apple membership from Individual to Organization

This is a conversion **in place**, not a new account: the same Apple ID keeps
its membership, the existing App Store Connect record (App ID 6801882118), the
uploaded builds and the TestFlight history. What changes is the public seller
name, which becomes the corporation's.

1. Sign in as the **Account Holder** at
   <https://developer.apple.com/account>, open the Membership details section
   and use **Update your information -> Switch to organization membership**;
   Apple also documents a direct migration request at
   <https://developer.apple.com/contact/request/migrate-individual-account>
   (**verify current** at
   <https://developer.apple.com/help/account/membership/updating-your-account-information/>).
2. Have ready: the **legal entity name** exactly as incorporated, the
   **D-U-N-S Number** from step 2, the corporate **website** (the GitHub Pages
   support site is a legitimate answer), and confirmation that you have
   **signing authority** to bind the corporation to Apple's agreements - as sole
   director and officer, you do.
3. Apple verifies the entity and may ask for business documents - articles of
   incorporation, the certificate, sometimes proof of address. Verification can
   take **up to about three weeks** (**verify current**).
4. Apple's own warning about the vendor-name change: it renames the vendor
   across all apps and resets `identifierForVendor` for existing users, which a
   mobile measurement partner would count as new installs, and it cannot be
   undone. **For this app that is a non-issue** - it has no analytics, no
   attribution SDK, and no `identifierForVendor` usage; every byte of user data
   is local and keyed by nothing Apple resets.
5. **Do not submit for review until this completes.** A submission under the
   Individual membership publishes your personal legal name as the seller, and
   that is the thing Pass 8b exists to prevent. Internal TestFlight testing is
   private and unaffected, so the device pass can continue throughout.

---

## Step 4 - CRA Business Number, GST/HST, and the App Store Connect tax form

1. **The Business Number arrives with the incorporation.** Both routes hand off
   to the CRA automatically: a federal incorporation is assigned a BN and a
   corporate income tax account as part of the filing, and an Ontario
   incorporation gets one through the Ontario Business Registry's CRA
   integration, typically within a few business days (**verify current**).
   Check for it in [CRA My Business Account](https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/business-account.html).
2. **Register the GST/HST program account** (the `RT0001` suffix on the BN) -
   online through My Business Account or the Business Registration Online
   service: <https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/register-gst-hst.html>.
   Registration is mandatory once taxable revenue passes the $30,000 small-supplier
   threshold, and **voluntary registration below it is allowed** - which is the
   route that matters here, since Apple wants the number long before the app
   earns anything (**verify current**).
3. **Then complete the tax information in App Store Connect**: Business ->
   Agreements, Tax, and Banking -> the Paid Apps agreement's tax forms. Canadian
   sellers supply the GST/HST number; Ontario is an HST province. This is the
   form the checklist has been calling Form 506 (**verify the current form name
   in App Store Connect** - Apple renames these).
4. The Paid Apps Agreement should then move from **Pending User Info** to
   **Active**. Registering under the corporation, after step 3's conversion,
   keeps the tax profile and the seller identity on the same entity - one more
   reason step 1 comes first.

Registering for GST/HST creates real filing obligations (returns on a schedule,
even nil ones). This is the point where an accountant earns their fee.

---

## Step 5 - Choose the price tier

Only possible once the Paid Apps Agreement is Active.

- Set it in App Store Connect under **Pricing and Availability**. Apple's
  standard tiers run up to US$999.99, with the other currencies derived from the
  tier you pick.
- Price can be changed later without a new build or a new review, so this is the
  cheapest decision in the chain to get wrong - unlike the seller name, which
  cannot be changed back.
- While you are on that screen, apply the 2026-08-18 decision to **exclude every
  EU storefront** (see `LAUNCH-CHECKLIST.md`, step 11), so the DSA trader
  declaration is never demanded. After incorporation the EU can be re-enabled -
  the declaration then carries the corporation's details rather than yours.

---

## If you do one thing today

**Start step 1.** It is the only step with nothing in front of it, and
everything else in this document is waiting on it: the D-U-N-S request needs an
entity, the Apple conversion needs the D-U-N-S, the tax form is cleanest under
the corporation, and the price needs the agreement Active. The filing itself is
an afternoon; the queue behind it is weeks.
