# Sippd Privacy Policy

**Effective date:** 17-09-2026

This policy explains what personal information Sippd ("the App", "we", "us") collects, why we collect it, how it is stored and protected, who we share it with, how long we keep it, and the rights you have over it.

Sippd is distributed on the Google Play Store (Android) and on the web at sippd-beta.vercel.app. Our users are global, with our primary market in South Africa. This policy is written to comply with South Africa's Protection of Personal Information Act (POPIA), and, per the note below, is also likely subject to the GDPR/UK GDPR for users in those regions.

**On GDPR applicability — this is a legal-fact question, not a style choice.** Under Article 3(2) of the GDPR, the regulation applies extraterritorially to any business processing the personal data of individuals located in the EU where the processing relates to offering goods or services to those individuals — regardless of whether payment is involved — or to monitoring their behaviour within the EU. Sippd is a publicly available app/web service with no geographic restriction excluding EU users, so it likely falls within GDPR's scope as a matter of law, not merely as a voluntary best-practice alignment. This has real consequences beyond wording:

[TODO — LEGAL REVIEW RECOMMENDED. If GDPR applies as a matter of law rather than voluntarily:
- You need a documented lawful basis (GDPR Article 6) for each processing purpose listed in Section 1 below, not just a description of what's collected.
- EU/UK users have the right to lodge a complaint with a supervisory authority in their own country, in addition to South Africa's Information Regulator — this should be added to Section 5.
- Article 27 may require appointing an EU representative if your processing isn't "occasional" — Sippd's ongoing social/profile features arguably aren't occasional, so this needs a real decision, not an assumption either way.
A lawyer familiar with both POPIA and GDPR can confirm how far this actually needs to go given your current scale — this doesn't need to block launch, but it shouldn't be silently skipped either.]

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
| Subscription/billing data (Sippd Pro) | Your Paddle subscription ID, customer ID, and subscription status, stored once you subscribe — see Section 3 for how this is shared with Paddle. |


## 2. How data is stored and protected

Your data is stored with Supabase, hosted in the EU West (Ireland) region. Access to your data is controlled using Postgres Row Level Security (RLS) policies at the database level, so by default you can only read and write your own data — other users' private data is not directly accessible to you outside of the App's intended social features (for example, public profiles and the activity feed, which are visible by design).

Data in transit to and from Sippd is encrypted (TLS), and Supabase encrypts stored data at rest by default as part of its own infrastructure. 

In the event of a data breach affecting your personal information, we will notify affected users and South Africa's Information Regulator without undue delay, as required under POPIA. 


## 3. Third-party processors

We use the following third-party services to operate Sippd. Each processes a limited, specific set of data:

- **Supabase** — our database, authentication, and file storage provider. Hosted in the EU West (Ireland) region. Stores your account data, collection data, and uploaded photos.
- **Open Food Facts API** — used to look up product details when you scan a barcode. No user data is sent to Open Food Facts; only the scanned barcode number is submitted to retrieve product information.
- **Vercel** — hosts and delivers the Sippd web app.
- **Sentry** — error monitoring. Personally identifiable information is stripped from error reports before they are sent to Sentry.
- **Paddle** — billing for Sippd Pro, our optional paid subscription. Acts as Merchant of Record: your payment details are handled directly by Paddle, not by Sippd. We receive and store your email, your Paddle subscription and customer IDs, and your subscription status. See our [Refund & Cancellation Policy](./refund-policy.md) for billing terms.

**On international data transfers:** because Supabase hosts your data in the EU (Ireland) and Paddle is a UK-headquartered company, personal information about South African users is transferred outside South Africa. POPIA (Section 72) requires that such a transfer only happen where the recipient country has adequate data protection law, or where an appropriate safeguard (such as a binding data processing agreement) is in place. The EU's GDPR is broadly recognized as providing an adequate standard of protection, which supports this transfer, but the specific safeguard should be documented rather than assumed.


## 4. Data retention

No retention periods have been finalized yet. Below is a proposed default for each data category — a reasonable starting point, not a final decision. Adjust and confirm each line, then remove this note once set:

| Data category | Proposed retention |
|---|---|
| Account/profile data | Retained while your account is active. Deleted or anonymized within 30 days of account deletion. |
| Collection data (cans, photos, trade history) | Deleted within the same window as account data above, following account deletion. |
| Rarity votes | Your individual vote is deleted with your account. The aggregated consensus count it contributed to is retained, since it's pooled across many users and is no longer personally identifiable once your individual vote is removed. |
| Subscription/billing data | Retained for as long as required by tax/accounting record-keeping law, which may be longer than your account remains active. |
| Crash/error logs (Sentry) | Retained per Sentry's own default retention period unless configured otherwise. |
| Backups | Deleted data may persist in routine backups for a limited additional period after deletion, until normal backup rotation removes it. |


## 5. Your rights

You have the following rights over your personal information:

- **Access.** You can view your own account and collection data directly within the App, and download a complete copy of it at any time — see Export below.
- **Correction.** You can update your display name, region, and password directly from Settings within the App.
- **Deletion.** You can delete your account from Settings within the App. 
- **Export.** You can download a self-service export of your data — your profile, collection, votes, follows, trades, crates, notifications, activity, and reactions — as a JSON file from Settings > Your Data within the App, at any time and free of charge.
- **Complain to a regulator.** You have the right to lodge a complaint with South Africa's Information Regulator if you believe your personal information has been processed unlawfully. 

**On the Information Officer requirement:** under POPIA, every organization processing personal information (a "responsible party") automatically has a default Information Officer — for a sole-operator project like Sippd, that is you by default — and POPIA requires that this Information Officer be registered with the Information Regulator via its eServices portal before taking up IO duties. [TODO: complete this registration at the Information Regulator's website (search "Information Regulator South Africa eServices Portal" for the current link, since portal URLs have moved before) and insert your registration details/contact information here once done. This is a real, outstanding compliance step, not just a documentation gap.]

## 6. How to contact us

You can contact us via email at seedstackstudio@gmail.com 

## 7. Changes to this policy

We may update this policy from time to time. If we make a material change, we'll update the effective date above and, where practical, notify you — for example, through an in-App notice or by email. Continuing to use the App after a change takes effect means you accept the updated policy.


