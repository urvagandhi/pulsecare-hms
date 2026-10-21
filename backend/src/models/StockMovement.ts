import { Schema, model, Types } from 'mongoose';

export type StockMovementType = 'in' | 'out' | 'adjustment' | 'waste';

export interface IStockMovement {
  _id: Types.ObjectId;
  itemId: Types.ObjectId;
  itemModel?: 'InventoryItem' | 'Drug';
  type: StockMovementType;
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  performedBy: Types.ObjectId;
  createdAt: Date;
}

const StockMovementSchema = new Schema<IStockMovement>(
  {
    itemId: { type: Schema.Types.ObjectId, required: true, refPath: 'itemModel' },
    itemModel: { type: String, enum: ['InventoryItem', 'Drug'], default: 'InventoryItem' },
    type: { type: String, enum: ['in', 'out', 'adjustment', 'waste'], required: true },
    quantity: { type: Number, required: true, min: 1 },
    previousQuantity: { type: Number, required: true },
    newQuantity: { type: Number, required: true },
    reason: { type: String },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Compound index for historical stock queries and audit trails
StockMovementSchema.index({ itemId: 1, createdAt: -1 });

export const StockMovement = model<IStockMovement>('StockMovement', StockMovementSchema);
