# Sippd Privacy Policy

**Effective date:** [NEEDS REVIEW — set an effective date before publishing]

This policy explains what personal information Sippd ("the App", "we", "us") collects, why we collect it, how it is stored and protected, who we share it with, how long we keep it, and the rights you have over it.

Sippd is distributed on the Google Play Store (Android) and on the web at sippd-beta.vercel.app. Our users are global, with our primary market in South Africa. This policy is written to comply with South Africa's Protection of Personal Information Act (POPIA), and the rights described in Section 5 are structured to align with GDPR-equivalent protections for users elsewhere.

[NEEDS REVIEW — confirm whether GDPR applies to Sippd as a matter of law (for example, if EU/UK residents use the App) rather than only as a voluntary alignment. This affects which of the obligations below are mandatory versus best-practice, and may require additional sections (e.g. a lawful-basis statement, an EU representative).]

## 1. What we collect and why

We collect the following categories of personal information:

| Data we collect | Why we collect it |
|---|---|
| Email address and display name | Collected via Supabase Auth when you create an account; used to let you log in, identify your account, and display your name to other users where relevant (e.g. leaderboards, the activity feed, your profile). |
| Can collection data — names, brands, barcodes, and photos you upload | This is the core function of the App: logging, cataloging, and showcasing your energy drink can collection. |
| Rarity votes and community activity — feed posts, reactions, follows | Powers Sippd's social and competitive features: the activity feed, community rarity consensus on cans, and following other collectors. |
| Streak and usage data — last active date, current streak | Powers the streak and gamification features that track your ongoing engagement with the App. |
| Region (optional) | Only collected if you choose to set it in your profile; used for the regional leaderboard feature. |
| Trade history | Recorded when you log a trade with another collector. This is entered by you manually — Sippd does not automatically detect or track trades. |

[NEEDS REVIEW — confirm this list is exhaustive. If the App or its infrastructure collects anything beyond what's listed here (for example, IP addresses logged by hosting infrastructure, or diagnostic data beyond what Sentry captures per Section 3), add it above.]

## 2. How data is stored and protected

Your data is stored with Supabase, hosted in the EU West (Ireland) region. Access to your data is controlled using Postgres Row Level Security (RLS) policies at the database level, so by default you can only read and write your own data — other users' private data is not directly accessible to you outside of the App's intended social features (for example, public profiles and the activity feed, which are visible by design).

[NEEDS REVIEW — decide and add any further security claims you want to make: encryption at rest/in transit, backup policy, breach-notification process, and how access by Sippd's own team is controlled and audited. Do not state a specific security certification or guarantee unless it has been verified for this project.]

## 3. Third-party processors

We use the following third-party services to operate Sippd. Each processes a limited, specific set of data:

- **Supabase** — our database, authentication, and file storage provider. Hosted in the EU West (Ireland) region. Stores your account data, collection data, and uploaded photos.
- **Open Food Facts API** — used to look up product details when you scan a barcode. No user data is sent to Open Food Facts; only the scanned barcode number is submitted to retrieve product information.
- **Vercel** — hosts and delivers the Sippd web app.
- **Sentry** — error monitoring. Personally identifiable information is stripped from error reports before they are sent to Sentry.
- **Paddle** — billing for Sippd Pro, our optional paid subscription. Acts as Merchant of Record: your payment details are handled directly by Paddle, not by Sippd. We receive and store your email, your Paddle subscription and customer IDs, and your subscription status. See our [Refund & Cancellation Policy](./refund-policy.md) for billing terms.

[NEEDS REVIEW — confirm whether any further processors need to be listed here, and whether a documented safeguard is needed for transferring South African users' data to a processor located in the EU (Supabase) or elsewhere (Paddle).]

## 4. Data retention

[NEEDS REVIEW — no retention periods have been set for any data category described in Section 1. Decide, for each category, how long it is kept — including what happens to it after you delete your account or after a period of inactivity — and document it here before publishing this policy.]

## 5. Your rights

You have the following rights over your personal information:

- **Access.** You can view your own account and collection data directly within the App, and download a complete copy of it at any time — see Export below.
- **Correction.** You can update your display name, region, and password directly from Settings within the App.
- **Deletion.** You can delete your account from Settings within the App. [NEEDS REVIEW — confirm this description matches current behavior, and disclose whether any data is retained after deletion (for example, anonymized activity records or historical leaderboard entries) rather than removed entirely.]
- **Export.** You can download a self-service export of your data — your profile, collection, votes, follows, trades, crates, notifications, activity, and reactions — as a JSON file from Settings > Your Data within the App, at any time and free of charge.

[NEEDS REVIEW — POPIA requires organizations to designate an Information Officer, register them with the Information Regulator, and provide a way for users to lodge a complaint with both your organization and the Regulator. Add that information here once available.]

## 6. How to contact us

[NEEDS REVIEW — add: the legal entity operating Sippd, its registered address, a contact email for privacy-related requests, and (if applicable) your designated Information Officer's details as required under POPIA.]

## 7. Changes to this policy

We may update this policy from time to time. [NEEDS REVIEW — decide and document how changes will be communicated to users (for example, an in-app notice, an email, or simply an updated "Effective date" above), and whether continued use of the App after a change constitutes acceptance of it.]
