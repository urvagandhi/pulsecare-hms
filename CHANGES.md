# PulseCare HMS - Change Log & Audit Trace

- **Base Repository:** https://github.com/all3n2601/Hospital-Management-System-MERN-Stack
- **Upstream License:** Apache License 2.0
- **Fork / Assignment Date:** 2026-10-06
- **Student Engineering Team:** Urva (Backend Owner), Rakshit (Frontend Owner)
- **Target Scope:** 4 Core Modules (Patient Registration & Management, Doctor & Department Management, Appointment Booking & Scheduling, Billing & Invoice)

---

## Preflight Findings (Phase 0)

### Baseline Verification (Phase 0.1)
- **Backend Type-Check (`npx tsc --noEmit`):**
  - Found 6 compiler errors: 2 in `src/models/User.ts:85,86` (`TS2790: The operand of a 'delete' operator must be optional`), and 4 in `src/migrations/001-consolidate-auth.ts:192,208,279,294` (`TS2352: Conversion ... may be a mistake`).
- **Backend Tests (`TZ=Asia/Kolkata npm test`):**
  - 1 suite passed (`src/tests/health.test.ts`), 12 suites failed due to TS2790 in `User.ts` under `ts-jest` and MongoMemoryServer binary extraction hook timeout (exceeded default 5000ms timeout in `jest.config.js`). Total time: 102.46s.
- **Frontend Type-Check (`npx tsc --noEmit`):**
  - Passed with 0 errors.
- **Frontend Build (`npm run build`):**
  - Resolved Tailwind CSS version mismatch (`package-lock.json` lock to 3.4.19). `npm run build` passes with 0 errors in 8.02s.

---

### Preflight Code Audit Questions (Phase 0.2)

- **Q1: Does `POST /auth/register` accept a `role` field from the request body? Can an anonymous caller obtain a non-patient account?**
  - *Finding:* No. `RegisterSchema` in `backend/src/modules/auth/schema.ts` does not define `role`. Furthermore, `registerUser` in `backend/src/modules/auth/service.ts:38-42` hardcodes `role: 'patient'` when calling `User.create()`. Anonymous callers cannot obtain a non-patient account.
- **Q2: Which endpoints does `pages/admin/Dashboard.tsx` call? Which of those return 403 for the receptionist role?**
  - *Finding:* Calls `GET /patients?limit=1000`, `GET /appointments?date=today&limit=5`, `GET /appointments?status=scheduled,confirmed&limit=5`, `GET /billing/revenue-mtd`, `GET /lab/orders?status=pending,processing&limit=5`, and `GET /inventory?belowReorder=true&limit=1`.
  - For receptionist, `GET /lab/orders` returns 403 Forbidden (`MATRIX['lab']['receptionist'] === false`), `GET /inventory` returns 403 Forbidden (`MATRIX['inventory']['receptionist'] === false`), and `/billing/revenue-mtd` fails with 404/NotFoundError because that route is unmounted on the billing router.
- **Q3: Is there ANY page where admin/receptionist can list appointments, book on behalf of a patient, or change status?**
  - *Finding:* No. In `frontend/src/App.tsx`, appointment routes only exist under `/patient/` (`/patient/book-appointment`, `/patient/appointments`). In `frontend/src/pages/admin/`, there is no appointment management page. `Dashboard.tsx` contains an unrouted quick-action link to `/admin/appointments`. Staff currently have no UI to manage or book appointments.
- **Q4: Do `Dockerfile`s, `package.json` scripts/`main`, or compose files reference the legacy root JS? Does any TS file import them?**
  - *Finding:* `backend/package.json:5` specifies `"main": "server.js"`. `backend/Dockerfile` specifies `CMD ["node", "dist/server.js"]` (the compiled output of `src/server.ts`). Docker compose files reference the Dockerfile.
  - Zero TypeScript files in `backend/src/` import legacy JS from `backend/controllers`, `backend/models`, or `backend/middlewares`. In `frontend/src/`, `AuthInitializer.tsx` is imported, but the 4 `.jsx` files in `components/Auth/` and all 4 `.jsx` files in `components/Patient/` are completely unimported.
- **Q5: Where is a patient's phone stored, and exactly how does `patients/service.ts` implement search?**
  - *Finding:* Primary phone is stored on the `User` model (`User.phone`), while emergency contact phone is in `Patient.emergencyContact.phone`.
  - In `backend/src/modules/patients/service.ts:78-90`, search runs `User.find({ role: 'patient', $or: [{ firstName: new RegExp(search, 'i') }, { lastName: new RegExp(search, 'i') }, { email: new RegExp(search, 'i') }] })` and filters `Patient.find({ userId: { $in: userIds } })`. It completely misses `patientId` (`PAT-XXXX`) and phone numbers, and does not escape regex metacharacters in user input.
