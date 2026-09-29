import mongoose, { Schema, Document, Model } from 'mongoose';
import { ROLES, PLANS } from '@resumeiq/shared';

export interface IUser extends Document {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro' | 'enterprise';
  emailVerified: boolean;
  emailVerificationToken?: string;
  emailVerificationExpires?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  avatarUrl?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  usage: {
    resumeUploads: number;
    aiAnalyses: number;
    jobMatches: number;
    applications: number;
    lastReset: Date;
  };
  createdAt: Date;
  updatedAt: Date;
  fullName: string;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    firstName: { type: String, required: true, maxlength: 50 },
    lastName: { type: String, required: true, maxlength: 50 },
    role: { type: String, enum: Object.values(ROLES), default: ROLES.USER },
    plan: { type: String, enum: Object.values(PLANS), default: PLANS.FREE },
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    avatarUrl: { type: String, maxlength: 2048 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    usage: {
      resumeUploads: { type: Number, default: 0 },
      aiAnalyses: { type: Number, default: 0 },
      jobMatches: { type: Number, default: 0 },
      applications: { type: Number, default: 0 },
      lastReset: { type: Date, default: Date.now },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret: Record<string, unknown>) => {
        delete ret.password;
        delete ret.emailVerificationToken;
        delete ret.passwordResetToken;
        delete ret.__v;
        return ret;
      },
    },
  }
);

userSchema.virtual('fullName').get(function (this: IUser) {
  return `${this.firstName} ${this.lastName}`;
});

userSchema.index({ email: 1 });
userSchema.index({ isDeleted: 1 });
userSchema.index({ createdAt: -1 });

export const User: Model<IUser> = mongoose.model<IUser>('User', userSchema);
