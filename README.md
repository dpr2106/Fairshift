# FairShift — Decent Work, Safety & Transparency Platform
> **Prompt Wars 2026 Hackathon | ACM Student Chapter, SRMIST**  
> **Theme:** UN SDG 8 — Decent Work and Economic Growth  
> **Target Industries:** Construction Sites & Healthcare Facilities

[![Automated Tests](https://img.shields.io/badge/tests-22%20passed%2C%200%20failed-brightgreen.svg)]()
[![Platform](https://img.shields.io/badge/runtime-Node%20v22%20%7C%20TypeScript%20%7C%20React-blue.svg)]()
[![Deployment](https://img.shields.io/badge/Vercel-Deployment%20Ready-black.svg)]()
[![Database](https://img.shields.io/badge/database-Neon%20PostgreSQL%20%7C%20Live%20Persistence-brightgreen.svg)]()
[![SDG 8](https://img.shields.io/badge/UN%20SDG%208-Decent%20Work-emerald.svg)]()

---

## 1. Executive Summary & Problem Context

Employee-intensive sectors—notably **construction sites** and **hospitals**—continue to rely on paper muster registers, spreadsheets, and informal messaging groups. This causes systemic friction:
- **For Blue-Collar Workers:** Unclear pay calculations, unrecorded overtime, fear of retaliation when reporting workplace safety hazards, and lack of portable credentials.
- **For Employers & Site Managers:** Zero real-time visibility into excessive consecutive hours, delayed escalation of acute physical hazards, and unverified skill backgrounds.
- **Accessibility Gaps:** Workers primarily communicate in regional languages (e.g., Tamil), have varying literacy levels, and operate basic smartphones on congested cellular links.

**FairShift** bridges this divide as an accessible, mobile-first, dual-portal platform that enforces mathematical wage transparency, verified QR attendance, non-retaliatory safety reporting with lifecycle tracking, and non-punitive fatigue advisories.

---

## 2. Core Implemented Features

### Feature A: Shift Tracking & Verified Attendance
- **Physical QR Token Validation:** Prevents fraudulent check-ins by validating against site-issued QR tokens.
- **Overnight Calendar-Day Math:** Accurately computes shifts that cross midnight (e.g., 20:00 to 05:00) without negative timestamps.
- **Configurable Overtime Calculations:** Automatically isolates standard hours (up to 8.0h daily threshold) from overtime hours based on organizational parameters.
- **Dual Status Workflow:** Distinguishes real-time recorded entries from manager-audited approvals (`Pending Review` → `Approved` / `Disputed`).

### Feature B: Mathematically Transparent Wage Estimates
- **Itemized Calculation Estimates:** Displays base pay, demonstration 1.5x overtime multiplier, EPF (12% retirement corpus estimate), ESIC (0.75% healthcare cover estimate), and Construction Welfare Fund cess. All payslips are explicitly labeled as demonstration estimates derived from workplace configuration rather than statutory legal certifications.
- **Interactive "Why is my pay this amount?" Explainer:** Translates mathematical deductions and gross/net calculations into plain language.
- **Text-to-Speech (TTS) Readout:** Built-in speech synthesis reads payslip breakdowns aloud in English or Tamil for low-literacy workers.

### Feature C: Safety Hazard Command Center
- **Dynamic Category Taxonomies:** Adapts hazard categories based on industry (e.g., *Scaffold Fall Hazard*, *Exposed 415V Wiring* for Construction; *Sharps Exposure*, *Corrosive Chemical Spill* for Healthcare).
- **Voice-to-Text Recording:** Integrates the browser Web Speech API for spoken hazard descriptions with microphone animation.
- **Emergency Service Separation:** Explicitly displays life-safety emergency guidance (112/emergency response) to prevent misusing hazard tickets for active fires or collapses.
- **Audit Lifecycle State Machine:** `Submitted` → `Under Review` → `Action Required` → `Resolved` with inspector assignment and resolution notes.

### Feature D: Confidential & Anonymous Workplace Voice
- **Identity Detachment & Anonymous Feedback:** Strictly decouples worker identity from feedback submissions (omitting worker ID, telephone, and IP address) to provide retaliation-free reporting without unsupported claims of zero-knowledge cryptography.
- **Aggregated Management Insights:** Displays macro sentiment distributions without individual worker attribution.

### Feature E: Non-Punitive Fatigue & Rest Advisories
- **Proactive Guardrails:** Triggers human-in-the-loop warnings when shifts exceed 10 consecutive hours or when rest gaps between shifts drop below 11 hours.
- **Non-Punitive Advisory Model:** Alerts require supervisors to grant compensatory rest rather than penalizing workers.

### Feature F: Portable Skill Passport
- **Accredited Verification:** Distinguishes worker-entered skills from employer-verified certifications stamped by accredited bodies (e.g., L&T CSTI, NABH Infection Control).

---

## 3. Multi-Industry Support (Demonstration Datasets)

> **Demonstration Notice:** *All organizations, personas (e.g., "Apex Metro Infrastructure", "Kaveri Multi-Speciality Hospital"), attendance logs, and ticket histories in this repository are synthetic demonstration data created specifically for Prompt Wars 2026 hackathon evaluation.*

| Configuration Dimension | 🏗️ Construction (*Apex Metro Infra — Demo*) | 🏥 Healthcare (*Kaveri Multi-Speciality — Demo*) |
| :--- | :--- | :--- |
| **Example Roles** | Mason / High-Rise Rigger, Site Electrician, Safety Marshall | Sanitation Specialist, Biohazard Tech, Auxiliary Nurse |
| **Shift Types** | Day Pour (08:00–17:00), Overnight Gantry Launch (20:00–05:00) | ICU Sanitation (06:00–14:30), Overnight ER Trauma (21:30–06:30) |
| **Specific Hazards** | Scaffold plank displacement, ungrounded 415V generator cable | Overflowing sharps containers, HVAC chemical leak |
| **Fatigue Thresholds** | >10h high-elevation work, <11h recovery gap | >27h cumulative night shift clustering |

---

## 4. Accessibility & Regional Language Support

- **Bilingual Interface:** Instant switching between **English** and **Tamil (தமிழ்)** with authentic translated UI strings.
- **Accessible Ergonomics:** Minimum 48px × 48px touch targets, visible keyboard focus indicators (`:focus-visible`), and high-contrast color palettes designed towards WCAG 2.2 AA accessibility guidelines.
- **Voice Fallback:** Spoken hazard descriptions and audio payslip synthesis for low-literacy workers.

---

## 5. Automated Verification & Test Suite

The project includes unit, integration, and security tests executing natively via Node's test runner:

```bash
npm test
```

### Test Coverage Summary (22 Tests Passed, 0 Failed):
- ✔ GET /health returns healthy status, service name, and database mode
- ✔ Rejects forged session tokens or altered payloads with 401 Unauthorized
- ✔ GET /api/shifts rejects unauthenticated request without token
- ✔ Workers are strictly forbidden from approving attendance or creating shifts
- ✔ Construction worker cannot check in or access records of Healthcare organization
- ✔ Check-in rejects invalid QR token
- ✔ Workplace feedback strictly detaches identity and stores no workerId
- ✔ Generated payslip has estimate status and itemized calculation notes
- ✔ Rejects x-user-id header without Bearer token with 401 Unauthorized
- ✔ GET /api/auth/users strictly sanitizes sensitive personal contact and wage information
- ✔ POST /api/system/reset rejects unauthenticated calls and non-manager workers
- ✔ Fails safely when SESSION_SECRET is missing or default in production
- ✔ GET /api/skills strictly prevents managers from accessing skills of workers in another organization
- ✔ PATCH /api/skills/:id/verify prevents managers from verifying skills of workers in another organization
- ✔ GET /api/attendance returns only records belonging to the manager organization
- ✔ GET /api/skills without workerId parameter returns only skills belonging to workers in manager organization
- ✔ Shift duration calculates correct regular hours for standard 8h day shift
- ✔ Overnight shift correctly computes across midnight boundary with overtime
- ✔ Rejects invalid checkout time that is before checkin time
- ✔ Transparent payslip calculates base pay, statutory 1.5x overtime, EPF and ESIC correctly
- ✔ Fatigue alert triggers when shift duration exceeds 10 hours
- ✔ Fatigue alert triggers when rest between shifts is less than mandatory 11 hours

**Result: 22 tests passed, 0 failed.**

---

## 6. Real PostgreSQL Persistence & Vercel Deployment

### Database Architecture: Neon PostgreSQL
- **Serverless PostgreSQL Driver:** Connects using `@neondatabase/serverless` with connection pooling over standard secure HTTPS/WebSocket (port 443), fully compatible with serverless functions and restrictive networks.
- **Real Asynchronous Queries:** All Express API endpoints are asynchronous and persist state directly to Neon PostgreSQL across all 9 entities:
  `organizations`, `users`, `shifts`, `attendance`, `payslips`, `safety_reports`, `workplace_feedback`, `fatigue_alerts`, and `skills`.
- **Atomic Migrations:** Schema defined in `server/migrations/001_initial_schema.sql` creates all 9 tables with foreign keys and indexes. Run via:
  ```bash
  npm run migrate
  ```
- **Verified Persistence:** Reads and writes are executed via parameterized SQL queries with verified record retrieval across independent requests.

### Vercel Serverless Deployment Architecture
The repository is pre-configured with `vercel.json` and a serverless API entry point (`api/index.ts`) for single-command or Git-integrated Vercel deployment:

1. **Frontend:** React + Vite builds to `dist/client`. Static assets and SPA routes are routed via Vercel rewrites.
2. **Backend API:** Express serverless function (`api/index.ts`) handles all `/api/*` and `/health` requests.
3. **SPA Routing:** Configured rewrite rules ensure client-side navigation and direct page refreshes resolve seamlessly.

#### Environment Variables Required in Vercel:
Configure these in **Vercel Project Settings → Environment Variables**:
- `DATABASE_URL`: Your pooled Neon PostgreSQL connection string (`postgresql://...sslmode=require`).
- `SESSION_SECRET`: A high-entropy cryptographic secret (minimum 32 characters) for HMAC token signing.
- `DEMO_MODE`: Set to `true` to enable hackathon persona switching and sample data for evaluators.
- `NODE_ENV`: Set to `production`.

---

## 7. Official Hackathon Evaluation Rubric Alignment

| Criterion | Implementation in FairShift | Verification Evidence |
| :--- | :--- | :--- |
| **1. Real-World Impact** | Replaces paper muster rolls with validated QR check-ins, audited payslips, and actionable hazard triage. | Live Worker & Employer portals sharing a single persistent relational data model. |
| **2. Relevance to SDG 8** | Directly targets Decent Work & Economic Growth by curbing uncompensated overtime and preventing fatal accidents. | Automated EPF/ESIC social protection itemization & fatigue rest flags. |
| **3. Inclusivity & Ease of Use** | Mobile-first architecture, large touch targets, English/Tamil bilingual interface, voice-to-text, and TTS payslip readout. | Verified in mobile viewport and browser testing. |
| **4. Technical Implementation** | Clean TypeScript architecture, strict RBAC, automated unit & integration tests, Cloud Run Dockerfile. | 18/18 automated test pass rate; zero external native compilation dependencies. |
| **5. Feasibility & Scalability** | Configurable multi-industry engine supporting both Construction and Healthcare out-of-the-box. | Seamless industry toggle adjusting roles, hazards, and workflows. |

---

## 8. LinkedIn Post Draft

```text
🚀 Excited to share FairShift — built for Prompt Wars 2026 organized by the ACM Student Chapter, SRMIST!

Workforce exploitation and safety oversights remain a massive challenge in employee-intensive sectors like construction and healthcare. Millions of workers still rely on paper registers and WhatsApp groups, resulting in unpaid overtime, unaddressed hazards, and zero portable career records.

FairShift solves this directly under UN SDG 8 (Decent Work and Economic Growth):
✅ Transparent Payslips: Line-by-line wage calculations, configurable 1.5x overtime estimates, and text-to-speech audio readouts.
✅ Shift & Attendance Tracking: Validated site QR verification with overnight shift handling.
✅ Safety Command Center: Retaliation-free hazard reporting with voice input and an audit lifecycle.
✅ Fatigue Advisories: Proactive rest gap monitoring to prevent accidents before they occur.
✅ Cross-Sector Agnostic: Configured for Construction Sites (Apex Metro) and Healthcare Facilities (Kaveri Hospital).
✅ Regional Language Inclusivity: Full bilingual support in English and Tamil (தமிழ்).

Tech Stack: TypeScript, Express, React, Vite, Neon Serverless PostgreSQL, and Vercel.

Check out our submission and live platform!
#PromptWars2026 #SRMIST #ACM #DecentWork #SDG8 #Neon #PostgreSQL #Vercel #WebDevelopment #TypeScript #SocialImpact
```

---

## 9. Submission Checklist

- [x] **Public GitHub Repository URL:** Ending explicitly in `.git`
- [x] **Single Branch Status:** Only 1 branch (`main`)
- [x] **Initial Repository Size:** Strictly under 10 MB (clean source code without node_modules/build artifacts)
- [x] **Zero Exposed Credentials:** No secrets or private keys in source
- [x] **Database Persistence:** Real asynchronous Neon PostgreSQL queries across all 9 schema entities
- [x] **Deployment Target:** Vercel serverless + SPA deployment configuration (`vercel.json`, `api/index.ts`)
- [x] **Test Results:** 22 automated unit, integration, and security tests passing
