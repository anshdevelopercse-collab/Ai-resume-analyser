import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  applicationSchema,
  jobDescriptionSchema,
} from '@resumeiq/shared';

describe('registerSchema', () => {
  it('accepts valid registration data', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'Password1',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(result.success).toBe(true);
  });

  it('rejects password without uppercase', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'password1',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without number', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'Password',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'Pa1',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      email: 'not-an-email',
      password: 'Password1',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty firstName', () => {
    const result = registerSchema.safeParse({
      email: 'user@example.com',
      password: 'Password1',
      firstName: '',
      lastName: 'Doe',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'secret' }).success).toBe(true);
  });

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(loginSchema.safeParse({ email: 'bad', password: 'pw' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  });

  it('rejects non-email string', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'notanemail' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  it('accepts valid token and strong password', () => {
    expect(resetPasswordSchema.safeParse({ token: 'tok123', password: 'NewPass1' }).success).toBe(true);
  });

  it('rejects empty token', () => {
    expect(resetPasswordSchema.safeParse({ token: '', password: 'NewPass1' }).success).toBe(false);
  });

  it('rejects weak new password', () => {
    expect(resetPasswordSchema.safeParse({ token: 'tok', password: 'weak' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('accepts valid change request', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'OldPass1', newPassword: 'NewPass2' }).success).toBe(true);
  });

  it('rejects missing newPassword', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'Old1' }).success).toBe(false);
  });
});

describe('applicationSchema', () => {
  it('accepts minimal valid application', () => {
    expect(applicationSchema.safeParse({ company: 'Acme', role: 'Engineer' }).success).toBe(true);
  });

  it('strips unknown fields (mass-assignment prevention)', () => {
    const result = applicationSchema.safeParse({
      company: 'Acme',
      role: 'Engineer',
      isDeleted: true,
      userId: 'hacker',
      _id: 'custom',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as any).isDeleted).toBeUndefined();
      expect((result.data as any).userId).toBeUndefined();
      expect((result.data as any)._id).toBeUndefined();
    }
  });

  it('rejects invalid status', () => {
    expect(applicationSchema.safeParse({ company: 'X', role: 'Y', status: 'hacked' }).success).toBe(false);
  });

  it('defaults status to wishlist when omitted', () => {
    const result = applicationSchema.safeParse({ company: 'X', role: 'Y' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('wishlist');
    }
  });
});

describe('jobDescriptionSchema', () => {
  it('accepts valid job description', () => {
    expect(jobDescriptionSchema.safeParse({ title: 'Engineer', description: 'A'.repeat(50) }).success).toBe(true);
  });

  it('rejects description shorter than 50 chars', () => {
    expect(jobDescriptionSchema.safeParse({ title: 'Engineer', description: 'Too short' }).success).toBe(false);
  });

  it('requires title', () => {
    expect(jobDescriptionSchema.safeParse({ description: 'A'.repeat(50) }).success).toBe(false);
  });
});
