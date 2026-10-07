# AUDIT_REPORT.md

---

# 1. Executive Summary

This repository is a TypeScript-rebuilt MERN stack Hospital Management System (HMS), named **"MediCore HMS"** in internal specifications. The codebase has undergone a complete architectural rewrite from an initial JavaScript prototype to a modern, strongly typed application powered by Express 5, Mongoose 8, Zod, React 18, Vite, Redux Toolkit (auth-only), TanStack React Query v5, and TailwindCSS with shadcn/ui primitives. All 4 target modules—**Patient Registration & Management**, **Doctor & Department Management**, **Appointment Booking & Scheduling**, and **Billing & Invoice**—are already fully implemented, operational, and supported by automated backend integration tests. 

**Verdict: Yes with caveats.** The repository provides a remarkably clean, production-grade foundation for a college assignment, vastly exceeding typical student projects in architecture and RBAC hygiene. However, it requires three critical interventions: (1) creating a dummy data seed script because the database starts completely empty, (2) cleanly trimming out 5 surplus modules (Lab, Pharmacy, Inventory, Documents, Analytics) that are out of scope, and (3) addressing remaining feature gaps (doctor date-specific leave, queue tokens, and PDF/printable invoices).

---

# 2. Repo Inventory and License

### 2.1 Repository Folder Tree (Depth 3, excluding `node_modules`, `.git`, `dist`)
```
.
├── backend
│   ├── controllers [VERIFIED legacy JS]
│   │   ├── adminController.js
│   │   ├── appointmentController.js
│   │   ├── authController.js
│   │   ├── doctorController.js
│   │   ├── nurseController.js
│   │   └── userController.js
│   ├── db [VERIFIED legacy JS]
│   │   └── mongoose.js
│   ├── Dockerfile [VERIFIED: node:20-alpine]
│   ├── jest.config.js [VERIFIED: ts-jest, MongoMemoryServer]
│   ├── middlewares [VERIFIED legacy JS]
│   │   ├── cors.js
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── models [VERIFIED legacy JS]
│   │   ├── appointment.js
│   │   ├── contactUs.js
│   │   ├── department.js
│   │   ├── doctor.js
│   │   ├── newsLetter.js
│   │   ├── nurse.js
│   │   └── user.js
│   ├── package.json
│   ├── package-lock.json
│   ├── server.js [VERIFIED legacy JS entrypoint]
│   ├── src [VERIFIED active TypeScript application]
│   │   ├── app.ts
│   │   ├── config (env.ts, secrets.ts)
│   │   ├── db (mongoose.ts, redis.ts)
│   │   ├── jobs (appointments.ts, inventory.ts)
│   │   ├── middleware (authenticate.ts, authorize.ts, errorHandler.ts, rateLimiter.ts, requestLogger.ts)
│   │   ├── migrations (001-consolidate-auth.ts)
│   │   ├── models (User, Patient, Doctor, Nurse, Receptionist, Department, Appointment, Invoice, ...)
│   │   ├── modules (analytics, appointments, auth, billing, documents, inventory, lab, patients, pharmacy, settings, staff)
│   │   ├── routes (index.ts)
│   │   ├── server.ts
│   │   ├── services (emailService.ts, pdfService.ts)
│   │   ├── socket (index.ts)
│   │   ├── tests (health.test.ts)
│   │   └── types (api.ts)
│   ├── tsconfig.json
│   └── tsconfig.test.json
├── CLAUDE.md [VERIFIED developer guide]
├── docker-compose.prod.yml
├── docker-compose.yml
├── docs
│   ├── superpowers (plans, specs) [VERIFIED architectural specs]
│   └── [College SPM Coursework Word Documents: SRS, T1-T10]
├── frontend
│   ├── Dockerfile [VERIFIED: node:20-alpine]
│   ├── index.html
│   ├── nginx.conf
│   ├── package.json
│   ├── package-lock.json
│   ├── postcss.config.js
│   ├── public (vite.svg)
│   ├── README.md
│   ├── src [VERIFIED active React 18 + Vite TypeScript application]
│   │   ├── App.tsx
│   │   ├── assets
│   │   ├── components (Auth, layout, Patient, Shared, ui)
│   │   ├── hooks (useAuth.ts, useEntitySelectData.ts, usePermissions.ts)
│   │   ├── lib (api.ts, format.ts, queryClient.ts, socket.ts, utils.ts)
│   │   ├── main.tsx
│   │   ├── pages (admin, doctor, nurse, patient, public)
│   │   ├── store (authSlice.ts, hooks.ts, index.ts)
│   │   ├── styles (globals.css)
│   │   └── types (api.ts, appointment.ts, billing.ts, doctor.ts, lab.ts, patient.ts, staff.ts)
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   └── vite.config.ts
├── images (1.jpg, 2.jpg, 3.jpg)
├── LICENSE [VERIFIED: Apache 2.0]
├── PLAN.md [VERIFIED: 10-phase rebuild plan]
└── README.md
```

### 2.2 Environment & Runtime Specifications
- **Node.js version required:** Node 20 LTS (`node:20-alpine` in `backend/Dockerfile:2` and `frontend/Dockerfile:1` [VERIFIED]). Tested and confirmed working on host Node `v24.21.0` with `npm 12.2.0` [VERIFIED].
- **Package Manager:** `npm` (v10+ supported; lockfiles are `package-lock.json` format 3 [VERIFIED]).
- **Database Engine:** MongoDB 7 / Mongoose 8.0.0 (`backend/package.json:35` [VERIFIED]).
- **Cache / Session Store:** Redis 7 via `ioredis@^5.0.0` (`backend/package.json:33` [VERIFIED]) used for rate limiting and Socket.io cluster adapter.
- **Environment Variables Required:**
  - `PORT`: API server port (default: `4451`) [VERIFIED `backend/src/config/env.ts:5`].
  - `NODE_ENV`: Runtime environment (`development` | `test` | `production`, default: `development`) [VERIFIED `backend/src/config/env.ts:4`].
  - `CORS_ORIGINS`: Allowed origins comma-separated (default: `http://localhost:5173`) [VERIFIED `backend/src/config/env.ts:6`].
  - `MONGODB_URI`: MongoDB connection string (default: `mongodb://localhost:27017/hms`) [VERIFIED `backend/src/config/secrets.ts:18`].
  - `REDIS_URL`: Redis server URL (default: `redis://localhost:6379`) [VERIFIED `backend/src/config/secrets.ts:19`].
  - `JWT_SECRET`: Secret for signing access tokens (default: `dev-jwt-secret-change-in-production`) [VERIFIED `backend/src/config/secrets.ts:20`].
  - `JWT_REFRESH_SECRET`: Secret for signing refresh tokens (default: `dev-refresh-secret-change-in-production`) [VERIFIED `backend/src/config/secrets.ts:21`].
  - `AWS_SES_FROM_EMAIL`: Sender email fallback (default: `noreply@hms.local`) [VERIFIED `backend/src/config/secrets.ts:22`].
  - `AWS_S3_BUCKET`: Asset bucket fallback (default: `hms-dev-bucket`) [VERIFIED `backend/src/config/secrets.ts:23`].
  - `LOG_LEVEL`: Logging verbosity (default: `info`) [VERIFIED `backend/src/config/env.ts:11`].

### 2.3 Dependency Table

