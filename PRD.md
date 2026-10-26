# Product Requirements Document — Kof'a, the doorway to your home (verified property marketplace)

| Field | Value |
|---|---|
| Status | **Draft v0.2 — revised after team review; working assumptions in use; developer approval is recorded in `docs/DECISIONS.md` but does not block work (ADR-019)** |
| Source | "Business Proposal & MVP Prototype — A Direct, Verified and Affordable Property Marketplace for Nigeria" (referred to below as *the proposal*; section numbers `§n` refer to it) |
| Product name | **Kof'a** — *the doorway to your home* (decided 2026-10-26, ADR-018). Logo, colours and domain still open under OQ-01. "The Platform" in older text means Kof'a. |
| Owners | Product scope is jointly owned by Developer 1 (Frontend) and Developer 2 (Backend) |
| Related docs | `docs/ARCHITECTURE.md`, `docs/API_CONTRACT.md`, `docs/DATABASE_SCHEMA.md`, `docs/UI_DESIGN_SYSTEM.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/PROGRESS.md`, `docs/DECISIONS.md` |

---

## 0. Changes in v0.2 (team review, 2026-10-24)

1. **Currency and formatting conventions** specified (NGN only, kobo integers, `₦` display rules, compact-format limits, input parsing, half-up fee rounding, test vectors) — BR-18, `docs/API_CONTRACT.md` §2.10, `docs/UI_DESIGN_SYSTEM.md` §6.1.
2. **Unknown error codes** — the code set is open; clients degrade by HTTP status; non-JSON failures handled — NFR-13, `docs/API_CONTRACT.md` §2.4.
3. **Complaints and reports** — minimum fields, rate limits, privacy rules, and a verify-before-action investigation workflow — FR-CMP-01…10, BR-16/17, `docs/API_CONTRACT.md` §4.8.
4. **AI assistant with human handoff** — answers common questions from approved content, and when it cannot help it always shows the company call line and support hours — FR-AI-01…10, BR-13…15, OQ-23…26, tasks 6G, ADR-014. This is a **scope addition** that both developers must confirm (priority proposed: Should).

## 1. Source analysis (read this first)

1. **The attachment is a business proposal, not a PRD.** It has no user stories, acceptance criteria, data definitions, roles, or non-functional requirements. This document derives them and marks every derived item as an assumption until approved.
2. **It describes a managed property marketplace, not a conventional CRM.** The task brief uses CRM words (leads, clients, sales workflows). They are mapped onto the proposal as follows, and this mapping is itself an open confirmation (OQ-21):

| Brief / CRM term | Meaning in this product | Proposal reference |
|---|---|---|
| Lead | **Inquiry** — a property seeker's expression of interest or inspection request | §4 Stage 3–4, §9E |
| Client | **Client** — a registered property seeker (tenant or buyer) | §4 Stage 3–6 |
| Property owner | **Landlord** — a *record* (contact + authority evidence), not a user account in the MVP | §4 Stage 1, §9D |
| Appointment | **Inspection** appointment | §4 Stage 5, §7 |
| Sales workflow | **Transaction** — negotiation, agreed terms, fee calculation, completion | §4 Stage 6, §6 |
| Reporting | KPI dashboard for the founding team | §15 |
| Notifications | Email (MVP) and in-app (later) event notices | §14 Phase 5 |

