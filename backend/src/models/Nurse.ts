import { Schema, model, Types } from 'mongoose';
import { nextSequence, getHighestSuffix } from './Counter';

export interface INurse {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  nurseId: string; // NUR-XXXX
  ward?: string;
  department?: Types.ObjectId; // ref Department
  shift: 'morning' | 'afternoon' | 'night';
  qualification: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NurseSchema = new Schema<INurse>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    nurseId: { type: String, unique: true, index: true },
    ward: { type: String },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    shift: { type: String, enum: ['morning', 'afternoon', 'night'], default: 'morning' },
    qualification: [{ type: String }],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Auto-generate nurseId using atomic counter
NurseSchema.pre('save', async function (next) {
  if (!this.nurseId) {
    const seq = await nextSequence('nurse', () => getHighestSuffix(Nurse, 'nurseId', 'NUR-'));
    this.nurseId = `NUR-${String(seq).padStart(4, '0')}`;
  }
  next();
});

export const Nurse = model<INurse>('Nurse', NurseSchema);
