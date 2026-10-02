import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IJobMatch extends Document {
  userId: mongoose.Types.ObjectId;
  resumeId: mongoose.Types.ObjectId;
  jobDescriptionId: mongoose.Types.ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: object;
  provider: string;
  aiModel: string;
  tokensUsed?: number;
  costEstimate?: number;
  error?: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const jobMatchSchema = new Schema<IJobMatch>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true },
    jobDescriptionId: { type: Schema.Types.ObjectId, ref: 'JobDescription', required: true },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    result: { type: Schema.Types.Mixed },
    provider: { type: String, default: 'pending' },
    aiModel: { type: String, default: 'pending' },
    tokensUsed: { type: Number },
    costEstimate: { type: Number },
    error: { type: String },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

jobMatchSchema.index({ userId: 1, resumeId: 1, jobDescriptionId: 1 });
jobMatchSchema.index({ userId: 1, createdAt: -1 });

export const JobMatch: Model<IJobMatch> = mongoose.model<IJobMatch>('JobMatch', jobMatchSchema);
