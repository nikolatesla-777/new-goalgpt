# GoalGPT Mobile App - Team Setup & Communication

> **Purpose:** Define team structure, roles, and communication protocols
> **Last Updated:** 2026-01-12
> **Status:** 🔲 Setup Required

---

## Team Structure

### Core Team (Required)

| Role | Responsibility | Time Commitment | Phases |
|------|---------------|-----------------|--------|
| **Backend Developer** | API development, database migration | Full-time | 1-4, 10-11 |
| **Mobile Developer** | React Native/Expo development | Full-time | 5-9 |
| **QA Engineer** | Testing, bug tracking | Full-time | 12 |
| **DevOps Engineer** | CI/CD, deployment, monitoring | Part-time | 0, 13 |
| **Project Manager** | Coordination, timeline, stakeholder communication | Part-time | 0-13 |

### Extended Team (Optional)

| Role | Responsibility | When Needed |
|------|---------------|-------------|
| **UI/UX Designer** | Design specs, mockups | Before Phase 5 |
| **Security Auditor** | Security review | Phase 12 |
| **Technical Writer** | Documentation | Phase 11-13 |

---

## Communication Channels

### 1. Slack/Discord Setup

**Channels to Create:**

```
#mobile-app-general       - General discussion
#mobile-app-backend       - Backend/API discussions
#mobile-app-frontend      - Mobile app discussions
#mobile-app-bugs          - Bug reports and tracking
#mobile-app-deployments   - Deployment notifications
#mobile-app-monitoring    - Alerts and monitoring
#mobile-app-random        - Non-work chat
```

**Integrations:**
- [ ] GitHub notifications → `#mobile-app-deployments`
- [ ] Sentry errors → `#mobile-app-monitoring`
- [ ] CI/CD status → `#mobile-app-deployments`

### 2. Daily Standup

**Schedule:** Every weekday at 10:00 AM (30 minutes max)

**Format:**
- What did you complete yesterday?
- What are you working on today?
- Any blockers?

**Tool:** Slack huddle or Zoom

### 3. Sprint Planning

**Schedule:** Every Monday at 2:00 PM (1 hour)

**Agenda:**
- Review last week's progress
- Plan current week's tasks
- Update master plan status
- Discuss blockers
- Risk assessment

### 4. Weekly Demo

**Schedule:** Every Friday at 4:00 PM (30 minutes)

**Purpose:**
- Show completed features
- Gather feedback
- Celebrate wins

---

## Documentation Tools

### Option A: Notion (Recommended)

**Workspace Setup:**

```
GoalGPT Mobile
├── 📋 Master Plan (link to MASTER-APP-GOALGPT-PLAN.md)
├── 📊 Sprint Board (Kanban)
├── 🐛 Bug Tracker
├── 📖 API Documentation
├── 🎨 Design System
├── 📱 Mobile App Specs
├── 🔐 Credentials Vault (restricted)
└── 📝 Meeting Notes
```

### Option B: Confluence

Similar structure to Notion, use Jira for issue tracking.

### Option C: GitHub Wiki + Issues

- Use GitHub Wiki for documentation
- GitHub Issues for bug tracking
- GitHub Projects for sprint board

---

## Development Workflow

### Git Branching Strategy

```
main                    → Production-ready code
├── develop             → Integration branch
│   ├── feature/phase-1-db-migration
│   ├── feature/phase-2-auth-api
│   ├── feature/phase-5-mobile-setup
│   └── bugfix/fix-auth-token-expiry
```

**Branch Naming Convention:**
- `feature/phase-X-description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Critical production fixes

### Pull Request Process

1. Create feature branch from `develop`
2. Implement feature
3. Write tests (if applicable)
4. Create PR to `develop`
5. Code review (minimum 1 approval)
6. Merge to `develop`
7. Deploy to staging
8. If stable, merge `develop` → `main` → deploy to production

### Code Review Guidelines

**Checklist:**
- [ ] Code follows project conventions
- [ ] No hardcoded credentials
- [ ] Error handling implemented
- [ ] TypeScript types defined
- [ ] Comments where necessary
- [ ] Tests pass
- [ ] No console.log in production code

---

## Issue Tracking

### Priority Levels

| Priority | Description | SLA |
|----------|-------------|-----|
| 🔴 **P0 - Critical** | Production down, data loss | Fix immediately |
| 🟠 **P1 - High** | Major feature broken | Fix within 24h |
| 🟡 **P2 - Medium** | Minor feature issue | Fix within 1 week |
| 🟢 **P3 - Low** | Nice to have, UI polish | Fix when available |

### Issue Template

```markdown
## Description
Clear description of the issue

