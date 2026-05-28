# Product Requirements Document
## LinkedIn Auto-Connect Tool — Browser Extension

**Version:** 1.0  
**Status:** Draft  
**Author:** [Your Name]  
**Date:** May 26, 2026

---

## 1. Executive Summary

Professionals trying to grow their LinkedIn network face a deeply manual, time-consuming process. Sending individual connection requests one-by-one — especially through niche sources like college alumni pages — makes meaningful network growth impractical at scale. This tool is a browser extension that runs directly on LinkedIn's live website to automate and accelerate the connection-request workflow, allowing a user to go from ~500 connections to a well-connected professional network in days rather than months.

---

## 2. Problem Statement

### Current Pain Points

- Sending a connection request on LinkedIn requires 3–5 clicks per person (visit profile → click Connect → add note → send).
- Growing from 500 to 1,000+ connections organically by visiting the Alumni section takes weeks of repetitive manual effort.
- There is no native LinkedIn feature to batch-send requests to people who match a profile (same college, same field, same graduation year).
- Users lose context — they forget who they've already requested, who declined, and who accepted.
- LinkedIn's weekly connection limit (~100–200 invitations) means careless bulk-sending can exhaust the quota on wrong targets.

### Who This Is For

A college student or early-career professional with ~500 LinkedIn connections who wants to rapidly grow their network within a specific domain — peers from the same college, people in the same industry, or alumni of the same program.

---

## 3. Goals & Non-Goals

### Goals

- Reduce the time to send 20+ targeted connection requests from 30 minutes → under 2 minutes.
- Let the user define a target audience (college alumni, industry, graduation year, location) and auto-send to all matching results on the current LinkedIn page.
- Surface a live dashboard showing requests sent, accepted, pending, and weekly quota remaining.
- Prevent account flags by introducing human-like delays and respecting LinkedIn's rate limits.

### Non-Goals

- This tool will NOT scrape or store LinkedIn profile data to any external server.
- It will NOT send automated messages or InMails (only connection requests with optional notes).
- It will NOT bypass LinkedIn's CAPTCHA or security systems.
- It will NOT work outside of LinkedIn.com.

---

## 4. Solution Overview

A **Chrome (and Edge) browser extension** that injects a lightweight control panel into LinkedIn pages. When the user navigates to any LinkedIn people-listing page (Alumni search, "People You May Know", search results, etc.), the extension detects all visible "Connect" buttons, queues them intelligently, and fires them with human-like pacing.

---

## 5. Core Features

### 5.1 One-Click Batch Connect

**Description:** A floating "Auto-Connect" button appears on any LinkedIn page that lists people with Connect buttons.

**Behavior:**
- On click, the extension scans the visible DOM for all available "Connect" buttons.
- It queues each one and fires them sequentially with a randomized delay of 4–9 seconds between each request (to mimic human behavior).
- After sending, it scrolls down, loads more results, and continues until the page is exhausted or the user-set limit is reached.

**User Controls:**
- Set a per-session limit (e.g., max 20 requests at a time).
- Pause / Resume / Stop at any point.
- Toggle to include a personalized note with each request (template-based, e.g., "Hi [First Name], I'm also a [College] alum in [Field] — would love to connect!").

### 5.2 Alumni Page Targeting

**Description:** When the user is on LinkedIn's Alumni search page (`linkedin.com/school/.../alumni`), the extension surfaces filter presets to narrow the audience before batch-connecting.

