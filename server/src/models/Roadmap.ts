import { Schema, model, Document, Types } from 'mongoose';

export interface IRoadmapMilestone {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  estimatedWeeks?: number;
  resources?: string[];
  completed: boolean;
}

export interface IRoadmap extends Document {
  userId: Types.ObjectId;
  targetRole: string;
  resumeId?: Types.ObjectId;
  jobDescriptionId?: Types.ObjectId;
  status: 'completed' | 'failed' | 'processing';
  provider?: string;
  summary?: string;
  skillGaps?: string[];
  milestones: IRoadmapMilestone[];
  createdAt: Date;
  updatedAt: Date;
}

const milestoneSchema = new Schema<IRoadmapMilestone>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  priority: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  estimatedWeeks: Number,
  resources: [String],
  completed: { type: Boolean, default: false },
}, { _id: false });

const roadmapSchema = new Schema<IRoadmap>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetRole: { type: String, required: true, maxlength: 200 },
  resumeId: { type: Schema.Types.ObjectId, ref: 'Resume' },
  jobDescriptionId: { type: Schema.Types.ObjectId, ref: 'JobDescription' },
  status: { type: String, enum: ['completed', 'failed', 'processing'], default: 'processing' },
  provider: String,
  summary: String,
  skillGaps: [String],
  milestones: [milestoneSchema],
}, { timestamps: true });

export const Roadmap = model<IRoadmap>('Roadmap', roadmapSchema);