- **Q6: List every use of Redis and what each does when Redis is unavailable.**
  - *Finding:*
    1. `backend/src/server.ts:22`: Calls `await connectRedis()`. If Redis connection fails, the process exits with fatal error code 1.
    2. `backend/src/middleware/rateLimiter.ts:21`: Calls `getRedisClient()`. If Redis is uninitialized or errors, the catch block logs a warning and fails open (calls `next()`), disabling rate limiting entirely.
    3. `backend/src/socket/index.ts:26-27`: Calls `getRedisClient().duplicate()`. If Redis is uninitialized, Socket.io initialization crashes.
- **Q7: Where does `DashboardRouter` send a `nurse` user, and which sign-up/staff-create UI options expose the Nurse role?**
  - *Finding:* `DashboardRouter` in `frontend/src/App.tsx:54` redirects `nurse` to `/nurse/dashboard`. `SignUp.tsx` does not expose any role selector (registers patients only). However, `AdminStaff` in `frontend/src/pages/admin/Staff.tsx:296` includes `<option value="nurse">Nurse</option>` in the staff creation dropdown.
- **Q8: How is "day of week" computed in (a) booking validation and (b) the available-slots listing? Are they consistent? Are dates stored/parsed as UTC?**
  - *Finding:*
    - In `appointments/service.ts:59`: `dayOfWeek = DAY_NAMES[appointmentDate.getDay()]` (uses local system time).
    - In `appointments/service.ts:159`: `dayOfWeek = DAY_NAMES[new Date(date).getDay()]` (uses local system time).
    - Normalized appointment dates in DB are stored at midnight UTC (`new Date(input.date + 'T00:00:00.000Z')`). Local `.getDay()` drifts across day boundaries for timezones with large offsets from UTC.
- **Q9: Which retained code imports from `lab`, `pharmacy`, `inventory`, `documents`, or `settings` modules?**
  - *Finding:*
    - `backend/src/services/pdfService.ts:2` imports `IDocument` from `../models/Document`.
    - `backend/src/server.ts:10` imports and calls `startInventoryJobs()`.
    - `backend/src/modules/analytics/service.ts` imports `LabOrder`, `Prescription`, `LabResult`, `Drug`.
    - `frontend/src/pages/admin/Dashboard.tsx` queries `/lab/orders` and `/inventory`, and renders a lab orders widget.

---

## Tasks Progress Table

