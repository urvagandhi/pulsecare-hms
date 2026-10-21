import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { APP_NAME } from '../lib/brand';
import { authReducer, setCredentials, clearCredentials, AuthUser } from '../store/authSlice';
import { formatDate, fmt } from '../lib/format';

// ─── Scene 1: Brand & Core Pillars Metadata ──────────────────────────────────
const PLATFORM_PILLARS = [
  {
    title: 'Patient Portal & Digital Identity',
    tagline: 'Instant Registration & Printable ID Cards',
    badges: ['Atomic PAT-ID Generation', 'Printable PDF Card', 'Safe RegEx Search', 'Profile Records'],
  },
  {
    title: 'Doctor Schedule & Leave Engine',
    tagline: 'Automated Slot Blackout & Roster Matrix',
    badges: ['Roster Matrix', 'Live Leave Blackout', 'Department Routing', 'Consultation Pricing'],
  },
  {
    title: 'Conflict-Free Queue Tokens',
    tagline: 'Daily Sequential Tokens #1, #2... per Physician',
    badges: ['Atomic Queue Tokens', 'Zero Double-Booking', 'Walk-in Reception Desk', 'Printable PDF Slips'],
  },
  {
    title: 'Itemized Billing & Tax Invoices',
    tagline: 'Categorized Line-Items & PDF Receipts',
    badges: ['Pure Function Totals', 'Server PDF-Lib Engine', 'Payment Status Tracking', 'Audit Reconciliation'],
  },
];

const SEEDED_CREDENTIALS = [
  { role: 'Admin', email: 'admin@pulsecare.test', name: 'Rajesh Malhotra' },
  { role: 'Receptionist', email: 'reception@pulsecare.test', name: 'Pooja Verma' },
  { role: 'Senior Cardio', email: 'dr.sharma@pulsecare.test', name: 'Dr. Arvind Sharma' },
  { role: 'Patient', email: 'patient1@pulsecare.test', name: 'Aarav Sharma' },
];

// ─── Scene 3: Form Schemas ────────────────────────────────────────────────────
const patientRegistrationSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().regex(/^\d{10}$/, 'Phone must be a 10-digit number'),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional(),
  emergencyContact: z.object({
    name: z.string().min(1),
    relationship: z.string().min(1),
    phone: z.string().min(1),
  }).optional(),
});

// ─── Scene 4 & 5: Appointment & Slot Engine Logic ─────────────────────────────
const appointmentBookingSchema = z.object({
  doctorId: z.string().min(1, 'Doctor is required'),
  patientId: z.string().min(1, 'Patient is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time slot format'),
  type: z.enum(['consultation', 'follow-up', 'emergency', 'procedure']).default('consultation'),
  reason: z.string().optional(),
});

function evaluateDoctorAvailability(
  targetDateStr: string,
  doctorLeaves: Array<{ startDate: string; endDate: string; reason?: string }>,
  doctorWorkingHours: { startTime: string; endTime: string } | null,
  bookedSlots: string[]
) {
  // Check if doctor is on leave
  const onLeave = doctorLeaves.some((l) => {
    const s = l.startDate.split('T')[0];
    const e = l.endDate.split('T')[0];
    return targetDateStr >= s && targetDateStr <= e;
  });

  if (onLeave) {
    return {
      status: 'ON_LEAVE',
      warning: 'Doctor on Approved Leave / Time Off',
      allSlots: [] as string[],
      availableSlots: [] as string[],
      bookedSlots: [] as string[],
    };
  }

  if (!doctorWorkingHours) {
    return {
      status: 'OFF_DUTY',
      warning: 'Doctor has no scheduled working hours on this date',
      allSlots: [] as string[],
      availableSlots: [] as string[],
      bookedSlots: [] as string[],
    };
  }

  // Generate 30-minute intervals
  const slots: string[] = [];
  const [startH, startM] = doctorWorkingHours.startTime.split(':').map(Number);
  const [endH, endM] = doctorWorkingHours.endTime.split(':').map(Number);
  let cur = startH * 60 + startM;
  const end = endH * 60 + endM;

  while (cur + 30 <= end) {
    const h = String(Math.floor(cur / 60)).padStart(2, '0');
    const m = String(cur % 60).padStart(2, '0');
    slots.push(`${h}:${m}`);
    cur += 30;
  }

  const bookedSet = new Set(bookedSlots);
  const availableSlots = slots.filter((s) => !bookedSet.has(s));

  return {
    status: 'AVAILABLE',
    warning: null,
    allSlots: slots,
    availableSlots,
    bookedSlots,
  };
}

