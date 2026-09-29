import type { AIProvider, AIMessage, AICompletionOptions, AICompletionResult } from './types';

export class DemoProvider implements AIProvider {
  readonly name = 'demo';
  readonly model = 'demo-deterministic';

  isAvailable(): boolean {
    return true;
  }

  async complete(
    messages: AIMessage[],
    _options: AICompletionOptions = {}
  ): Promise<AICompletionResult> {
    const lastMessage = messages[messages.length - 1]?.content ?? '';

    // Return structured demo responses based on what's being asked
    let content = '';

    if (lastMessage.includes('analyze') || lastMessage.includes('RESUME_TEXT')) {
      content = JSON.stringify(getDemoAnalysis());
    } else if (lastMessage.includes('match') || lastMessage.includes('JOB_DESCRIPTION')) {
      content = JSON.stringify(getDemoJobMatch());
    } else if (lastMessage.includes('interview') || lastMessage.includes('questions')) {
      content = JSON.stringify(getDemoInterviewQuestions());
    } else if (lastMessage.includes('roadmap') || lastMessage.includes('learning')) {
      content = JSON.stringify(getDemoRoadmap());
    } else if (lastMessage.includes('rewrite') || lastMessage.includes('bullet')) {
      content = JSON.stringify(getDemoBulletSuggestions());
    } else {
      content = JSON.stringify({ message: 'Demo mode response' });
    }

    return {
      content,
      tokensUsed: 0,
      provider: this.name,
      model: this.model,
      latencyMs: 200,
      costEstimate: 0,
    };
  }
}

function getDemoAnalysis() {
  return {
    overallScore: 72,
    atsScore: 68,
    formattingScore: 80,
    contentScore: 70,
    impactScore: 65,
    sections: [
      {
        section: 'Contact Information',
        score: 90,
        maxScore: 100,
        issues: [],
        suggestions: ['Consider adding LinkedIn profile URL'],
        evidence: [],
      },
      {
        section: 'Professional Summary',
        score: 65,
        maxScore: 100,
        issues: ['Summary is generic and lacks specific value proposition'],
        suggestions: [
          'Lead with your most impressive achievement',
          'Specify target role and key skills',
        ],
        evidence: ['Current: "Experienced professional seeking new opportunities"'],
      },
      {
        section: 'Work Experience',
        score: 70,
        maxScore: 100,
        issues: [
          'Bullet points use weak action verbs ("responsible for", "helped with")',
          'Missing quantifiable achievements',
        ],
        suggestions: [
          'Start each bullet with a strong action verb (Led, Delivered, Increased)',
          'Add metrics: "Increased sales by X%" or "Reduced processing time by Y hours"',
        ],
        evidence: ['Found 3 bullets beginning with "Responsible for"'],
      },
      {
        section: 'Skills',
        score: 75,
        maxScore: 100,
        issues: ['Skills listed without context or proficiency levels'],
        suggestions: ['Group skills by category', 'Remove generic soft skills'],
        evidence: [],
      },
      {
        section: 'Education',
        score: 85,
        maxScore: 100,
        issues: [],
        suggestions: ['Add relevant coursework if recent graduate'],
        evidence: [],
      },
    ],
    skills: {
      technical: ['JavaScript', 'React', 'Node.js', 'SQL', 'Python'],
      soft: ['Communication', 'Problem-solving', 'Teamwork'],
      domain: ['Web Development', 'Software Engineering'],
      tools: ['Git', 'VS Code', 'Jira'],
    },
    strengths: [
      'Clear educational background',
      'Relevant technical skills listed',
      'Consistent date formatting',
    ],
    weaknesses: [
      'Lack of quantifiable achievements',
      'Weak action verbs throughout',
      'Generic professional summary',
    ],
    improvements: [
      {
        priority: 'high',
        category: 'Impact',
        issue: 'No measurable achievements',
        suggestion: 'Add at least 3 quantified accomplishments (e.g., "Reduced load time by 40%")',
        evidence: 'Work experience section reviewed',
      },
      {
        priority: 'high',
        category: 'Language',
        issue: 'Passive language and weak verbs',
        suggestion: 'Replace "responsible for" and "helped with" with strong action verbs',
        evidence: 'Found in 5 bullet points',
      },
      {
        priority: 'medium',
        category: 'ATS',
        issue: 'Missing keywords for target role',
        suggestion: 'Review job description and incorporate relevant keywords naturally',
        evidence: '',
      },
    ],
    wordCount: 450,
    pageCount: 1,
    hasQuantifiableAchievements: false,
    scoringMethodology: 'Scores are calculated using a weighted rubric: Content (30%), ATS Compatibility (25%), Formatting (20%), Impact (25%). This is a demo analysis.',
    disclaimer: 'This is DEMO MODE data for illustration. Configure an AI provider (ANTHROPIC_API_KEY or OPENAI_API_KEY) for real analysis. Scores are not guarantees of ATS system compatibility or hiring outcomes.',
  };
}

