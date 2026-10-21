import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials, AuthUser } from '@/store/authSlice';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Logo } from '@/components/Shared/Logo';
import { APP_NAME } from '@/lib/brand';

const signUpSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/,
      'Password must contain uppercase, lowercase, number, and special character'
    ),
  bloodGroup: z.enum(['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']).optional().or(z.literal('')),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  allergies: z.string().optional(),
});
type SignUpForm = z.infer<typeof signUpSchema>;

export function SignUp() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { register, handleSubmit, formState: { errors } } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
  });

  const registerMutation = useMutation({
    mutationFn: (data: SignUpForm) => {
      const payload = {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        bloodGroup: data.bloodGroup || undefined,
        allergies: data.allergies ? data.allergies.split(',').map((s) => s.trim()).filter(Boolean) : [],
        emergencyContact: (data.emergencyName || data.emergencyPhone)
          ? {
              name: data.emergencyName || '',
              relationship: 'Emergency Contact',
              phone: data.emergencyPhone || '',
            }
          : undefined,
      };
      return api.post<{ data: { user: AuthUser; accessToken: string } }>('/auth/register', payload);
    },
    onSuccess: ({ data }) => {
      queryClient.clear();
      dispatch(setCredentials({ user: data.data.user, accessToken: data.data.accessToken }));
      navigate('/dashboard', { replace: true });
    },
  });

  const onSubmit = (data: SignUpForm) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-accent/5 p-4 py-8">
      <Card className="w-full max-w-lg shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader className="text-center pb-3">
          <div className="flex justify-center mb-3">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-2xl font-extrabold tracking-tight">Create Patient Account</CardTitle>
          <p className="text-muted-foreground text-xs mt-1">
            Register on {APP_NAME} to book consultations and access health records
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs font-medium">First name</Label>
                <Input id="firstName" placeholder="Kavya" className="h-9 text-xs" {...register('firstName')} />
                {errors.firstName && <p className="text-destructive text-[11px]">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-xs font-medium">Last name</Label>
                <Input id="lastName" placeholder="Patel" className="h-9 text-xs" {...register('lastName')} />
                {errors.lastName && <p className="text-destructive text-[11px]">{errors.lastName.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium">Email address</Label>
                <Input id="email" type="email" placeholder="kavya.patel@test.com" className="h-9 text-xs" {...register('email')} />
                {errors.email && <p className="text-destructive text-[11px]">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" className="h-9 text-xs" {...register('password')} />
                {errors.password && <p className="text-destructive text-[11px]">{errors.password.message}</p>}
              </div>
            </div>

            {/* Clinical Essentials (Module 1: Patient Registration & Profile Management) */}
            <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Clinical Essentials (Module 1)
                </span>
                <span className="text-[10px] text-muted-foreground">Optional</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bloodGroup" className="text-xs">Blood Group</Label>
                  <select
                    id="bloodGroup"
                    {...register('bloodGroup')}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="allergies" className="text-xs">Known Drug Allergies</Label>
                  <Input
                    id="allergies"
                    placeholder="e.g. Penicillin, Sulfa"
                    className="h-9 text-xs"
                    {...register('allergies')}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="emergencyName" className="text-xs">Emergency Contact</Label>
                  <Input
                    id="emergencyName"
                    placeholder="e.g. Rajesh Patel (Father)"
                    className="h-9 text-xs"
                    {...register('emergencyName')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emergencyPhone" className="text-xs">Emergency Phone</Label>
                  <Input
                    id="emergencyPhone"
                    placeholder="e.g. +91 98765 43210"
                    className="h-9 text-xs"
                    {...register('emergencyPhone')}
                  />
                </div>
              </div>
            </div>

            {registerMutation.isError && (
              <p className="text-destructive text-xs text-center p-2 rounded-md bg-rose-50 dark:bg-rose-950/20">
                {(registerMutation.error as any)?.response?.data?.error?.message ??
                  'Registration failed. Please check details and try again.'}
              </p>
            )}

            <Button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 shadow-sm"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Creating Account & Profile...' : 'Complete Patient Registration'}
            </Button>

            <p className="text-center text-xs text-muted-foreground pt-1">
              Already have an account?{' '}
              <Link to="/sign-in" className="text-emerald-600 font-semibold hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
