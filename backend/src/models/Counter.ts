import { Schema, model, Document, Model } from 'mongoose';

export interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0, required: true },
  },
  { versionKey: false }
);

export const Counter = model<ICounter>('Counter', CounterSchema);

const initializedKeys = new Set<string>();

/**
 * Reset initialization cache (useful for testing when database is wiped).
 */
export function clearCounterCache(): void {
  initializedKeys.clear();
}

/**
 * Extracts the highest numeric suffix for IDs matching prefix in a given model.
 */
export async function getHighestSuffix(targetModel: Model<any>, field: string, prefix: string): Promise<number> {
  try {
    const docs = await targetModel.find({ [field]: new RegExp(`^${prefix}\\d+$`) })
      .select({ [field]: 1 })
      .lean();
    let max = 0;
    for (const d of docs) {
      const val = (d as any)[field];
      if (typeof val === 'string') {
        const num = parseInt(val.slice(prefix.length), 10);
        if (!isNaN(num) && num > max) max = num;
      }
    }
    return max;
  } catch {
    return 0;
  }
}

/**
 * Atomically generates the next sequence number for a given counter key.
 * On first use per process, initializes the counter using initFn if existing records exist.
 */
export async function nextSequence(key: string, initFn?: () => Promise<number>): Promise<number> {
  if (initFn && !initializedKeys.has(key)) {
    initializedKeys.add(key);
    const existing = await Counter.findById(key);
    if (!existing) {
      const highest = await initFn();
      if (highest > 0) {
        await Counter.updateOne({ _id: key }, { $max: { seq: highest } }, { upsert: true });
      }
    }
  }

  const result = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return result!.seq;
}