function getDemoJobMatch() {
  return {
    matchScore: 68,
    matchingSkills: ['JavaScript', 'React', 'Node.js', 'SQL', 'Git', 'Agile'],
    missingSkills: ['TypeScript', 'AWS', 'Docker', 'GraphQL', 'Redis'],
    relevantExperience: [
      { item: '3 years frontend development', relevance: 'Directly matches required experience' },
      { item: 'REST API development', relevance: 'Aligns with backend requirements' },
    ],
    keywordCoverage: 62,
    qualificationGaps: [
      'No demonstrated TypeScript experience',
      'Cloud infrastructure experience not mentioned',
      'No containerization experience listed',
    ],
    suggestedEdits: [
      {
        section: 'Skills',
        original: 'JavaScript, React, Node.js',
        suggested: 'TypeScript, JavaScript, React, Node.js (add TypeScript if you have experience)',
        reason: 'Job description emphasizes TypeScript proficiency',
      },
    ],
    summary: 'Your resume is a moderate match for this role. Strong frontend fundamentals align well, but cloud and DevOps skills are gaps. Focus on highlighting transferable skills.',
    disclaimer: 'This is DEMO MODE data. Configure an AI provider for real job matching. Match scores are not predictions of hiring decisions.',
  };
}

function getDemoInterviewQuestions() {
  return {
    questions: [
      {
        id: 'q1',
        type: 'technical',
        question: 'Explain the difference between REST and GraphQL APIs.',
        guidance: 'Focus on use cases, trade-offs, and when you would choose each.',
        followUps: ['Which have you used in production?', 'How do you handle authentication in each?'],
        sampleAnswer: 'REST uses fixed endpoints for each resource while GraphQL provides a single flexible endpoint. REST is simpler and well-understood; GraphQL reduces over/under-fetching. I have used REST extensively and GraphQL for complex UIs with many data requirements.',
      },
      {
        id: 'q2',
        type: 'behavioral',
        question: 'Tell me about a time you had to meet a tight deadline.',
        guidance: 'Use the STAR framework: Situation, Task, Action, Result.',
        followUps: ['What would you do differently?', 'How did you prioritize?'],
        sampleAnswer: 'Situation: We had a critical product launch with a 2-week deadline after a team member left. Task: I needed to complete their work plus my own. Action: I triaged tasks, automated repetitive work, and communicated blockers early. Result: Launched on time with all critical features.',
      },
      {
        id: 'q3',
        type: 'project',
        question: 'Walk me through your most impactful project.',
        guidance: 'Focus on your specific contributions, technical decisions, and measurable outcomes.',
        followUps: ['What was most challenging?', 'What would you change?'],
        sampleAnswer: null,
      },
    ],
    disclaimer: 'These are DEMO questions. Configure an AI provider for role-specific questions generated from your resume and job description.',
  };
}

function getDemoRoadmap() {
  return {
    targetRole: 'Senior Software Engineer',
    currentLevel: 'Mid-level Engineer',
    estimatedWeeks: 16,
    milestones: [
      {
        title: 'TypeScript Mastery',
        description: 'Build strong TypeScript foundations including generics, decorators, and advanced types',
        skills: ['TypeScript', 'Type safety', 'Advanced types'],
        estimatedHours: 30,
        resources: [
          { title: 'TypeScript Handbook', type: 'documentation', url: 'https://www.typescriptlang.org/docs/' },
          { title: 'TypeScript Deep Dive', type: 'book', note: 'Free online book by Basarat Ali Syed' },
        ],
        project: 'Rewrite one existing project in TypeScript',
      },
      {
        title: 'Cloud Fundamentals (AWS)',
        description: 'Learn core AWS services used in modern web applications',
        skills: ['AWS EC2', 'S3', 'RDS', 'Lambda', 'IAM'],
        estimatedHours: 40,
        resources: [
          { title: 'AWS Free Tier', type: 'documentation', url: 'https://aws.amazon.com/free/' },
          { title: 'AWS Solutions Architect Associate Prep', type: 'course', note: 'Look for current courses on major learning platforms' },
        ],
        project: 'Deploy a full-stack app on AWS',
      },
    ],
    disclaimer: 'This is DEMO MODE data. Configure an AI provider for a personalized roadmap based on your actual resume and target job description. Resource links and time estimates are approximate.',
  };
}

function getDemoBulletSuggestions() {
  return {
    suggestions: [
      {
        original: 'Responsible for developing features',
        improved: 'Developed 8 user-facing features using React and TypeScript, reducing bug reports by 25%',
        explanation: 'Added strong action verb, specificity, and quantified impact',
      },
      {
        original: 'Helped with customer issues',
        improved: 'Resolved 50+ customer-reported bugs per sprint, improving user satisfaction score from 3.2 to 4.1',
        explanation: 'Replaced passive language with measurable outcome',
      },
    ],
    disclaimer: 'DEMO MODE suggestions. These are illustrative examples only. Never add fabricated metrics to your actual resume.',
  };
}
