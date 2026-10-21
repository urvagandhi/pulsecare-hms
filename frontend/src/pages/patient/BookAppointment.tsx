import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Check, AlertTriangle } from 'lucide-react';
import { downloadPdf } from '@/lib/downloadPdf';
import toast from 'react-hot-toast';
import { formatDate } from '@/lib/format';

interface DoctorProfile {
  _id: string;
  doctorId: string;
  specialization: string;
  consultationFee: number;
  leaves?: { startDate: string; endDate: string; reason?: string }[];
  userId: {
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface DoctorsResponse {
  success: boolean;
  data: DoctorProfile[];
}

interface SlotsResponse {
  success: boolean;
  data: string[];
  meta?: {
    bookedSlots?: string[];
    allSlots?: string[];
  };
}

interface PatientProfileResponse {
  success: boolean;
  data: {
    _id: string;
    patientId: string;
  };
}

function formatDateForInput(d: Date): string {
  return d.toISOString().split('T')[0];
}

const tomorrowDate = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateForInput(d);
})();

export function BookAppointment() {
  const user = useAppSelector((s) => s.auth.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedSpecialization, setSelectedSpecialization] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState(tomorrowDate);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [appointmentType, setAppointmentType] = useState<'consultation' | 'follow-up' | 'procedure'>('consultation');
  const [reason, setReason] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<{
    _id: string;
    appointmentId: string;
    tokenNumber?: number;
    date: string;
    timeSlot: string;
  } | null>(null);

  // Fetch patient profile to get patient._id
  const { data: patientProfileData } = useQuery<PatientProfileResponse>({
    queryKey: ['patient', 'me', user?._id],
    queryFn: async () => {
      const res = await api.get('/patients/me');
      return res.data;
    },
    enabled: !!user?._id,
  });

  // Fetch all active doctors
  const { data: doctorsData, isLoading: doctorsLoading } = useQuery<DoctorsResponse>({
    queryKey: ['doctors', 'active'],
    queryFn: async () => {
      const res = await api.get('/doctors?isActive=true&limit=100');
      return res.data;
    },
  });

  const doctors = doctorsData?.data ?? [];
  const specializations = [...new Set(doctors.map((d) => d.specialization))].sort();

  const filteredDoctors = selectedSpecialization
    ? doctors.filter((d) => d.specialization === selectedSpecialization)
    : doctors;

  // Fetch available slots for the selected doctor + date
  const { data: slotsData, isLoading: slotsLoading } = useQuery<SlotsResponse>({
    queryKey: ['slots', selectedDoctorId, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({ doctorId: selectedDoctorId, date: selectedDate });
      const res = await api.get(`/appointments/slots?${params}`);
      return res.data;
    },
    enabled: !!selectedDoctorId && !!selectedDate && step === 2,
  });

  const availableSlots = slotsData?.data ?? [];
  const bookedSlots = new Set(slotsData?.meta?.bookedSlots ?? []);
  const allSlots = slotsData?.meta?.allSlots && slotsData.meta.allSlots.length > 0
    ? slotsData.meta.allSlots
    : availableSlots;

  const bookMutation = useMutation({
    mutationFn: async () => {
      const patientId = patientProfileData?.data?._id;
      if (!patientId) throw new Error('Patient profile not loaded');
      const res = await api.post('/appointments', {
        doctorId: selectedDoctorId,
        patientId,
        date: selectedDate,
        timeSlot: selectedSlot,
        type: appointmentType,
        reason: reason || undefined,
      });
      return res.data;
    },
    onSuccess: (res) => {
      const appt = res.data;
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
      void queryClient.invalidateQueries({ queryKey: ['patient-dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['doctor-dashboard'] });
      setConfirmedBooking({
        _id: appt._id,
        appointmentId: appt.appointmentId,
        tokenNumber: appt.tokenNumber,
        date: selectedDate,
        timeSlot: selectedSlot,
      });
      toast.success(
        appt.tokenNumber !== undefined
          ? `Appointment booked! Your Queue Token is #${appt.tokenNumber}`
          : 'Appointment booked successfully!'
      );
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
        'Failed to book appointment';
      toast.error(message);
    },
  });

  const selectedDoctor = doctors.find((d) => d._id === selectedDoctorId);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Book an Appointment</h1>
        <p className="text-muted-foreground">Schedule a visit with one of our doctors</p>
      </div>

      {confirmedBooking ? (
        <Card className="text-center p-8 space-y-6 border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/80/20 dark:bg-emerald-950/20">
          <div className="mx-auto w-16 h-16 bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950 dark:text-teal-200 rounded-full flex items-center justify-center shadow-sm">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Appointment Confirmed!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your appointment is booked and your queue token has been assigned.
            </p>
          </div>

          <div className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-sm mx-auto shadow-sm space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Your Daily Queue Token</p>
              <p className="text-5xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                #{confirmedBooking.tokenNumber ?? 1}
              </p>
            </div>
            <div className="border-t pt-3 text-sm space-y-1 text-slate-700 dark:text-slate-300">
              <p className="font-mono text-xs text-muted-foreground">{confirmedBooking.appointmentId}</p>
              <p className="font-semibold text-slate-900 dark:text-slate-100">
                Dr. {selectedDoctor?.userId?.firstName} {selectedDoctor?.userId?.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{selectedDoctor?.specialization}</p>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 pt-1">
                {formatDate(confirmedBooking.date, { withDayOfWeek: true })} at {confirmedBooking.timeSlot}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <Button
              variant="outline"
              onClick={() => downloadPdf(`/appointments/${confirmedBooking._id}/slip`, `appointment-slip-${confirmedBooking.appointmentId}.pdf`)}
              className="flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              Download Slip (PDF)
            </Button>
            <Button onClick={() => navigate('/patient/appointments')}>
              View My Appointments
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmedBooking(null);
                setStep(1);
                setSelectedDoctorId('');
                setSelectedSlot('');
                setReason('');
              }}
            >
              Book Another
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex items-center gap-1 ${
                  s === step ? 'text-primary font-semibold' : s < step ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${
                    s === step
                      ? 'border-primary bg-primary text-primary-foreground'
                      : s < step
                        ? 'border-green-600 bg-green-600 text-white'
                        : 'border-muted-foreground'
                  }`}
                >
                  {s}
                </span>
                {s === 1 && 'Select Doctor'}
                {s === 2 && 'Choose Slot'}
                {s === 3 && 'Confirm'}
                {s < 3 && <span className="mx-1 text-muted-foreground">›</span>}
              </div>
            ))}
          </div>

      {/* Step 1: Select doctor */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Select a Doctor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Filter by Specialization</Label>
              <select
                className="mt-1 w-full border rounded-md p-2 bg-background text-foreground text-sm"
                value={selectedSpecialization}
                onChange={(e) => {
                  setSelectedSpecialization(e.target.value);
                  setSelectedDoctorId('');
                }}
              >
                <option value="">All Specializations</option>
                {specializations.map((spec) => (
                  <option key={spec} value={spec}>
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            {doctorsLoading && <p className="text-sm text-muted-foreground">Loading doctors...</p>}

            <div className="space-y-2">
              {filteredDoctors.map((doc) => (
                <div
                  key={doc._id}
                  className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                    selectedDoctorId === doc._id
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedDoctorId(doc._id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">
                        Dr. {doc.userId?.firstName} {doc.userId?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">{doc.specialization}</p>
                    </div>
                    <p className="text-sm font-medium">₹{doc.consultationFee}</p>
                  </div>
                </div>
              ))}
              {!doctorsLoading && filteredDoctors.length === 0 && (
                <p className="text-sm text-muted-foreground">No doctors found.</p>
              )}
            </div>

            <Button
              className="w-full"
              disabled={!selectedDoctorId}
              onClick={() => setStep(2)}
            >
              Next: Choose Slot
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Choose slot */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Choose a Time Slot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={selectedDate}
                min={tomorrowDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setSelectedSlot('');
                }}
                className="mt-1"
              />
            </div>

            {slotsLoading && <p className="text-sm text-muted-foreground">Loading available slots...</p>}

            {!slotsLoading && allSlots.length === 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  Doctor Unavailable on {formatDate(selectedDate)}
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  {selectedDoctor?.leaves?.some((l) => {
                    const startStr = new Date(l.startDate).toISOString().split('T')[0];
                    const endStr = new Date(l.endDate).toISOString().split('T')[0];
                    return selectedDate >= startStr && selectedDate <= endStr;
                  })
                    ? `Dr. ${selectedDoctor?.userId?.firstName} ${selectedDoctor?.userId?.lastName} is scheduled on leave / time off on this date.`
                    : `Dr. ${selectedDoctor?.userId?.firstName} ${selectedDoctor?.userId?.lastName} has no scheduled consultation slots on this date.`}
                  {' '}Please select another date.
                </p>
              </div>
            )}

            {allSlots.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Time Slots</Label>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                      Available ({availableSlots.length})
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-400 dark:bg-slate-600 inline-block" />
                      Booked ({bookedSlots.size})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {allSlots.map((slot) => {
                    const isBooked = bookedSlots.has(slot);
                    const isSelected = selectedSlot === slot;

                    if (isBooked) {
                      return (
                        <div
                          key={slot}
                          className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 cursor-not-allowed select-none opacity-60 transition-all shadow-xs"
                          title="This slot is already booked"
                        >
                          <span className="font-mono text-sm font-semibold line-through decoration-slate-400 dark:decoration-slate-500">
                            {slot}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-0.5">
                            Booked
                          </span>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={slot}
                        type="button"
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-sm font-medium transition-all ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30 font-semibold'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20'
                        }`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        <span className="font-mono text-sm font-semibold">{slot}</span>
                        <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-emerald-100' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          Available
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                Back
              </Button>
              <Button
                disabled={!selectedSlot || bookedSlots.has(selectedSlot)}
                onClick={() => setStep(3)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Next: Confirm
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Confirm */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 3: Confirm Booking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-secondary/30 p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Doctor</span>
                <span className="font-medium">
                  Dr. {selectedDoctor?.userId?.firstName} {selectedDoctor?.userId?.lastName}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Specialization</span>
                <span className="font-medium">{selectedDoctor?.specialization}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Date</span>
                <span className="font-medium">
                  {formatDate(selectedDate, { withDayOfWeek: true, fullMonth: true })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Time</span>
                <span className="font-medium">{selectedSlot}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Fee</span>
                <span className="font-medium">₹{selectedDoctor?.consultationFee}</span>
              </div>
            </div>

            <div>
              <Label>Appointment Type</Label>
              <select
                className="mt-1 w-full border rounded-md p-2 bg-background text-foreground text-sm"
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value as typeof appointmentType)}
              >
                <option value="consultation">Consultation</option>
                <option value="follow-up">Follow-up</option>
                <option value="procedure">Procedure</option>
              </select>
            </div>

            <div>
              <Label>Reason for Visit (optional)</Label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Describe your symptoms or reason..."
                className="mt-1"
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                Back
              </Button>
              <Button
                onClick={() => bookMutation.mutate()}
                disabled={bookMutation.isPending}
                className="flex-1"
              >
                {bookMutation.isPending ? 'Booking...' : 'Confirm Booking'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
        </>
      )}
    </div>
  );
}
