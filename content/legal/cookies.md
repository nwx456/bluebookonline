---
title: Cookie Policy
description: How AP Practice Exam Online uses cookies and similar technologies.
lastUpdated: "July 2026"
version: "2.0"
---

# Cookie Policy

This Cookie Policy explains how **AP Practice Exam Online** ("**we**," "**us**," or "**our**") uses cookies, local storage, and similar technologies when you visit or use our website and applications (the "**Service**"). It should be read together with our [Privacy Policy](/privacy) and [Terms of Service](/terms).

**Last updated:** July 2026 · **Version:** 2.0

---

## What Are Cookies and Similar Technologies?

**Cookies** are small text files placed on your device by websites you visit. They help sites remember your preferences, keep you signed in, and understand how the site is used.

**Local storage** (including `localStorage` and `sessionStorage`) stores data in your browser without sending it on every request. We use local storage for consent choices and UI preferences that are not strictly cookies but serve a similar purpose.

**Pixels and tags** (where used by advertising partners) are small code snippets that may set or read cookies when you interact with ad units.

This Policy covers all of the above unless we specifically distinguish them.

## How We Use Cookies

We group cookies and similar technologies into the following categories:

| Category | Purpose | Can you disable? |
|----------|---------|------------------|
| **Strictly necessary** | Authentication, security, load balancing | No — required for core Service |
| **Functional / preferences** | Remember consent, legal region, program choice | Partially — clearing storage resets choices |
| **Analytics & advertising** | Google AdSense, usage measurement | Yes — where consent or opt-out applies |

We do not use cookies to collect sensitive categories of personal data. For broader data processing purposes, see our [Privacy Policy](/privacy).

## Cookie and Storage Table

The table below lists cookies and storage keys we use or that our integrated partners may set when the Service is used.

| Name / key | Provider | Type | Duration | Purpose |
|------------|----------|------|----------|---------|
| `sb-*-auth-token` (and related Supabase auth cookies) | Supabase | HTTP cookie (essential) | Session / refresh lifetime | Maintains authenticated login session; secures API requests |
| `bbo:cookie-consent` | AP Practice Exam Online | localStorage | Until cleared or updated | Stores your cookie/analytics consent decision and timestamp |
| `bbo:legal-region` | AP Practice Exam Online | localStorage | Until cleared or updated | Remembers declared legal region for consent UI (EU, TR, US, MENA, ROW) |
| `bbo-gpc` | AP Practice Exam Online | localStorage / signal handling | Until cleared | Records honor of Global Privacy Control (GPC) opt-out where supported |
| `__gads`, `__gpi`, `IDE`, `ANID`, `NID` | Google (AdSense/Ads) | HTTP cookie (advertising) | Varies (often 13 months or less) | Ad delivery, frequency capping, fraud prevention, measurement |
| `_ga`, `_ga_*`, `_gid` | Google Analytics (via AdSense stack) | HTTP cookie (analytics/ad) | `_ga`: up to 2 years; `_gid`: 24 hours | Distinguish users/sessions for analytics and ad performance |
| Program preference keys (AP/SAT) | AP Practice Exam Online | localStorage | Persistent until cleared | Remembers selected exam program in UI |

**Note:** Exact Supabase cookie names depend on your project reference ID (pattern `sb-<project-ref>-auth-token`). Google may set additional cookies when AdSense loads; names and durations may change per Google's policies.

