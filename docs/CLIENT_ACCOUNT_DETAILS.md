# Client account details — FE-3.6 / J-3.7 follow-up

Task Brief: Developer2, owner-authorized frontend fix on joint/FE-3.6-client-account-details, based on assistant commit1e6070e (support merged on main; assistant branch pending). Problem: PWA Account → /account → /account/overview currently renders LiveInquiries because overview is treated as an inquiry view. Objective: show the signed-in client's actual identity details from existing GET /auth/me without changing the original theme or account APIs. Dependencies: existing real auth/session and client route guards implemented. Required docs: auth contract/session conventions, frontend design tokens, planFE-3.6/J-3.7. Files: account route/component, account navigation, focused tests/E2E and progress.

Acceptance: Account opens actual full name/email/phone/email-verification status/joined date; no sample figures, profile image or invented editing API; inquiries remain separately accessible. Preserve client-only guard and staff/admin routing. Loading/error/retry/no-phone states. Existing verify-email/reset-password/logout flows linked. Tests: meaningful component coverage for actual account rendering, failed request/retry and null phone; real local PostgreSQL mobile browser navigation/own-account privacy/unauthenticated redirect, responsive/axe; lint/types/build. No backend/schema/contract change, migration, production user data, AI call, deployment or push.

## Verification

- Frontend lint, typecheck and production build passed.164 unit tests passed (including4 new account-detail cases); focused account/routing run5 passed.
- Real production frontend + local FastAPI/PostgreSQL browser journey1 passed: tap PWA Account from properties → /account/overview → own full name/email/phone/status; inquiries separate; another user_id query cannot select another identity; logout revokes access; anonymous Account redirects to sign-in.
- Overflow and axe passed at360/768/1280px; mobile screenshot reviewed. Fictional accounts only; AI disabled.
- No contract, backend, schema, migration, credential or production-data change. Details remain read-only through existing /auth/me. No frontend sample account or profile image.
- Role-aware /account workspace destinations and all Account links retain the stable overview route. Missing/expired access cookies now use the existing /session/restore flow before sign-in, preserving valid refresh sessions. Server client-only guard remains before rendering.
- Peer review, push/merge and deployment remain pending; unrelated .DS_Store/.vscode/REGISTRATION_RECOVERY.md changes left untouched.

Final local review resolved the expired-access-cookie Account redirect edge. Fresh production build/lint/types passed, and the extended real-stack browser test passed after deleting only the access cookie in the mounted PWA: the existing refresh session restored the same client details without requiring login. No blocking local review finding remains; independent peer review and deployment pending.
