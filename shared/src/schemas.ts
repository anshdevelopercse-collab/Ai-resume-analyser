import { z } from 'zod';
import { APPLICATION_STATUS } from './constants';

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name required').max(50),
  lastName: z.string().min(1, 'Last name required').max(50),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

export const jobDescriptionSchema = z.object({
  title: z.string().min(1, 'Job title required').max(200),
  company: z.string().max(200).optional(),
  description: z.string().min(50, 'Job description too short').max(20000),
  location: z.string().max(200).optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  currency: z.string().max(10).optional(),
  url: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export const applicationSchema = z.object({
  company: z.string().min(1, 'Company required').max(200),
  role: z.string().min(1, 'Role required').max(200),
  location: z.string().max(200).optional(),
  remote: z.boolean().optional(),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  currency: z.string().max(10).optional(),
  jobDescriptionId: z.string().optional(),
  resumeId: z.string().optional(),
  status: z.enum(APPLICATION_STATUS).default('wishlist'),
  appliedAt: z.string().optional(),
  deadline: z.string().optional(),
  nextActionDate: z.string().optional(),
  nextAction: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  interviewDates: z.array(z.string()).default([]),
  source: z.string().max(200).optional(),
  url: z.string().url().optional(),
  contactName: z.string().max(200).optional(),
  contactEmail: z.string().email().optional(),
});

export const resumeBuilderSchema = z.object({
  title: z.string().min(1).max(200),
  templateId: z.string().optional(),
  content: z.object({
    personal: z.object({
      fullName: z.string(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      location: z.string().optional(),
      website: z.string().url().optional(),
      linkedin: z.string().optional(),
      github: z.string().optional(),
      summary: z.string().optional(),
    }).optional(),
    experience: z.array(z.object({
      company: z.string(),
      title: z.string(),
      location: z.string().optional(),
      startDate: z.string(),
      endDate: z.string().optional(),
      current: z.boolean().optional(),
      bullets: z.array(z.string()),
    })).optional(),
    education: z.array(z.object({
      institution: z.string(),
      degree: z.string(),
      field: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      gpa: z.string().optional(),
      honors: z.string().optional(),
    })).optional(),
    skills: z.array(z.object({
      category: z.string(),
      items: z.array(z.string()),
    })).optional(),
    projects: z.array(z.object({
      name: z.string(),
      description: z.string(),
      technologies: z.array(z.string()).optional(),
      url: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      bullets: z.array(z.string()).optional(),
    })).optional(),
    certifications: z.array(z.object({
      name: z.string(),
      issuer: z.string().optional(),
      date: z.string().optional(),
      url: z.string().optional(),
      credentialId: z.string().optional(),
    })).optional(),
    customSections: z.array(z.object({
      title: z.string(),
      content: z.string(),
    })).optional(),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type JobDescriptionInput = z.infer<typeof jobDescriptionSchema>;
export type ApplicationInput = z.infer<typeof applicationSchema>;
export type ResumeBuilderInput = z.infer<typeof resumeBuilderSchema>;
