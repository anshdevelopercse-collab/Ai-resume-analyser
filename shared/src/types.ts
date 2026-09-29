import type { APPLICATION_STATUS, ANALYSIS_STATUS, PLANS, ROLES } from './constants';

export type PlanType = typeof PLANS[keyof typeof PLANS];
export type RoleType = typeof ROLES[keyof typeof ROLES];
export type ApplicationStatus = typeof APPLICATION_STATUS[number];
export type AnalysisStatus = typeof ANALYSIS_STATUS[keyof typeof ANALYSIS_STATUS];

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  requestId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleType;
  plan: PlanType;
  emailVerified: boolean;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeFile {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  extractedText?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeSection {
  name: string;
  content: string;
  present: boolean;
  score?: number;
  issues?: string[];
  suggestions?: string[];
}

export interface SkillCategory {
  technical: string[];
  soft: string[];
  domain: string[];
  tools: string[];
}

export interface SectionScore {
  section: string;
  score: number;
  maxScore: number;
  issues: string[];
  suggestions: string[];
  evidence: string[];
}

export interface ResumeAnalysisResult {
  overallScore: number;
  atsScore: number;
  formattingScore: number;
  contentScore: number;
  impactScore: number;
  sections: SectionScore[];
  skills: SkillCategory;
  strengths: string[];
  weaknesses: string[];
  improvements: Array<{
    priority: 'high' | 'medium' | 'low';
    category: string;
    issue: string;
    suggestion: string;
    evidence?: string;
  }>;
  wordCount: number;
  pageCount: number;
  hasQuantifiableAchievements: boolean;
  scoringMethodology: string;
  disclaimer: string;
}

export interface JobMatchResult {
  matchScore: number;
  matchingSkills: string[];
  missingSkills: string[];
  relevantExperience: Array<{
    item: string;
    relevance: string;
  }>;
  keywordCoverage: number;
  qualificationGaps: string[];
  suggestedEdits: Array<{
    section: string;
    original: string;
    suggested: string;
    reason: string;
  }>;
  summary: string;
  disclaimer: string;
}

export interface InterviewQuestion {
  id: string;
  type: 'technical' | 'behavioral' | 'project' | 'situational';
  question: string;
  guidance: string;
  followUps: string[];
  starFramework?: {
    situation: string;
    task: string;
    action: string;
    result: string;
  };
  sampleAnswer?: string;
}

export interface LearningMilestone {
  title: string;
  description: string;
  skills: string[];
  estimatedHours: number;
  resources: Array<{
    title: string;
    type: 'course' | 'book' | 'article' | 'project' | 'documentation';
    url?: string;
    note?: string;
  }>;
  project?: string;
}

export interface ApplicationEntry {
  id: string;
  userId: string;
  company: string;
  role: string;
  location?: string;
  remote?: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  jobDescriptionId?: string;
  resumeId?: string;
  status: ApplicationStatus;
  appliedAt?: string;
  deadline?: string;
  nextActionDate?: string;
  nextAction?: string;
  notes?: string;
  interviewDates: string[];
  source?: string;
  url?: string;
  contactName?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsageStats {
  resumeUploads: number;
  aiAnalyses: number;
  jobMatches: number;
  applications: number;
}
