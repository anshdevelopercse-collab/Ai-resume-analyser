import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IJobDescription extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  company?: string;
  description: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  url?: string;
  notes?: string;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const jobDescriptionSchema = new Schema<IJobDescription>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, maxlength: 200 },
    company: { type: String, maxlength: 200 },
    description: { type: String, required: true, maxlength: 20000 },
    location: { type: String, maxlength: 200 },
    remote: { type: Boolean },
    salaryMin: { type: Number },
    salaryMax: { type: Number },
    currency: { type: String, maxlength: 10 },
    url: { type: String, maxlength: 2048 },
    notes: { type: String, maxlength: 2000 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

jobDescriptionSchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });

export const JobDescription: Model<IJobDescription> = mongoose.model<IJobDescription>(
  'JobDescription',
  jobDescriptionSchema
);
