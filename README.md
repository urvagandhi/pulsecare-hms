# PulseCare HMS — Hospital Management System

> **A focused, resilient clinical operations and outpatient scheduling platform built with TypeScript, Node.js, Express, MongoDB, React, Tailwind CSS, and Framer Motion.**

PulseCare HMS is a modern, modular Hospital Management System engineered for outpatient clinics and healthcare facilities. It streamlines the patient lifecycle from initial registration through specialist consultation scheduling to itemized billing and printable records.

---

## 🏥 Four Core Modules

PulseCare HMS is strictly scoped and optimized around four essential clinical workflows:

1. **Patient Registration & Management**
   - Self-service patient portal and administrative front-desk registration.
   - Deterministic atomic ID generation (`PAT-0001`, `PAT-0002`, ...).
   - Safe regex search across patient ID, name, email, and phone numbers.
   - Emergency contact and blood group management.
   - Server-side printable Patient ID Card PDF generation (`GET /api/v1/patients/me/id-card`).

2. **Doctor & Department Management**
   - Department catalog (Cardiology, Pediatrics, Orthopedics, General Medicine, etc.).
   - Specialist availability matrices with consultation fee visibility.
   - Physician leave and time-off tracking.
   - Automatic slot blackout: booking is strictly locked out when a doctor is on leave.

3. **Appointment Booking & Scheduling**
   - Real-time 30-minute slot availability engine based on doctor schedules and time zones.
   - Atomic per-doctor, per-date daily queue token generation (`#1`, `#2`, ...).
   - Concurrency protection: partial unique compound index prevents double-bookings.
   - Full staff appointment management portal for walk-ins and consultation status updates.
   - Server-side printable Appointment Slip PDF with token badge (`GET /api/v1/appointments/:id/slip`).

4. **Billing & Invoices**
   - Granular categorized line items (`consultation`, `doctor_charge`, `medicine`, `procedure`, `other`).
   - Pure centralized financial totals calculation with strict two-decimal rounding, tax, and discounts.
   - Draft invoice editing: line-item removal with automated totals recalculation.
   - Multi-stage lifecycle (`draft` → `issued` → `paid` / `partial` / `overdue`).
   - Server-side printable Tax Invoice PDF generation (`GET /api/v1/billing/:id/pdf`).

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Backend** | Node.js (v20+), Express 4, TypeScript 5, Mongoose 8 (MongoDB), Zod, pdf-lib, Winston |
| **Frontend** | React 18, Vite 5, TypeScript 5, Tailwind CSS, shadcn/ui primitives, Framer Motion, TanStack Query v5, Redux Toolkit |
| **Database** | MongoDB (v6.0+), with in-memory MongoMemoryServer for headless isolated testing |
| **Optional Cache** | Redis (with fully automatic, transparent in-memory fallback when absent) |
| **Testing** | Jest, Supertest, MongoMemoryServer, React Testing Library |

---

## 📋 Prerequisites

- **Node.js**: `v20.x` or later (tested on Node 20 / Node 22)
- **MongoDB**: Community Server `v6.0+` running on `mongodb://localhost:27017` (or MongoDB Atlas URI)
- **Redis (Optional)**: If not running or `REDIS_ENABLED=false`, the server automatically falls back to in-memory rate limiting and socket transport without degradation.

---

## 🚀 Step-by-Step Local Run Guide

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/urva/pulsecare-hms.git
cd pulsecare-hms

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

### 2. Configure Environment Variables

Both `backend` and `frontend` come with pre-configured `.env.example` templates.

```bash
# Setup backend environment
cp backend/.env.example backend/.env

# Setup frontend environment
cp frontend/.env.example frontend/.env
```

Default backend configuration (`backend/.env`):
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/pulsecare-hms
REDIS_ENABLED=false
JWT_SECRET=dev_jwt_secret_pulsecare_at_least_32_characters_long_min
JWT_REFRESH_SECRET=dev_jwt_refresh_secret_pulsecare_at_least_32_chars_min
FRONTEND_URL=http://localhost:5173
```

Default frontend configuration (`frontend/.env`):
```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

### 3. Seed Database with Realistic Test Accounts

Run the idempotent database seed script from the `backend/` directory:

```bash
cd backend
npm run seed
```

To wipe the database and re-generate a fresh, pristine seed dataset:

```bash
cd backend
npm run seed:reset
```

### 4. Start the Application

In terminal 1 (Backend API — Port `5000`):
```bash
cd backend
npm run dev
```

In terminal 2 (Frontend Client — Port `5173`):
```bash
cd frontend
npm run dev
```

Open your browser at **`http://localhost:5173`** to access the PulseCare HMS portal.

---

## 👥 Seeded Credentials Table

All seeded accounts use the password: `Password@123`

| Role | Email | Name | Capabilities |
|---|---|---|---|
| **Admin** | `admin@pulsecare.test` | System Administrator | Hospital oversight, user roles, staff leaves, analytics, billing |
| **Receptionist** | `reception@pulsecare.test` | Sarah Jenkins | Patient registration, walk-in appointments, invoice creation & issue |
| **Doctor (Cardiology)** | `dr.smith@pulsecare.test` | Dr. Alexander Smith | Outpatient schedule, daily queue tokens, patient consultations |
| **Doctor (Pediatrics)** | `dr.chen@pulsecare.test` | Dr. Emily Chen | Pediatric consultations, schedule, queue management |
| **Doctor (Orthopedics)**| `dr.patel@pulsecare.test` | Dr. Rajesh Patel | Orthopedic schedule, consultations, leave tracking |
| **Patient 1** | `patient1@pulsecare.test` | James Wilson | Self-service appointment booking, view slips, ID card, pay invoices |
| **Patient 2** | `patient2@pulsecare.test` | Sophia Martinez | Booking, appointments, invoices, ID card |
| **Patient 3** | `patient3@pulsecare.test` | Liam Johnson | Booking, appointments, invoices, ID card |