#### Backend Dependencies (`backend/package.json`)
| Package Name | Version | Purpose in <= 5 Words |
|---|---|---|
| `@aws-sdk/client-secrets-manager` | `^3.0.0` | Cloud secrets fetcher in production |
| `@socket.io/redis-adapter` | `^8.3.0` | Multi-instance websocket sync adapter |
| `bcryptjs` | `^2.4.3` | Password hashing and validation |
| `cookie-parser` | `^1.4.6` | HTTP cookie extraction middleware |
| `cors` | `^2.8.5` | Cross-origin resource sharing headers |
| `dotenv` | `^16.3.1` | Local environment variables loader |
| `express` | `^5.0.0` | Core web application framework |
| `handlebars` | `^4.7.0` | Email and document templating |
| `helmet` | `^7.0.0` | HTTP security response headers |
| `ioredis` | `^5.0.0` | High-performance Redis client driver |
| `jsonwebtoken` | `^9.0.0` | JWT generation and verification |
| `mongoose` | `^8.0.0` | MongoDB object modeling library |
| `node-cron` | `^3.0.0` | Scheduled background task runner |
| `nodemailer` | `^6.10.1` | SMTP email transport client |
| `pdf-lib` | `^1.17.1` | Pure JavaScript PDF generator |
| `socket.io` | `^4.7.0` | Real-time bidirectional event transport |
| `uuid` | `^9.0.0` | Cryptographic unique ID generation |
| `winston` | `^3.11.0` | Structured JSON request logger |
| `zod` | `^3.22.0` | Schema declaration and validation |

#### Backend DevDependencies (`backend/package.json`)
| Package Name | Version | Purpose in <= 5 Words |
|---|---|---|
| `typescript` | `^5.9.3` | TypeScript compiler and language |
| `ts-node` | `^10.9.0` | TypeScript execution for Node |
| `nodemon` | `^3.0.0` | Development file watching restart |
| `jest` | `^30.3.0` | JavaScript testing framework runner |
| `ts-jest` | `^29.4.6` | TypeScript preprocessor for Jest |
| `supertest` | `^6.3.0` | HTTP assertion test integration |
| `mongodb-memory-server` | `^9.0.0` | In-memory MongoDB for tests |
| `eslint` | `^8.0.0` | Code analysis and linting |

#### Frontend Dependencies (`frontend/package.json`)
| Package Name | Version | Purpose in <= 5 Words |
|---|---|---|
| `react` | `^18.2.0` | Component UI library engine |
| `react-dom` | `^18.2.0` | React DOM renderer integration |
| `react-router-dom` | `^6.20.0` | Client-side routing and navigation |
| `@reduxjs/toolkit` | `^2.0.0` | Predictable state container library |
| `react-redux` | `^9.0.0` | React bindings for Redux |
| `@tanstack/react-query` | `^5.0.0` | Async server state manager |
| `axios` | `^1.6.0` | Promise HTTP request client |
| `zod` | `^3.22.0` | Client data validation schemas |
| `react-hook-form` | `^7.48.0` | Form state management hooks |
| `@hookform/resolvers` | `^3.3.0` | Hook-form resolver for Zod |
| `lucide-react` | `^0.294.0` | Modern SVG interface icons |
| `tailwindcss` | `^3.3.0` | Utility-first CSS styling framework |
| `tailwind-merge` | `^2.0.0` | Merge Tailwind class conflicts |
| `clsx` | `^2.0.0` | Conditional CSS class constructor |
| `class-variance-authority` | `^0.7.1` | UI component variant management |
| `date-fns` | `^3.0.0` | Date manipulation and formatting |
| `framer-motion` | `^10.16.0` | UI component animation library |
| `recharts` | `^2.10.0` | Composable charting component library |
| `react-hot-toast` | `^2.4.0` | Lightweight toast notification popups |
| `socket.io-client` | `^4.7.0` | Real-time websocket client connection |

### 2.4 License & Project Attribution
1. **Legal License:** The root `LICENSE` file contains the full legal text of the **Apache License Version 2.0** (January 2004) with copyright attribution `Copyright 2026 Urva, Rakshit` [VERIFIED `LICENSE:1-2, 189-192`].
2. **NOTICE File:** Contains the official system engineering highlights and author attributions (`NOTICE`).
3. **Backend package.json:** Configured with `"license": "Apache-2.0"`.
4. **Frontend package.json:** Configured with `"private": true`.

---

# 3. How to Run

### 3.1 Local Environment Setup (No Docker Required)
Because the team requested running purely locally without Docker, ensure local native `mongod` and `redis-server` instances are running on their default ports.

#### Step 1: Start Redis
Redis is required by the backend bootstrap sequence (`backend/src/server.ts:22`).
```bash
# Verify redis service
redis-server --daemonize yes
# Confirm ping returns PONG
redis-cli ping
```
*Verification:* Local `redis-server` v7.0.15 is installed and verified responding with `PONG` [VERIFIED].

#### Step 2: Start MongoDB
MongoDB must run on port 27017.
```bash
# Using installed system mongod or cached binary:
mongod --dbpath ~/.mongodb/data --port 27017 --fork --logpath ~/.mongodb/mongod.log
```
*Verification:* In-memory mongod v6.0.14 binary exists at `~/.cache/mongodb-binaries/mongod-x64-ubuntu-6.0.14` [VERIFIED].

#### Step 3: Install & Start Backend
```bash
cd backend
npm install
npm run dev
```
*Working Output:*
- Server boots via `nodemon --watch src --ext ts --exec ts-node src/server.ts` [VERIFIED `backend/package.json:9`].
- Binds to port `4451` [VERIFIED `backend/src/config/env.ts:5`].
- Winston logger outputs: `HMS API running on port 4451 [development]` [VERIFIED `backend/src/server.ts:28`].

#### Step 4: Install & Start Frontend
```bash
cd frontend
npm install
npm run dev
```
*Working Output:*
- Vite dev server starts on `http://localhost:5173` [VERIFIED `frontend/vite.config.ts:11`].
- Automatic reverse-proxy forwards `/api` requests to `http://localhost:4451` [VERIFIED `frontend/vite.config.ts:13`].

### 3.2 Ports & Network Topology
- **Frontend Web UI:** `http://localhost:5173`
- **Backend API:** `http://localhost:4451`
- **API Base Route:** `http://localhost:4451/api/v1`
- **MongoDB:** `localhost:27017`
- **Redis Server:** `localhost:6379`

### 3.3 Default / Seed Login Credentials
- **Status:** **NONE** [NOT FOUND].
- **Finding:** The repository does not include any pre-seeded administrative or doctor accounts in the database. There is no default login user (e.g. `admin@test.com`) in the code. A user must first register an account via the UI (`/sign-up`) or API (`POST /api/v1/auth/register`). Notice that standard registration assigns the `patient` role by default unless overridden.

### 3.4 Errors & Warnings Encountered
1. **Node 25+ / Buffer API Warning:** `backend/package.json:14` contains an automated `postinstall` hook to patch `buffer-equal-constant-time` because `SlowBuffer` was deprecated in modern Node runtimes [VERIFIED `backend/package.json:14-15`].
2. **Blocked Scripts Warning:** `npm install` blocks postinstall scripts for `mongodb-memory-server` and `esbuild` if run with strict npm security settings [VERIFIED].
3. **Jest Test Timeout on Standalone Run:** Running all 13 test suites simultaneously without `--testTimeout=30000` resulted in worker hook timeouts (5000ms limit exceeded while extracting the MongoDB test binary) [VERIFIED]. Running suites with `--testTimeout=30000 --forceExit` executed successfully with 100% passing tests (13/13 in billing) [VERIFIED].

---

# 4. Backend: Routes Table

Every route is mounted under `/api/v1` in `backend/src/routes/index.ts` [VERIFIED].