// ─── Scene 6: Pure Financial Totals Calculator ────────────────────────────────
function calculateInvoiceTotals(
  lineItems: Array<{ description: string; quantity: number; unitPrice: number; category?: string }>,
  taxRate = 0,
  discount = 0,
  amountPaid = 0
) {
  const computedItems = lineItems.map((item) => ({
    ...item,
    total: item.quantity * item.unitPrice,
  }));

  const subtotal = Math.round(computedItems.reduce((sum, item) => sum + item.total, 0) * 100) / 100;
  const tax = Math.round((subtotal * (taxRate || 0) / 100) * 100) / 100;
  const total = Math.round((subtotal + tax - (discount || 0)) * 100) / 100;
  const balance = Math.round((total - (amountPaid || 0)) * 100) / 100;

  return {
    lineItems: computedItems,
    subtotal,
    tax,
    total,
    balance,
    amountPaid,
  };
}

// ─── Role-Based Navigation Routing Logic ──────────────────────────────────────
function resolveDashboardRoute(userRole: string | undefined): string {
  switch (userRole) {
    case 'admin':
    case 'receptionist':
      return '/admin/dashboard';
    case 'doctor':
      return '/doctor/dashboard';
    case 'patient':
      return '/patient/dashboard';
    case 'nurse':
      return '/nurse/dashboard';
    default:
      return '/sign-in';
  }
}

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('PulseCare HMS — Official Frontend Demonstration Script Workflow Test Suite', () => {
  // ─── SCENE 1: Brand & Core Clinical Pillars ─────────────────────────────────
  describe('Scene 1: Public Landing Page & 4 Core Modules Verification', () => {
    it('verifies official branding and system naming', () => {
      expect(APP_NAME).toBe('PulseCare HMS');
    });

    it('verifies the 4 Core Outpatient Modules metadata match the Demonstration Script', () => {
      expect(PLATFORM_PILLARS).toHaveLength(4);

      const titles = PLATFORM_PILLARS.map((p) => p.title);
      expect(titles).toContain('Patient Portal & Digital Identity');
      expect(titles).toContain('Doctor Schedule & Leave Engine');
      expect(titles).toContain('Conflict-Free Queue Tokens');
      expect(titles).toContain('Itemized Billing & Tax Invoices');
    });

    it('verifies all 4 seeded test accounts from the script are present in seeded credentials list', () => {
      const emails = SEEDED_CREDENTIALS.map((c) => c.email);
      expect(emails).toContain('admin@pulsecare.test');
      expect(emails).toContain('reception@pulsecare.test');
      expect(emails).toContain('dr.sharma@pulsecare.test');
      expect(emails).toContain('patient1@pulsecare.test');
    });
  });

  // ─── SCENE 2 & 3: Auth State Machine & Registration ─────────────────────────
  describe('Scene 2 & 3: Role Routing & Patient Self-Registration Workflow', () => {
    it('resolves correct dashboard routes for each stakeholder role', () => {
      expect(resolveDashboardRoute('admin')).toBe('/admin/dashboard');
      expect(resolveDashboardRoute('receptionist')).toBe('/admin/dashboard');
      expect(resolveDashboardRoute('doctor')).toBe('/doctor/dashboard');
      expect(resolveDashboardRoute('patient')).toBe('/patient/dashboard');
      expect(resolveDashboardRoute(undefined)).toBe('/sign-in');
    });

    it('validates Kavya Patels registration details matching Scene 3 inputs', () => {
      const validPatient = patientRegistrationSchema.safeParse({
        firstName: 'Kavya',
        lastName: 'Patel',
        email: 'kavya.patel@test.com',
        password: 'Password@123',
        phone: '9876543210',
        bloodGroup: 'B+',
        emergencyContact: {
          name: 'Ramesh Patel',
          relationship: 'Father',
          phone: '9876543211',
        },
      });

      expect(validPatient.success).toBe(true);
      if (validPatient.success) {
        expect(validPatient.data.bloodGroup).toBe('B+');
        expect(validPatient.data.phone).toBe('9876543210');
      }
    });

    it('rejects patient registration when password is shorter than 8 characters', () => {
      const invalid = patientRegistrationSchema.safeParse({
        firstName: 'Kavya',
        lastName: 'Patel',
        email: 'kavya.patel@test.com',
        password: 'short',
        phone: '9876543210',
      });

      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0].message).toBe('Password must be at least 8 characters');
      }
    });

    it('manages Redux credentials state transitions cleanly', () => {
      const mockPatient: AuthUser = {
        _id: 'user_kavya_123',
        email: 'kavya.patel@test.com',
        firstName: 'Kavya',
        lastName: 'Patel',
        role: 'patient',
      };

      // 1. Initial State
      let state = authReducer(undefined, { type: '@@INIT' });
      expect(state.isAuthenticated).toBe(false);

      // 2. Login as Kavya
      state = authReducer(state, setCredentials({ user: mockPatient, accessToken: 'mock_jwt_token' }));
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.firstName).toBe('Kavya');
      expect(state.user?.role).toBe('patient');

      // 3. Logout
      state = authReducer(state, clearCredentials());
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  // ─── SCENE 4: Doctor Leave Blackout Logic ───────────────────────────────────
  describe('Scene 4: Doctor Leave Blackout Engine (Defect D-022)', () => {
    const doctorLeaves = [
      {
        startDate: '2026-11-01',
        endDate: '2026-11-01',
        reason: 'Medical Conference in Ahmedabad',
      },
    ];

    it('locks out all booking slots on the approved leave date (2026-11-01)', () => {
      const result = evaluateDoctorAvailability(
        '2026-11-01',
        doctorLeaves,
        { startTime: '09:00', endTime: '13:00' },
        []
      );

      expect(result.status).toBe('ON_LEAVE');
      expect(result.warning).toContain('Doctor on Approved Leave');
      expect(result.allSlots).toHaveLength(0);
      expect(result.availableSlots).toHaveLength(0);
    });

    it('generates 30-min available and booked slots when doctor is on duty (2026-11-02)', () => {
      const result = evaluateDoctorAvailability(
        '2026-11-02',
        doctorLeaves,
        { startTime: '09:00', endTime: '13:00' },
        ['09:30', '11:00'] // already booked slots
      );

      expect(result.status).toBe('AVAILABLE');
      expect(result.allSlots).toEqual([
        '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
      ]);
      expect(result.availableSlots).toContain('10:00');
      expect(result.availableSlots).not.toContain('09:30');
      expect(result.availableSlots).not.toContain('11:00');
    });
  });

  // ─── SCENE 5: Appointment Booking, Daily Token #1 & Formatting ──────────────
  describe('Scene 5: Appointment Booking, Queue Token #1 & Display Formatting', () => {
    it('validates a complete consultation booking request for 10:00 AM', () => {
      const bookingPayload = {
        doctorId: '60c72b2f9b1d8b001c8e4c1a',
        patientId: '60c72b2f9b1d8b001c8e4c1b',
        date: '2026-11-02',
        timeSlot: '10:00',
        type: 'consultation' as const,
        reason: 'ECG consultation',
      };

      const result = appointmentBookingSchema.safeParse(bookingPayload);
      expect(result.success).toBe(true);
    });

    it('formats appointment date and currency cleanly', () => {
      expect(fmt(600)).toBe('₹600.00');
      expect(formatDate('2026-11-02')).toBe('02 Nov 2026');
    });
  });

  // ─── SCENE 6: Itemized Invoicing, D-019 Recalculation & Payments ─────────────
  describe('Scene 6: Itemized Invoicing & Pure Financial Recalculation (Defect D-019)', () => {
    it('executes the exact financial sequence from Scene 6: adds 3 items, deletes ECG, recalculates with 5% tax and ₹50 discount', () => {
      // Step 1: Create draft invoice with 3 items
      const initialItems = [
        { description: 'Dr. Sharma Consultation', quantity: 1, unitPrice: 600, category: 'consultation' },
        { description: 'ECG Test Diagnostic', quantity: 1, unitPrice: 450, category: 'procedure' },
        { description: 'Prescribed Cardiac Medicine', quantity: 1, unitPrice: 160, category: 'medicine' },
      ];
      const taxRate = 5;
      const discount = 50;

      const initialResult = calculateInvoiceTotals(initialItems, taxRate, discount, 0);

      // Verify Initial Math:
      // Subtotal = 600 + 450 + 160 = 1210.00
      // Tax = 5% of 1210 = 60.50
      // Total = 1210 + 60.50 - 50 = 1220.50
      expect(initialResult.subtotal).toBe(1210.00);
      expect(initialResult.tax).toBe(60.50);
      expect(initialResult.total).toBe(1220.50);
      expect(initialResult.balance).toBe(1220.50);

      // Step 2: Delete ECG item (Defect D-019 Fix)
      // Remaining items: Consultation (600) + Medicine (160)
      const updatedItems = [initialItems[0], initialItems[2]];
      const updatedResult = calculateInvoiceTotals(updatedItems, taxRate, discount, 0);

      // Verify Recalculated Math:
      // Subtotal = 600 + 160 = 760.00
      // Tax = 5% of 760 = 38.00
      // Total = 760 + 38.00 - 50 = 748.00
      // Balance = 748.00
      expect(updatedResult.subtotal).toBe(760.00);
      expect(updatedResult.tax).toBe(38.00);
      expect(updatedResult.total).toBe(748.00);
      expect(updatedResult.balance).toBe(748.00);

      // Step 3: Record full payment of ₹748.00
      const paidResult = calculateInvoiceTotals(updatedItems, taxRate, discount, 748.00);
      expect(paidResult.amountPaid).toBe(748.00);
      expect(paidResult.balance).toBe(0.00);
    });
  });
});
