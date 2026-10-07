import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable, ColumnDef } from '@/components/Shared/DataTable';
import { StatusBadge } from '@/components/Shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import toast from 'react-hot-toast';

interface StaffUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

export interface DoctorLeave {
  startDate: string;
  endDate: string;
  reason?: string;
}

interface DoctorProfile {
  _id: string;
  doctorId?: string;
  nurseId?: string;
  receptionistId?: string;
  specialization?: string;
  department?: { _id: string; name: string } | null;
  leaves?: DoctorLeave[];
  userId: StaffUser;
  isActive: boolean;
}

interface StaffEntry {
  role: string;
  profile: DoctorProfile;
}

interface StaffResponse {
  success: boolean;
  data: StaffEntry[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface DepartmentRecord {
  _id: string;
  name: string;
}

interface CreateStaffForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'doctor' | 'receptionist';
  specialization: string;
  departmentId: string;
  qualification: string;
}

const defaultForm: CreateStaffForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'doctor',
  specialization: '',
  departmentId: '',
  qualification: '',
};

export function AdminStaff() {
  const [modalOpen, setModalOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<StaffEntry | null>(null);
  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);
  const [newLeaveStart, setNewLeaveStart] = useState('');
  const [newLeaveEnd, setNewLeaveEnd] = useState('');
  const [newLeaveReason, setNewLeaveReason] = useState('');

  const [form, setForm] = useState<CreateStaffForm>(defaultForm);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<StaffResponse>({
    queryKey: ['staff', page],
    queryFn: async () => {
      const res = await api.get(`/staff?page=${page}&limit=20`);
      return res.data;
    },
  });

  const { data: deptData } = useQuery<{ success: boolean; data: DepartmentRecord[] }>({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/departments');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: Omit<CreateStaffForm, 'qualification'> & { qualification: string[] }) => {
      const res = await api.post('/staff', payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Staff member created successfully');
      setModalOpen(false);
      setForm(defaultForm);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to create staff member';
      toast.error(msg);
    },
  });

  const updateLeaveMutation = useMutation({
    mutationFn: async (updatedLeaves: DoctorLeave[]) => {
      if (!selectedDoctor) return;
      const res = await api.patch(`/staff/${selectedDoctor.profile.userId._id}`, {
        leaves: updatedLeaves,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Doctor leaves updated successfully');
      setLeaveModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['staff'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to update doctor leaves';
      toast.error(msg);
    },
  });

  const handleAddLeave = () => {
    if (!newLeaveStart || !newLeaveEnd) {
      toast.error('Start date and end date are required');
      return;
    }
    if (newLeaveEnd < newLeaveStart) {
      toast.error('End date must be greater than or equal to start date');
      return;
    }
    setLeaves([
      ...leaves,
      {
        startDate: newLeaveStart,
        endDate: newLeaveEnd,
        reason: newLeaveReason.trim() || 'Annual Leave',
      },
    ]);
    setNewLeaveStart('');
    setNewLeaveEnd('');
    setNewLeaveReason('');
  };

  const handleRemoveLeave = (idx: number) => {
    setLeaves(leaves.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      qualification: form.qualification
        ? form.qualification.split(',').map((q) => q.trim()).filter(Boolean)
        : [],
    });
  };

  const columns: ColumnDef<StaffEntry>[] = [
    {
      header: 'Staff ID',
      accessorKey: 'profile',
      cell: (row) =>
        row.profile.doctorId ?? row.profile.nurseId ?? row.profile.receptionistId ?? '—',
    },
    {
      header: 'Name',
      accessorKey: 'profile.userId',
      cell: (row) =>
        `${row.profile.userId?.firstName ?? ''} ${row.profile.userId?.lastName ?? ''}`,
    },
    {
      header: 'Role',
      accessorKey: 'role',
      cell: (row) => (
        <span className="capitalize">{row.role}</span>
      ),
    },
    {
      header: 'Specialization',
      accessorKey: 'profile.specialization',
      cell: (row) => row.profile.specialization ?? '—',
    },
    {
      header: 'Department',
      accessorKey: 'profile.department',
      cell: (row) => row.profile.department?.name ?? '—',
    },
    {
      header: 'Email',
      accessorKey: 'profile.userId.email',
      cell: (row) => row.profile.userId?.email ?? '—',
    },
    {
      header: 'Status',
      accessorKey: 'profile.isActive',
      cell: (row) => (
        <StatusBadge status={row.profile.isActive ? 'active' : 'inactive'} />
      ),
    },
    {
      header: 'Actions',
      accessorKey: '_id',
      cell: (row) =>
        row.role === 'doctor' ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedDoctor(row);
              setLeaves(
                (row.profile.leaves ?? []).map((l) => ({
                  startDate: l.startDate ? new Date(l.startDate).toISOString().split('T')[0] : '',
                  endDate: l.endDate ? new Date(l.endDate).toISOString().split('T')[0] : '',
                  reason: l.reason,
                }))
              );
              setNewLeaveStart('');
              setNewLeaveEnd('');
              setNewLeaveReason('');
              setLeaveModalOpen(true);
            }}
          >
            Time Off
          </Button>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        ),
    },
  ];

  const staff = data?.data ?? [];
  const meta = data?.meta;
  const departments = deptData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff</h1>
          <p className="text-muted-foreground">Manage hospital doctors and receptionists</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>Add Staff</Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Staff List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={staff}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No staff members found"
          />

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages} — {meta.total} total staff
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (meta.totalPages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent onClose={() => setModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <Select
                id="role"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as CreateStaffForm['role'] })
                }
                required
              >
                <option value="doctor">Doctor</option>
                <option value="receptionist">Receptionist</option>
              </Select>
            </div>

            {form.role === 'doctor' && (
              <div className="space-y-1">
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  required={form.role === 'doctor'}
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="departmentId">Department</Label>
              <Select
                id="departmentId"
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                placeholder="Select department (optional)"
              >
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="qualification">Qualifications (comma-separated)</Label>
              <Input
                id="qualification"
                placeholder="e.g. MBBS, MD"
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Staff'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Doctor Time Off / Leaves Modal */}
      <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
        <DialogContent onClose={() => setLeaveModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>
              Doctor Time Off — Dr. {selectedDoctor?.profile.userId.firstName}{' '}
              {selectedDoctor?.profile.userId.lastName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {/* Existing leaves list */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Current Scheduled Leave Periods
              </Label>
              {leaves.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No leave scheduled for this doctor.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {leaves.map((l, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg border p-2.5 text-xs bg-slate-50 dark:bg-slate-900"
                    >
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {l.startDate} to {l.endDate}
                        </p>
                        <p className="text-muted-foreground">{l.reason || 'Leave'}</p>
                      </div>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveLeave(idx)}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add new leave section */}
            <div className="border-t pt-4 space-y-3">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Add New Leave Period
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="leaveStart" className="text-xs">Start Date</Label>
                  <Input
                    id="leaveStart"
                    type="date"
                    value={newLeaveStart}
                    onChange={(e) => setNewLeaveStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="leaveEnd" className="text-xs">End Date</Label>
                  <Input
                    id="leaveEnd"
                    type="date"
                    value={newLeaveEnd}
                    onChange={(e) => setNewLeaveEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="leaveReason" className="text-xs">Reason (optional)</Label>
                <Input
                  id="leaveReason"
                  placeholder="e.g. Conference, Medical leave"
                  value={newLeaveReason}
                  onChange={(e) => setNewLeaveReason(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={handleAddLeave} className="w-full">
                + Add Leave Window
              </Button>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setLeaveModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={updateLeaveMutation.isPending}
                onClick={() => updateLeaveMutation.mutate(leaves)}
              >
                {updateLeaveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