| Method | Path | Controller / File | Auth Required? | Role Restriction (`authorize.ts`) | Target Module |
|---|---|---|---|---|---|
| `GET` | `/api/v1/health` | `app.ts:47` | No | None (public) | System |
| `POST` | `/api/v1/auth/register` | `auth/controller.ts:register` | No | None (public) | Auth |
| `POST` | `/api/v1/auth/login` | `auth/controller.ts:login` | No | None (public) | Auth |
| `POST` | `/api/v1/auth/refresh` | `auth/controller.ts:refresh` | No | None (httpOnly cookie / body) | Auth |
| `POST` | `/api/v1/auth/logout` | `auth/controller.ts:logout` | No | None (public) | Auth |
| `POST` | `/api/v1/auth/logout-all` | `auth/controller.ts:logoutAll` | Yes | All roles (`authenticate`) | Auth |
| `POST` | `/api/v1/auth/forgot-password` | `auth/controller.ts:forgotPassword` | No | None (public) | Auth |
| `POST` | `/api/v1/auth/reset-password` | `auth/controller.ts:resetPassword` | No | None (public) | Auth |
| `GET` | `/api/v1/auth/me` | `auth/controller.ts:getMe` | Yes | All authenticated roles | Auth |
| `GET` | `/api/v1/patients/me` | `patients/controller.ts:getOwnProfile` | Yes | Patient (`patients:read`, ownOnly) | Patient |
| `PATCH`| `/api/v1/patients/me` | `patients/controller.ts:updateOwnProfile` | Yes | Patient (`patients:write`, ownOnly) | Patient |
| `GET` | `/api/v1/patients` | `patients/controller.ts:listPatients` | Yes | Admin, Doctor, Nurse, Receptionist, Patient (own) | Patient |
| `POST` | `/api/v1/patients` | `patients/controller.ts:createPatient` | Yes | Admin, Receptionist (`patients:write`) | Patient |
| `GET` | `/api/v1/patients/:id` | `patients/controller.ts:getPatient` | Yes | Admin, Doctor, Nurse, Receptionist, Patient (own) | Patient |
| `PATCH`| `/api/v1/patients/:id` | `patients/controller.ts:updatePatient` | Yes | Admin, Receptionist, Patient (own) | Patient |
| `GET` | `/api/v1/staff` | `staff/controller.ts:listStaff` | Yes | Admin only (`users:read`) | Doctor & Staff |
| `POST` | `/api/v1/staff` | `staff/controller.ts:createStaff` | Yes | Admin only (`users:write`) | Doctor & Staff |
| `GET` | `/api/v1/staff/:id` | `staff/controller.ts:getStaff` | Yes | Admin only (`users:read`) | Doctor & Staff |
| `PATCH`| `/api/v1/staff/:id` | `staff/controller.ts:updateStaff` | Yes | Admin only (`users:write`) | Doctor & Staff |
| `DELETE`| `/api/v1/staff/:id` | `staff/controller.ts:deactivateStaff` | Yes | Admin only (`users:write`) | Doctor & Staff |
| `GET` | `/api/v1/doctors` | `staff/controller.ts:listDoctors` | Yes | All authenticated (`patients:read` proxy) | Doctor |
| `GET` | `/api/v1/doctors/available` | `staff/controller.ts:getAvailableDoctors` | Yes | All authenticated (`patients:read` proxy) | Doctor |
| `GET` | `/api/v1/doctors/:id` | `staff/controller.ts:getDoctorProfile` | Yes | All authenticated (`patients:read` proxy) | Doctor |
| `GET` | `/api/v1/departments` | `staff/controller.ts:listDepartments` | Yes | All authenticated (`patients:read` proxy) | Department |
| `POST` | `/api/v1/departments` | `staff/controller.ts:createDepartment` | Yes | Admin only (`users:write`) | Department |
| `PATCH`| `/api/v1/departments/:id` | `staff/controller.ts:updateDepartment` | Yes | Admin only (`users:write`) | Department |
| `GET` | `/api/v1/appointments/slots` | `appointments/controller.ts:getAvailableSlots` | Yes | Admin, Doctor (own), Receptionist, Patient (own) | Appointment |
| `POST` | `/api/v1/appointments` | `appointments/controller.ts:bookAppointment` | Yes | Admin, Receptionist, Patient (own), Doctor | Appointment |
| `GET` | `/api/v1/appointments` | `appointments/controller.ts:listAppointments` | Yes | Admin, Receptionist, Doctor (own), Patient (own) | Appointment |
| `GET` | `/api/v1/appointments/:id`| `appointments/controller.ts:getAppointment` | Yes | Admin, Receptionist, Doctor (own), Patient (own) | Appointment |
| `PATCH`| `/api/v1/appointments/:id/status` | `appointments/controller.ts:updateAppointmentStatus` | Yes | Admin, Receptionist, Doctor (own), Patient (cancel only) | Appointment |
| `DELETE`| `/api/v1/appointments/:id` | `appointments/controller.ts:cancelAppointment` | Yes | Admin, Receptionist, Doctor (own), Patient (own) | Appointment |
| `POST` | `/api/v1/billing` | `billing/controller.ts:createInvoice` | Yes | Admin, Receptionist (`billing:write`) | Billing |
| `GET` | `/api/v1/billing` | `billing/controller.ts:listInvoices` | Yes | Admin, Receptionist, Patient (own-read) | Billing |
| `GET` | `/api/v1/billing/:id` | `billing/controller.ts:getInvoice` | Yes | Admin, Receptionist, Patient (own-read) | Billing |
| `PATCH`| `/api/v1/billing/:id/issue` | `billing/controller.ts:issueInvoice` | Yes | Admin only (`billing:issue`) | Billing |
| `POST` | `/api/v1/billing/:id/payments` | `billing/controller.ts:recordPayment` | Yes | Admin, Receptionist (`billing:write`) | Billing |
| `PATCH`| `/api/v1/billing/:id/void` | `billing/controller.ts:voidInvoice` | Yes | Admin only (`billing:void`) | Billing |
| `POST` | `/api/v1/lab/orders` | `lab/controller.ts:createLabOrder` | Yes | Admin, Doctor (`lab:write`) | Surplus (Lab) |
| `GET` | `/api/v1/lab/orders` | `lab/controller.ts:listLabOrders` | Yes | Admin, Doctor, Nurse, Patient (own) | Surplus (Lab) |
| `GET` | `/api/v1/lab/orders/:id` | `lab/controller.ts:getLabOrderById` | Yes | Admin, Doctor, Nurse, Patient (own) | Surplus (Lab) |
| `PATCH`| `/api/v1/lab/orders/:id/status` | `lab/controller.ts:updateLabOrderStatus` | Yes | Admin, Doctor (`lab:write`) | Surplus (Lab) |
| `POST` | `/api/v1/lab/results` | `lab/controller.ts:createLabResult` | Yes | Admin, Doctor (`lab:write`) | Surplus (Lab) |
| `GET` | `/api/v1/lab/results/:orderId` | `lab/controller.ts:getLabResultByOrderId` | Yes | Admin, Doctor, Nurse, Patient (own) | Surplus (Lab) |
| `PATCH`| `/api/v1/lab/results/:id/verify` | `lab/controller.ts:verifyLabResult` | Yes | Admin, Doctor (`lab:write`) | Surplus (Lab) |
| `POST` | `/api/v1/pharmacy/drugs` | `pharmacy/controller.ts:createDrug` | Yes | Admin only (`drugs:write`) | Surplus (Pharmacy) |
| `GET` | `/api/v1/pharmacy/drugs` | `pharmacy/controller.ts:listDrugs` | Yes | Admin, Doctor, Nurse (`drugs:read`) | Surplus (Pharmacy) |
| `GET` | `/api/v1/pharmacy/drugs/:id` | `pharmacy/controller.ts:getDrugById` | Yes | Admin, Doctor, Nurse (`drugs:read`) | Surplus (Pharmacy) |
| `PATCH`| `/api/v1/pharmacy/drugs/:id` | `pharmacy/controller.ts:updateDrug` | Yes | Admin only (`drugs:write`) | Surplus (Pharmacy) |
| `POST` | `/api/v1/pharmacy/prescriptions` | `pharmacy/controller.ts:createPrescription` | Yes | Admin, Doctor (`prescriptions:write`) | Surplus (Pharmacy) |
| `GET` | `/api/v1/pharmacy/prescriptions` | `pharmacy/controller.ts:listPrescriptions` | Yes | Admin, Doctor, Nurse, Patient (own) | Surplus (Pharmacy) |
| `GET` | `/api/v1/pharmacy/prescriptions/:id`| `pharmacy/controller.ts:getPrescriptionById`| Yes | Admin, Doctor, Nurse, Patient (own) | Surplus (Pharmacy) |
| `PATCH`| `/api/v1/pharmacy/prescriptions/:id/activate` | `pharmacy/controller.ts:activatePrescription` | Yes | Admin, Doctor (`prescriptions:write`) | Surplus (Pharmacy) |
| `PATCH`| `/api/v1/pharmacy/prescriptions/:id/dispense` | `pharmacy/controller.ts:dispensePrescription` | Yes | Admin, Nurse (`prescriptions:dispense`) | Surplus (Pharmacy) |
| `PATCH`| `/api/v1/pharmacy/prescriptions/:id/cancel` | `pharmacy/controller.ts:cancelPrescription` | Yes | Admin, Doctor (`prescriptions:write`) | Surplus (Pharmacy) |
| `POST` | `/api/v1/inventory/items` | `inventory/controller.ts:createItem` | Yes | Admin only (`inventory:write`) | Surplus (Inventory) |
| `GET` | `/api/v1/inventory/items` | `inventory/controller.ts:listItems` | Yes | Admin, Nurse (`inventory:read`) | Surplus (Inventory) |
| `GET` | `/api/v1/inventory/items/:id` | `inventory/controller.ts:getItemById` | Yes | Admin, Nurse (`inventory:read`) | Surplus (Inventory) |
| `PATCH`| `/api/v1/inventory/items/:id` | `inventory/controller.ts:updateItem` | Yes | Admin only (`inventory:write`) | Surplus (Inventory) |
| `POST` | `/api/v1/inventory/items/:id/stock` | `inventory/controller.ts:adjustStock` | Yes | Admin only (`inventory:write`) | Surplus (Inventory) |
| `GET` | `/api/v1/inventory/items/:id/movements` | `inventory/controller.ts:listItemMovements` | Yes | Admin, Nurse (`inventory:read`) | Surplus (Inventory) |
| `GET` | `/api/v1/inventory/movements` | `inventory/controller.ts:listAllMovements` | Yes | Admin, Nurse (`inventory:read`) | Surplus (Inventory) |
| `POST` | `/api/v1/documents` | `documents/controller.ts:createDocument` | Yes | Admin, Doctor (`documents:issue`) | Surplus (Documents) |
| `GET` | `/api/v1/documents` | `documents/controller.ts:listDocuments` | Yes | Admin, Doctor, Patient (own) | Surplus (Documents) |
| `GET` | `/api/v1/documents/:id` | `documents/controller.ts:getDocumentById` | Yes | Admin, Doctor, Patient (own) | Surplus (Documents) |
| `POST` | `/api/v1/documents/:id/issue` | `documents/controller.ts:issueDocument` | Yes | Admin, Doctor (`documents:issue`) | Surplus (Documents) |
| `POST` | `/api/v1/documents/:id/void` | `documents/controller.ts:voidDocument` | Yes | Admin, Doctor (`documents:void`) | Surplus (Documents) |
| `GET` | `/api/v1/analytics/appointments` | `analytics/controller.ts:getAppointmentAnalytics` | Yes | Admin only (`analytics:read`) | Surplus (Analytics) |
| `GET` | `/api/v1/analytics/revenue` | `analytics/controller.ts:getRevenueAnalytics` | Yes | Admin only (`analytics:read`) | Surplus (Analytics) |
| `GET` | `/api/v1/analytics/lab` | `analytics/controller.ts:getLabAnalytics` | Yes | Admin only (`analytics:read`) | Surplus (Analytics) |
| `GET` | `/api/v1/analytics/prescriptions`| `analytics/controller.ts:getPrescriptionAnalytics`| Yes | Admin only (`analytics:read`) | Surplus (Analytics) |
| `GET` | `/api/v1/settings` | `settings/controller.ts:getSettings` | Yes | Admin only (`settings:read`) | Surplus (Settings) |
| `PATCH`| `/api/v1/settings` | `settings/controller.ts:updateSettings` | Yes | Admin only (`settings:write`) | Surplus (Settings) |

