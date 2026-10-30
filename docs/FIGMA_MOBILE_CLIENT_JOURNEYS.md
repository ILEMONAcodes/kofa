# Mobile client journeys — Figma 78:2309

Task: FE-5.7 — client journeys presentation shell
Objective: Implement all 23 source mobile views as one connected, explicitly labelled UI preview using shared project controls and original theme.
Owner: Joint (Developer 2, continuing explicitly authorized frontend work)
Branch: joint/FE-5.7-mobile-client-journeys
Required docs: IMPLEMENTATION_PLAN FE-5.6/5.7 and client UI rows FE-6.5/6.11/6.16/6.20; PRD client journeys/privacy/appointments/complaints; API_CONTRACT 4.7/4.8 (Draft), UI_DESIGN_SYSTEM and ARCHITECTURE frontend/mock policy.
Files expected: client preview route/registry/components/styles, existing authentication account preview link, tests/tokens/handoff/progress.
Dependencies: current foundation/browse/auth/landlord presentation implemented. Backend authentication and named module freezes unavailable.
Contract: 0.2.0 Draft. API_CONTRACT 4.7 prohibits endpoint implementation/mocks before freezes; no payloads, mocks, live records, fees or business transitions will be implemented. This is one shared presentation module; real inquiry/appointment/transaction/complaint/notification modules remain separate tasks.
Acceptance: all 23 source states reviewable; exact assets/theme/layout; dropdowns/Other, budget steps and accessible forms; connected preview navigation; local evidence validation; refresh/read/action feedback clearly distinguished from real services; real account entries remain signed out. No fake authentication, successful mutation or real data transmission.
Tests planned: browser all-screen mobile rendering/overflow, inquiry dropdown and explicit outcome, complaint accessibility and evidence limits; lint/typecheck/unit/build/mock audit.
Out of scope: backend, identity/session integration, polling real records, persistence, fee arithmetic/payments/escrow, publication/legal policy text, admin screens.
Assumptions: Figma references and fictional dates/records are static examples, not live data. Optional notifications remain labelled Optional. Existing common Input/Button/Modal/Budget controls replace unavailable generic Code Connect primitives. Native UI validation is presentation-only; RHF/Zod/generated API integration remains pending. No endpoint mocks or contract changes.

Implementation notes

- Entry: `/client-preview/overview`. All 23 source states have static routes, source-node IDs and a numbered screen directory. The existing authentication account preview links to this directory's overview.
- Source content is stored as a semantic block registry; the renderer uses project Button, Modal and SearchBudget controls rather than raw exported Figma JSX. Original DM Sans, brown/cream palette, 124px header, 20px body spacing, rounded cards, 220px property photos and bottom navigation are retained.
- Exact exported client logo and active inquiry icon are local SVGs. Other navigation assets and property photography match existing assets byte-for-byte.
- Editable fields, native dates, dropdowns with Other, budget steppers, inquiry status filtering and local evidence selection are available. Evidence stays in memory and is never uploaded. Backend actions show an explicit unavailable-service dialog with a separate link to an example outcome.
- Actual authentication, service submission, messaging/polling, appointments, transactions, complaints and notifications remain integration tasks. No backend endpoints, identity checks, policies, payment processing or contracts were changed. Production account routes remain signed out.
- This is a mobile presentation implementation; desktop widths show a bounded mobile preview rather than a new desktop client design.

Validation (2026-10-30)

- `npm run build` — passed; all 23 client preview routes statically generated.
- `npm run typecheck` and `npm run lint` — passed, no lint warnings.
- `npm run test -- --run` — 64 tests passed in 8 files.
- Chrome client checks — all five checks passed across the final suite run and focused rerun: inquiry/Other/outcome, complaint accessibility, evidence limits, correct record detail links, and all 23 routes at 390×844 without horizontal overflow. The 23-route loop exceeded the default 30-second timeout under parallel load; its focused rerun passed in 13 seconds, and its timeout is now 90 seconds.
- Axe complaint-form check — no serious/critical violations. This is scoped accessibility validation, not a whole-site audit.
- `npm run mock-audit` — no active TEMP-MOCK handlers.
- Overview screenshot inspected at 390×844. Other screens were route/heading/overflow checked; a full pixel-by-pixel comparison of every source state remains a design review task.