**Filter Options (mirrors LinkedIn's own filters):**
- Graduation year range
- Where they work (company/industry)
- Where they live (city/country)
- What they studied (field of study)

The extension auto-applies these filters and then activates batch-connect on the results.

### 5.3 Weekly Quota Tracker

**Description:** LinkedIn limits connection invitations (approximately 100–200/week for free accounts). The extension tracks how many requests have been sent in the current rolling 7-day window and warns the user before they hit the limit.

**Dashboard shows:**
- Requests sent this week / estimated weekly limit
- Requests accepted (pulled from LinkedIn's "My Network" page)
- Requests pending
- Estimated days until quota resets

### 5.4 Smart Deduplication

**Description:** The extension maintains a local log (stored in `chrome.storage.local`) of every profile URL where a request was already sent. It automatically skips these profiles in future sessions so the user never double-requests.

### 5.5 Personalized Note Templates

**Description:** Users can pre-write 1–3 note templates with variable placeholders. The extension fills them in per-request.

**Supported variables:**
- `{first_name}` — pulled from the profile card on the page
- `{college}` — user-defined in settings
- `{field}` — user-defined in settings

**Example template:**
> "Hi {first_name}, I'm also a [College] student in {field} — would love to connect and exchange notes!"

---

## 6. Technical Architecture

### 6.1 Extension Components

| Component | Technology | Role |
|---|---|---|
| Manifest | `manifest.json` (MV3) | Permissions, content script injection |
| Content Script | JavaScript | DOM interaction on LinkedIn pages |
| Background Service Worker | JavaScript | Queue management, rate limiting, storage sync |
| Popup UI | React or plain HTML/CSS/JS | Settings panel and live dashboard |
| Storage | `chrome.storage.local` | Sent-request log, templates, quota data |

### 6.2 How It Works on LinkedIn's Live Website

The extension operates entirely client-side — it does not call any external APIs or route traffic through a backend server. It:

1. Injects a content script when the user visits `*.linkedin.com/*`.
2. Observes the page DOM for recognizable LinkedIn UI patterns (the "Connect" button, profile name, profile URL).
3. Interacts with those elements programmatically (click events) just as a user would.
4. Logs actions to local extension storage.

No LinkedIn credentials, cookies, or profile data are ever transmitted to any external server.

### 6.3 Rate Limiting Strategy

To avoid triggering LinkedIn's bot-detection:

- Randomized delay between each click: 4–9 seconds (configurable).
- Maximum 20 requests per session by default (configurable up to 40).
- Mandatory cool-down if 10 requests are sent within 5 minutes.
- Extension stops automatically if LinkedIn serves a CAPTCHA or "suspicious activity" notice.

---

## 7. User Flow

```
User installs extension
        ↓
User navigates to LinkedIn Alumni Page
(linkedin.com/school/[college]/alumni)
        ↓
Extension detects page → shows floating "Auto-Connect" panel
        ↓
User sets filters (graduation year, field, location)
        ↓
User sets session limit (e.g., 25 requests)
        ↓
User picks note template (optional)
        ↓
User clicks "Start Auto-Connect"
        ↓
Extension queues visible Connect buttons
→ clicks each with random delay
→ scrolls & loads more results
→ stops at session limit or page end
        ↓
Dashboard shows: 25 sent | 0 accepted (updates as acceptances come in)
        ↓
User repeats next day / next session
```

---

## 8. UI / UX Requirements

### Floating Panel (injected on LinkedIn pages)

- Compact, non-intrusive panel anchored to the bottom-right corner.
- Shows: Session progress bar, requests sent counter, stop button.
- Visually distinct from LinkedIn's own UI (different color scheme, labeled clearly as "Auto-Connect Tool").

### Extension Popup (clicking the extension icon)

- Tab 1 — **Dashboard:** Weekly quota usage, total connections sent/accepted/pending.
- Tab 2 — **Templates:** Add/edit personalized note templates.
- Tab 3 — **Settings:** Default delay range, max per session, toggle note sending on/off.

### Design Principles

- Never feel like a bot — all UI language should feel manual and intentional (e.g., "Send to these 24 people" not "Mass blast").
- Warn clearly before any action that could risk the user's LinkedIn account.
- One-click undo for the last batch (withdraws requests sent in the last session).

---

## 9. Permissions Required

| Permission | Why It's Needed |
|---|---|
| `activeTab` | Read current LinkedIn page DOM |
| `scripting` | Inject content script to interact with LinkedIn UI |
| `storage` | Save sent-request log, templates, quota data locally |
| `host_permissions: linkedin.com` | Run on LinkedIn pages only |

No `tabs`, `history`, `cookies`, or any broad permissions required.

---

## 10. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| LinkedIn updates DOM structure, breaking selectors | High | Use multiple fallback selectors; monitor for breakage; publish updates quickly |
| LinkedIn detects bot-like behavior and restricts account | Medium | Human-like delays, session caps, stop-on-CAPTCHA logic |
| LinkedIn ToS violation | Medium | Clear in-app disclaimer; tool only automates clicks, does not scrape or store data externally |
| Chrome Web Store rejection | Low | Extension requests minimal permissions; operates entirely client-side |
| User accidentally exhausts weekly invite quota | Low | Hard limit at 80% of estimated quota with a warning prompt |

---

## 11. Success Metrics

| Metric | Target (30 days post-launch) |
|---|---|
| Time to send 20 connection requests | < 3 minutes (down from ~25 minutes) |
| User's total connection count growth | +200 connections/month for active users |
| Extension crash / breakage incidents | < 2 per month |
| Weekly quota exhaustion events | < 5% of active user sessions |
| User retention (weekly active) | > 60% of installs |

---

## 12. Milestones & Timeline

| Phase | Deliverable | Timeline |
|---|---|---|
| Phase 1 | Core batch-connect on Alumni page (no notes, no dashboard) | Week 1–2 |
| Phase 2 | Note templates + deduplication log | Week 3 |
| Phase 3 | Quota tracker + popup dashboard | Week 4 |
| Phase 4 | Filter presets for Alumni page | Week 5 |
| Phase 5 | Testing, rate-limit hardening, Chrome Web Store submission | Week 6–7 |

---

## 13. Out of Scope (Future Versions)

- Firefox / Safari support
- Auto-messaging after connection is accepted
- AI-generated personalized notes per profile
- Analytics export (CSV of connections made)
- Support for LinkedIn Recruiter or Sales Navigator pages

---

## 14. Open Questions

1. Should the extension work on mobile (LinkedIn PWA)? *(Likely out of scope for v1)*
2. What is the exact weekly invite limit for free vs. Premium LinkedIn accounts? *(Needs validation — currently estimated at 100–200/week)*
3. Should note-sending be opt-in (default off) to reduce friction and risk? *(Recommended: yes)*
4. Do we publish on Chrome Web Store or distribute as an unpacked extension? *(Web Store preferred for trust)*

---

*This PRD is a living document. Update version and status as the product evolves.*