---

# 5. Backend: Data Models

The active database architecture uses Mongoose 8 models in `backend/src/models/` [VERIFIED].

### 1. `User` (`backend/src/models/User.ts`)
- **Fields:** `firstName` (String, required), `lastName` (String, required), `email` (String, required, unique, indexed), `password` (String, required, hidden `select: false`), `role` (String, enum: `admin` | `doctor` | `nurse` | `receptionist` | `patient`, required, indexed), `phone` (String), `dob` (Date), `gender` (String, enum: `male` | `female` | `other`), `address` (Subdocument: street, city, state, zipCode), `avatar` (String), `isActive` (Boolean, default: true), `failedLoginAttempts` (Number, default: 0), `lockedUntil` (Date), `lastLogin` (Date), `timestamps` (true).
- **Relations:** Core authentication entity referenced by `Patient`, `Doctor`, `Nurse`, `Receptionist`, `AuditLog`, `RefreshToken`.

### 2. `Patient` (`backend/src/models/Patient.ts`)
- **Fields:** `userId` (ObjectId, ref: `User`, required, unique, indexed), `patientId` (String, unique, indexed, e.g. `PAT-0001`), `bloodGroup` (String, enum: `A+`...`AB-`), `allergies` ([String]), `emergencyContact` (Subdocument: name, relationship, phone), `medicalHistory` (Array of {condition, diagnosisDate, treatment, notes}), `insuranceInfo` (Subdocument: provider, policyNumber, expiryDate), `timestamps` (true).
- **Relations:** 1-to-1 with `User`. Referenced by `Appointment`, `Invoice`, `LabOrder`, `Prescription`, `Document`.

### 3. `Doctor` (`backend/src/models/Doctor.ts`)
- **Fields:** `userId` (ObjectId, ref: `User`, required, unique, indexed), `doctorId` (String, unique, indexed, e.g. `DOC-0001`), `specialization` (String, required), `qualification` ([String]), `department` (ObjectId, ref: `Department`), `availability` (Array of {day, startTime, endTime}), `consultationFee` (Number, default: 0), `rating` (Number, default: 0), `reviewCount` (Number, default: 0), `isActive` (Boolean, default: true), `timestamps` (true).
- **Relations:** 1-to-1 with `User`. Ref to `Department`. Referenced by `Appointment`, `Department.head`, `LabOrder`.

### 4. `Department` (`backend/src/models/Department.ts`)
- **Fields:** `name` (String, required, unique, trim), `description` (String), `head` (ObjectId, ref: `Doctor`), `bedCount` (Number, default: 0), `location` (String), `isActive` (Boolean, default: true), `timestamps` (true).
- **Relations:** Ref to `Doctor` as department head. Referenced by `Doctor`, `Nurse`, `Receptionist`, `Appointment`.

