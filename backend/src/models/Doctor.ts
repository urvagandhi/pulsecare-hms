import { Schema, model, Types } from 'mongoose';
import { nextSequence, getHighestSuffix } from './Counter';

export interface IAvailability {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  startTime: string; // HH:MM
  endTime: string;
}

export interface IDoctorLeave {
  startDate: Date;
  endDate: Date;
  reason?: string;
}

export interface IDoctor {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // ref User
  doctorId: string;       // DOC-XXXX
  specialization: string;
  qualification: string[];
  department?: Types.ObjectId; // ref Department
  availability: IAvailability[];
  consultationFee: number;
  leaves?: IDoctorLeave[];
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorSchema = new Schema<IDoctor>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    doctorId: { type: String, unique: true, index: true },
    specialization: { type: String, required: true },
    qualification: [{ type: String }],
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    availability: [{
      day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
    }],
    consultationFee: { type: Number, default: 0, min: 0 },
    leaves: [{
      startDate: { type: Date, required: true },
      endDate: { type: Date, required: true },
      reason: { type: String },
    }],
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Auto-generate doctorId before save using atomic counter
DoctorSchema.pre('save', async function (next) {
  if (!this.doctorId) {
    const seq = await nextSequence('doctor', () => getHighestSuffix(Doctor, 'doctorId', 'DOC-'));
    this.doctorId = `DOC-${String(seq).padStart(4, '0')}`;
  }
  next();
});

export const Doctor = model<IDoctor>('Doctor', DoctorSchema);