## Steps to Reproduce
1. Step 1
2. Step 2
3. Expected vs Actual result

## Environment
- Device: iPhone 14 Pro
- OS: iOS 17.1
- App Version: 1.0.0

## Screenshots/Logs
(if applicable)

## Priority
[P0 / P1 / P2 / P3]

## Assignee
@username
```

---

## Meeting Schedule

### Weekly Calendar

| Day | Time | Meeting | Duration | Attendees |
|-----|------|---------|----------|-----------|
| Mon | 10:00 | Daily Standup | 30 min | All |
| Mon | 14:00 | Sprint Planning | 60 min | All |
| Tue | 10:00 | Daily Standup | 30 min | All |
| Wed | 10:00 | Daily Standup | 30 min | All |
| Thu | 10:00 | Daily Standup | 30 min | All |
| Fri | 10:00 | Daily Standup | 30 min | All |
| Fri | 16:00 | Weekly Demo | 30 min | All |

---

## Credentials Management

### Tool: 1Password / LastPass / Bitwarden

**Vaults:**
- `GoalGPT Mobile - Production` (PM + DevOps only)
- `GoalGPT Mobile - Staging` (All developers)
- `GoalGPT Mobile - Third-Party APIs` (All developers)

**Items to Store:**
- RevenueCat API keys
- Firebase credentials
- Google/Apple OAuth keys
- AdMob credentials
- Database passwords
- JWT secrets

**Access Control:**
- Production credentials: PM, DevOps only
- Staging credentials: All developers
- Third-party API keys: All developers

---

## Onboarding Checklist

### New Team Member Setup

**Day 1:**
- [ ] Add to Slack/Discord channels
- [ ] Grant GitHub repository access
- [ ] Add to 1Password vault (staging)
- [ ] Share master plan document
- [ ] Assign onboarding buddy
- [ ] Schedule 1-on-1 with PM

**Day 2:**
- [ ] Local development environment setup
- [ ] Run: `./scripts/check-dev-environment.sh`
- [ ] Clone repositories
- [ ] Run staging backend locally
- [ ] Run mobile app on simulator/emulator

**Day 3:**
- [ ] Review phase 0 documentation
- [ ] Attend daily standup
- [ ] Pick first small task
- [ ] Submit first PR

---

## Offboarding Checklist

### When Team Member Leaves

- [ ] Remove from Slack/Discord
- [ ] Revoke GitHub access
- [ ] Remove from 1Password vaults
- [ ] Rotate credentials they had access to
- [ ] Transfer assigned issues
- [ ] Document knowledge transfer

---

## Emergency Contacts

| Role | Name | Phone | Email | Availability |
|------|------|-------|-------|--------------|
| Project Manager | [Name] | +90 5XX XXX XXXX | pm@goalgpt.com | 24/7 |
| Backend Lead | [Name] | +90 5XX XXX XXXX | backend@goalgpt.com | Working hours |
| Mobile Lead | [Name] | +90 5XX XXX XXXX | mobile@goalgpt.com | Working hours |
| DevOps | [Name] | +90 5XX XXX XXXX | devops@goalgpt.com | On-call rotation |

---

## Phase 0 Team Setup Checklist

### Communication
- [ ] Slack/Discord workspace created
- [ ] All channels set up
- [ ] Team members invited
- [ ] Daily standup scheduled
- [ ] Sprint planning scheduled

### Documentation
- [ ] Notion/Confluence workspace created
- [ ] Master plan uploaded
- [ ] API documentation started
- [ ] Design specs shared

### Tools
- [ ] GitHub repository access granted
- [ ] 1Password vaults created
- [ ] CI/CD pipelines configured (Phase 13)

### Team
- [ ] Roles assigned
- [ ] Responsibilities documented
- [ ] Meeting schedule agreed
- [ ] Emergency contacts listed

---

**✅ Team Setup Complete When:**
- All communication channels active
- First standup completed
- All team members onboarded
- Documentation accessible to all
- Emergency procedures understood

**Next:** Begin Phase 1 - Database Migration
