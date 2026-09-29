import mongoose, { Schema, Document, Model } from 'mongoose';
import { APPLICATION_STATUS } from '@resumeiq/shared';

export interface IApplication extends Document {
  userId: mongoose.Types.ObjectId;
  company: string;
  role: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  jobDescriptionId?: mongoose.Types.ObjectId;
  resumeId?: mongoose.Types.ObjectId;
  status: typeof APPLICATION_STATUS[number];
  appliedAt?: Date;
  deadline?: Date;
  nextActionDate?: Date;
  nextAction?: string;
  notes?: string;
  interviewDates: Date[];
  source?: string;
  url?: string;
  contactName?: string;
  contactEmail?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    company: { type: String, required: true, maxlength: 200 },
    role: { type: String, required: true, maxlength: 200 },
    location: { type: String, maxlength: 200 },
    remote: { type: Boolean },
    salaryMin: { type: Number },
    salaryMax: { type: Number },
    currency: { type: String, maxlength: 10 },
    jobDescriptionId: { type: Schema.Types.ObjectId, ref: 'JobDescription' },
    resumeId: { type: Schema.Types.ObjectId, ref: 'Resume' },
    status: {
      type: String,
      enum: APPLICATION_STATUS,
      default: 'wishlist',
    },
    appliedAt: { type: Date },
    deadline: { type: Date },
    nextActionDate: { type: Date },
    nextAction: { type: String, maxlength: 500 },
    notes: { type: String, maxlength: 5000 },
    interviewDates: [{ type: Date }],
    source: { type: String, maxlength: 200 },
    url: { type: String, maxlength: 2048 },
    contactName: { type: String, maxlength: 200 },
    contactEmail: { type: String, maxlength: 255 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

applicationSchema.index({ userId: 1, isDeleted: 1, status: 1 });
applicationSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });

export const Application: Model<IApplication> = mongoose.model<IApplication>(
  'Application',
  applicationSchema
);
