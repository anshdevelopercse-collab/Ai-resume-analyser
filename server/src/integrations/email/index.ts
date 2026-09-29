import { config } from '../../config';
import { logger } from '../../utils/logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class ConsoleEmailProvider {
  async send(opts: EmailOptions): Promise<void> {
    logger.info('[EMAIL PREVIEW]', {
      to: opts.to,
      subject: opts.subject,
      text: opts.text || opts.html.replace(/<[^>]+>/g, '').slice(0, 200),
    });
  }
}

class SmtpEmailProvider {
  private transporter: any;

  async init(): Promise<void> {
    const nodemailer = await import('nodemailer');
    this.transporter = nodemailer.createTransport({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.smtpPort === 465,
      auth: config.email.smtpUser ? {
        user: config.email.smtpUser,
        pass: config.email.smtpPass,
      } : undefined,
    });
  }

  async send(opts: EmailOptions): Promise<void> {
    if (!this.transporter) await this.init();
    await this.transporter.sendMail({
      from: config.email.from,
      ...opts,
    });
  }
}

class EmailService {
  private provider: ConsoleEmailProvider | SmtpEmailProvider;

  constructor() {
    if (config.email.provider === 'smtp' && config.email.smtpHost) {
      this.provider = new SmtpEmailProvider();
    } else {
      this.provider = new ConsoleEmailProvider();
    }
  }

  async sendVerificationEmail(email: string, token: string, name: string): Promise<void> {
    const verifyUrl = `${config.clientUrl}/verify-email?token=${token}`;
    await this.provider.send({
      to: email,
      subject: 'Verify your ResumeIQ account',
      html: `
        <h2>Welcome to ResumeIQ, ${name}!</h2>
        <p>Please verify your email address to get started.</p>
        <a href="${verifyUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Verify Email</a>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>This link expires in 24 hours.</p>
        <p><em>If you didn't create an account, you can ignore this email.</em></p>
      `,
      text: `Welcome to ResumeIQ! Verify your email: ${verifyUrl}`,
    });
  }

  async sendPasswordResetEmail(email: string, token: string, name: string): Promise<void> {
    const resetUrl = `${config.clientUrl}/reset-password?token=${token}`;
    await this.provider.send({
      to: email,
      subject: 'Reset your ResumeIQ password',
      html: `
        <h2>Password Reset Request</h2>
        <p>Hi ${name}, we received a request to reset your password.</p>
        <a href="${resetUrl}" style="background:#6366f1;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Reset Password</a>
        <p>Or copy this link: ${resetUrl}</p>
        <p>This link expires in 1 hour.</p>
        <p><em>If you didn't request this, please ignore this email and your password will remain unchanged.</em></p>
      `,
      text: `Reset your ResumeIQ password: ${resetUrl}`,
    });
  }

  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    await this.provider.send({
      to: email,
      subject: 'Welcome to ResumeIQ!',
      html: `<h2>Welcome, ${name}!</h2><p>Your account is ready. Start by uploading your resume.</p>`,
      text: `Welcome to ResumeIQ, ${name}!`,
    });
  }
}

export const emailService = new EmailService();
