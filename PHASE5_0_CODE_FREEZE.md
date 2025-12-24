# Phase 5-0: Code Freeze Declaration (RC1)

**Date/Time (Europe/Istanbul / TSİ):** 2025-12-23 11:00:39 (+03:00)
**Phase:** 5-0 (Release Candidate Freeze)
**Status:** ✅ **ACTIVE**

## Scope
- **Applies to:** `main` branch and any release branches derived from it (e.g., `release/*`).
- **Does NOT apply to:** local experiments or spike branches that never merge to `main`.

## Release Identity
- **Release Candidate:** RC1
- **RC Tag:** `rc1` (to be created once the repo has an initial commit and CI is green)
- **Target Cutover:** Phase 5-3 (Staging deploy → 24h observation → Production controlled rollout)

---

## Freeze Declaration

As of **2025-12-23 11:00:39 TSİ**, the `main` branch is in **CODE FREEZE** status for Phase 5 Release Candidate 1 (RC1).

**Enforcement:**
- Direct pushes to `main` are prohibited.
- All merges require a PR and must pass required CI checks.
- Branch protection rules should be enabled for `main` (required reviews + required status checks).

### Freeze Rules

1. **No New Features:** Feature work is **BLOCKED** until freeze is lifted.
2. **Only Prod-Stability Fixes:** Only changes that prevent/mitigate production incidents are allowed.
3. **No Contract Drift:** API/DB contracts must not change unless the change fixes an existing contract violation.
4. **Invariants Are Sacred:** Phase 3/4 invariants must remain true (minute engine must not update `updated_at`, optimistic locking must remain, DB-only controllers remain DB-only).
5. **Proof Required:** Every allowed change must include evidence (command output / logs) added to the relevant proof report.

---

## Allowed Exceptions

### Exception Type: Production-Stability Bug Fixes Only

**Definition:** A production bug fix is a change that:
- Fixes a critical bug that affects production stability, data integrity, or security
- Does not introduce new features or functionality
- Does not change existing APIs or contracts (unless fixing a contract violation)
- Is directly related to Phase 4-5 workstreams (observability, resilience, freeze detection, UI failsafe, production readiness)
- Includes fixes required to complete Phase 5 staging/prod deploy (health/readiness, logging, CI gate) if they address a release-blocking risk.
- Must be minimal and surgical (smallest change that fixes the issue).

### Exception Process

1. **Open a PR:** Base branch must be `main`.
2. **Label:** `prod-bug-fix`.
3. **Attach Evidence:** PR must include:
   - Incident/issue link (or a short written incident summary if none exists)
   - Risk assessment (what can break?)
   - Proof commands executed + their output (paste into PR or link to updated proof doc)
4. **Review + Approval:**
   - Minimum **1 approval** from release manager/senior engineer.
   - If DB migrations or provider logic is touched: **2 approvals**.
5. **Merge Policy:**
   - Squash-merge only.
   - No merge if CI is red.

---

## "No Feature" Rule

**Strictly prohibited during freeze:**
- New API endpoints (unless fixing a broken contract)
- New database schema changes (unless fixing data corruption)
- New background workers (unless fixing a critical worker failure)
- UI enhancements or new UI features
- Performance optimizations that are not bug fixes
- Refactoring that is not directly related to a production bug
- Any change that increases scope without a production incident justification

---

## Freeze Lift Criteria

Freeze is lifted only when ALL are true:
1. **Phase 5-3 complete:** Staging deploy performed and smoke tests PASS.
2. **Observation complete:** Minimum **24 hours** staging observation with no P0/P1 incidents.
3. **Golden-day proof PASS:** Phase 3C/Phase 4 proof endpoints pass on staging.
4. **Production deploy complete:** Controlled rollout executed and verified stable.
5. **Release Manager Declaration:** Release manager updates this document status to **LIFTED** with timestamp.

## Emergency Freeze Break

If a P0 production incident requires immediate action:
- Follow the same exception process, but mark PR as `P0` in title.
- Require **explicit release manager approval** before merge.
- Add a short postmortem note link to the PR within 24 hours.

---

## Roles & Contact

- **Release Manager:** (fill)
- **On-call Engineer:** (fill)

If roles are unknown, assign before Phase 5-3.

---

## Status History
- 2025-12-23 11:00:39 (+03:00) — **ACTIVE** (RC1 freeze declared)

**End of Code Freeze Declaration**