Third-party cookies are controlled by those providers. Consult [Google's partner policies](https://policies.google.com/technologies/partner-sites) for details.

## Strictly Necessary Cookies

These cookies are **required** to provide the Service and cannot be switched off in our systems. They are usually set only in response to actions you take, such as logging in or completing security challenges.

**Supabase authentication cookies** enable:

- Secure sign-in and session refresh;
- Protection of your Account and uploaded content; and
- Server-side validation of API requests.

If you block these cookies in your browser, parts of the Service—including login and exam features—may not function.

## Functional Storage (Consent and Preferences)

We use browser **local storage** (not always classified as cookies) for:

- **`bbo:cookie-consent`** — records whether you accepted or rejected optional analytics/advertising cookies, and which policy version was shown;
- **`bbo:legal-region`** — aligns banner and modal behavior with your declared region;
- **`bbo-gpc`** — when your browser sends a Global Privacy Control signal, we may store that we honored an opt-out for applicable U.S. state flows;
- **Exam program preference** — AP vs SAT UI selection for convenience.

Clearing site data removes these keys and may cause the cookie banner to reappear.

## Analytics and Advertising Cookies

With your **consent** (in the **European Union, Türkiye**, and other regions where required) or subject to **notice and opt-out** (in the **United States** and similar jurisdictions), we may load **Google AdSense** and related Google tags that set advertising and analytics cookies such as `_ga` and `__gads`.

These technologies may:

- Display ads on free tiers or public pages;
- Measure ad impressions and interactions;
- Limit repeat ad display; and
- Generate aggregated reports for us and Google.

We do **not** sell your personal data for money. AdSense may involve "sharing" for targeted advertising under some U.S. state laws—see [Privacy Policy — United States (CCPA/CPRA)](/privacy#united-states-ccpacpra).

If you **reject** optional cookies in the EU/TR banner, AdSense scripts should not load until you change your preference.

## Regional Consent and Opt-Out

Consent behavior depends on your **legal region**, determined at registration and stored in `bbo:legal-region`:

| Region | Optional cookies (AdSense / analytics) |
|--------|----------------------------------------|
| **European Union (GDPR)** | Loaded only after **explicit opt-in** via cookie banner or Privacy settings |
| **Türkiye (KVKK)** | Loaded only after **explicit opt-in** |
| **United States (CCPA/CPRA)** | **Notice at collection**; opt-out via Privacy settings, GPC, or cookie banner where shown |
| **MENA** | **Explicit consent** for non-essential cookies where required by local PDPL flows |
| **Rest of world** | Consent or notice as implemented in product; essential cookies always active |

Signed-in users can update choices anytime at [Privacy settings](/settings/privacy). Changes apply on subsequent page loads.

## Global Privacy Control (GPC)

Where supported, we honor **Global Privacy Control** browser signals for applicable U.S. state opt-out rights related to targeted advertising. When GPC is detected, we record handling via `bbo-gpc` and suppress non-essential ad loading consistent with our implementation.

GPC does not affect strictly necessary authentication cookies.

## Managing Your Preferences

You can control cookies and storage in several ways:

1. **Cookie banner** — shown on first visit (or after clearing storage) in regions that require consent;
2. **[Privacy settings](/settings/privacy)** — update analytics/advertising consent when signed in;
3. **Browser settings** — block or delete cookies and site data (see help for Chrome, Firefox, Safari, Edge);
4. **Google ad personalization** — [Google Ads Settings](https://adssettings.google.com/) and [aboutads.info](https://www.aboutads.info/choices/) industry opt-out tools;
5. **Incognito/private mode** — session cookies cleared when you close the window; local storage may still persist unless cleared.

Blocking all cookies may prevent login. Blocking only third-party cookies may limit advertising but allow core features.

## Do Not Track

Some browsers offer "Do Not Track" (DNT) signals. There is no universal standard for responding to DNT. We treat **GPC** as an actionable opt-out signal where required by law. We do not currently respond separately to DNT headers.

## Updates to This Policy

We may update this Cookie Policy when we add features, change providers, or update legal requirements. The "Last updated" date and version at the top will change accordingly. Material changes may require renewed consent in regulated regions.

## Contact and Further Information

Questions about cookies or this Policy:

| | |
|---|---|
| **Email** | [info@apracticexamonline.com](mailto:info@apracticexamonline.com) |
| **Privacy Policy** | [/privacy](/privacy) |
| **Privacy settings** | [/settings/privacy](/settings/privacy) |
| **Postal address** | [Legal address — to be completed] |

For personal data rights beyond cookies, see [Privacy Policy — Your Rights](/privacy#your-rights).
