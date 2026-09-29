import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IInterviewSession extends Document {
  userId: mongoose.Types.ObjectId;
  resumeId?: mongoose.Types.ObjectId;
  jobDescriptionId?: mongoose.Types.ObjectId;
  title: string;
  questions: Array<{
    id: string;
    type: string;
    question: string;
    guidance: string;
    followUps: string[];
    sampleAnswer?: string;
    userAnswer?: string;
    aiFeedback?: string;
  }>;
  status: 'draft' | 'active' | 'completed';
  provider: string;
  aiModel: string;
  createdAt: Date;
  updatedAt: Date;
}

const interviewSessionSchema = new Schema<IInterviewSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume' },
    jobDescriptionId: { type: Schema.Types.ObjectId, ref: 'JobDescription' },
    title: { type: String, required: true, maxlength: 200 },
    questions: [{
      id: String,
      type: { type: String, enum: ['technical', 'behavioral', 'project', 'situational'] },
      question: String,
      guidance: String,
      followUps: [String],
      sampleAnswer: String,
      userAnswer: String,
      aiFeedback: String,
    }],
    status: { type: String, enum: ['draft', 'active', 'completed'], default: 'draft' },
    provider: { type: String, default: 'demo' },
    aiModel: { type: String, default: 'demo' },
  },
  { timestamps: true }
);

interviewSessionSchema.index({ userId: 1, createdAt: -1 });

export const InterviewSession: Model<IInterviewSession> = mongoose.model<IInterviewSession>(
  'InterviewSession',
  interviewSessionSchema
);
