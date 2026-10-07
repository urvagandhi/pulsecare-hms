import { Schema, model, Types } from 'mongoose';
import { nextSequence, getHighestSuffix } from './Counter';

export interface IReceptionist {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  receptionistId: string; // REC-XXXX
  department?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReceptionistSchema = new Schema<IReceptionist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    receptionistId: { type: String, unique: true, index: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

// Auto-generate receptionistId using atomic counter
ReceptionistSchema.pre('save', async function (next) {
  if (!this.receptionistId) {
    const seq = await nextSequence('receptionist', () => getHighestSuffix(Receptionist, 'receptionistId', 'REC-'));
    this.receptionistId = `REC-${String(seq).padStart(4, '0')}`;
  }
  next();
});

export const Receptionist = model<IReceptionist>('Receptionist', ReceptionistSchema);
