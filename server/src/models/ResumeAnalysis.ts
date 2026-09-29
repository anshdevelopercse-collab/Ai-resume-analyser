import mongoose, { Schema, Document, Model } from 'mongoose';
import { ANALYSIS_STATUS } from '@resumeiq/shared';

export interface IResumeAnalysis extends Document {
  userId: mongoose.Types.ObjectId;
  resumeId: mongoose.Types.ObjectId;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  provider: string;
  aiModel: string;
  tokensUsed?: number;
  costEstimate?: number;
  processingMs?: number;
  result?: object;
  error?: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const sectionScoreSchema = new Schema({
  section: String,
  score: Number,
  maxScore: Number,
  issues: [String],
  suggestions: [String],
  evidence: [String],
}, { _id: false });

const resumeAnalysisSchema = new Schema<IResumeAnalysis>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume', required: true },
    status: {
      type: String,
      enum: Object.values(ANALYSIS_STATUS),
      default: ANALYSIS_STATUS.PENDING,
    },
    provider: { type: String, default: 'demo' },
    aiModel: { type: String, default: 'demo' },
    tokensUsed: { type: Number },
    costEstimate: { type: Number },
    processingMs: { type: Number },
    result: { type: Schema.Types.Mixed },
    error: { type: String },
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

resumeAnalysisSchema.index({ userId: 1, resumeId: 1 });
resumeAnalysisSchema.index({ userId: 1, createdAt: -1 });
resumeAnalysisSchema.index({ status: 1 });

export const ResumeAnalysis: Model<IResumeAnalysis> = mongoose.model<IResumeAnalysis>(
  'ResumeAnalysis',
  resumeAnalysisSchema
);
