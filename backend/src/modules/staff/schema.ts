import { z } from 'zod';

export const DoctorLeaveSchema = z.object({
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  reason: z.string().optional(),
}).refine(
  (data) => new Date(data.endDate).getTime() >= new Date(data.startDate).getTime(),
  { message: 'endDate must be greater than or equal to startDate', path: ['endDate'] }
);

export const CreateStaffSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  dob: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  role: z.enum(['doctor', 'nurse', 'receptionist']),
  // Doctor-specific
  specialization: z.string().optional(),
  qualification: z.array(z.string()).optional(),
  departmentId: z.string().optional(),
  consultationFee: z.number().min(0).optional(),
  leaves: z.array(DoctorLeaveSchema).optional(),
  // Nurse-specific
  ward: z.string().optional(),
  shift: z.enum(['morning', 'afternoon', 'night']).optional(),
});

export const UpdateStaffSchema = CreateStaffSchema.partial().omit({ email: true, password: true, role: true });

export const CreateDepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  headDoctorId: z.string().optional(),
  bedCount: z.number().min(0).optional(),
  location: z.string().optional(),
});

export const UpdateDepartmentSchema = CreateDepartmentSchema.partial();
