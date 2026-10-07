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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { downloadPdf } from '@/lib/downloadPdf';
import { Calendar, Clock, Download, Plus, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface DoctorUser {
  firstName: string;
  lastName: string;
  email: string;
}

interface DoctorRecord {
  _id: string;
  doctorId: string;
  specialization: string;
  consultationFee: number;
  leaves?: { startDate: string; endDate: string; reason?: string }[];
  userId: DoctorUser;
}

interface PatientUser {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

interface PatientRecord {
  _id: string;
  patientId: string;
  bloodGroup?: string;
  userId: PatientUser;
}

export interface StaffAppointmentRecord {
  _id: string;
  appointmentId: string;
  tokenNumber?: number;
  date: string;
  timeSlot: string;
  status: 'confirmed' | 'inProgress' | 'completed' | 'cancelled' | 'noShow' | string;
  type: string;
  reason?: string;
  notes?: string;
  cancelReason?: string;
  doctor: DoctorRecord;
  patient: PatientRecord;
  createdAt: string;
}

interface AppointmentsResponse {
  success: boolean;
  data: StaffAppointmentRecord[];
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface SlotsResponse {
  success: boolean;
  data: string[];
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

const todayStr = formatDate(new Date());
const tomorrowStr = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDate(d);
})();

export function AdminAppointments() {
  const queryClient = useQueryClient();

  // Filters state
  const [dateFilter, setDateFilter] = useState<string>('');
  const [doctorFilter, setDoctorFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const limit = 20;

  // Booking modal state
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState(todayStr);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [appointmentType, setAppointmentType] = useState<'consultation' | 'follow-up' | 'emergency' | 'procedure'>('consultation');
  const [bookingReason, setBookingReason] = useState('');

  // Booking confirmation modal state
  const [confirmedBooking, setConfirmedBooking] = useState<StaffAppointmentRecord | null>(null);

  // Status update modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<StaffAppointmentRecord | null>(null);
  const [newStatus, setNewStatus] = useState<string>('confirmed');
  const [statusNotes, setStatusNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  // Fetch doctors list
  const { data: doctorsData } = useQuery<{ success: boolean; data: DoctorRecord[] }>({
    queryKey: ['doctors', 'all-active'],
    queryFn: async () => {
      const res = await api.get('/doctors?isActive=true&limit=100');
      return res.data;
    },
  });
  const doctors = doctorsData?.data ?? [];

  // Fetch patients for booking dialog
  const { data: patientsData } = useQuery<{ success: boolean; data: PatientRecord[] }>({
    queryKey: ['patients', 'search', patientSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (patientSearch.trim()) params.set('search', patientSearch.trim());
      params.set('limit', '50');
      const res = await api.get(`/patients?${params}`);
      return res.data;
    },
    enabled: bookModalOpen,
  });
  const patients = patientsData?.data ?? [];

  // Fetch slots for booking dialog
  const { data: slotsData, isFetching: slotsLoading } = useQuery<SlotsResponse>({
    queryKey: ['slots', selectedDoctorId, bookingDate],
    queryFn: async () => {
      const res = await api.get(`/appointments/slots?doctorId=${selectedDoctorId}&date=${bookingDate}`);
      return res.data;
    },
    enabled: !!selectedDoctorId && !!bookingDate && bookModalOpen,
  });
  const availableSlots = slotsData?.data ?? [];

  // Fetch appointments list
  const { data: appointmentsData, isLoading: appointmentsLoading } = useQuery<AppointmentsResponse>({
    queryKey: ['admin', 'appointments', { date: dateFilter, doctorId: doctorFilter, status: statusFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      if (doctorFilter && doctorFilter !== 'all') params.set('doctorId', doctorFilter);
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      params.set('page', String(page));
      params.set('limit', String(limit));
      const res = await api.get(`/appointments?${params}`);
      return res.data;
    },
  });

  const appointments = appointmentsData?.data ?? [];
  const meta = appointmentsData?.meta;

  // Book appointment mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/appointments', {
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        date: bookingDate,
        timeSlot: selectedSlot,
        type: appointmentType,
        reason: bookingReason.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success('Appointment booked successfully!');
      setBookModalOpen(false);
      setConfirmedBooking(data.data);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'appointments'] });
      // Reset form
      setSelectedPatientId('');
      setSelectedDoctorId('');
      setSelectedSlot('');
      setBookingReason('');
    },
    onError: (err: unknown) => {
      const errorObj = (err as { response?: { status?: number; data?: { error?: { message?: string } } } })?.response;
      const status = errorObj?.status;
      const message = errorObj?.data?.error?.message;

      if (status === 409 || message?.toLowerCase().includes('already booked')) {
        toast.error('This time slot is already booked. Please choose another slot.');
      } else if (message?.toLowerCase().includes('leave')) {
        toast.error(message || 'Doctor is on leave on this date.');
      } else {
        toast.error(message || 'Failed to book appointment.');
      }
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAppointment) return;
      const payload: Record<string, string> = { status: newStatus };
      if (statusNotes.trim()) payload.notes = statusNotes.trim();
      if (newStatus === 'cancelled' && cancelReason.trim()) payload.cancelReason = cancelReason.trim();

      const res = await api.patch(`/appointments/${selectedAppointment._id}/status`, payload);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Appointment status updated successfully');
      setStatusModalOpen(false);
      setSelectedAppointment(null);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'appointments'] });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(message || 'Failed to update appointment status');
    },
  });

  const handleOpenStatusModal = (appointment: StaffAppointmentRecord) => {
    setSelectedAppointment(appointment);
    setNewStatus(appointment.status);
    setStatusNotes(appointment.notes ?? '');
    setCancelReason(appointment.cancelReason ?? '');
    setStatusModalOpen(true);
  };

  const handleDownloadSlip = (apt: StaffAppointmentRecord) => {
    const filename = `appointment-slip-${apt.tokenNumber ? `token-${apt.tokenNumber}` : apt.appointmentId}.pdf`;
    void downloadPdf(`/appointments/${apt._id}/slip`, filename);
  };

  // Table columns definition
  const columns: ColumnDef<StaffAppointmentRecord>[] = [
    {
      header: 'Token',
      accessorKey: 'tokenNumber',
      cell: (row) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
          #{row.tokenNumber ?? '—'}
        </span>
      ),
    },
    {
      header: 'Appointment ID',
      accessorKey: 'appointmentId',
      cell: (row) => <span className="font-mono text-xs font-semibold">{row.appointmentId}</span>,
    },
    {
      header: 'Patient',
      accessorKey: 'patient',
      cell: (row) => {
        const p = row.patient;
        return (
          <div>
            <div className="font-medium text-slate-900 dark:text-slate-100">
              {p?.userId?.firstName} {p?.userId?.lastName}
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {p?.patientId} {p?.userId?.phone ? `• ${p.userId.phone}` : ''}
            </div>
          </div>
        );
      },
    },
    {
      header: 'Doctor',
      accessorKey: 'doctor',
      cell: (row) => {
        const d = row.doctor;
        return (
          <div>
            <div className="font-medium text-slate-900 dark:text-slate-100">
              Dr. {d?.userId?.firstName} {d?.userId?.lastName}
            </div>
            <div className="text-xs text-muted-foreground">{d?.specialization}</div>
          </div>
        );
      },
    },
    {
      header: 'Date & Time',
      accessorKey: 'date',
      cell: (row) => (
        <div>
          <div className="font-medium text-slate-900 dark:text-slate-100">{row.date}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3 h-3 inline" /> {row.timeSlot}
          </div>
        </div>
      ),
    },
    {
      header: 'Type',
      accessorKey: 'type',
      cell: (row) => (
        <span className="capitalize text-xs font-medium text-slate-600 dark:text-slate-400">
          {row.type}
        </span>
      ),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      accessorKey: '_id',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2"
            onClick={() => handleOpenStatusModal(row)}
          >
            Update
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs px-2 text-teal-600 dark:text-teal-400 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30"
            onClick={() => handleDownloadSlip(row)}
            title="Download Appointment Slip"
          >
            <Download className="w-3.5 h-3.5 mr-1" /> Slip
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-7 h-7 text-teal-600 dark:text-teal-400" />
            Appointment Management
          </h1>
          <p className="text-muted-foreground">
            Schedule walk-ins, filter daily queues, and manage patient consultation statuses
          </p>
        </div>
        <Button
          onClick={() => {
            setConfirmedBooking(null);
            setBookModalOpen(true);
          }}
          className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
        >
          <Plus className="w-4 h-4" /> Book for Patient
        </Button>
      </div>

      {/* Filters Bar */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Date</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setPage(1);
                  }}
                  className="h-9"
                />
              </div>
              <div className="flex gap-1.5 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={dateFilter === todayStr ? 'default' : 'outline'}
                  className={`h-6 text-xs px-2 ${dateFilter === todayStr ? 'bg-teal-600 hover:bg-teal-700 text-white' : ''}`}
                  onClick={() => {
                    setDateFilter(todayStr);
                    setPage(1);
                  }}
                >
                  Today
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={dateFilter === tomorrowStr ? 'default' : 'outline'}
                  className={`h-6 text-xs px-2 ${dateFilter === tomorrowStr ? 'bg-teal-600 hover:bg-teal-700 text-white' : ''}`}
                  onClick={() => {
                    setDateFilter(tomorrowStr);
                    setPage(1);
                  }}
                >
                  Tomorrow
                </Button>
                {dateFilter && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 text-xs px-2 text-muted-foreground"
                    onClick={() => {
                      setDateFilter('');
                      setPage(1);
                    }}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* Doctor filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Doctor</Label>
              <Select
                value={doctorFilter}
                onChange={(e) => {
                  setDoctorFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9"
              >
                <option value="all">All Doctors</option>
                {doctors.map((d) => (
                  <option key={d._id} value={d._id}>
                    Dr. {d.userId.firstName} {d.userId.lastName} ({d.specialization})
                  </option>
                ))}
              </Select>
            </div>

            {/* Status filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">Status</Label>
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9"
              >
                <option value="all">All Statuses</option>
                <option value="confirmed">Confirmed</option>
                <option value="inProgress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="noShow">No Show</option>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments Data Table */}
      <Card>
        <CardHeader className="py-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">
              Appointments List {meta?.total !== undefined ? `(${meta.total})` : ''}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            data={appointments}
            columns={columns}
            isLoading={appointmentsLoading}
            emptyMessage="No appointments found for the selected filters."
          />
        </CardContent>
      </Card>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Page {meta.page} of {meta.totalPages} ({meta.total} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Book for Patient Modal */}
      <Dialog open={bookModalOpen} onOpenChange={setBookModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Plus className="w-5 h-5 text-teal-600" /> Book Appointment for Patient
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 1. Patient Selector */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Select Patient</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="Filter patient by name, ID, or phone..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <div className="max-h-36 overflow-y-auto border rounded-md divide-y text-sm">
                {patients.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground text-center">No patients found</p>
                ) : (
                  patients.map((p) => (
                    <div
                      key={p._id}
                      onClick={() => setSelectedPatientId(p._id)}
                      className={`p-2.5 flex items-center justify-between cursor-pointer transition-colors ${
                        selectedPatientId === p._id
                          ? 'bg-teal-50 dark:bg-teal-950/40 border-l-4 border-teal-600 text-teal-900 dark:text-teal-100 font-medium'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div>
                        <p className="font-medium">
                          {p.userId?.firstName} {p.userId?.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.patientId} {p.userId?.phone ? `• ${p.userId.phone}` : ''}
                        </p>
                      </div>
                      {selectedPatientId === p._id && (
                        <span className="text-teal-600 text-xs font-semibold">Selected ✓</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 2. Doctor Selector */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Select Doctor</Label>
              <Select
                value={selectedDoctorId}
                onChange={(e) => {
                  setSelectedDoctorId(e.target.value);
                  setSelectedSlot('');
                }}
                className="h-10"
              >
                <option value="">-- Choose Doctor --</option>
                {doctors.map((d) => (
                  <option key={d._id} value={d._id}>
                    Dr. {d.userId.firstName} {d.userId.lastName} — {d.specialization} (₹{d.consultationFee})
                  </option>
                ))}
              </Select>
            </div>

            {/* 3. Date Picker */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Appointment Date</Label>
              <Input
                type="date"
                min={todayStr}
                value={bookingDate}
                onChange={(e) => {
                  setBookingDate(e.target.value);
                  setSelectedSlot('');
                }}
                className="h-10"
              />
            </div>

            {/* 4. Time Slot Picker */}
            <div className="space-y-2">
              <Label className="font-semibold text-sm flex items-center justify-between">
                <span>Available Time Slots</span>
                {slotsLoading && <span className="text-xs text-muted-foreground animate-pulse">Loading slots...</span>}
              </Label>

              {!selectedDoctorId ? (
                <p className="text-xs text-muted-foreground p-3 border rounded bg-slate-50 dark:bg-slate-800/50">
                  Please select a doctor to view available time slots.
                </p>
              ) : slotsLoading ? (
                <p className="text-xs text-muted-foreground p-3 border rounded">Checking schedule...</p>
              ) : availableSlots.length === 0 ? (
                <div className="p-3 border rounded border-amber-200 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No slots available for this doctor on {bookingDate} (doctor may be on leave, off duty, or fully booked).</span>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1">
                  {availableSlots.map((slot) => (
                    <Button
                      key={slot}
                      type="button"
                      size="sm"
                      variant={selectedSlot === slot ? 'default' : 'outline'}
                      className={`h-9 text-xs font-mono font-medium ${
                        selectedSlot === slot
                          ? 'bg-teal-600 hover:bg-teal-700 text-white'
                          : 'hover:border-teal-500'
                      }`}
                      onClick={() => setSelectedSlot(slot)}
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Appointment Type */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Type</Label>
              <Select
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value as typeof appointmentType)}
                className="h-9"
              >
                <option value="consultation">Consultation</option>
                <option value="follow-up">Follow-Up</option>
                <option value="emergency">Emergency</option>
                <option value="procedure">Procedure</option>
              </Select>
            </div>

            {/* 6. Reason / Notes */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-sm">Reason / Chief Complaint</Label>
              <Input
                placeholder="e.g. Fever, persistent cough, regular follow up"
                value={bookingReason}
                onChange={(e) => setBookingReason(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBookModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedPatientId || !selectedDoctorId || !selectedSlot || bookMutation.isPending}
              onClick={() => bookMutation.mutate()}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {bookMutation.isPending ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking Confirmation Dialog */}
      {confirmedBooking && (
        <Dialog open={!!confirmedBooking} onOpenChange={() => setConfirmedBooking(null)}>
          <DialogContent className="max-w-md text-center">
            <div className="mx-auto w-14 h-14 bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-300 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl text-center">Appointment Confirmed!</DialogTitle>
            </DialogHeader>

            <div className="p-4 bg-teal-50/50 dark:bg-teal-950/30 rounded-xl border border-teal-200 dark:border-teal-800 space-y-2 my-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Daily Queue Token
              </p>
              <p className="text-4xl font-black text-teal-600 dark:text-teal-400">
                #{confirmedBooking.tokenNumber ?? 1}
              </p>
              <div className="text-xs text-muted-foreground font-mono">
                {confirmedBooking.appointmentId}
              </div>
              <div className="pt-2 text-sm text-slate-700 dark:text-slate-300">
                <p className="font-semibold">
                  Dr. {confirmedBooking.doctor?.userId?.firstName} {confirmedBooking.doctor?.userId?.lastName}
                </p>
                <p className="text-xs text-muted-foreground">{confirmedBooking.doctor?.specialization}</p>
                <p className="text-xs font-medium text-teal-700 dark:text-teal-300 mt-1">
                  {confirmedBooking.date} at {confirmedBooking.timeSlot}
                </p>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setConfirmedBooking(null)}
              >
                Close
              </Button>
              <Button
                className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white gap-2"
                onClick={() => handleDownloadSlip(confirmedBooking)}
              >
                <Download className="w-4 h-4" /> Download Slip
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Status Update Modal */}
      {selectedAppointment && (
        <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Update Appointment Status</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Appointment: <span className="font-mono">{selectedAppointment.appointmentId}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Patient: {selectedAppointment.patient?.userId?.firstName} {selectedAppointment.patient?.userId?.lastName} • Token #{selectedAppointment.tokenNumber ?? '—'}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Status</Label>
                <Select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="h-9"
                >
                  <option value="confirmed">Confirmed</option>
                  <option value="inProgress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="noShow">No Show</option>
                </Select>
              </div>

              {newStatus === 'cancelled' && (
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">Cancellation Reason</Label>
                  <Input
                    placeholder="e.g. Patient requested, doctor emergency"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="h-9"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Notes</Label>
                <Input
                  placeholder="Optional notes or remarks"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setStatusModalOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={updateStatusMutation.isPending}
                onClick={() => updateStatusMutation.mutate()}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {updateStatusMutation.isPending ? 'Updating...' : 'Save Status'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
