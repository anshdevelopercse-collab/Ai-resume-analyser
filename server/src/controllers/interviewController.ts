import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  createInterviewSession,
  findInterviewSessionById,
  listInterviewSessions,
  updateInterviewSession,
} from '../repositories/interviewSessionRepository';
import { findResumeById } from '../repositories/resumeRepository';
import { findJobDescriptionById } from '../repositories/jobDescriptionRepository';
import { getAIProvider } from '../integrations/ai';
import { NotFoundError } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const INTERVIEW_SYSTEM = `You are an expert technical recruiter and career coach. Generate interview questions based on the resume and job description. Return ONLY valid JSON.`;

function buildInterviewPrompt(resumeText: string, jobDescription: string, role: string): string {
  return `Generate 8-10 interview questions for a candidate applying for: ${role}

RESUME (excerpt):
${resumeText.slice(0, 3000)}

JOB DESCRIPTION (excerpt):
${jobDescription.slice(0, 2000)}

Return JSON with:
{
  "questions": [
    {
      "id": "<uuid>",
      "type": "technical"|"behavioral"|"project"|"situational",
      "question": "string",
      "guidance": "string",
      "followUps": ["string"],
      "sampleAnswer": "string (labeled as example only)"
    }
  ],
  "disclaimer": "These questions are AI-generated for practice purposes only. They do not reflect actual interview content from any specific employer."
}`;
}

export async function generateInterviewQuestions(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { resumeId, jobDescriptionId, title } = req.body;

    const [resume, jobDesc] = await Promise.all([
      resumeId ? findResumeById(resumeId, req.userId!) : null,
      jobDescriptionId ? findJobDescriptionById(jobDescriptionId, req.userId!) : null,
    ]);

    const resumeText = resume?.extractedText || '';
    const jdText = jobDesc?.description || '';
    const role = jobDesc?.title || title || 'Software Engineer';

    const provider = getAIProvider();
    let questions: any[] = [];
    let disclaimer = '';

    try {
      const result = await provider.complete([
        { role: 'user', content: buildInterviewPrompt(resumeText, jdText, role) },
      ], { systemPrompt: INTERVIEW_SYSTEM });

      const jsonText = result.content.slice(
        result.content.indexOf('{'),
        result.content.lastIndexOf('}') + 1
      );
      const parsed = JSON.parse(jsonText);
      questions = parsed.questions || [];
      disclaimer = parsed.disclaimer || '';

      questions = questions.map((q: any) => ({
        ...q,
        id: q.id || uuidv4(),
      }));
    } catch (err) {
      logger.error('Interview generation failed', { error: err });
      throw err;
    }

    const session = await createInterviewSession({
      userId: req.userId!,
      resumeId: resumeId || undefined,
      jobDescriptionId: jobDescriptionId || undefined,
      title: `Interview Prep - ${role}`,
      questions,
      status: 'active',
      provider: provider.name,
      aiModel: provider.model,
    });

    res.status(201).json({
      success: true,
      data: session,
      meta: { disclaimer },
    });
  } catch (err) {
    next(err);
  }
}

export async function getInterviewSessions(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const sessions = await listInterviewSessions(req.userId!, 20);
    const stripped = sessions.map(s => ({
      ...s,
      questions: (s.questions as any[]).map(({ userAnswer: _ua, aiFeedback: _af, ...q }) => q),
    }));
    res.json({ success: true, data: stripped });
  } catch (err) {
    next(err);
  }
}

export async function getInterviewSession(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const session = await findInterviewSessionById(req.params.id as string, req.userId!);
    if (!session) throw new NotFoundError('Interview session');
    res.json({ success: true, data: session });
  } catch (err) {
    next(err);
  }
}

export async function submitAnswer(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const { questionId, answer } = req.body;
    const session = await findInterviewSessionById(req.params.id as string, req.userId!);
    if (!session) throw new NotFoundError('Interview session');

    const questions = session.questions as any[];
    const question = questions.find((q: any) => q.id === questionId);
    if (!question) throw new NotFoundError('Question');

    question.userAnswer = String(answer).slice(0, 5000);

    const provider = getAIProvider();
    const feedbackPrompt = `Rate this interview answer for: "${question.question}"

Answer: ${question.userAnswer}

Provide brief constructive feedback on: content quality, STAR structure (if behavioral), missing points, and one specific improvement. Be encouraging but honest. Max 200 words.`;

    try {
      const result = await provider.complete([
        { role: 'user', content: feedbackPrompt },
      ], { maxTokens: 400 });
      question.aiFeedback = result.content;
    } catch {
      question.aiFeedback = 'Feedback unavailable at this time.';
    }

    await updateInterviewSession(req.params.id as string, req.userId!, { questions });
    res.json({ success: true, data: { feedback: question.aiFeedback } });
  } catch (err) {
    next(err);
  }
}
