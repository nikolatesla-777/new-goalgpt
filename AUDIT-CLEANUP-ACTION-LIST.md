# CLEANUP & ACTION LIST - GoalGPT Branch Management

**Date:** 2026-01-25
**Purpose:** Executable checklist for branch cleanup and process improvement
**For:** Development team + Project management

---

## 📋 QUICK CHECKLIST OVERVIEW

- [ ] **Phase 1:** Delete critical duplicate branch (5 min) 🔴 URGENT
- [ ] **Phase 2:** Delete merged PR branches (5 min) 🟡 HIGH
- [ ] **Phase 3:** Review old Claude branches (30 min) 🟡 HIGH
- [ ] **Phase 4:** Clean local branches (2 min) 🟢 NORMAL
- [ ] **Phase 5:** Set up branch protection (10 min) 🟢 NORMAL
- [ ] **Phase 6:** Document process (30 min) 🟢 NORMAL

**Total Estimated Time:** ~1 hour 22 minutes

---

## 🔴 PHASE 1: DELETE CRITICAL DUPLICATE BRANCH (URGENT)

### ⏱ Estimated Time: 5 minutes
### 🎯 Priority: CRITICAL
### 👤 Who: Lead developer or DevOps

### Why This is Critical

Branch `claude/security-code-review-6VaCc` contains OLD versions of PR-6 through PR-12. These PRs are already in main with NEWER, IMPROVED versions. If someone accidentally merges this branch:

- ❌ Reintroduces fixed bugs (PR-9 DB connection bug, PR-12 HALF_TIME bug)
- ❌ Causes 200+ lines of merge conflicts
- ❌ Overwrites production improvements
- ❌ Potential production downtime

### Action Steps

```bash
# 1. Verify branch exists and is redundant
git fetch --all
git log origin/claude/security-code-review-6VaCc --oneline | head -10

# Expected: You should see PR-6 through PR-12 commits with OLD dates (2026-01-22)

# 2. Confirm main has newer versions
git log origin/main --oneline --grep="PR-" | head -20

# Expected: You should see PR-6 through PR-14 with NEWER dates (2026-01-23 to 2026-01-25)

# 3. DELETE the duplicate branch
git push origin --delete claude/security-code-review-6VaCc

# 4. Verify deletion
git branch -r | grep security-code-review

# Expected: No output (branch deleted)
```

### ✅ Verification

After deletion:
```bash
# Should return empty
git ls-remote --heads origin claude/security-code-review-6VaCc
```

If deletion fails (protected branch), contact GitHub admin to unprotect first.

---

## 🟡 PHASE 2: DELETE MERGED PR BRANCHES (HIGH PRIORITY)

### ⏱ Estimated Time: 5 minutes
### 🎯 Priority: HIGH
### 👤 Who: Any developer with push access

### Why Clean These Up

These branches are 100% merged into main. Keeping them:
- ❌ Clutters branch list
- ❌ Confuses new developers ("Which branch is current?")
- ❌ Increases repo clone time
- ❌ Makes git log harder to read

### Branches to Delete

| Branch | Reason | Safe? |
|--------|--------|-------|
| `pr-13-fix-typescript-errors` | Merged to main (commit d21561a) | ✅ YES |
| `pr-2-auth-grouping` | Merged to main (commit 2e380c4) | ✅ YES |
| `pr-3-security-fixes` | Merged to main (commit 39e2b20) | ✅ YES |
| `migration-add-last-update-source` | Merged to main (commit 16591a1) | ✅ YES |

### Action Steps

```bash
# DELETE all merged PR branches
git push origin --delete pr-13-fix-typescript-errors
git push origin --delete pr-2-auth-grouping
git push origin --delete pr-3-security-fixes
git push origin --delete migration-add-last-update-source
```

### ✅ Verification

```bash
# List remaining PR branches (should be empty or minimal)
git branch -r | grep "origin/pr-"

# Expected: No output or only active PR branches
```

---

## 🟡 PHASE 3: REVIEW OLD CLAUDE BRANCHES (HIGH PRIORITY)

### ⏱ Estimated Time: 30 minutes (5-10 min per branch)
### 🎯 Priority: HIGH (this week)
### 👤 Who: Senior developer familiar with codebase

### Why Review First

These branches contain performance optimizations and features that may still be valuable, but they're 73-126 commits behind main. We need to:
1. Check if changes are already in main (duplicate)
2. Cherry-pick valuable commits
3. Delete branch after extraction

### Branches to Review

#### 1. `claude/analyze-website-performance-JUQXa`

**Details:**
- Last commit: 2026-01-20
- Commits behind main: 111
- Commits ahead: 0

**Review Steps:**

