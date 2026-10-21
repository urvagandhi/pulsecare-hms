import { StatusBadge } from '@/components/Shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { downloadPdf } from '@/lib/downloadPdf';
import { formatDate } from '@/lib/format';

export interface AppointmentRecord {
  _id: string;
  appointmentId: string;
  tokenNumber?: number;
  date: string;
  timeSlot: string;
  type: string;
  status: string;
  reason?: string;
  notes?: string;
  cancelReason?: string;
  cancelledBy?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  };
  doctor?: {
    _id: string;
    specialization: string;
    userId?: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  patient?: {
    _id: string;
    patientId: string;
    userId?: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

interface AppointmentCardProps {
  appointment: AppointmentRecord;
  viewAs?: 'doctor' | 'patient' | 'admin';
  onConfirm?: (id: string) => void;
  onStart?: (id: string) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
}

export function AppointmentCard({
  appointment,
  viewAs = 'admin',
  onConfirm,
  onStart,
  onComplete,
  onCancel,
}: AppointmentCardProps) {
  const appointmentDate = formatDate(appointment.date, { withDayOfWeek: true });

  const doctorName = appointment.doctor?.userId
    ? `Dr. ${appointment.doctor.userId.firstName} ${appointment.doctor.userId.lastName}`
    : 'Unknown Doctor';

  const patientName = appointment.patient?.userId
    ? `${appointment.patient.userId.firstName} ${appointment.patient.userId.lastName}`
    : 'Unknown Patient';

  const isUpcoming = (appointment.status === 'scheduled' || appointment.status === 'confirmed') && new Date(appointment.date) >= new Date();

  return (
    <Card className="w-full">
      <CardContent className="pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-mono text-muted-foreground">{appointment.appointmentId}</span>
              {appointment.tokenNumber !== undefined && (
                <span className="text-xs font-semibold bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800/80">
                  Token #{appointment.tokenNumber}
                </span>
              )}
              <StatusBadge status={appointment.status} />
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded capitalize">
                {appointment.type}
              </span>
            </div>

            <p className="font-semibold text-gray-900 dark:text-white">
              {appointmentDate} at {appointment.timeSlot}
            </p>

            {viewAs !== 'doctor' && (
              <p className="text-sm text-muted-foreground">{doctorName} — {appointment.doctor?.specialization}</p>
            )}

            {viewAs !== 'patient' && (
              <p className="text-sm text-muted-foreground">Patient: {patientName}</p>
            )}

            {appointment.reason && (
              <p className="text-sm text-muted-foreground">Reason: {appointment.reason}</p>
            )}

            {appointment.status === 'cancelled' && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-900/60 text-xs">
                <div className="flex flex-wrap items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                  <span>Audit Trail: Cancelled</span>
                  {typeof appointment.cancelledBy === 'object' && appointment.cancelledBy?.firstName ? (
                    <span className="font-medium text-rose-700 dark:text-rose-400">
                      by {appointment.cancelledBy.firstName} {appointment.cancelledBy.lastName || ''}{' '}
                      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/60 font-semibold font-mono">
                        {appointment.cancelledBy.role}
                      </span>
                    </span>
                  ) : appointment.cancelledBy ? (
                    <span className="font-medium text-rose-700 dark:text-rose-400">
                      by System/User
                    </span>
                  ) : null}
                </div>
                {appointment.cancelReason && (
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                    Reason: <span className="font-medium italic">{appointment.cancelReason}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => downloadPdf(`/appointments/${appointment._id}/slip`, `appointment-slip-${appointment.appointmentId}.pdf`)}
            >
              Slip
            </Button>
            {isUpcoming && viewAs === 'doctor' && appointment.status === 'scheduled' && onConfirm && (
                <Button size="sm" variant="outline" onClick={() => onConfirm(appointment._id)}>
                  Confirm
                </Button>
              )}
              {viewAs === 'doctor' && appointment.status === 'confirmed' && onStart && (
                <Button size="sm" variant="outline" onClick={() => onStart(appointment._id)}>
                  Start
                </Button>
              )}
              {viewAs === 'doctor' && appointment.status === 'inProgress' && onComplete && (
                <Button size="sm" variant="outline" onClick={() => onComplete(appointment._id)}>
                  Complete
                </Button>
              )}
              {appointment.status !== 'completed' && appointment.status !== 'cancelled' && onCancel && (
                <Button size="sm" variant="destructive" onClick={() => onCancel(appointment._id)}>
                  Cancel
                </Button>
              )}
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