| Task | Status | Files Touched | Commit | Notes |
|---|---|---|---|---|
| **0.0 Preflight** | DONE | `CHANGES.md` | - | Baseline tests recorded; Q1–Q9 answered |
| **1.1 Seed script** | DONE | `backend/src/scripts/seed.ts`, `backend/package.json`, `backend/src/models/User.ts`, `backend/src/migrations/001-consolidate-auth.ts` | `f750c33` | Idempotent dummy seeder created with 1 Admin, 1 Receptionist, 3 Doctors, 3 Departments, 5 Patients, 8 Appointments, 3 Invoices. Verified login for all seeded accounts. |
| **1.2 Redis optional** | DONE | `backend/src/config/env.ts`, `backend/src/db/redis.ts`, `backend/src/middleware/rateLimiter.ts`, `backend/src/middleware/rateLimiter.test.ts`, `backend/src/socket/index.ts` | `6ad671e` | Added REDIS_ENABLED env toggle (default true). Graceful in-memory rate limiter and Socket.IO fallback when Redis is unreachable or disabled. Added unit tests for fallback and 429 response. |
| **1.3 Lock down registration** | DONE | `backend/src/modules/auth/schema.ts`, `backend/src/modules/auth/service.ts`, `backend/src/modules/auth/tests/auth.test.ts` | `f8b1f38` | Strictly locked down public registration to role 'patient'. Added Zod refinement rejecting non-patient role attempts with 400 VALIDATION_ERROR. Stripped role field in service layer. Added unit tests for role lockdown. |
| **1.4 Timezone-safe availability** | DONE | `backend/src/utils/dateUtils.ts`, `backend/src/utils/dateUtils.test.ts`, `backend/src/modules/appointments/service.ts`, `backend/src/modules/staff/service.ts` | `6b528f8` | Added timezone-safe dateUtils (parseUtcMidnight, getUtcDayOfWeek). Harmonized appointment booking, slot listing, and doctor availability search to UTC midnight and UTC day-of-week. Verified tests pass under both TZ=Asia/Kolkata and TZ=UTC. |
| **1.5 Test config & secrets guard** | DONE | `backend/jest.config.js`, `backend/src/config/secrets.ts`, `backend/src/config/secrets.test.ts`, `backend/.env.example`, `frontend/.env.example` | `dc94c5f` | Set default testTimeout to 30000 in jest.config.js. Added validateSecretsGuard throwing clear fatal error if dev default JWT secrets are used in production. Created comprehensive backend/.env.example and frontend/.env.example. |
| **2.1 Backend unmounting** | DONE | `backend/src/routes/index.ts`, `backend/src/server.ts`, `backend/src/modules/analytics/router.ts`, `backend/src/modules/analytics/tests/analytics.test.ts`, `backend/src/tests/unmounted.test.ts` | `f0cd8f8` | Unmounted lab, pharmacy, inventory, documents, and settings routers. Removed startInventoryJobs(). Trimmed analytics router to appointments & revenue only. Preserved surplus tests with describe.skip. Verified 404 on unmounted paths and 124 passing active tests. |
| **2.2 Frontend trimming & nav** | DONE | `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/App.tsx` | `f88a0dd` | Trimmed navigation and routes to 4 core modules. Role-correct items verified for Admin, Doctor, Receptionist, Patient without dead links. Unmounted surplus pages preserved. |
| **2.3 Dashboard fix** | DONE | `frontend/src/pages/admin/Dashboard.tsx` | `c2a61d0` | Removed unmounted `/lab/orders` and `/inventory` queries. Guarded `/analytics/revenue` to admin only; receptionist gets pending invoices attention count and list via `/billing`. Replaced lab widget with 'Invoices Needing Attention' using retained billing endpoints. |
| **2.4 Remove legacy JS** | DONE | `backend/package.json`, `backend/server.js`, `backend/controllers/`, `backend/models/`, `backend/db/`, `backend/middlewares/`, `frontend/src/components/Auth/*.jsx`, `frontend/src/components/Patient/*.jsx` | `82f5a6b` | Confirmed zero imports/references to legacy JS across active TS files, scripts, and Dockerfiles. Removed legacy root JS and legacy jsx folders via `git rm`. Updated `backend/package.json` main entry to `dist/server.js`. Verified backend tests and frontend build pass cleanly. |
| **3.1 Atomic ID counters** | DONE | `backend/src/models/Counter.ts`, `backend/src/models/Counter.test.ts`, `backend/src/models/Patient.ts`, `backend/src/models/Doctor.ts`, `backend/src/models/Appointment.ts`, `backend/src/models/Invoice.ts`, `backend/src/models/Receptionist.ts`, `backend/src/models/Nurse.ts` | `10bc941` | Implemented Counter model with atomic findOneAndUpdate and self-initialization from existing data using $max. Replaced countDocuments in Patient (PAT-xxxx), Doctor (DOC-xxxx), Appointment (APT-xxxx), Invoice (INV-xxxx), Receptionist (REC-xxxx), Nurse (NUR-xxxx). Added 5 concurrency & sequence unit tests. |
| **3.2 Patient search (F7)** | DONE | `backend/src/modules/patients/service.ts`, `backend/src/modules/patients/tests/patients.test.ts`, `frontend/src/pages/admin/Patients.tsx` | `3f99e41` | Implemented regex escaping (escapeRegex) and extended listPatients to search across firstName, lastName, email, primary phone, emergencyContact.phone, and patientId (PAT-xxxx). Updated search placeholder to 'Search by name, email, ID, or phone...' and added Phone column to patient table. Verified 4 search test cases including special characters `(` and `.*`. |
| **3.3 Doctor leave (F2)** | DONE | `backend/src/models/Doctor.ts`, `backend/src/modules/staff/schema.ts`, `backend/src/modules/staff/service.ts`, `backend/src/modules/appointments/service.ts`, `backend/src/modules/appointments/tests/appointments.test.ts`, `frontend/src/pages/admin/Staff.tsx`, `frontend/src/pages/patient/BookAppointment.tsx` | `2fd3b78` | Added Doctor leaves schema (startDate, endDate, reason) with endDate >= startDate validation. Enforced leave window check in booking validation (400) and slot generation (empty slots). Added Doctor Time Off dialog in admin Staff page and unavailable notice in patient booking page. Verified 3 test cases. |
| **3.4 Queue token (F3)** | PENDING | | | |
| **3.5 Itemized invoice (F4)** | PENDING | | | |
| **3.6 Printable PDFs (F5+F3)** | PENDING | | | |
| **3.7 Appointment management staff** | PENDING | | | |
| **4.1 Rebrand** | PENDING | | | |
| **4.2 Landing page** | PENDING | | | |
| **4.3 Documentation** | PENDING | | | |

---

## Blockers
*None currently.*

---

## Known Limitations
1. Doctor and department listing routes reuse the `patients:read` permission in `staff/router.ts`.
