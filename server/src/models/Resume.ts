import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IResume extends Document {
  userId: mongoose.Types.ObjectId;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  storageKey: string;
  extractedText: string;
  pageCount?: number;
  wordCount?: number;
  isActive: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  label?: string;
  createdAt: Date;
  updatedAt: Date;
}

const resumeSchema = new Schema<IResume>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    filename: { type: String, required: true, maxlength: 255 },
    originalName: { type: String, required: true, maxlength: 255 },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    storageKey: { type: String, required: true },
    extractedText: { type: String, default: '' },
    pageCount: { type: Number },
    wordCount: { type: Number },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    label: { type: String, maxlength: 200 },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: Record<string, unknown>) => {
        delete ret.__v;
        delete ret.storageKey;
        return ret;
      },
    },
  }
);

resumeSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });

export const Resume: Model<IResume> = mongoose.model<IResume>('Resume', resumeSchema);
