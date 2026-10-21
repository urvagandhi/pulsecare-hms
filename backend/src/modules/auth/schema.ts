import { z } from 'zod';

export const RegisterSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
    'Password must contain uppercase, lowercase, number, and special character'
  ),
  phone: z.string().optional(),
  dob: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  role: z.string().optional(),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional(),
  allergies: z.union([z.array(z.string()), z.string()]).optional(),
  emergencyContact: z
    .object({
      name: z.string().optional(),
      relationship: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
}).refine((data) => !data.role || data.role === 'patient', {
  message: 'Privileged roles cannot be set via public registration',
  path: ['role'],
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
    'Password must contain uppercase, lowercase, number, and special character'
  ),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