```bash
# 1. Checkout and inspect
git checkout origin/claude/analyze-website-performance-JUQXa
git log --oneline -20

# 2. Look for these potentially valuable commits:
#    - Pagination fixes for /match/diary API
#    - Performance optimizations
#    - Timezone standardization (TSI)

# 3. Check if already in main
git log origin/main --oneline --grep="pagination" --grep="diary"

# 4a. If commits are valuable and NOT in main:
git checkout main
git cherry-pick <commit-hash>  # Pick valuable commits one by one
git push origin main

# 4b. If commits are already in main or not valuable:
#     Just note it for deletion

# 5. Delete branch
git push origin --delete claude/analyze-website-performance-JUQXa
```

**Specific Commits to Check:**
- "fix: Add pagination to /match/diary API to fetch ALL matches"
- "fix: Standardize all timezone handling to TSI (UTC+3)"

**Decision Matrix:**
- ✅ Cherry-pick if: Feature not in main + still relevant
- ❌ Delete if: Already in main or superseded by newer implementation

---

#### 2. `claude/fix-match-details-performance-JyyOG`

**Details:**
- Last commit: 2026-01-21
- Commits behind main: 73
- Commits ahead: 0

**Review Steps:**

```bash
# 1. Checkout and inspect
git checkout origin/claude/fix-match-details-performance-JyyOG
git log --oneline -20

# 2. Look for these commits:
#    - TrendTab offensive intensity chart
#    - Client-side cache with stale-while-revalidate
#    - Performance optimizations for match details

# 3. Check if features exist in current main
#    (e.g., does TrendTab have offensive intensity chart?)

# 4. Cherry-pick valuable commits or note for deletion
```

**Specific Features to Check:**
- "feat(trend): Update TrendTab to display offensive intensity chart"
- "perf(phase4): Add client-side cache with stale-while-revalidate pattern"

**Decision:** Review frontend TrendTab component. If chart doesn't exist and is valuable, cherry-pick.

---

#### 3. `claude/review-codebase-kf6qI`

**Details:**
- Last commit: 2026-01-19
- Commits behind main: 126
- Commits ahead: 0

**Review Steps:**

```bash
# 1. Quick inspection
git log origin/claude/review-codebase-kf6qI --oneline -10

# 2. Check for deploy script updates
git show origin/claude/review-codebase-kf6qI:deploy.sh > /tmp/old-deploy.sh
git show origin/main:deploy.sh > /tmp/current-deploy.sh
diff /tmp/old-deploy.sh /tmp/current-deploy.sh

# 3. If no valuable differences, delete immediately
```

**Likely Decision:** DELETE (too old, likely superseded)

---

#### 4. `claude/sports-api-timezone-guide-nvwBe`

**Details:**
- Last commit: 2026-01-19
- Commits behind main: 115
- Commits ahead: 1 (one unique commit!)

**Review Steps:**

```bash
# 1. Check the unique commit
git log origin/claude/sports-api-timezone-guide-nvwBe ^origin/main --oneline

# 2. Inspect the commit
git show <commit-hash>

# 3. Check if timezone handling is already correct in main
#    (Look for TSI/UTC+3 usage across services)

# 4. If timezone changes are already applied, delete
```

**Specific Check:**
- "feat: Standardize all services to use TSİ (UTC+3) timezone"
- Check if this is already done in main (likely yes)

**Likely Decision:** DELETE (timezone already standardized in main)

---

### Review Checklist Template

For each branch, fill this out:

```
Branch: _______________________________
Date Reviewed: _______________________
Reviewer: _____________________________

[ ] Inspected commit history
[ ] Checked for duplicate commits in main
[ ] Identified valuable commits: _______________
[ ] Cherry-picked commits (if any): _______________
[ ] Deleted branch: _______________
[ ] Verified deletion: _______________

Notes:
_________________________________________
```

---

## 🟢 PHASE 4: CLEAN LOCAL BRANCHES (NORMAL PRIORITY)

### ⏱ Estimated Time: 2 minutes
### 🎯 Priority: NORMAL
### 👤 Who: Each developer on their machine

### Why Clean Local Branches

Local branches that are already merged:
- Take up disk space
- Clutter `git branch` output
- Cause confusion

### Action Steps

```bash
# 1. Fetch latest from remote
git fetch --all --prune

# 2. List local branches that are merged to main
git branch --merged main

# Expected output (these are safe to delete):
#   pr-11-route-dedup
#   pr-13-fix-typescript-errors
#   pr-14-zod-validation
#   pr-8a-jobrunner-wrap
#   pr-8b-phase1-watchdog
#   pr-8b-phase2-batch1
#   pr-8b-phase2-batch2
#   pr-8b.1-hotfix-lock-key-alphanumeric
#   migration-add-last-update-source

# 3. Delete all merged branches (EXCEPT main and current branch)
git branch --merged main | grep -v "^\*" | grep -v "main" | xargs git branch -d

# 4. Verify cleanup
git branch

# Expected: Only main and any active feature branches
```

