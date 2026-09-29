import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { InterviewSession } from '../models/InterviewSession';
import { Resume } from '../models/Resume';
import { JobDescription } from '../models/JobDescription';
import { getAIProvider, isDemoMode } from '../integrations/ai';
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
      resumeId ? Resume.findOne({ _id: resumeId, userId: req.userId, isDeleted: false }) : null,
      jobDescriptionId ? JobDescription.findOne({ _id: jobDescriptionId, userId: req.userId, isDeleted: false }) : null,
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

    const session = await InterviewSession.create({
      userId: req.userId,
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
      meta: {
        demoMode: isDemoMode(),
        disclaimer,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getInterviewSessions(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const sessions = await InterviewSession.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('-questions.userAnswer -questions.aiFeedback');
    res.json({ success: true, data: sessions });
  } catch (err) {
    next(err);
  }
}

export async function getInterviewSession(
  req: AuthRequest, res: Response, next: NextFunction
): Promise<void> {
  try {
    const session = await InterviewSession.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
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
    const session = await InterviewSession.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!session) throw new NotFoundError('Interview session');

    const question = session.questions.find((q: any) => q.id === questionId);
    if (!question) throw new NotFoundError('Question');

    question.userAnswer = String(answer).slice(0, 5000);

    // Generate AI feedback
    if (!isDemoMode()) {
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
    } else {
      question.aiFeedback = '[DEMO] Your answer was recorded. Configure an AI provider to receive personalized feedback on your interview answers.';
    }

    await session.save();
    res.json({ success: true, data: { feedback: question.aiFeedback } });
  } catch (err) {
    next(err);
  }
}