### 5. `Appointment` (`backend/src/models/Appointment.ts`)
- **Fields:** `appointmentId` (String, unique, indexed, e.g. `APT-0001`), `patient` (ObjectId, ref: `Patient`, required, indexed), `doctor` (ObjectId, ref: `Doctor`, required, indexed), `department` (ObjectId, ref: `Department`), `date` (Date, required, indexed), `timeSlot` (String, required, e.g. `'09:00'`), `type` (String, enum: `consultation` | `follow-up` | `emergency` | `procedure`, default: `consultation`), `status` (String, enum: `scheduled` | `confirmed` | `inProgress` | `completed` | `cancelled` | `noShow`, default: `scheduled`), `reason` (String), `notes` (String), `createdBy` (ObjectId, ref: `User`, required), `cancelledBy` (ObjectId, ref: `User`), `cancelReason` (String), `timestamps` (true).
- **Indices:** Compound partial unique index `{ doctor: 1, date: 1, timeSlot: 1 }` with filter `{ status: { $nin: ['cancelled', 'noShow'] } }` prevents double booking [VERIFIED `Appointment.ts:46-49`].

### 6. `Invoice` (`backend/src/models/Invoice.ts`)
- **Fields:** `invoiceId` (String, unique, indexed, e.g. `INV-0001`), `patient` (ObjectId, ref: `Patient`, required, indexed), `appointment` (ObjectId, ref: `Appointment`), `lineItems` (Array of {description, quantity, unitPrice, total}, min 1 item required), `subtotal` (Number, computed), `taxRate` (Number, 0-100), `tax` (Number, computed), `discount` (Number, default: 0), `total` (Number, computed), `amountPaid` (Number, computed), `balance` (Number, computed), `status` (String, enum: `draft` | `issued` | `paid` | `partial` | `overdue` | `void`, default: `draft`), `insurance` (Subdocument: provider, policyNumber, coverageAmount), `payments` (Array of {amount, method: cash/card/insurance/transfer, paidAt, reference, recordedBy: ObjectId ref User}), `issuedDate` (Date), `dueDate` (Date), `paidDate` (Date), `notes` (String), `issuedBy` (ObjectId, ref: `User`, required), `voidedBy` (ObjectId, ref: `User`), `voidReason` (String), `timestamps` (true).
- **Hooks:** Pre-save recalculates `subtotal`, `tax`, `total`, `amountPaid`, `balance`, and automatically transitions status to `paid` or `partial` [VERIFIED `Invoice.ts:126-182`].

### 7. `Nurse` & `Receptionist` (`Nurse.ts`, `Receptionist.ts`)
- `Nurse`: 1-to-1 with `User`, `nurseId` (`NUR-XXXX`), `ward`, `department` (ref `Department`), `shift` (`morning` | `afternoon` | `night`).
- `Receptionist`: 1-to-1 with `User`, `receptionistId` (`REC-XXXX`), `department` (ref `Department`).

### 8. `RefreshToken` & `AuditLog` (`RefreshToken.ts`, `AuditLog.ts`)
- `RefreshToken`: SHA-256 hash of token, `familyId` for rotation tracking, TTL index on `expiresAt` (`expireAfterSeconds: 0`).
- `AuditLog`: Append-only immutable log (`actorId`, `actorRole`, `action`, `resourceType`, `resourceId`, `before`, `after`, `timestamp`). Mongoose mutation methods blocked [VERIFIED `AuditLog.ts:40-62`].

### 9. Surplus Models (Lab, Pharmacy, Inventory, Documents, Settings)
- `LabOrder` & `LabResult`: Diagnostics tracking.
- `Drug` & `Prescription`: Pharmacy dispensing.
- `InventoryItem` & `StockMovement`: Medical supplies.
- `Document`: Certificate issuance (`DOC-XXXX`).
- `Settings`: Hospital singleton metadata.

---

# 6. Backend: Auth and Role Enforcement

### 6.1 Authentication Flow
- **Registration (`auth/service.ts:register`):** Creates a `User` with password hashed using `bcryptjs` with salt round `12` (`User.ts:67` [VERIFIED]). Generates initial access token and refresh token family.
- **Login (`auth/service.ts:login`):** Validates credentials, checks account lock status (`failedLoginAttempts >= 5` locks account for 15 minutes in `User.ts:77-80` [VERIFIED]). Returns a short-lived JWT access token (15m expiry) and sets an `httpOnly`, `sameSite: strict` refresh token cookie.
- **Refresh Token Rotation (`auth/service.ts:refresh`):** Uses family-based invalidation. When a refresh token is presented, its SHA-256 hash is checked. If valid, a new access token and new refresh token are issued while invalidating the old token. If an already-used or revoked token is presented (reuse attack), the entire token family is immediately revoked, forcing re-authentication [VERIFIED `auth/service.ts:108-145`].
- **Logout:** Revokes the active refresh token and clears the cookie. `POST /auth/logout-all` revokes all refresh tokens for that user ID.

### 6.2 Role Checking & RBAC Matrix
Role enforcement is centralized in `backend/src/middleware/authorize.ts` [VERIFIED].
- **Roles:** `admin`, `doctor`, `nurse`, `receptionist`, `patient`.
- **Enforcement Mechanism:**
  ```ts
  router.get('/patients', authenticate, authorize('patients', 'read'), PatientController.listPatients);
  ```
  `authenticate` decrypts the JWT Bearer header and populates `req.user` with `{ _id, role }`. `authorize(resource, action)` inspects the permission matrix `MATRIX[resource][role]`:
  - If permission is `false`: Responds with `403 Forbidden` (`Role '{role}' is not permitted to perform '{action}' on '{resource}'`) [VERIFIED `authorize.ts:231-238`].
  - If permission is `'own-read'` or `'own-rw'`: Sets `req.ownOnly = true` and proceeds to the controller/service to enforce database ownership filtering [VERIFIED `authorize.ts:241-244`].
  - If permission is `'all'`: Grants unrestricted access.

### 6.3 Input Validation & Error Handling
- **Validation:** Every module defines a strict `schema.ts` using `zod`. Controllers call `Schema.safeParse(req.body)` and forward issues to `parseZodError()` which instantiates a `ValidationError` (HTTP 400) [VERIFIED `staff/controller.ts:13-19`].
- **Centralized Error Envelope:** `backend/src/middleware/errorHandler.ts` catches all thrown errors and formats them into a standardized response:
  ```json
  {
    "success": false,
    "error": {
      "code": "VALIDATION_ERROR",
      "message": "Validation failed",
      "details": { "field": "Error description" }
    }
  }
  ```
  Recognizes custom subclasses: `ValidationError` (400), `AuthError` (401), `ForbiddenError` (403), `NotFoundError` (404), `ConflictError` (409), and handles Mongo duplicate key `11000` (409) [VERIFIED `errorHandler.ts:5-74`].

---

# 7. Frontend: Pages, State, Theming Surface

### 7.1 Pages & Routes (`frontend/src/App.tsx`)
All client routes are configured using React Router v6 in `frontend/src/App.tsx` [VERIFIED].