### Safe Delete vs Force Delete

```bash
# Safe delete (only merged branches)
git branch -d branch-name

# Force delete (unmerged branches - BE CAREFUL!)
git branch -D branch-name  # Only use if you're SURE
```

### ✅ Verification

```bash
# List remaining local branches
git branch

# Should see minimal branches (main + active work)
```

---

## 🟢 PHASE 5: SET UP BRANCH PROTECTION (NORMAL PRIORITY)

### ⏱ Estimated Time: 10 minutes
### 🎯 Priority: NORMAL (this week)
### 👤 Who: GitHub admin or repository owner

### Why Protect Branches

Prevent:
- ❌ Direct pushes to main (bypass review)
- ❌ Accidental force pushes
- ❌ Merge of broken code

### GitHub Settings

**Navigate to:** GitHub repo → Settings → Branches → Add branch protection rule

#### Rule 1: Protect `main`

```
Branch name pattern: main

✅ Require a pull request before merging
   ✅ Require approvals: 1
   ✅ Dismiss stale pull request approvals when new commits are pushed
   ✅ Require review from Code Owners (if CODEOWNERS file exists)

✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   Status checks (if CI/CD exists):
      - Build
      - TypeScript check
      - Tests

✅ Require conversation resolution before merging

✅ Do not allow bypassing the above settings
   (Admins can override in emergencies)

✅ Restrict who can push to matching branches
   Allowed: Repository admins only

❌ Allow force pushes (keep disabled)
❌ Allow deletions (keep disabled)
```

#### Rule 2: Protect `pr-*` Pattern (Optional)

```
Branch name pattern: pr-*

✅ Restrict who can push to matching branches
   Allowed: Branch creator + admins

❌ Allow force pushes (keep disabled)
```

### ✅ Verification

Try to push directly to main:
```bash
# This should FAIL with protection error
git checkout main
echo "test" >> test.txt
git add test.txt
git commit -m "test direct push"
git push origin main

# Expected error: "protected branch hook declined"
```

---

## 🟢 PHASE 6: DOCUMENT BRANCH MANAGEMENT PROCESS (NORMAL PRIORITY)

### ⏱ Estimated Time: 30 minutes
### 🎯 Priority: NORMAL (this month)
### 👤 Who: Tech lead or senior developer

### Why Document

Prevent future branch clutter by establishing clear rules.

### Create BRANCHING.md File

```bash
# Create documentation file
touch BRANCHING.md
```

**Contents:**

```markdown
# Branch Management Process

## Branch Naming Convention

### Feature Branches
Format: `pr-<number>-<short-description>`

Examples:
- `pr-15-add-redis-cache`
- `pr-16-fix-websocket-reconnect`

### Hotfix Branches
Format: `hotfix-<issue>-<short-description>`

Examples:
- `hotfix-db-connection-leak`
- `hotfix-auth-token-expiry`

### Personal Experiment Branches
Format: `experiment/<your-name>/<description>`

Examples:
- `experiment/john/graphql-api`
- `experiment/jane/new-ui-framework`

## Workflow

### 1. Creating a Feature Branch

```bash
# Always branch from latest main
git checkout main
git pull origin main

# Create feature branch
git checkout -b pr-15-add-redis-cache

# Work on feature
git add .
git commit -m "feat: Add Redis cache layer"
git push origin pr-15-add-redis-cache
```

### 2. Opening Pull Request

- Create PR on GitHub
- Add description explaining:
  - What changed
  - Why it changed
  - How to test
- Request review from at least 1 person
- Ensure CI/CD passes

### 3. After Merge

```bash
# Immediately after PR is merged:
git checkout main
git pull origin main

# Delete local branch
git branch -d pr-15-add-redis-cache

# Delete remote branch (if not auto-deleted)
git push origin --delete pr-15-add-redis-cache
```

### 4. Auto-Delete After Merge

Enable on GitHub:
Settings → General → Pull Requests →
✅ Automatically delete head branches

## Branch Lifecycle

```
Create → Push → PR → Review → Merge → DELETE
(1 min)  (work)  (same day)    (minutes) (immediately)
```

**Maximum branch lifetime:** 1 week
**After 1 week:** Either merge or close PR + delete branch

## Exceptions

### Long-lived Branches (Allowed)

- `main` - production branch
- `staging` - pre-production testing (if exists)
- `develop` - integration branch (if using GitFlow)

### Backup Branches (Special)

Format: `backup/<description>-<date>`

Example: `backup/pre-mqtt-refactor-20260125`

- Used for safety before major refactoring
- Keep for 1 month max
- Prefix with `backup/` to distinguish

## Commands Reference

### List branches by age
```bash
git for-each-ref --sort=committerdate refs/heads/ --format='%(committerdate:short) %(refname:short)'
```

### Delete merged branches
```bash
git branch --merged main | grep -v "^\*" | grep -v "main" | xargs git branch -d
```

### Delete remote branches
```bash
git push origin --delete branch-name
```

### Prune deleted remote branches
```bash
git fetch --all --prune
```

## Monthly Cleanup (First Monday of Month)

```bash
# 1. Update main
git checkout main
git pull origin main

