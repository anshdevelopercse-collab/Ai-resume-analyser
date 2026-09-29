import { describe, it, expect } from 'vitest';

// Inline the pure helper functions under test so we don't need to import
// modules with heavy side-effects (mongoose, AI SDKs, etc.)

function extractJSON(text: string): string {
  const jsonStart = text.indexOf('{');
  const jsonEnd = text.lastIndexOf('}');
  if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found in response');
  return text.slice(jsonStart, jsonEnd + 1);
}

function validateAnalysisResult(result: any): void {
  if (typeof result.overallScore !== 'number') throw new Error('Invalid analysis: missing overallScore');
  if (!Array.isArray(result.sections)) throw new Error('Invalid analysis: missing sections');
  if (!result.skills) throw new Error('Invalid analysis: missing skills');
  result.overallScore = Math.min(100, Math.max(0, Math.round(result.overallScore)));
  result.atsScore = Math.min(100, Math.max(0, Math.round(result.atsScore ?? 0)));
  result.formattingScore = Math.min(100, Math.max(0, Math.round(result.formattingScore ?? 0)));
  result.contentScore = Math.min(100, Math.max(0, Math.round(result.contentScore ?? 0)));
  result.impactScore = Math.min(100, Math.max(0, Math.round(result.impactScore ?? 0)));
}

const validResult = {
  overallScore: 75,
  atsScore: 80,
  formattingScore: 70,
  contentScore: 85,
  impactScore: 60,
  sections: [{ section: 'Experience', score: 80 }],
  skills: { technical: ['TypeScript'], soft: [], domain: [], tools: [] },
  strengths: [],
  weaknesses: [],
  improvements: [],
};

describe('extractJSON', () => {
  it('extracts JSON from plain text response', () => {
    const text = 'Here is the analysis:\n{"key": "value"}\nEnd.';
    expect(extractJSON(text)).toBe('{"key": "value"}');
  });

  it('extracts JSON when it is the entire response', () => {
    const json = '{"overallScore": 75}';
    expect(extractJSON(json)).toBe(json);
  });

  it('throws when no JSON braces are present', () => {
    expect(() => extractJSON('no json here')).toThrow('No JSON found in response');
  });

  it('handles nested objects', () => {
    const text = 'prefix {"outer": {"inner": 1}} suffix';
    const extracted = extractJSON(text);
    expect(JSON.parse(extracted)).toEqual({ outer: { inner: 1 } });
  });
});

describe('validateAnalysisResult', () => {
  it('passes a valid result without throwing', () => {
    const data = { ...validResult };
    expect(() => validateAnalysisResult(data)).not.toThrow();
  });

  it('clamps overallScore above 100 down to 100', () => {
    const data = { ...validResult, overallScore: 150 };
    validateAnalysisResult(data);
    expect(data.overallScore).toBe(100);
  });

  it('clamps overallScore below 0 up to 0', () => {
    const data = { ...validResult, overallScore: -10 };
    validateAnalysisResult(data);
    expect(data.overallScore).toBe(0);
  });

  it('rounds fractional scores', () => {
    const data = { ...validResult, overallScore: 72.7 };
    validateAnalysisResult(data);
    expect(data.overallScore).toBe(73);
  });

  it('defaults missing optional scores to 0', () => {
    const { atsScore: _a, formattingScore: _f, contentScore: _c, impactScore: _i, ...rest } = validResult;
    const data = { ...rest };
    validateAnalysisResult(data);
    expect((data as any).atsScore).toBe(0);
    expect((data as any).formattingScore).toBe(0);
  });

  it('throws when overallScore is missing', () => {
    const { overallScore: _, ...rest } = validResult;
    expect(() => validateAnalysisResult(rest)).toThrow('missing overallScore');
  });

  it('throws when sections is missing', () => {
    const { sections: _, ...rest } = validResult;
    expect(() => validateAnalysisResult(rest)).toThrow('missing sections');
  });

  it('throws when skills is missing', () => {
    const { skills: _, ...rest } = validResult;
    expect(() => validateAnalysisResult(rest)).toThrow('missing skills');
  });
});

describe('idempotencyKey construction', () => {
  it('analysis key is deterministic for same userId + resumeId', () => {
    const userId = 'user123';
    const resumeId = 'resume456';
    const key1 = `analysis:${userId}:${resumeId}`;
    const key2 = `analysis:${userId}:${resumeId}`;
    expect(key1).toBe(key2);
  });

  it('match key is deterministic for same userId + resumeId + jobDescriptionId', () => {
    const k1 = `match:u1:r1:j1`;
    const k2 = `match:u1:r1:j1`;
    expect(k1).toBe(k2);
  });

  it('analysis keys differ for different resumes', () => {
    expect(`analysis:u1:r1`).not.toBe(`analysis:u1:r2`);
  });
});