| Client Path | Page Component | Allowed Roles | Backend API Endpoints Called |
|---|---|---|---|
| `/sign-in` | `pages/public/SignIn.tsx` | Public | `POST /api/v1/auth/login` |
| `/sign-up` | `pages/public/SignUp.tsx` | Public | `POST /api/v1/auth/register` |
| `/dashboard` | `DashboardRouter` (`App.tsx:43`) | Authenticated | Redirects to role-specific dashboard |
| `/admin/dashboard` | `pages/admin/Dashboard.tsx` | Admin, Receptionist | `GET /api/v1/analytics/*`, `GET /api/v1/appointments` |
| `/admin/patients` | `pages/admin/Patients.tsx` | Admin, Receptionist | `GET /api/v1/patients`, `POST /api/v1/patients`, `PATCH /api/v1/patients/:id` |
| `/admin/staff` | `pages/admin/Staff.tsx` | Admin, Receptionist | `GET /api/v1/staff`, `POST /api/v1/staff`, `PATCH /api/v1/staff/:id`, `GET /api/v1/departments` |
| `/admin/billing` | `pages/admin/Billing.tsx` | Admin, Receptionist | `GET /api/v1/billing`, `POST /api/v1/billing`, `PATCH /api/v1/billing/:id/issue`, `POST /api/v1/billing/:id/payments`, `PATCH /api/v1/billing/:id/void` |
| `/doctor/dashboard` | `pages/doctor/Dashboard.tsx` | Doctor | `GET /api/v1/appointments`, `GET /api/v1/patients` |
| `/doctor/schedule` | `pages/doctor/Schedule.tsx` | Doctor | `GET /api/v1/appointments`, `PATCH /api/v1/appointments/:id/status` |
| `/patient/dashboard` | `pages/patient/Dashboard.tsx` | Patient | `GET /api/v1/appointments`, `GET /api/v1/patients/me`, `GET /api/v1/billing` |
| `/patient/book-appointment` | `pages/patient/BookAppointment.tsx` | Patient | `GET /api/v1/doctors`, `GET /api/v1/appointments/slots`, `POST /api/v1/appointments` |
| `/patient/appointments` | `pages/patient/Appointments.tsx` | Patient | `GET /api/v1/appointments`, `DELETE /api/v1/appointments/:id` |
| `/patient/billing` | `pages/patient/Billing.tsx` | Patient | `GET /api/v1/billing` |
| `/patient/billing/:id` | `pages/patient/InvoiceDetail.tsx`| Patient | `GET /api/v1/billing/:id` |
| `/admin/lab`, `/doctor/lab`, `/patient/lab` | Lab Pages | Admin, Nurse, Doctor, Patient | Surplus Lab Endpoints |
| `/admin/pharmacy`, `/doctor/prescriptions`, `/nurse/dispensing` | Pharmacy Pages | Admin, Doctor, Nurse, Patient | Surplus Pharmacy Endpoints |
| `/admin/inventory`, `/nurse/inventory` | Inventory Pages | Admin, Nurse | Surplus Inventory Endpoints |
| `/admin/documents`, `/doctor/documents`, `/patient/documents` | Document Pages | Admin, Doctor, Patient | Surplus Document Endpoints |
| `/admin/analytics` | `pages/admin/Analytics.tsx` | Admin | Surplus Analytics Endpoints |
| `/admin/settings` | `pages/admin/Settings.tsx` | Admin | Surplus Settings Endpoints |

### 7.2 State Management Layout
- **Redux Toolkit (`frontend/src/store/authSlice.ts`):** Confined strictly to client authentication state: `user`, `accessToken`, `isAuthenticated`, `isLoading` [VERIFIED `authSlice.ts:12-24`].
- **TanStack React Query v5 (`frontend/src/lib/queryClient.ts`):** Manages 100% of server state, caching, optimistic updates, and background refetching across patients, staff, appointments, and billing [VERIFIED].
- **API Client (`frontend/src/lib/api.ts`):** Axios instance configured with `baseURL: '/api/v1'` and `withCredentials: true`. Includes a request interceptor that injects the Redux `accessToken` into `Authorization: Bearer <token>`, and a response interceptor that catches 401 errors, enqueues pending calls, issues a silent `/api/v1/auth/refresh`, updates Redux, and retries the failed requests [VERIFIED `api.ts:11-68`].