# 2. List old branches
git branch -r --sort=committerdate | head -20

# 3. Check each branch:
#    - Is it merged? Delete it
#    - Is it >1 month old? Review with team

# 4. Clean local branches
git branch --merged main | grep -v "^\*" | grep -v "main" | xargs git branch -d
```

## Questions?

Contact: [Tech Lead Name/Email]
```

### Add to CLAUDE.md

Update `CLAUDE.md` (project memory card):

```markdown
## 15. BRANCH MANAGEMENT

**See:** BRANCHING.md for full process

**Quick Rules:**
- Branch naming: `pr-<number>-<description>`
- Always branch from latest main
- Delete after merge (same day)
- Max branch lifetime: 1 week
- Monthly cleanup: First Monday of month

**Protected Branches:**
- main (requires PR + 1 approval)
```

### ✅ Verification

```bash
# Verify documentation exists
ls -la BRANCHING.md CLAUDE.md

# Verify content
head -20 BRANCHING.md
```

---

## 📊 PROGRESS TRACKING

Use this table to track cleanup progress:

| Phase | Task | Assignee | Due Date | Status | Notes |
|-------|------|----------|----------|--------|-------|
| 1 | Delete security-code-review branch | ___ | Today | ⬜ |  |
| 2 | Delete merged PR branches | ___ | Today | ⬜ |  |
| 3 | Review analyze-website-performance | ___ | This week | ⬜ |  |
| 3 | Review fix-match-details | ___ | This week | ⬜ |  |
| 3 | Review review-codebase | ___ | This week | ⬜ |  |
| 3 | Review timezone-guide | ___ | This week | ⬜ |  |
| 4 | Clean local branches | Each dev | This week | ⬜ |  |
| 5 | Set up branch protection | Admin | This week | ⬜ |  |
| 6 | Document process | Tech lead | This month | ⬜ |  |

**Legend:**
- ⬜ Not started
- 🔄 In progress
- ✅ Complete
- ❌ Blocked

---

## 🚨 EMERGENCY ROLLBACK

If branch deletion causes issues:

### Restore Deleted Remote Branch

```bash
# 1. Find deleted branch commit
git reflog show origin/branch-name

# OR search all reflog
git reflog | grep "branch-name"

# 2. Recreate branch at commit
git checkout -b branch-name <commit-hash>

# 3. Push to remote
git push origin branch-name
```

### Restore Deleted Local Branch

```bash
# 1. Find commit in reflog
git reflog

# Look for: "commit: <message>" or "checkout: moving from branch-name"

# 2. Recreate branch
git checkout -b branch-name <commit-hash>
```

**Note:** Reflog keeps deleted branch history for ~30 days (default).

---

## 📞 SUPPORT

### Issues During Cleanup

**Problem:** Branch deletion fails (protected)
**Solution:** GitHub Settings → Branches → Edit protection rule → Temporarily disable → Delete → Re-enable

**Problem:** "Can't delete branch, not fully merged"
**Solution:** Use `git branch -D` to force delete (verify first!)

**Problem:** Deleted wrong branch
**Solution:** Use reflog to restore (see Emergency Rollback section)

### Questions?

Contact:
- Tech Lead: [Name/Email]
- DevOps: [Name/Email]
- GitHub Admin: [Name/Email]

---

## ✅ COMPLETION CHECKLIST

After completing all phases:

- [ ] All redundant remote branches deleted
- [ ] All local merged branches deleted
- [ ] Old Claude branches reviewed and actioned
- [ ] Branch protection enabled on main
- [ ] BRANCHING.md documentation created
- [ ] CLAUDE.md updated with branch rules
- [ ] Team notified of new process
- [ ] Progress tracking table updated

**Final Verification:**

```bash
# Should show minimal branches
git branch -r

# Expected output:
#   origin/main
#   (possibly origin/staging or origin/develop)
#   (only active feature branches)

# Should show clean reflog
git reflog | grep "delete" | tail -10

# Should show branch protection
# (Check on GitHub: Settings → Branches)
```

---

**Created:** 2026-01-25
**Last Updated:** 2026-01-25
**Next Review:** 2026-02-01 (weekly check for first month)
**Maintenance:** Monthly cleanup (first Monday)
