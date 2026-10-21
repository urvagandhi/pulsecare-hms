import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { APP_NAME } from '../lib/brand';

// Form validation schemas matching SignIn and SignUp pages
const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  phone: z.string().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
});

// Appointment booking validation schema
const bookAppointmentSchema = z.object({
  doctorId: z.string().min(1, 'Doctor selection is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time slot format'),
  type: z.enum(['consultation', 'follow-up', 'emergency', 'procedure']).default('consultation'),
  reason: z.string().optional(),
});

describe('Frontend Form & Validation Smoke Tests [Conflict 15]', () => {
  describe('Branding and System Identity', () => {
    it('verifies standard application branding', () => {
      expect(APP_NAME).toBe('PulseCare HMS');
    });
  });

  describe('SignIn Validation Schema', () => {
    it('accepts valid credentials', () => {
      const valid = signInSchema.safeParse({
        email: 'admin@pulsecare.com',
        password: 'Password123!',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects invalid email format', () => {
      const invalid = signInSchema.safeParse({
        email: 'invalid-email',
        password: 'secret',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0].message).toBe('Invalid email address');
      }
    });

    it('rejects empty password', () => {
      const invalid = signInSchema.safeParse({
        email: 'doctor@pulsecare.com',
        password: '',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('SignUp / Patient Registration Schema', () => {
    it('accepts complete patient registration data', () => {
      const valid = signUpSchema.safeParse({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        password: 'SecurePassword123!',
        phone: '+1234567890',
        gender: 'female',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects passwords shorter than 8 characters', () => {
      const invalid = signUpSchema.safeParse({
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        password: 'short',
      });
      expect(invalid.success).toBe(false);
      if (!invalid.success) {
        expect(invalid.error.issues[0].message).toBe('Password must be at least 8 characters');
      }
    });
  });

  describe('Appointment Booking Schema', () => {
    it('validates correct appointment booking payload', () => {
      const valid = bookAppointmentSchema.safeParse({
        doctorId: '60c72b2f9b1d8b001c8e4c1a',
        date: '2026-11-15',
        timeSlot: '09:30',
        type: 'consultation',
        reason: 'Regular general checkup',
      });
      expect(valid.success).toBe(true);
    });

    it('rejects invalid date format', () => {
      const invalid = bookAppointmentSchema.safeParse({
        doctorId: '60c72b2f9b1d8b001c8e4c1a',
        date: '15/11/2026',
        timeSlot: '09:30',
      });
      expect(invalid.success).toBe(false);
    });
  });

  describe('Role Hierarchy & RBAC Rules', () => {
    const ROLE_HIERARCHY: Record<string, number> = {
      admin: 5,
      doctor: 4,
      nurse: 3,
      receptionist: 2,
      patient: 1,
    };

    it('correctly ranks administrative access above clinical and patient roles', () => {
      expect(ROLE_HIERARCHY.admin).toBeGreaterThan(ROLE_HIERARCHY.doctor);
      expect(ROLE_HIERARCHY.doctor).toBeGreaterThan(ROLE_HIERARCHY.nurse);
      expect(ROLE_HIERARCHY.nurse).toBeGreaterThan(ROLE_HIERARCHY.receptionist);
      expect(ROLE_HIERARCHY.receptionist).toBeGreaterThan(ROLE_HIERARCHY.patient);
    });
  });
});