3. **§3 contains an unanswered question** ("How would this be done?"). It is treated as answered by the six-stage flow in §4 of the proposal.
4. **Business decisions are still open** (the proposal's own "internal discussion" list, §18). They are carried into the register in section 10. Each has a *proposed default* so that unblocked work can proceed; defaults only become decisions when both developers approve them in `docs/DECISIONS.md`.

## 2. Product summary

**Vision.** A trusted intermediary between landlords/sellers and tenants/buyers in Nigeria: verified listings, lower disclosed fees (proposed 2% + 2%), landlord privacy, managed communication, structured inspections, and recorded transactions.

**MVP goal (proposal §9–10).** Validate demand and the operating workflow with a website: landlords submit properties, staff verify and publish them, clients search and express interest, staff qualify, schedule inspections and coordinate transactions. Everything is recorded in the platform, not in personal messaging apps.

**AI assistant (added in v0.2).** A site assistant answers common questions from approved content and public listing data so the team is not overloaded. When it cannot help, or the topic is outside its remit, it hands over to humans and always shows the company call line and support hours.

**Non-goals for the MVP.** Native mobile app; landlord self-service dashboard; subscriptions; featured/sponsored listings; property-management or relocation services; escrow or holding client funds; online payment gateway (deferred, OQ-06); real-time chat; SMS/WhatsApp; saved searches/favourites; multi-city expansion tooling.

## 3. Users and roles

| Role | Who | Account? | Capabilities (MVP) |
|---|---|---|---|
| Visitor | Anyone | No | Browse and search published properties, read policies, submit a landlord listing form, report a suspicious listing |
| Client | Tenant/buyer | Yes (self-register) | Express interest, message staff, view own inquiries/appointments/transactions, confirm or cancel inspections, file complaints |
| Landlord | Owner, authorised agent, developer, property manager | **No account** (assumption A-2) | Submits the listing form; approvals and availability updates are recorded by staff on their behalf |
| Staff | Operations team (verifier / coordinator) | Yes (created by admin) | Review and verify properties, run the inquiry pipeline, schedule inspections, manage transactions and complaints |
| Admin | Founding team | Yes (seeded) | Everything staff can do, plus user management, fee-rule configuration, audit log, reports |

## 4. Core journeys

1. **List a property.** Landlord submits form + photos + evidence → staff review → verification → landlord approval of price/description recorded → publish.
2. **Find a property.** Visitor searches with filters → opens detail page → registers/logs in → expresses interest.
3. **Qualify.** Staff reply in an in-platform thread, record qualification, answer questions.
4. **Inspect.** Staff schedule inspection with client, staff representative and landlord/authorised representative → client confirms → inspection completed → outcome recorded.
5. **Transact.** Offer and terms recorded → fees calculated and disclosed → payments recorded → transaction completed or cancelled.
6. **Raise a concern.** Anyone reports a suspicious listing; clients file complaints → staff triage and resolve.

## 5. Functional requirements

Priority is MoSCoW **for the MVP**. "Source" is the proposal section.

### 5.1 Authentication and authorization (AUTH)
| ID | Requirement | Pri | Source |
|---|---|---|---|
| FR-AUTH-01 | Client self-registration (name, email, phone, password) with recorded acceptance of terms/privacy version | Must | §9E |
| FR-AUTH-02 | Login, logout, silent session refresh | Must | — |
| FR-AUTH-03 | Password reset by email | Must | — |
| FR-AUTH-04 | Email verification | Should | §8 |
| FR-AUTH-05 | Staff accounts created by admin only; roles `client`, `staff`, `admin` | Must | §9F |
| FR-AUTH-06 | Authorization enforced server-side on every endpoint (default deny) | Must | §8 |
| FR-AUTH-07 | Login rate limiting and brute-force protection | Must | §8 |
| FR-AUTH-08 | Admin can deactivate users | Should | — |

### 5.2 Property module (PROP)
| ID | Requirement | Pri | Source |
|---|---|---|---|
| FR-PROP-01 | Public landlord submission form: location/address, type, intended use, rent or sale price, rooms, bathrooms, amenities, availability, landlord conditions, relationship to property, landlord contact | Must | §4 St.1, §9D |
| FR-PROP-02 | Upload photos (required), optional video, and ownership/authorisation evidence (private) | Must | §4 St.1 |
| FR-PROP-03 | Staff queue of submissions with status/area/assignee filters | Must | §9F |
| FR-PROP-04 | Staff can correct listing data and request changes from the landlord | Must | §8 |
| FR-PROP-05 | Record verification: checklist results, method, evidence references, verifier, date | Must | §4 St.2, §8 |
| FR-PROP-06 | Record landlord approval of advertised price and description before publication | Must | §5 |
| FR-PROP-07 | Publish only when verification passed **and** landlord approval recorded; unpublish, reject (with reason), archive | Must | §4 St.2 |
| FR-PROP-08 | Availability status with "last confirmed" date | Must | §8 |
| FR-PROP-09 | Public search filters: location/neighbourhood, budget, type, bedrooms, bathrooms, furnishing, amenities, rent/buy, availability | Must | §4 St.3 |
| FR-PROP-10 | Sorting and pagination of results | Must | — |
| FR-PROP-11 | Property detail page: photos, price and payment terms, location, features, verification status/date and scope, availability, description, interest/inspection CTA | Must | §9C |
| FR-PROP-12 | Landlord contact details are never exposed to visitors or clients | Must | §5, §8 |
| FR-PROP-13 | Status history (who/when/why) recorded for every listing | Must | §8 |
| FR-PROP-14 | SEO-friendly slugs and metadata | Should | §10 |
| FR-PROP-15 | Landlord dashboard | Won't | §9D (deferred by proposal) |
| FR-PROP-16 | Land and commercial listings | Won't (default, OQ-10) | §4 St.1 |

### 5.3 Inquiries — "leads" (INQ)
| ID | Requirement | Pri | Source |
|---|---|---|---|
| FR-INQ-01 | Logged-in client expresses interest or requests an inspection for a property, with budget, move-in date, notes | Must | §4 St.3 |
| FR-INQ-02 | Inquiries persisted with lifecycle status | Must | §9E |
| FR-INQ-03 | In-platform message thread between client and staff (async text) | Must | §4 St.4 |
| FR-INQ-04 | Client views own inquiries and threads | Must | §9E |
| FR-INQ-05 | Staff pipeline: filter, search, assign, change status | Must | §9F |
| FR-INQ-06 | Staff qualification record and internal notes (never visible to client) | Must | §4 St.4 |
| FR-INQ-07 | General "Speak to our team" inquiry not tied to a property | Must | §9A |
| FR-INQ-08 | Visible warnings against off-platform payments and conversations | Must | §8 |
| FR-INQ-09 | Message attachments | Won't | — |
| FR-INQ-10 | Real-time chat | Won't (async + refresh) | §14 Ph.5 |
| FR-INQ-11 | Saved searches / favourites | Won't | §14 Ph.5 |

### 5.4 Inspection appointments (APPT)
| ID | Requirement | Pri | Source |
|---|---|---|---|
| FR-APPT-01 | Staff schedule an inspection from an inquiry (time, property, client, staff rep, landlord/representative) | Must | §4 St.5 |
| FR-APPT-02 | Client sees details and can confirm, cancel or request reschedule; exact address disclosed only after confirmation (OQ-11) | Must | §4 St.5, §5 |
| FR-APPT-03 | Appointment lifecycle and recorded outcome | Must | §8 |
| FR-APPT-04 | Conflict detection (same staff or property at overlapping times) | Should | — |
| FR-APPT-05 | Inspection fee record: amount, status, refundable/credited rules | Should (blocked by OQ-04) | §7 |
| FR-APPT-06 | Calendar view (list view is Must) | Should | — |

### 5.5 Transactions and fees (TXN)
| ID | Requirement | Pri | Source |
|---|---|---|---|
| FR-TXN-01 | Staff create a transaction from an inquiry/appointment (rent or sale, parties, agreed price) | Must | §4 St.6 |
| FR-TXN-02 | Fees computed **server-side** from configurable rules (rate, basis, payer) and disclosed before agreement | Must (blocked by OQ-03) | §6 |
| FR-TXN-03 | Offers and agreed terms recorded as a timeline | Must | §4 St.6 |
| FR-TXN-04 | Manual recording of payments/fees in an append-only ledger | Must | §8 |
| FR-TXN-05 | Complete or cancel a transaction with reason; records retained | Must | §4 St.6 |
| FR-TXN-06 | Online payment gateway | Won't (OQ-06) | §8 |
| FR-TXN-07 | Escrow / holding of rent or purchase funds | Won't (legal review) | §8 |

### 5.6 Complaints and reports (CMP)
| ID | Requirement | Pri | Source |
|---|---|---|---|
| FR-CMP-01 | Public "report suspicious listing" form with the minimum fields below (rate limited, abuse-protected) | Must | §9G |
| FR-CMP-02 | Authenticated complaint/dispute linked to a property, appointment, transaction or "general", with the minimum fields below | Must | §9F |
| FR-CMP-03 | Staff triage, assignment, status and resolution | Must | §9F |
| FR-CMP-04 | **Every report and complaint is an unverified allegation until staff investigate it.** Staff record findings, evidence reviewed, an outcome (`substantiated`, `partially_substantiated`, `unsubstantiated`, `inconclusive`) and actions taken before it can be resolved | Must | §8, §16 |
| FR-CMP-05 | Precautionary hold: staff may temporarily unpublish a listing reported as fake or as asking for off-platform payment; the hold must be reviewed within 2 business days. Permanent actions (reject listing, block landlord) are admin-only and need a substantiated or partially substantiated outcome | Must | §8 |
| FR-CMP-06 | Reporter identity is confidential: never shown to landlords, the reported party or other users | Must | §5, §8 |
| FR-CMP-07 | Reporter receives a reference number, and a generic outcome notice if contact details were given | Should | §9F |
| FR-CMP-08 | Clients see the status and public note of their own complaints | Should | — |
| FR-CMP-09 | Evidence upload (up to 3 files) on reports and complaints | Should | — |
| FR-CMP-10 | Number of reports raises review priority only; it never unpublishes a listing automatically (replaces the v0.1 "auto-flag" idea) | Could | §8 |

**Minimum report fields**

| Form | Required | Optional |
|---|---|---|
| Suspicious-listing report (public) | Property (from the listing page); reason (`fake_listing`, `wrong_price`, `misleading_description`, `already_let_or_sold`, `unauthorised_agent`, `asked_to_pay_outside`, `other`); description 20–2000 characters | Name; email or phone (the form says that without contact details we cannot follow up); up to 3 evidence files |
| Complaint (signed-in client) | Kind (`dispute`, `service_complaint`, `other`); subject (a property, appointment or transaction belonging to the client, or "general"); description 20–4000 characters | Date it happened; desired outcome (≤ 500 characters); up to 3 evidence files |

**Rate limits and abuse protection** (values in `docs/API_CONTRACT.md` §6): per-IP and per-property limits on reports, per-user limits on complaints, honeypot field, CAPTCHA-ready, duplicate detection (same reporter + property + reason within 24 h returns a conflict, not a second case).

**Privacy** (BR-17): reporter name/contact/user id are staff-only; the landlord is never told who reported; no public "reported" badge or counter; staff approaching a landlord do not paraphrase identifying details; evidence is stored privately; raw IP addresses are never stored (salted hash only); descriptions never appear in logs; the form warns users not to enter ID, card or bank details and rejects card-like numbers.

**Verification workflow** (FR-CMP-04/05): `new → triage → investigating → resolved | dismissed`. To **resolve**: findings, evidence reviewed, an outcome and at least one action (including `no_action`). To **dismiss**: a reason (`duplicate`, `spam_or_abuse`, `out_of_scope`, `insufficient_information`). Staff may place a precautionary hold on high-risk reports; nothing permanent happens on an unverified report.

### 5.7 Admin, notifications, reporting, policies, homepage
| ID | Requirement | Pri | Source |
|---|---|---|---|
| FR-ADM-01 | Admin dashboard home: queue counts and KPIs | Should | §9F |
| FR-ADM-02 | Landlord directory (records and their properties) | Should | §9F |
| FR-ADM-03 | Staff management UI | Should | §9F |
| FR-ADM-04 | Audit log viewer | Could | §8 |
| FR-NTF-01 | Email on key events (inquiry reply, appointment change, listing decision, transaction update) | Should | §14 Ph.5 |
| FR-NTF-02 | In-app notification centre | Could | §14 Ph.5 |
| FR-NTF-03 | SMS / WhatsApp notifications | Won't | — |
| FR-RPT-01 | KPI metrics from §15, derived from operational data | Should | §15 |
| FR-RPT-02 | CSV export of reports | Could | — |
| FR-POL-01 | Terms, privacy, fee disclosure, verification limitations, refund conditions, how-to-report pages | Must | §9G |
| FR-POL-02 | Consent recorded (policy type + version + time) at registration and landlord submission | Must | §9G |
| FR-HOME-01 | Homepage: value proposition, CTAs *Find a Property / List Your Property / Speak to Our Team*, featured verified listings | Must | §9A |
| FR-SUB-01 | Subscriptions, featured/sponsored listings, additional services | Won't | §6 streams 2–4 |

### 5.8 AI assistant with human handoff (AI) — added in v0.2
Priority is **Should**, pending both developers' confirmation (scope addition, ADR-014). Source: team review; supports the proposal's "consistent customer support" (§12) and "responding to inquiries" (§13).

| ID | Requirement | Pri |
|---|---|---|
| FR-AI-01 | Chat assistant on public pages and the client area (anonymous allowed, rate limited), clearly disclosed as AI | Should |
| FR-AI-02 | Answers only from (a) staff-approved knowledge articles (how it works, fees, verification, inspections, policies, FAQs) and (b) public property data; every answer shows its source | Should |
| FR-AI-03 | **Handoff:** when it cannot answer confidently, the topic is out of scope, the user asks for a person, or the service fails, it stops answering and shows the **call line**, support hours, and options to message the team (login required) or report a listing | Should |
| FR-AI-04 | Out-of-scope topics always hand off: payments, refunds and disputes; legal advice; complaints and fraud claims; the status of a specific transaction or account; price or fee negotiation; distress or safety | Should |
| FR-AI-05 | Call-line number and support hours are admin-configurable; the widget shows whether the line is open now (Africa/Lagos) | Should |
| FR-AI-06 | "Message the team" handoff (signed-in) creates a general inquiry with the transcript visible to staff | Should |
| FR-AI-07 | Staff manage knowledge articles (draft → published) and review flagged and handed-off conversations | Should |
| FR-AI-08 | Cost and abuse controls: message length, rate limits, daily token budget; on exhaustion or failure the user gets the handoff card, never an error screen | Should |
| FR-AI-09 | Answer feedback (helpful / not helpful) | Could |
| FR-AI-10 | Other languages (e.g. Nigerian Pidgin), voice, WhatsApp channel | Won't (OQ-26) |

## 6. MVP proposal

**In the MVP (Must + Should):** accounts and roles; landlord submission with private evidence; staff verification and publication workflow; public search and detail; inquiries with in-platform messaging; inspection scheduling; transactions with server-calculated fees and a manual ledger; complaints and suspicious-listing reports with staff verification before any action; an AI assistant with handoff to the company call line; email notifications; KPI dashboard; policy pages and consent records; admin and staff management.

**Could (only if time remains after acceptance):** in-app notification centre, calendar view, audit viewer, CSV export, auto-flagging, stale-availability job.

**Deferred (Won't for MVP):** landlord dashboard, payment gateway, escrow, subscriptions, featured listings, real-time chat, attachments, SMS/WhatsApp, saved searches, mobile app, land/commercial listings.

**Why this cut.** It is the smallest set that exercises every stage of the proposal's workflow (§4) end to end with real staff operations, which is what the pilot (§14 Phase 3) must measure. Anything that automates money movement or needs legal sign-off is deferred, because the proposal itself says those require legal and regulatory review first (§8, §16).

## 7. Business rules

| ID | Rule |
|---|---|
| BR-01 | A listing is public only if status is `published`, verification is `passed`, and a landlord approval of the current price and description exists. |
| BR-02 | "Verified" means the checks recorded in the verification record were done. It is **never** shown as a guarantee of legal ownership or title; the verification scope is shown beside the badge (§8). |
| BR-03 | Landlord phone, email, documents and exact address are never returned by any public or client endpoint. |
| BR-04 | A fee is never charged without prior disclosure of what it covers, whether it is refundable or creditable, and what happens on cancellation or unavailability (§7). |
| BR-05 | Fee amounts are computed on the server only. The frontend displays what the API returns. |
| BR-06 | Monetary values are stored as integer kobo; currency is NGN. |
| BR-07 | Sponsored placement (when introduced) is labelled and never changes verification handling (§6). |
| BR-08 | Every status change is recorded with actor, time and reason where applicable. |
| BR-09 | Ledger entries are append-only; corrections are reversing entries. |
| BR-10 | Availability must carry a "last confirmed" date, and stale availability must be visible to staff (§8). |
| BR-11 | Staff-only internal notes are never visible to clients. |
| BR-12 | Platform messaging shows off-platform warnings; staff never request payment outside approved channels. |
| BR-13 | The assistant states that it is AI, answers only from approved knowledge articles and public listing data, and cites its sources. |
| BR-14 | The assistant never gives landlord contact details, exact addresses or internal notes; never gives legal advice or title guarantees; never tells anyone to pay or gives account details; never states fees except from approved content; never judges a complaint. |
| BR-15 | When the assistant cannot help it hands off to humans and **always shows the company call line and support hours**; it never leaves the user at a dead end. |
| BR-16 | Complaints and reports are unverified allegations until staff conclude an investigation; no permanent action is taken on an unverified report. |
| BR-17 | Reporter identity is staff-only and never disclosed to the reported party, landlords or other users; report counts are never shown publicly. |
| BR-18 | Currency is NGN only, held as integer kobo; displayed with `₦` and comma grouping; fee rounding is half-up in integer arithmetic on the backend only (`docs/API_CONTRACT.md` §2.10). |

## 8. Non-functional requirements (derived; all assumptions until approved)

| ID | Requirement |
|---|---|
| NFR-01 | Public search API p95 < 500 ms at 5,000 published listings; public pages LCP < 2.5 s on mid-range Android over 4G |
| NFR-02 | Mobile-first responsive UI; image optimisation and lazy loading for low-bandwidth users |
| NFR-03 | Server-rendered public pages for SEO (§10 relies on organic traffic) |
| NFR-04 | WCAG 2.1 AA for public and client pages; keyboard operable admin |
| NFR-05 | OWASP ASVS Level 1 as the security baseline; TLS everywhere; PII minimisation; compliance with Nigerian data-protection law (NDPA 2023) to be confirmed by counsel (OQ-18) |
| NFR-06 | Target availability 99.5% during pilot |
| NFR-07 | Daily database backups with a tested restore |
| NFR-08 | Structured logs, request IDs on every response, error monitoring; no PII in logs |
| NFR-09 | English only; NGN currency; display timezone Africa/Lagos; store UTC |
| NFR-10 | Browsers: last two versions of Chrome, Safari, Firefox, Edge; Android Chrome |
| NFR-11 | Backend service-layer coverage ≥ 80%; every acceptance criterion has at least one automated test; critical journeys covered by E2E |
| NFR-12 | Assistant: first response p95 < 8 s; if the LLM provider fails or takes > 15 s, the user gets the handoff card, not an error |
| NFR-13 | Error handling: clients tolerate unknown error codes and non-JSON failures without crashing or showing raw errors (`docs/API_CONTRACT.md` §2.4) |

## 9. KPIs and the data they require (§15)

| KPI | Derived from |
|---|---|
| Landlords onboarded; verified active listings | `landlords`, `properties.status`, `verified_at` |
| % listings with confirmed availability | `properties.last_availability_confirmed_at` vs threshold (OQ-12) |
| Qualified inquiries | `inquiries.qualified_at` |
| Time from inquiry to inspection | `inquiries.created_at` → first `appointments.scheduled_at` |
| Inspections completed; inspection→transaction rate | `appointments.status`, `transactions` |
| Completed transactions; revenue per transaction | `transactions`, `ledger_entries` |
| Complaints, fraudulent submissions, disputes | `complaints`, rejected properties with reason `fraud` |
| CAC, satisfaction, referral rate | **Not derivable from the system in the MVP** — excluded unless a source is added (OQ-17) |

## 10. Gap analysis and open-question register

### 10.1 Inconsistencies and omissions in the source
1. No formal roles or permissions defined beyond "founding team".
2. No lifecycle definitions for listings, inquiries, appointments, transactions, complaints.
3. "Price and payment terms" is undefined for rentals (annual/monthly/bi-annual, caution, legal and service charges).
4. Fee calculation basis for rent is explicitly undecided (first-year rent vs other).
5. Inspection fee refund/credit rules undecided, though §7 requires disclosure before payment.
6. Verification "may include" several checks, but no checklist, evidence standard or verifier is defined.
7. "Landlords can review and approve price and description" is promised, but landlords have no account in the MVP — the mechanism is undefined.
8. How landlords update availability without a dashboard is undefined.
9. Dispute handling and complaint SLAs are mentioned but not designed.
10. No data-protection, retention or consent design despite storing identity documents and contact details.
11. No media rules (limits, video, storage, retention).
12. No messaging rules beyond "in-platform messaging, a managed channel or privacy-preserving contact methods".
13. KPIs include items the system cannot observe (CAC, satisfaction, referrals).
14. Launch city, brand colours/logo and budget undecided (the name Kof'a is decided); hosting and region undecided.
15. Task brief vocabulary (CRM) differs from the source (marketplace) — see §1.

### 10.2 Register

| ID | Question | Blocks | Proposed default (applied until decided) | Needed by |
|---|---|---|---|---|
| OQ-01 | Logo, brand colours, domain (the name **Kof'a** is decided, ADR-018) | Branding in FE-1.4, domain, legal pages | Neutral tokens with the Kof'a wordmark as text; colour and logo swap is a token change | FE-6.26, J-7.7 |
| OQ-02 | Launch city / neighbourhoods | Area taxonomy, seed data | Abuja (the proposal's own example); areas are data, not code | BE-4.2 |
| OQ-03 | Commission: applies to rent and sale? basis (first-year rent, sale price)? rounding, min/max, who pays? | J-6.7, BE-6.8 | 2% client + 2% landlord of annual rent (rent) or sale price (sale), rounded to nearest kobo, no cap; rules table is configurable | J-6.7 |
| OQ-04 | Inspection fee: amount, refundable or credited, cancellation/unavailability handling | FR-APPT-05, J-6.1, J-6.7 | Fee optional and configurable (default ₦0 = disabled); if enabled it is credited against the service fee on proceeding; refunded if landlord/staff cancels or property is unavailable or materially different | J-6.1 |
| OQ-05 | Verification checklist, evidence required, who verifies | J-4.1, BE-4.2 | Checks: identity, ownership/authority documents, location, price, features, availability; method `desk_review` / `physical_inspection` / `both`; performed by staff; each check pass/fail/n.a. + note | J-4.1 |
| OQ-06 | Payments, transaction records, gateway | J-6.7, BE-6.9 | No gateway in MVP; staff record payments made to approved company accounts in the ledger; gateway (e.g. Paystack/Flutterwave) is post-MVP; escrow out of scope | J-6.7 |
| OQ-07 | Landlord accounts and approvals | J-4.1 | No accounts. Staff record approval (method, date, note, evidence); landlord contacted by phone/WhatsApp/email by staff | J-4.1 |
| OQ-08 | Must clients register to express interest? | J-5.1 | Yes — registration required (spam control, thread access, audit) | J-5.1 |
| OQ-09 | Staff roles | J-1.3 | Two roles: `staff`, `admin` | J-1.3 |
| OQ-10 | Property taxonomy: listing types, property types, payment terms, extra charges, land/commercial | J-4.1 | Rent and sale; apartment, house, duplex, bungalow, terrace, studio, room; land and commercial post-MVP; price period `year`/`month`/`one_time`; extra charges stored as an itemised list | J-4.1 |
| OQ-11 | What does the public see of the location, and when is the exact address disclosed? | J-4.1, J-6.1 | Public: state/city/neighbourhood + free-text street hint + approximate map; exact address after the client confirms an inspection | J-4.1 |
| OQ-12 | Availability re-confirmation cadence | BR-10 | Flag stale after 14 days; no automatic unpublish in MVP | BE-4.5 |
| OQ-13 | Media limits, storage provider, retention | BE-4.3 | Photos 5–20, ≤ 10 MB each (JPEG/PNG/WebP); optional video ≤ 100 MB, no transcoding; S3-compatible private storage; documents retained while listing exists + retention period set by counsel | BE-4.3 |
| OQ-14 | Messaging scope | J-5.1 | Async text threads, refresh/polling; no attachments; masked calls and off-platform-contact detection post-MVP | J-5.1 |
| OQ-15 | Email provider; SMS/WhatsApp | BE-3.4, BE-6.19 | Transactional email via one SMTP/API provider behind an interface; SMS/WhatsApp out | BE-3.4 |
| OQ-16 | Complaint investigation process: SLAs, who may take which action, reporter notifications | J-6.14 | Statuses new → triage → investigating → resolved/dismissed; outcomes and actions per FR-CMP-04/05; first response 2 business days (internal); permanent actions admin-only; generic outcome notice to the reporter | J-6.14 |
| OQ-17 | KPI definitions; which KPIs need new data sources | J-6.22 | Only system-derivable KPIs (section 9); CAC/satisfaction/referral out | J-6.22 |
| OQ-18 | Legal and policy content (terms, privacy, fees, refunds, verification limits), consent wording, retention, NDPA compliance, anti-circumvention terms | FR-POL-01, J-7.7 | Placeholder content clearly marked "draft — not legal advice"; go-live blocked until counsel approves | FE-6.26, J-7.7 |
| OQ-19 | Non-functional targets | NFR section | Values in section 8 | J-1.1 |
| OQ-20 | Hosting, region, budget | BE-7.5, FE-7.6 | Containerised backend + managed PostgreSQL + object storage; frontend on a Node/edge host; region to be chosen with NDPA advice | BE-7.5 |
| OQ-21 | Confirm CRM-to-marketplace vocabulary mapping (section 1) | Everything | Mapping in section 1 accepted | J-0.3 |
| OQ-22 | Confirm subscriptions, featured listings and gateway are excluded from MVP | Scope | Excluded | J-0.3 |
| OQ-23 | AI assistant: LLM provider and model, monthly budget, what conversation data may go to a third party (NDPA), transcript retention | J-6.28, BE-6.30 | Provider behind an interface (Claude API is the working candidate); only the chat text is sent, no account data; transcripts kept 90 days (confirm with counsel); daily token budget set by admin | J-6.28 |
| OQ-24 | Company call line: number, who answers, support days and hours, behaviour outside hours | J-6.28, FE-6.32 | Single number and hours stored in admin settings (placeholder until supplied); outside hours the widget shows the hours and invites a message to the team | J-6.28 |
| OQ-25 | Who writes and approves knowledge articles; initial FAQ content | BE-6.29, J-6.28 | Staff draft, admin publishes; initial set (how it works, fees, verification, inspections, reporting, contact) written from the proposal and approved by the founders | J-6.28 |
| OQ-26 | Assistant languages and channels | J-6.28 | English only, web only; Nigerian Pidgin and WhatsApp later | J-6.28 |

## 11. Assumptions in force

- **A-1** Launch is a single city, but nothing in code is city-specific.
- **A-2** Landlords have no login; staff act on their behalf and record evidence of each approval.
- **A-3** Clients must register before expressing interest.
- **A-4** All money is NGN, stored in kobo.
- **A-5** The platform never holds client funds in the MVP.
- **A-6** One staff team; no multi-tenancy or franchise model.
- **A-7** Public pages are indexed by search engines; admin and client areas are not.
- **A-8** The assistant may be used anonymously; "message the team" requires login, while the call line is always shown.
- **A-9** The call line is staffed during the published support hours.

## 12. Product risks that affect engineering

| Risk | Engineering response |
|---|---|
| Wrong data exposed (landlord PII) | Separate public/private serializers; automated privacy-leak tests in every public endpoint (BE-4.9) |
| Fee miscalculation | Pure, exhaustively tested fee functions; worked examples from the proposal as tests (J-6.12) |
| Contract drift between the two developers | Contract change protocol; OpenAPI drift check (BE-2.4); generated TS types (FE-2.5) |
| Frontend ships on mocks | Mock audit in CI; acceptance gate in every integration task |
| Legal content not ready at launch | Content is data-driven pages with placeholders; go-live gate J-7.7 |
| Scope creep from Phase 5/"full app" ideas | Won't list in section 6; changes via `agents/PRODUCT_PLANNER.md` process |
| AI assistant gives a wrong or unsafe answer | Answers only from approved sources with citations; deterministic handoff categories; output filter; golden-set and red-team evaluation (BE-6.31); transcripts reviewable by staff |
| An unverified complaint harms a landlord's listing | Verify-before-action workflow, time-boxed precautionary holds, admin-only permanent actions (FR-CMP-04/05) |
| Assistant cost or abuse | Rate limits, message length cap, daily token budget with automatic handoff (FR-AI-08) |

## 13. Traceability (proposal → requirements)

§4 St.1 → FR-PROP-01/02 · §4 St.2 → FR-PROP-05/07 · §4 St.3 → FR-PROP-09–11, FR-INQ-01 · §4 St.4 → FR-INQ-03/06 · §4 St.5 → FR-APPT-* · §4 St.6 → FR-TXN-* · §5 → BR-03, FR-PROP-06 · §6 → FR-TXN-02, FR-SUB-01 · §7 → FR-APPT-05, BR-04 · §8 → BR-02/03/09/10, FR-INQ-08, FR-CMP-* · §9A–G → FR-HOME-01, FR-PROP-*, FR-INQ-*, FR-ADM-*, FR-POL-* · §15 → FR-RPT-01
