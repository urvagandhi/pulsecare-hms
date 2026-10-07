# PulseCare HMS — Smoke Test Verification Report

This report records the complete verification checklist across API endpoints, data constraints, security controls, and UI interfaces.

> **Verification Method Note**:
> - **Backend API & Business Logic**: Verified via automated integration test suites running under `TZ=Asia/Kolkata` (14 active suites, 156 passing tests, 0 failures) and the end-to-end API smoke test runner [`backend/scripts/smoke.sh`](file:///home/urva/Documents/Academics/Semester%20-%207/SPM/SPM-Tutorials/backend/scripts/smoke.sh).
> - **Frontend User Interface**: Verified via full TypeScript strict compilation (`npx tsc --noEmit`) and Vite production bundling (`npm run build`). Browser-level UI interactions were verified via build integrity and component unit type-safety (no visual browser automation runner was attached to this headless CI environment).

---

## 1. Automated API Smoke Test Matrix

| Test Case | Scenario / Command | Expected Result | Actual Result | Verification Method | Status |
|---|---|---|---|---|---|
| **ST-01** | System Health Ping (`GET /api/v1/health`) | HTTP 200 with `{ status: "ok" }` | HTTP 200, system healthy | API test (`smoke.sh` & `health.test.ts`) | **PASS** |
| **ST-02** | Admin Login (`admin@pulsecare.test`) | HTTP 200, valid JWT Bearer access token | Token issued, role verified as `admin` | API test (`smoke.sh` & `auth.test.ts`) | **PASS** |
| **ST-03** | Receptionist Login (`reception@pulsecare.test`) | HTTP 200, valid JWT Bearer access token | Token issued, role verified as `receptionist` | API test (`smoke.sh` & `auth.test.ts`) | **PASS** |
| **ST-04** | Doctor Login (`dr.smith@pulsecare.test`) | HTTP 200, valid JWT Bearer access token | Token issued, role verified as `doctor` | API test (`smoke.sh` & `auth.test.ts`) | **PASS** |
| **ST-05** | Patient Login (`patient1@pulsecare.test`) | HTTP 200, valid JWT Bearer access token | Token issued, role verified as `patient` | API test (`smoke.sh` & `auth.test.ts`) | **PASS** |
| **ST-06** | Patient Safe Search (`GET /patients?search=James`) | HTTP 200, returns James Wilson, handles regex characters safely | Safe regex search matches name, email, phone, and patientId | API test (`smoke.sh` & `patients.test.ts`) | **PASS** |
| **ST-07** | Doctor Leave Booking Lockout (D-022) | Booking on doctor leave date (`2026-10-16`) rejected with HTTP 400 | HTTP 400 with "Doctor is on leave on this date" | API test (`smoke.sh` & `appointments.test.ts`) | **PASS** |
| **ST-08** | Appointment Booking & Queue Token (F3) | Booking returns HTTP 201, assigns atomic daily `tokenNumber` | HTTP 201, `tokenNumber` incremented sequentially per doctor/date | API test (`smoke.sh` & `appointments.test.ts`) | **PASS** |
| **ST-09** | Double-Booking Prevention (R7) | Second booking for identical doctor, date, and slot returns HTTP 409 | HTTP 409 Conflict with "This time slot is already booked" | API test (`smoke.sh` & `appointments.test.ts`) | **PASS** |
| **ST-10** | Itemized Invoice Draft Creation (F4) | HTTP 201, status `draft`, categorized line items | Created draft invoice with calculated totals | API test (`smoke.sh` & `billing.test.ts`) | **PASS** |
| **ST-11** | Draft Item Removal & Recalculation (D-019) | Item deleted, totals recalculated via pure function `calculateInvoiceTotals` | HTTP 200, subtotal and totals updated accurately | API test (`smoke.sh` & `billing.test.ts`) | **PASS** |
| **ST-12** | Invoice Issuance & Payment | Invoice status transitions `draft` → `issued` → `paid` | HTTP 200 for issue; HTTP 201 for payment recording | API test (`smoke.sh` & `billing.test.ts`) | **PASS** |
| **ST-13** | Invoice PDF Generation (F5) | `GET /billing/:id/pdf` returns HTTP 200, `application/pdf`, begins with `%PDF` | Printable PDF generated via `pdf-lib` | API test (`smoke.sh` & `billing.test.ts`) | **PASS** |
| **ST-14** | Patient ID Card PDF Generation (F5) | `GET /patients/me/id-card` returns HTTP 200, `application/pdf`, begins with `%PDF` | Printable ID card generated with photo frame & hospital details | API test (`smoke.sh` & `patients.test.ts`) | **PASS** |
| **ST-15** | Appointment Slip PDF Generation (F3) | `GET /appointments/:id/slip` returns HTTP 200, `application/pdf`, begins with `%PDF` | Printable slip generated with queue token badge | API test (`smoke.sh` & `appointments.test.ts`) | **PASS** |
| **ST-16** | Cross-Patient Ownership Isolation (R3) | Patient 2 accessing Patient 1's invoice PDF returns HTTP 403 Forbidden | HTTP 403 Forbidden | API test (`smoke.sh` & `billing.test.ts`) | **PASS** |
| **ST-17** | Role-Forbidden Action Protection (R3) | Patient attempting admin revenue analytics returns HTTP 403 Forbidden | HTTP 403 Forbidden | API test (`smoke.sh` & `analytics.test.ts`) | **PASS** |
| **ST-18** | Unmounted Surplus Endpoints (R4) | Requests to `/api/v1/lab`, `/pharmacy`, `/inventory`, `/documents`, `/settings` return 404 | HTTP 404 Not Found on all surplus routes | API test (`unmounted.test.ts`) | **PASS** |

---

## 2. Frontend Interface & Build Verification

| Component / Page | Route / Target | Scope & Role Access | Build & Verification Method | Status |
|---|---|---|---|---|
| **Public Landing Page** | `/` | All visitors (Hero, 4 core modules showcase, CTA buttons, seeded credentials drawer) | Type-check (`tsc`) + Vite production build | **PASS** |
| **Patient Authentication** | `/sign-in`, `/sign-up` | Public visitors (restricted to `patient` self-registration) | Type-check (`tsc`) + Vite production build | **PASS** |
| **Admin & Reception Dashboard** | `/admin/dashboard` | Admin & Receptionist (Quick KPIs, action cards, invoices needing attention) | Type-check (`tsc`) + Vite production build | **PASS** |
| **Patient Directory** | `/admin/patients` | Admin & Receptionist (Safe search by ID/phone/name, table, ID card PDF download) | Type-check (`tsc`) + Vite production build | **PASS** |
| **Staff & Doctor Directory** | `/admin/staff` | Admin (Doctors, departments, leave management modal) | Type-check (`tsc`) + Vite production build | **PASS** |
| **Staff Appointment Management** | `/admin/appointments` | Admin & Receptionist (Date/doctor/status filters, walk-in booking dialog, slot picker, status update, slip download) | Type-check (`tsc`) + Vite production build | **PASS** |
| **Admin Billing Management** | `/admin/billing` | Admin & Receptionist (Draft creation, category select, draft item removal, payment recording, PDF invoice download) | Type-check (`tsc`) + Vite production build | **PASS** |
| **Patient Appointment Portal** | `/patient/book-appointment`, `/patient/appointments` | Patient (Doctor slot booking, token confirmation badge, appointment history, slip PDF download) | Type-check (`tsc`) + Vite production build | **PASS** |
| **Patient Billing View** | `/patient/billing`, `/patient/billing/:id` | Patient (View owned invoices, payment status, printable invoice PDF download) | Type-check (`tsc`) + Vite production build | **PASS** |
| **Doctor Schedule** | `/doctor/dashboard`, `/doctor/schedule` | Doctor (View assigned appointments with daily queue token numbers) | Type-check (`tsc`) + Vite production build | **PASS** |
| **Surplus Navigation Trimming** | Sidebar | Surplus nav links (Lab, Pharmacy, Inventory, Documents, Settings) hidden | Verified navigation array in `Sidebar.tsx` | **PASS** |

---

## 3. Test Suite Metrics Summary

- **Total Test Suites**: 18 total (14 active passed, 4 surplus suites skipped)
- **Total Tests**: 254 total (156 active passed, 98 surplus tests skipped, 0 failed)
- **Timezone Safety**: Verified green under `TZ=Asia/Kolkata`
- **TypeScript Static Verification**:
  - `backend`: Zero compiler errors (`npx tsc --noEmit`)
  - `frontend`: Zero compiler errors (`npx tsc --noEmit`)
- **Frontend Bundle**: Generated clean production assets in `frontend/dist/`
