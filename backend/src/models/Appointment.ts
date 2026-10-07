import { Schema, model, Types } from 'mongoose';
import { nextSequence, getHighestSuffix } from './Counter';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'inProgress' | 'completed' | 'cancelled' | 'noShow';
export type AppointmentType = 'consultation' | 'follow-up' | 'emergency' | 'procedure';

export interface IAppointment {
  _id: Types.ObjectId;
  appointmentId: string; // APT-XXXX
  tokenNumber?: number;
  patient: Types.ObjectId;    // ref Patient
  doctor: Types.ObjectId;     // ref Doctor
  department?: Types.ObjectId; // ref Department
  date: Date;
  timeSlot: string; // e.g., '09:00' (HH:MM)
  type: AppointmentType;
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
  createdBy: Types.ObjectId; // ref User
  cancelledBy?: Types.ObjectId; // ref User
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    appointmentId: { type: String, unique: true, index: true },
    tokenNumber: { type: Number, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    date: { type: Date, required: true, index: true },
    timeSlot: { type: String, required: true },
    type: { type: String, enum: ['consultation', 'follow-up', 'emergency', 'procedure'], default: 'consultation' },
    status: { type: String, enum: ['scheduled', 'confirmed', 'inProgress', 'completed', 'cancelled', 'noShow'], default: 'scheduled', index: true },
    reason: { type: String },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String },
  },
  { timestamps: true }
);

// CRITICAL: Compound unique index prevents double-booking at DB layer
// Partial index: only applies to non-cancelled appointments
AppointmentSchema.index(
  { doctor: 1, date: 1, timeSlot: 1 },
  { unique: true, partialFilterExpression: { status: { $nin: ['cancelled', 'noShow'] } } }
);

// Auto-generate appointmentId and doctor-date daily tokenNumber using atomic counter
AppointmentSchema.pre('save', async function (next) {
  if (!this.appointmentId) {
    const seq = await nextSequence('appointment', () => getHighestSuffix(Appointment, 'appointmentId', 'APT-'));
    this.appointmentId = `APT-${String(seq).padStart(4, '0')}`;
  }
  if (!this.tokenNumber && this.doctor && this.date) {
    const doctorId = this.doctor instanceof Types.ObjectId
      ? this.doctor.toString()
      : (this.doctor as any)?._id
        ? (this.doctor as any)._id.toString()
        : String(this.doctor);
    const dateStr = (this.date instanceof Date ? this.date : new Date(this.date)).toISOString().split('T')[0];
    const key = `token:${doctorId}:${dateStr}`;
    this.tokenNumber = await nextSequence(key);
  }
  next();
});

export const Appointment = model<IAppointment>('Appointment', AppointmentSchema);
