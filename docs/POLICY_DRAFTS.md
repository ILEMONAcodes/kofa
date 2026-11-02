# FE-6.26 — owner-supplied policy drafts

Task: FE-6.26 (partial) — replace placeholder Terms and Privacy pages with owner-supplied drafts.
Objective: readable desktop/mobile policy documents reachable from existing consent/footer links.
Owner: Developer 2, continuing explicit frontend authorization.
Branch: joint/FE-6.26-policy-drafts (based on the integrated auth work, not main, to retain dependencies).
Required documentation: PRD OQ-18; IMPLEMENTATION_PLAN FE-6.26; API_CONTRACT /policies/current.
Files: frontend/src/content/policies/**; resources/[screen]/page.tsx; this document; PROGRESS and DECISIONS.
Dependencies: existing resources routes and registration consent links, implemented.
Contract: unchanged v0.3.0; documents retain draft-v1, matching the current configured policy versions.
Acceptance: all 10 Terms and 8 Privacy sections retained; proposed values/placeholders preserved; draft banner visible; responsive readable pages; existing links resolve.
Validation: frontend typecheck and ESLint for changed TypeScript files.
Out of scope: legal approval, final policy publication, fee calculation changes, new authentication modes, landlord accounts, full FE-6.26 disclosure suite.
Working assumption: OQ-18 draft-only default. User says use these now and replace later; this is not counsel approval.

## Deployment and registration

Owner subsequently explicitly authorized MVP client registration before legal review (2026-11-02). Private backend/.env now sets POLICIES_APPROVED=true, enabling the existing registration path. This is owner authorization, not counsel approval; draft notices remain. Render needs the same environment variable. No remote hosting settings or database rows were changed.

The drafts describe future marketplace, email and assistant functionality; a visible notice explains that some described services are planned. Bracketed company/contact/fee/retention values remain unresolved. Owner must verify actual data practices before approval. Draft revision is dated 2026-11-02, not an effective date.

The supplied closing note about a zip/renaming is editorial correspondence, not policy text. Existing product name remains Kof’a; no new sign-off gates introduced.

## Validation results

Frontend `npm run typecheck`: passed. Targeted ESLint for the three changed TypeScript files: passed. `git diff --check`: passed. Reviewer pass confirms all 18 supplied sections retained and backend/config unchanged. No browser visual check performed. Existing `.DS_Store` and `frontend/next-env.d.ts` user changes preserved. Not pushed or deployed.