### 7.3 UI Theming Surface
- **Tailwind & Theme Tokens:** Configured in `frontend/tailwind.config.ts:8-48` and `frontend/src/styles/globals.css:5-48` using HSL variables (`--background`, `--foreground`, `--primary`, `--secondary`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`) [VERIFIED].
- **Fonts:** System Inter stack: `fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] }` (`tailwind.config.ts:43` [VERIFIED]).
- **Brand Name Location:** The string `"HMS"` appears in `Sidebar.tsx:61` and `SignIn.tsx:41`. The full string `"Hospital Management System"` is declared in `frontend/index.html:6` [VERIFIED].
- **Logo / Icons:** Lucide icon library (`lucide-react`) is used across all views. Brand logo is currently an inline styled letter `"H"` badge inside `Sidebar.tsx:58-60` and `SignIn.tsx:37-39` [VERIFIED].
- **Framer Motion Analysis:** `framer-motion` is installed (`frontend/package.json:22`) but is **only** imported in orphaned legacy JSX files (`frontend/src/components/Auth/*.jsx` and `components/Patient/*.jsx`) [VERIFIED]. None of the active TypeScript pages or components in `frontend/src/pages/` utilize Framer Motion.
- **Dark Mode Assessment:** **Already fully implemented.** Dark mode is powered by Tailwind's `class` strategy (`darkMode: ['class']` in `tailwind.config.ts:4`), with `.dark` CSS tokens declared in `globals.css:29-47`. A Sun/Moon toggle button exists in `frontend/src/components/layout/Topbar.tsx:47-49` that flips the `.dark` class on `document.documentElement` and persists the user preference in `localStorage.getItem('theme')` [VERIFIED `Topbar.tsx:9-29`].

---

# 8. Module Mapping (Our 4 Modules) and Trimming Plan

### 8.1 Module Mapping Matrix
| Target Module & Capability | Exists? | Backend Implementation | Frontend Implementation | Operational Status | Quality & Code Notes |
|---|---|---|---|---|---|
| **1. Patient Registration** | **EXISTS** | `patients/service.ts:11` | `pages/public/SignUp.tsx` | Works | Creates User + Patient profile with blood group, allergies, contact. |
| **1. Patient List & Profile** | **EXISTS** | `patients/service.ts:72, 109` | `pages/admin/Patients.tsx` | Works | Admin/receptionist directory; patient own-profile editing. |
| **2. Doctor Management** | **EXISTS** | `staff/service.ts:26, 104` | `pages/admin/Staff.tsx` | Works | Doctor profile creation, fees, qualifications, active status. |
| **2. Department Management**| **EXISTS** | `staff/service.ts:221, 243` | `pages/admin/Staff.tsx` | Works | Department creation, head doctor assignment, bed capacity. |
| **3. Appointment Booking** | **EXISTS** | `appointments/service.ts:30` | `pages/patient/BookAppointment.tsx` | Works | Doctor selection, dynamic date/slot picker, reason. |
| **3. Appointment Schedule** | **EXISTS** | `appointments/service.ts:242` | `pages/doctor/Schedule.tsx` | Works | Status updates (`confirmed`, `completed`, `cancelled`). |
| **4. Invoice Creation** | **EXISTS** | `billing/service.ts:13` | `pages/admin/Billing.tsx` | Works | Draft invoice with dynamic line items, tax rate, discount. |
| **4. Payment Recording** | **EXISTS** | `billing/service.ts:48` | `pages/admin/Billing.tsx` | Works | Cash, card, transfer; auto-marks invoice `paid` or `partial`. |
| **4. Patient Bills View** | **EXISTS** | `billing/service.ts:92, 130` | `pages/patient/Billing.tsx` | Works | Patients view their own issued invoices and balances. |

### 8.2 Surplus Modules & Trimming Plan
The repository includes 5 modules that are out of scope: **Lab & Diagnostics**, **Pharmacy**, **Inventory**, **Documents & Certificates**, and **Analytics/Settings**.

#### Exactly What to Remove / Hide:
1. **Frontend Sidebar Navigation (`frontend/src/components/layout/Sidebar.tsx`):**
   - Remove lines 26–39 containing `NAV_ITEMS` entries for:
     - `Lab Orders` (`/doctor/lab`), `Lab Results` (`/patient/lab`), `Lab Management` (`/admin/lab`)
     - `Prescriptions` (`/doctor/prescriptions`), `Dispensing Queue` (`/nurse/dispensing`), `Pharmacy` (`/admin/pharmacy`)
     - `Inventory` (`/admin/inventory`, `/nurse/inventory`)
     - `Documents` (`/doctor/documents`, `/patient/documents`, `/admin/documents`)
     - `Analytics` (`/admin/analytics`), `Settings` (`/admin/settings`).
2. **Frontend Routing (`frontend/src/App.tsx`):**
   - In `App.tsx`, comment out or delete surplus routes:
     - Line 87–90: `/admin/lab`
     - Line 102–110: `lab`, `pharmacy`, `inventory`, `documents`, `analytics`, `settings` inside `/admin/*`
     - Line 123–125: `lab`, `prescriptions`, `documents` inside `/doctor/*`
     - Line 137–138: `dispensing`, `inventory` inside `/nurse/*`
     - Line 154–158: `lab`, `prescriptions`, `documents` inside `/patient/*`
3. **Backend Route Registration (`backend/src/routes/index.ts`):**
   - Comment out or remove router imports and mounts for:
     - `labRouter` (line 7, 20)
     - `pharmacyRouter` (line 8, 21)
     - `inventoryRouter` (line 9, 22)
     - `documentsRouter` (line 10, 23)
     - `analyticsRouter` (line 11, 24)
     - `settingsRouter` (line 12, 25)
4. **Backend Background Jobs (`backend/src/server.ts`):**
   - Remove `startInventoryJobs()` on line 10 and 30 so the server does not run background inventory stock checks.
5. **Orphaned Dead Legacy Files to Delete Safely:**
   - `backend/server.js`, `backend/controllers/*.js`, `backend/db/*.js`, `backend/middlewares/*.js`, `backend/models/*.js`.
   - `frontend/src/components/Auth/*.jsx`, `frontend/src/components/Patient/*.jsx`.

---

# 9. Feature Gap Table (F1 to F10)

| Feature | Description | Status | Evidence (File + Lines) | Required Modifications / Implementation Files | Effort |
|---|---|---|---|---|---|
| **F1** | Prevent double-booking doctor slot | **EXISTS** | `Appointment.ts:46-49`<br>`appointments/service.ts:82-89, 143-146` | Already enforced at DB layer with compound partial unique index and server transaction/query pre-check. | **None** |
| **F2** | Block booking on doctor day-off / leave | **PARTIAL** | `appointments/service.ts:58-64`<br>`Doctor.ts:32-36` | Weekly day-off is enforced via `availability` array matching day-of-week. Custom date-specific leave is MISSING. Add `leaves: [{ startDate, endDate, reason }]` to `Doctor.ts` and check in `appointments/service.ts`. | **S** (1 hr) |
| **F3** | Appointment queue token + confirmation slip | **MISSING** | `Appointment.ts:8, 27`<br>`BookAppointment.tsx:117-120` | `appointmentId` (`APT-0001`) exists, but daily queue token number (Token #1, #2) is missing. Add `tokenNumber` computation per doctor/date in `appointments/service.ts`, and a printable confirmation modal with barcode/slip in `frontend/src/pages/patient/Appointments.tsx`. | **M** (2 hrs) |
| **F4** | Itemized invoice calculated in one central function + item removal recalculation | **PARTIAL** | `Invoice.ts:126-182`<br>`billing/service.ts:13-31` | Total calculation is centralized in Mongoose pre-save hook (`subtotal + tax - discount`). However, line items are generic text, missing categorized fields (Consultation Fee, Doctor Charge, Medicines), and there is no API endpoint to remove an item from a draft invoice and recalculate. Add itemized schema helper in `Invoice.ts` and `DELETE /billing/:id/items/:itemIndex` endpoint in `billing/router.ts`. | **M** (2 hrs) |
| **F5** | Printable / PDF invoice & patient ID card | **MISSING** | `pdfService.ts:8-169` | `pdf-lib` is installed and used for general medical certificates in `pdfService.ts`, but invoice PDF generation is absent. No patient ID card generator exists. Add `generateInvoicePdf()` in `pdfService.ts` and a browser print CSS view in `InvoiceDetail.tsx`. | **M** (3 hrs) |
| **F6** | Backend role-based route protection | **EXISTS** | `authorize.ts:87-166`<br>`authenticate.ts:11-33` | 100% enforced on backend for all protected endpoints using `authenticate` and `authorize(resource, action)`. Unauthorized roles receive 403. | **None** |
| **F7** | Search / filter (patient ID/phone, doctor department) | **PARTIAL** | `patients/service.ts:82-86`<br>`staff/service.ts:116` | Doctor filter by department exists (`/staff?department=...`). Patient search only filters `firstName`, `lastName`, `email`; it does NOT match `patientId` (`PAT-XXXX`) or `phone`. Extend `$or` query in `patients/service.ts:82-86`. | **S** (30 min) |
| **F8** | Seed script with dummy data | **MISSING** | `backend/src/migrations/` [NOT FOUND] | No dummy data seeder exists. Database starts empty. Create `backend/src/scripts/seed.ts` populating 1 Admin, 3 Doctors, 1 Receptionist, 5 Patients, 2 Departments, 5 Appointments, and 3 Invoices. | **M** (2 hrs) |
| **F9** | Automated tests for billing & booking conflict | **EXISTS** | `billing.test.ts:1-150`<br>`appointments.test.ts:161-170` | 13 billing tests verify calculation, partial/full payment, and voiding. Appointment tests verify 409 Conflict when double-booking same doctor and slot. | **None** |
| **F10**| UI rebrand (colors, logo, app name, dark mode) | **PARTIAL** | `tailwind.config.ts:8-48`<br>`globals.css:5-48`<br>`Topbar.tsx:47-49` | Theme variables exist and dark mode works. App name is generic "HMS", logo is placeholder "H", and public landing page is missing. Customize color palette in `globals.css`, add SVG hospital logo, update title in `index.html`, and build a landing hero section. | **M** (2-3 hrs) |

---

# 10. Bugs, Risks and Security Findings (Severity-Ranked)

### Critical Severity
1. **Empty Database / Auth Bootstrap Deadlock [VERIFIED]:**
   - *Issue:* No default users exist in MongoDB, and standard registration defaults to role `patient`. An administrator or doctor cannot log in or be created through standard UI forms without manually executing database queries or creating a seed script.
   - *Impact:* The application cannot be demonstrated to evaluators without manual database manipulation.
2. **Coexistence of Orphaned Legacy Code [VERIFIED]:**
   - *Issue:* Root `backend/controllers/`, `backend/server.js`, `backend/models/`, and `frontend/src/components/Auth/*.jsx` contain legacy JavaScript code that is completely detached from the running TypeScript application.
   - *Impact:* Students modifying these files will find zero effect on the application, leading to severe confusion and wasted effort.

### High Severity
3. **Non-Atomic Counter ID Generation Race Condition [VERIFIED `Appointment.ts:54`, `Invoice.ts:159`, `Doctor.ts:49`, `Patient.ts:60`]:**
   - *Issue:* Auto-generated IDs (`APT-XXXX`, `INV-XXXX`, `PAT-XXXX`) use `countDocuments() + 1` in Mongoose pre-save hooks.
   - *Impact:* Concurrent requests generate identical IDs, crashing with Mongo duplicate key errors (code 11000). While acceptable for a 2-student demo, a sequence counter collection should be used if evaluated on concurrency.
4. **Hardcoded Dev Fallback Secrets in Production Config [VERIFIED `backend/src/config/secrets.ts:20-21`]:**
   - *Issue:* JWT secrets default to `'dev-jwt-secret-change-in-production'` if environment variables are not supplied.
   - *Impact:* Predictable tokens if deployed to public demonstration URLs without environment configuration.
5. **Hard Redis Dependency at Startup [VERIFIED `backend/src/server.ts:22`]:**
   - *Issue:* `server.ts` calls `await connectRedis()`. If Redis is not running locally, the entire backend crashes with `Fatal startup error: [Error: Redis not initialized]` and exits with code 1.
   - *Impact:* A laptop running only Node and Mongo cannot boot the backend unless Redis is installed or Redis initialization is wrapped in a try/catch graceful fallback.

### Medium Severity
6. **Semantic Misuse of `patients:read` Permission for Doctor & Department Listing [VERIFIED `staff/router.ts:16, 22`]:**
   - *Issue:* The routes `GET /api/v1/doctors` and `GET /api/v1/departments` are guarded by `authorize('patients', 'read')` rather than a dedicated resource permission.
   - *Impact:* Architectural code smell; if patient permissions are adjusted, doctor catalog access is unintentionally modified.
7. **Date Availability Timezone Drift [VERIFIED `appointments/service.ts:59`, `staff/service.ts:201`]:**
   - *Issue:* `appointmentDate.getDay()` evaluates local day-of-week while dates are parsed with UTC strings (`Z`). Depending on machine timezone (e.g. UTC+5:30 IST), day transitions near midnight can map to the wrong day-of-week availability.

### Low Severity
8. **Unused Dependencies in Package.json [VERIFIED `frontend/package.json:22`]:**
   - `framer-motion` is declared as a core dependency but is only used in unused legacy `.jsx` files.
9. **Deprecated Sub-dependencies [VERIFIED]:**
   - Npm audit reports deprecated transitive dependencies (`glob@10.5.0`, `supertest@6.3.4`, `eslint@8.57.1`). None affect local demo functionality.

---

# 11. Recommended Change Plan (Tier 1 to 4)

### Tier 1: Must-Fix to Run and Demo Locally (Immediate Priority)
- **Task 1.1: Create Database Seed Script (`backend/src/scripts/seed.ts`) [Effort: M - 2 hrs]**
  - Populate initial dummy records: 1 Admin (`admin@hospital.com` / `Admin123!`), 2 Doctors (Cardiology, Pediatrics), 1 Receptionist (`reception@hospital.com`), 3 Patients, 2 Departments.
  - Add npm script: `"seed": "ts-node src/scripts/seed.ts"` to `backend/package.json`.
- **Task 1.2: Graceful Redis Fallback (`backend/src/db/redis.ts`, `server.ts`) [Effort: S - 30 min]**
  - Wrap `connectRedis()` in `server.ts` in a try/catch block so backend continues running in in-memory mode if Redis is temporarily offline.

### Tier 2: Module Trimming (Clean Up Scope)
- **Task 2.1: Hide Surplus Frontend Pages (`Sidebar.tsx`, `App.tsx`) [Effort: S - 45 min]**
  - Comment out Lab, Pharmacy, Inventory, Documents, Analytics links in `Sidebar.tsx`.
  - Disable routes in `App.tsx` so the navigation cleanly displays only the 4 target modules.
- **Task 2.2: Unmount Surplus Backend Routers (`backend/src/routes/index.ts`) [Effort: S - 30 min]**
  - Comment out `/lab`, `/pharmacy`, `/inventory`, `/documents`, `/analytics`, `/settings`.
- **Task 2.3: Remove Dead Legacy Code [Effort: S - 15 min]**
  - Safely archive or delete `backend/controllers/*.js`, `backend/server.js`, `frontend/src/components/Auth/*.jsx`.

### Tier 3: Feature Additions (F1 to F10 by Value-for-Effort)
- **Task 3.1: Patient Search Extension (F7) [Effort: S - 30 min]**
  - Update `backend/src/modules/patients/service.ts:82-86` to match `phone` and `patientId` (`PAT-XXXX`).
- **Task 3.2: Queue Token & Printable Appointment Slip (F3) [Effort: M - 2 hrs]**
  - Calculate daily sequential token in `appointments/service.ts`.
  - Add "Print Slip" modal with hospital header and token number in `frontend/src/pages/patient/Appointments.tsx`.
- **Task 3.3: Doctor Leave / Time-Off Blocking (F2) [Effort: S - 1 hr]**
  - Add `leaves: [{ startDate: Date, endDate: Date, reason: String }]` to `Doctor.ts`.
  - Add validation in `appointments/service.ts:58` blocking booking if appointment date falls in a doctor's leave window.
- **Task 3.4: Itemized Invoice Breakdown & Item Removal (F4) [Effort: M - 2 hrs]**
  - Add explicit item types in `Invoice.ts` (`consultation`, `doctor_charge`, `medicine`, `discount`).
  - Add `DELETE /api/v1/billing/:id/items/:itemIndex` endpoint recalculating invoice balance.
- **Task 3.5: Printable / PDF Invoice (F5) [Effort: M - 2.5 hrs]**
  - Add printable invoice template button in `frontend/src/pages/patient/InvoiceDetail.tsx` with clean CSS print styles `@media print`.

### Tier 4: Polish & Presentation
- **Task 4.1: UI Rebranding (F10) [Effort: M - 2 hrs]**
  - Replace generic "HMS" with college project name (e.g., "PulseCare HMS").
  - Add medical cross logo in `Sidebar.tsx` and `SignIn.tsx`.
  - Update primary brand color in `frontend/src/styles/globals.css`.
- **Task 4.2: Documentation & Demo Walkthrough [Effort: S - 1 hr]**
  - Update `README.md` with exact local run commands, default logins from seed script, and test commands.

### Suggested Task Split
- **Urva (Backend Owner):**
  - Task 1.1: Dummy data seed script (`seed.ts`).
  - Task 1.2: Redis graceful fallback.
  - Task 2.2: Backend route trimming.
  - Task 3.1: Patient search extension (F7).
  - Task 3.3: Doctor leave validation (F2).
  - Task 3.4: Itemized invoice calculation & item removal API (F4).
- **Rakshit (Frontend Owner):**
  - Task 2.1: Trimming sidebar navigation and unused routes.
  - Task 3.2: Queue token display & printable appointment slip (F3).
  - Task 3.5: Printable invoice layout & patient ID card view (F5).
  - Task 4.1: UI rebrand (colors, logo, title, landing page redesign).
  - Task 4.2: Frontend demo flow testing and verification.

---

# 12. Open Questions / Things I Could Not Verify

1. **AWS Production Services:** Production configuration references AWS Secrets Manager (`AWS_SECRET_NAME: hms/app-secrets`), AWS SES, and AWS S3 (`backend/src/config/secrets.ts:27-37`). Dev fallbacks work locally without AWS, but production builds require these variables.
2. **Payment Gateway Integration:** The current billing system supports recording payments (`cash`, `card`, `insurance`, `transfer`) with an optional reference string (`Invoice.ts:76`). It does not integrate a live gateway (Stripe/Razorpay), which aligns with the dummy data college project constraint.
3. **ABDM / THIMS Compliance Mentions in Coursework Docs:** The assignment document `docs/Tutorial - 1/SRS_Hospital_Management_System.docx` describes a commercial ABDM-compliant hospital platform replacing "THIMS". While the existing MERN codebase has complete clinical and billing models, national healthcare API integration (ABHA ID, ABDM M1/M2/M3 milestones) is not implemented in this open-source base.

---
*Report generated via read-only code audit.*
