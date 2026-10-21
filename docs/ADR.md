# Architectural Decision Records (ADRs) — PulseCare HMS

This document records key architectural decisions made during the design, development, and reconciliation of the PulseCare Hospital Management System (HMS).

---

## ADR-001: Single-Hospital, Multi-Department Enterprise Architecture

- **Status**: Accepted & Supercedes SRS Section 2.1 Multi-Tenant SaaS specification
- **Date**: October 2026
- **Context**:
  Early drafts in the System Requirements Specification (`SRS_Hospital_Management_System.docx`) referenced a multi-tenant cloud SaaS deployment with independent hospital branches. In practice, clinical workflows require strict HIPAA/DISHA data locality, airtight patient confidentiality, zero risk of tenant cross-contamination, and high-performance localized queries without overhead from global composite tenant keys.
- **Decision**:
  The system is formally architected and baseline-implemented as a **Single-Hospital, Multi-Department Enterprise System**.
  - All collections operate within a dedicated, secured database instance.
  - Logical separation is enforced at the department level (`Department` schema) and role-based access control level (`authorize` middleware across Admin, Doctor, Nurse, Receptionist, Patient).
  - Multi-hospital SaaS tenancy is designated for the Phase 2 roadmap.
- **Consequences**:
  - **Positive**: Eliminates risk of tenant data leakages; maximizes index efficiency; simplifies database backups (`mongodump`) and restores.
  - **Neutral**: Cloud multi-tenant deployment would require introducing a `tenantId` field and compound indexing across all collections.

---

## ADR-002: Database Engine Selection — MongoDB 8.0 & Mongoose ODM

- **Status**: Accepted (Reconciles T2 Process Models reference to PostgreSQL)
- **Date**: October 2026
- **Context**:
  Tutorial 2 proposed relational PostgreSQL for transactional integrity. However, hospital outpatient operations involve semi-structured clinical entities: dynamic prescription drug regimens, variable allergy lists, unstructured medical history items, categorized line items, and nested diagnostic test orders.
- **Decision**:
  PulseCare HMS utilizes **MongoDB 8.0 with Mongoose ODM** paired with an atomic Counter sequence collection (`Counter.ts`) and Redis caching.
  - Transactional integrity is guaranteed via native MongoDB multi-document ACID transactions (`session.startTransaction()`) with atomic fallbacks.
  - Double booking is strictly prevented at the database layer using a partial unique compound index on `{ doctor: 1, date: 1, timeSlot: 1 }` with `{ partialFilterExpression: { status: { $nin: ['cancelled', 'noShow'] } } }`.
  - Sequential human-readable identifiers (`PAT-XXXX`, `DOC-XXXX`, `APT-XXXX`, `INV-XXXX`, `RX-XXXX`, `LAB-XXXX`) are atomically generated via `$inc` counters in `Counter.ts`.
- **Consequences**:
  - **Positive**: Rich support for nested document arrays without multi-table join latency; rapid schema evolution for clinical records.
  - **Mitigation**: Schema validation rules are enforced using Mongoose schema hooks and central Zod schema parsers.

---

## ADR-003: Invoicing Model — Staff POS Settlement & Simulated Online Gateway

- **Status**: Accepted (Reconciles SRS FR-E2-1 and T3)
- **Date**: October 2026
- **Context**:
  Hospital billing involves two distinct settlement channels:
  1. Front-desk walk-in settlement where staff collect cash, card swipe, or insurance coverage.
  2. Patient online invoice settlement.
- **Decision**:
  The billing module implements:
  - Staff Point-of-Sale settlement via `POST /api/v1/billing/:id/payments` with audit logging and amount-paid tracking.
  - Online self-checkout endpoint `POST /api/v1/billing/:id/pay-online` & `/checkout` returning simulated payment gateway transaction IDs (`RAZORPAY_PAY_<timestamp>_<rand>`) and updating invoice balances.
  - Production external Razorpay webhook receivers are maintained in the Phase 2 external integration roadmap.
- **Consequences**:
  - **Positive**: Complete payment lifecycle is fully operable and testable offline without depending on live third-party gateway credentials.

---

## ADR-004: Segregation of Duties (SoD) in Invoicing Permissions

- **Status**: Accepted (Reconciles T3 Receptionist Permissions vs Billing Test #7)
- **Date**: October 2026
- **Context**:
  To protect financial integrity, medical centers enforce dual-control accounting. Front-desk staff must not have unilateral authority to issue legal tax invoices or alter pricing without oversight.
- **Decision**:
  Role permissions are stratified as follows:
  - **Receptionist**: May generate draft invoices (`POST /api/v1/billing`) and record incoming patient payments (`POST /api/v1/billing/:id/payments`).
  - **Admin**: Holds exclusive authorization to formally transition an invoice from `draft` to legally binding `issued` status (`PATCH /api/v1/billing/:id/issue`) and void invoices (`PATCH /api/v1/billing/:id/void`).
- **Consequences**:
  - **Positive**: Adheres to financial auditing standards and internal control best practices.