---

## 🧪 Testing & Verification

### Running Automated Test Suites

All tests run in isolated in-memory MongoDB containers under Kolkata local time:

```bash
cd backend
npx tsc --noEmit
TZ=Asia/Kolkata npm test
```

### Running Frontend Type-Check & Build

```bash
cd frontend
npx tsc --noEmit
npm run build
```

### Running the End-to-End API Smoke Test

Start the backend server on port 5000, then execute the automated smoke test script:

```bash
bash backend/scripts/smoke.sh
```

---

## 💾 Database Backup & Recovery

PulseCare HMS includes an integrated script wrapping MongoDB native `mongodump`:

```bash
cd backend
npm run backup
```

Snapshots are written to timestamped directories under `backend/backups/YYYYMMDD_HHMMSS`. To restore a backup:

```bash
mongorestore --uri="mongodb://localhost:27017/pulsecare-hms" ./backend/backups/<timestamp>/pulsecare-hms
```

---

## 📁 Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── config/          # Environment validation & secrets guard
│   │   ├── db/              # MongoDB connection & Redis optional fallback
│   │   ├── middleware/      # Authentication, authorize (RBAC), rate limiter, error handler
│   │   ├── models/          # User, Patient, Doctor, Appointment, Invoice, Counter, AuditLog
│   │   ├── modules/
│   │   │   ├── appointments/# Slots, booking, leave checking, queue tokens
│   │   │   ├── auth/        # Login, registration, token refresh
│   │   │   ├── billing/     # Pure invoice calculation, itemized billing, payments
│   │   │   ├── patients/    # Patient registration, regex search, profile
│   │   │   └── staff/       # Doctor & staff directory, leave windows
│   │   ├── routes/          # Mounted active routes (surplus unmounted)
│   │   ├── scripts/         # Idempotent seed script & smoke test
│   │   ├── services/        # PDF generation service (pdf-lib)
│   │   └── utils/           # Timezone-safe UTC date calculation
├── frontend/
│   ├── src/
│   │   ├── components/      # UI primitives (shadcn), Layout (Sidebar, ProtectedRoute), Shared
│   │   ├── hooks/           # useAuth, usePermissions
│   │   ├── lib/             # API client, brand constants, downloadPdf helper
│   │   ├── pages/
│   │   │   ├── admin/       # Dashboard, Patients, Staff, Appointments, Billing, Analytics
│   │   │   ├── doctor/      # Dashboard, Schedule
│   │   │   ├── patient/     # Dashboard, BookAppointment, Appointments, Billing, InvoiceDetail
│   │   │   └── public/      # Landing, SignIn, SignUp, Unauthorized, NotFound
│   │   └── styles/          # Tailwind globals, accessible teal color tokens
├── docs/
│   └── TRACEABILITY.md      # Risk register & defects traceability matrix
├── CHANGES.md               # Chronological task progress & preflight findings
├── NOTICE                   # Project copyright attribution & engineering highlights
├── SMOKE_TEST.md            # Comprehensive verification checklist & results
└── README.md
```

---

## 💡 Key Architectural & Engineering Highlights

| Area | Architectural Challenge & Requirement | PulseCare HMS Engineering Solution |
|---|---|---|
| **Scope & Modules** | Clean separation of critical healthcare functions | Strictly scoped and optimized around 4 core modules (Patient, Doctor, Appointment, Billing) |
| **Queueing & Tokens** | Fair patient waiting times & OPD queue visibility | Atomic daily queue tokens (`#1`, `#2`, ...) generated sequentially per doctor and date |
| **Concurrency & Integrity** | Preventing concurrent appointment collisions | Atomic partial unique index on `(doctorId, date, timeSlot)` guaranteeing zero double-bookings |
| **ID Sequencing** | High-concurrency unique identifier generation | Thread-safe, self-initializing atomic `Counter` sequence generators (`PAT-xxxx`, `DOC-xxxx`, `APT-xxxx`, `INV-xxxx`) |
| **Timezone Safety** | Eliminating day-boundary and scheduling errors across zones | Timezone-neutral UTC midnight normalization and strict UTC day-of-week evaluation |
| **Doctor Availability** | Dynamic clinical scheduling and doctor time-off | Doctor leave window tracking with automated booking lockout and slot exclusion |
| **Financial Precision** | Accurate itemized billing without floating-point drift | Central pure function (`calculateInvoiceTotals`) with 2-decimal rounding and dynamic draft editing |
| **Document Generation** | Instant offline-capable medical paperwork export | Server-side printable PDFs for invoices, appointment slips, and patient ID cards via `pdf-lib` |
| **Deployment Resilience** | Operating in diverse deployment environments | Graceful in-memory fallback for rate limiting and socket transport when Redis is absent |
| **Visual Identity & UX** | Clinical usability and accessible aesthetics | Modern accessible teal theme, custom medical SVG branding, dark mode support, and public landing page |

---

## 📄 License

This project is licensed under the **Apache License, Version 2.0**. See the [`NOTICE`](NOTICE) file for details.
