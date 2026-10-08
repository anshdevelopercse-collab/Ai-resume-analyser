import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  // Clean slate
  await prisma.resumeAnalysis.deleteMany();
  await prisma.jobMatch.deleteMany();
  await prisma.roadmap.deleteMany();
  await prisma.interviewSession.deleteMany();
  await prisma.application.deleteMany();
  await prisma.jobDescription.deleteMany();
  await prisma.resume.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  // Create user
  const hash = await bcrypt.hash('Demo1234!', 10);
  const user = await prisma.user.create({
    data: {
      email: 'demo@resumeiq.dev',
      passwordHash: hash,
      firstName: 'Ansh',
      lastName: 'Sharma',
      emailVerified: true,
      plan: 'pro',
      usageResumeUploads: 3,
      usageAiAnalyses: 8,
      usageJobMatches: 5,
    },
  });
  console.log('Created user:', user.email);

  // ── Resumes ──────────────────────────────────────────────
  const resume1 = await prisma.resume.create({
    data: {
      userId: user.id,
      filename: 'ansh_sharma_sde.pdf',
      originalName: 'Ansh_Sharma_SDE_Resume.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 148230,
      storageKey: 'uploads/ansh_sharma_sde.pdf',
      label: 'Software Engineer Resume',
      pageCount: 1,
      wordCount: 487,
      extractedText: `Ansh Sharma
ansh.developer.cse@gmail.com | +91 98765 43210 | LinkedIn | GitHub | Portfolio

SUMMARY
Full-stack software engineer with 2+ years of experience building scalable web applications. Proficient in React, Node.js, TypeScript, and cloud technologies. Passionate about clean architecture and developer experience.

EXPERIENCE
Software Developer Intern — TechCorp Solutions, Bangalore (Jun 2024 – Present)
• Built 3 microservices handling 50k+ daily requests using Node.js and Express
• Reduced API response time by 40% via Redis caching and query optimization
• Implemented CI/CD pipelines on GitHub Actions cutting deployment time by 60%
• Led frontend migration from JavaScript to TypeScript across 15k+ LOC codebase

EDUCATION
B.Tech Computer Science Engineering — XYZ University (2022–2026) | CGPA: 8.7/10

SKILLS
Languages: TypeScript, JavaScript, Python, Java
Frontend: React, Next.js, Tailwind CSS, Redux
Backend: Node.js, Express, Prisma, PostgreSQL, MongoDB, Redis
Cloud/DevOps: AWS (EC2, S3, Lambda), Docker, GitHub Actions
Tools: Git, Postman, Figma, VS Code

PROJECTS
ResumeIQ – AI Resume Analyser SaaS
• Full-stack SaaS with AI-powered resume scoring using Gemini API
• Tech: React, TypeScript, Node.js, PostgreSQL, Prisma, Tailwind CSS
• Features: Resume analysis, job matching, skill roadmaps, interview prep

E-Commerce Platform
• Built complete e-commerce platform with payment integration (Razorpay)
• 500+ products, real-time inventory management, 99.9% uptime

CERTIFICATIONS
AWS Certified Developer – Associate | Google Cloud Professional Cloud Developer`,
    },
  });

  const resume2 = await prisma.resume.create({
    data: {
      userId: user.id,
      filename: 'ansh_sharma_fullstack.pdf',
      originalName: 'Ansh_Sharma_FullStack_2024.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 134890,
      storageKey: 'uploads/ansh_sharma_fullstack.pdf',
      label: 'Full Stack Developer Resume',
      pageCount: 1,
      wordCount: 462,
      extractedText: 'Full stack resume text...',
    },
  });

  console.log('Created 2 resumes');

  // ── Job Descriptions ──────────────────────────────────────
  const job1 = await prisma.jobDescription.create({
    data: {
      userId: user.id,
      title: 'Senior Frontend Engineer',
      company: 'Razorpay',
      description: `We are looking for a Senior Frontend Engineer to join our Payments team.

Requirements:
• 3+ years of experience with React and TypeScript
• Strong understanding of state management (Redux, Zustand, or similar)
• Experience with performance optimization and Core Web Vitals
• Knowledge of micro-frontend architecture
• Familiarity with testing (Jest, React Testing Library, Cypress)
• Experience with CI/CD and modern deployment workflows

Nice to have:
• Experience with Next.js and SSR/SSG patterns
• GraphQL experience
• Design system experience (building component libraries)

What you'll do:
• Build and maintain high-performance payment UI components
• Collaborate with design and backend teams
• Mentor junior engineers and conduct code reviews
• Drive technical decisions for the frontend architecture`,
      location: 'Bangalore',
      remote: false,
      salaryMin: 2000000,
      salaryMax: 3500000,
      currency: 'INR',
      url: 'https://razorpay.com/jobs',
    },
  });

  const job2 = await prisma.jobDescription.create({
    data: {
      userId: user.id,
      title: 'Backend Engineer – Node.js',
      company: 'Zepto',
      description: `Join Zepto's high-growth engineering team building India's fastest grocery delivery platform.

Requirements:
• 2+ years with Node.js and TypeScript
• Experience with microservices architecture
• Strong PostgreSQL/MongoDB knowledge
• Redis, message queues (Kafka/RabbitMQ) experience
• REST API design best practices
• Docker and Kubernetes knowledge

Responsibilities:
• Design and build scalable backend services
• Optimize database queries for high throughput
• Implement real-time features using WebSockets
• Ensure 99.99% uptime for critical payment services`,
      location: 'Mumbai',
      remote: true,
      salaryMin: 1800000,
      salaryMax: 3000000,
      currency: 'INR',
    },
  });

  const job3 = await prisma.jobDescription.create({
    data: {
      userId: user.id,
      title: 'Full Stack Engineer',
      company: 'CRED',
      description: `CRED is hiring Full Stack Engineers to build next-gen fintech products.

Requirements:
• Strong React + Node.js skills
• TypeScript proficiency
• Database design experience
• API integration expertise
• System design knowledge`,
      location: 'Bangalore',
      remote: false,
      salaryMin: 2500000,
      salaryMax: 4000000,
      currency: 'INR',
    },
  });

  console.log('Created 3 job descriptions');

  // ── Resume Analysis ───────────────────────────────────────
  const analysis1 = await prisma.resumeAnalysis.create({
    data: {
      userId: user.id,
      resumeId: resume1.id,
      status: 'completed',
      provider: 'gemini',
      aiModel: 'gemini-2.0-flash',
      tokensUsed: 3842,
      processingMs: 4120,
      idempotencyKey: `analysis:${user.id}:${resume1.id}`,
      result: {
        overallScore: 82,
        atsScore: 88,
        formattingScore: 85,
        contentScore: 78,
        impactScore: 76,
        scoringMethodology: "Scores computed across ATS compatibility, formatting quality, content depth, and measurable impact. Higher weight given to quantified achievements and keyword density.",
        strengths: [
          "Strong quantified achievements (40% performance improvement, 60% deployment reduction)",
          "Relevant tech stack matches current industry demand",
          "Clean single-page format with clear section hierarchy",
          "Projects section demonstrates real-world application of skills",
          "Certifications from major cloud providers add credibility"
        ],
        weaknesses: [
          "Work experience section is thin — only one internship listed",
          "Summary could be more targeted to specific roles",
          "Missing soft skills and leadership examples",
          "No mention of team size or scope of projects"
        ],
        improvements: [
          {
            priority: "high",
            category: "Experience",
            issue: "Only one work experience entry limits perceived seniority",
            suggestion: "Add freelance projects, open-source contributions, or college projects as experience entries with measurable outcomes",
            evidence: "Recruiters spend avg 7 seconds on resume; sparse experience raises red flags"
          },
          {
            priority: "high",
            category: "Keywords",
            issue: "Missing system design keywords that ATS filters for",
            suggestion: "Add terms: microservices, distributed systems, scalability, REST API, API design",
            evidence: "80% of resumes filtered by ATS before human review"
          },
          {
            priority: "medium",
            category: "Impact",
            issue: "Project descriptions lack business metrics",
            suggestion: "Add user count, traffic numbers, or business value to each project (e.g. 'serving 1000+ users')",
            evidence: "Quantified impact increases callback rate by 40%"
          },
          {
            priority: "medium",
            category: "Summary",
            issue: "Generic summary doesn't highlight unique value proposition",
            suggestion: "Tailor summary to target role: mention specific domain (fintech, SaaS, etc.) and key differentiator",
            evidence: "Tailored summaries improve interview rate by 30%"
          },
          {
            priority: "low",
            category: "Formatting",
            issue: "Skills section could be better categorized",
            suggestion: "Group skills by proficiency level (Expert / Proficient / Familiar) for clearer reading",
            evidence: "Structured skills sections improve ATS parsing accuracy"
          }
        ],
        sections: [
          {
            section: "Contact Information",
            score: 95,
            maxScore: 100,
            issues: [],
            suggestions: ["Consider adding portfolio website URL"],
            evidence: ["Email, phone, LinkedIn, GitHub all present"]
          },
          {
            section: "Professional Summary",
            score: 70,
            maxScore: 100,
            issues: ["Too generic — applies to any developer"],
            suggestions: ["Add specific domain expertise", "Mention career goal for target role"],
            evidence: ["'Passionate about clean architecture' is vague"]
          },
          {
            section: "Work Experience",
            score: 75,
            maxScore: 100,
            issues: ["Only one experience entry", "No team context"],
            suggestions: ["Add scope of team size", "Include more bullet points with metrics"],
            evidence: ["TechCorp entry has strong metrics (50k requests, 40% improvement)"]
          },
          {
            section: "Education",
            score: 85,
            maxScore: 100,
            issues: [],
            suggestions: ["Add relevant coursework or academic projects"],
            evidence: ["CGPA 8.7 is competitive for entry-level roles"]
          },
          {
            section: "Skills",
            score: 88,
            maxScore: 100,
            issues: ["No proficiency levels"],
            suggestions: ["Differentiate expert vs familiar skills"],
            evidence: ["Strong breadth: React, Node.js, AWS, Docker all listed"]
          },
          {
            section: "Projects",
            score: 72,
            maxScore: 100,
            issues: ["Missing user/traffic metrics for projects"],
            suggestions: ["Add GitHub stars or live user counts", "Mention tech challenges overcome"],
            evidence: ["ResumeIQ project is impressive but lacks scale metrics"]
          }
        ],
        skills: {
          technical: ["TypeScript", "JavaScript", "React", "Node.js", "Express", "PostgreSQL", "MongoDB", "Redis", "Docker", "AWS"],
          frameworks: ["Next.js", "Tailwind CSS", "Redux", "Prisma"],
          tools: ["Git", "GitHub Actions", "Postman", "Figma"],
          languages: ["Python", "Java"],
          cloud: ["AWS EC2", "AWS S3", "AWS Lambda", "Google Cloud"]
        },
        disclaimer: null
      }
    }
  });

  console.log('Created resume analysis');

  // ── Job Match ─────────────────────────────────────────────
  await prisma.jobMatch.create({
    data: {
      userId: user.id,
      resumeId: resume1.id,
      jobDescriptionId: job1.id,
      status: 'completed',
      provider: 'gemini',
      aiModel: 'gemini-2.0-flash',
      tokensUsed: 2941,
      idempotencyKey: `match:${user.id}:${resume1.id}:${job1.id}`,
      result: {
        overallMatch: 74,
        skillMatch: 80,
        experienceMatch: 62,
        keywordMatch: 78,
        verdict: "Strong candidate with minor gaps",
        matchedSkills: ["React", "TypeScript", "Node.js", "CI/CD", "GitHub Actions", "Performance optimization"],
        missingSkills: ["Redux/Zustand (state management)", "Micro-frontend architecture", "Cypress E2E testing", "GraphQL"],
        keywordGaps: ["micro-frontend", "Core Web Vitals", "SSR", "component library"],
        recommendations: [
          "Add Redux or Zustand to skills — it's explicitly required",
          "Mention any performance optimization work with Core Web Vitals metrics",
          "Highlight any design system or component library work from projects",
          "Consider a small Next.js project to cover SSR knowledge gap"
        ]
      }
    }
  });

  await prisma.jobMatch.create({
    data: {
      userId: user.id,
      resumeId: resume1.id,
      jobDescriptionId: job2.id,
      status: 'completed',
      provider: 'gemini',
      aiModel: 'gemini-2.0-flash',
      tokensUsed: 2654,
      idempotencyKey: `match:${user.id}:${resume1.id}:${job2.id}`,
      result: {
        overallMatch: 88,
        skillMatch: 92,
        experienceMatch: 78,
        keywordMatch: 85,
        verdict: "Excellent match — apply immediately",
        matchedSkills: ["Node.js", "TypeScript", "PostgreSQL", "MongoDB", "Redis", "Docker", "Microservices", "REST API"],
        missingSkills: ["Kafka/RabbitMQ message queues", "Kubernetes"],
        keywordGaps: ["Kafka", "Kubernetes", "WebSocket"],
        recommendations: [
          "Your microservices experience at TechCorp directly aligns",
          "Add Kafka to learning plan — it's heavily used at Zepto scale",
          "Kubernetes basics would strengthen the application significantly",
          "The remote work aspect matches well with your profile"
        ]
      }
    }
  });

  console.log('Created 2 job matches');

  // ── Roadmap ───────────────────────────────────────────────
  await prisma.roadmap.create({
    data: {
      userId: user.id,
      resumeId: resume1.id,
      jobDescriptionId: job1.id,
      targetRole: 'Senior Frontend Engineer',
      status: 'completed',
      provider: 'gemini',
      summary: 'Your path to Senior Frontend Engineer focuses on deepening React architecture knowledge, mastering state management patterns, and building measurable performance optimization skills. With your existing TypeScript and React foundation, you are approximately 4-6 months from being competitive for senior roles at top-tier companies.',
      skillGaps: ['State Management (Redux/Zustand)', 'Micro-frontend Architecture', 'Core Web Vitals', 'Component Library Design', 'GraphQL', 'Cypress E2E Testing'],
      milestones: [
        {
          id: uuidv4(),
          title: 'Master Advanced State Management',
          description: 'Deep dive into Redux Toolkit and Zustand. Build a complex application demonstrating both patterns with proper middleware, selectors, and async thunks.',
          priority: 'high',
          estimatedWeeks: 2,
          resources: ['Redux Toolkit official docs', 'Zustand GitHub examples', 'Jack Herrington YouTube series on React state', 'Build: mini e-commerce cart with RTK Query'],
          completed: true,
        },
        {
          id: uuidv4(),
          title: 'Core Web Vitals & Performance',
          description: 'Learn to measure and optimize LCP, FID/INP, and CLS. Use Chrome DevTools, Lighthouse, and Web Vitals library to identify and fix real performance issues.',
          priority: 'high',
          estimatedWeeks: 2,
          resources: ['web.dev/learn/performance', 'Chrome DevTools Performance tab', 'React DevTools Profiler', 'Build: audit and optimize your portfolio site'],
          completed: true,
        },
        {
          id: uuidv4(),
          title: 'Micro-Frontend Architecture',
          description: 'Understand module federation with Webpack 5. Build a micro-frontend demo with independent deployable units sharing a shell application.',
          priority: 'high',
          estimatedWeeks: 3,
          resources: ['Webpack 5 Module Federation docs', 'Micro Frontends by Michael Geers', 'Martin Fowler micro-frontends article', 'Build: two micro-apps sharing auth state'],
          completed: false,
        },
        {
          id: uuidv4(),
          title: 'Build a Component Library',
          description: 'Create a production-quality React component library with TypeScript, Storybook, and proper theming. Publish to npm.',
          priority: 'medium',
          estimatedWeeks: 3,
          resources: ['Storybook documentation', 'Radix UI source code study', 'shadcn/ui architecture patterns', 'Build: 10-component library published on npm'],
          completed: false,
        },
        {
          id: uuidv4(),
          title: 'GraphQL Client Mastery',
          description: 'Learn Apollo Client and TanStack Query for GraphQL. Understand caching strategies, optimistic updates, and subscriptions.',
          priority: 'medium',
          estimatedWeeks: 2,
          resources: ['Apollo Client docs', 'The Guild GraphQL tutorials', 'Hasura free tier for practice backend', 'Build: replace REST calls in a project with GraphQL'],
          completed: false,
        },
        {
          id: uuidv4(),
          title: 'E2E Testing with Cypress',
          description: 'Write comprehensive E2E test suites with Cypress. Cover critical user flows, API mocking, and CI integration.',
          priority: 'medium',
          estimatedWeeks: 1,
          resources: ['Cypress official docs', 'Testing Library best practices', 'Real World App Cypress tests (GitHub)', 'Build: full test suite for your best project'],
          completed: false,
        },
        {
          id: uuidv4(),
          title: 'System Design for Frontend',
          description: 'Study frontend system design: caching strategies, CDN, code splitting, lazy loading at scale, and design system governance.',
          priority: 'low',
          estimatedWeeks: 2,
          resources: ['Frontend System Design Handbook', 'GreatFrontEnd system design section', 'Addy Osmani "Learning Patterns"', 'Practice: design Twitter feed component system'],
          completed: false,
        }
      ]
    }
  });

  console.log('Created roadmap');

  // ── Interview Session ─────────────────────────────────────
  await prisma.interviewSession.create({
    data: {
      userId: user.id,
      resumeId: resume1.id,
      jobDescriptionId: job1.id,
      title: 'Senior Frontend Engineer — Razorpay Prep',
      status: 'active',
      provider: 'gemini',
      aiModel: 'gemini-2.0-flash',
      questions: [
        {
          id: uuidv4(),
          question: 'Walk me through how you reduced API response time by 40% at TechCorp. What was your approach to identifying the bottleneck and implementing the solution?',
          type: 'behavioral',
          difficulty: 'medium',
          userAnswer: 'We had endpoints taking 800ms+ on average. I used Node.js profiling and identified N+1 query patterns in our ORM. I implemented Redis caching for frequently-read data and added database indexes. The combination brought average response time down to ~480ms.',
          aiFeedback: {
            score: 82,
            strengths: ['Specific metric (40% improvement) shows impact', 'Demonstrated systematic debugging approach', 'Mentioned multiple optimization techniques'],
            improvements: ['Quantify the business impact (fewer timeouts, better user experience)', 'Mention how you validated the improvement (benchmarking, monitoring)', 'Could elaborate on what specific queries were the bottleneck'],
            suggestedAnswer: 'Strong answer overall. Add: "We validated using APM tooling and set up dashboards to monitor p95 latency ongoing, reducing timeouts by 70% which directly improved our user completion rate on checkout flows."'
          }
        },
        {
          id: uuidv4(),
          question: 'Explain the difference between useCallback and useMemo. When would you use each, and when might overusing them be harmful?',
          type: 'technical',
          difficulty: 'medium',
          userAnswer: 'useCallback memoizes functions, useMemo memoizes values. You use useCallback when passing functions as props to prevent child re-renders. useMemo for expensive calculations. Overusing them adds overhead — the memoization itself costs memory and comparison time.',
          aiFeedback: {
            score: 78,
            strengths: ['Correct understanding of the core difference', 'Good point about memoization overhead'],
            improvements: ['Give a concrete example — interviewers want to see applied knowledge', 'Mention referential equality and why it matters for React.memo', 'Missing: when NOT to use them (simple components, rarely changing values)'],
            suggestedAnswer: 'Add an example: "If I have a parent passing an onClick handler to 100 list items wrapped in React.memo, useCallback prevents all 100 from re-rendering on parent state changes. But for a simple counter increment handler, the overhead outweighs the benefit."'
          }
        },
        {
          id: uuidv4(),
          question: 'How would you architect a payment form component that needs to be reusable across 5 different checkout flows, each with different validation rules and visual variants?',
          type: 'technical',
          difficulty: 'hard',
          userAnswer: null,
          aiFeedback: null
        },
        {
          id: uuidv4(),
          question: 'Tell me about a time you had a disagreement with a teammate about a technical approach. How did you resolve it?',
          type: 'behavioral',
          difficulty: 'medium',
          userAnswer: null,
          aiFeedback: null
        }
      ]
    }
  });

  console.log('Created interview session');

  // ── Applications ──────────────────────────────────────────
  await prisma.application.createMany({
    data: [
      {
        userId: user.id,
        company: 'Razorpay',
        role: 'Senior Frontend Engineer',
        location: 'Bangalore',
        remote: false,
        status: 'interview',
        jobDescriptionId: job1.id,
        resumeId: resume1.id,
        appliedAt: new Date('2026-09-18'),
        nextAction: 'Technical round with Payments team',
        nextActionDate: new Date('2026-10-12'),
        notes: 'Referred by college senior. HR screening went well. Strong interest in their micro-frontend work.',
        salaryMin: 2000000,
        salaryMax: 3500000,
        currency: 'INR',
      },
      {
        userId: user.id,
        company: 'Zepto',
        role: 'Backend Engineer – Node.js',
        location: 'Mumbai',
        remote: true,
        status: 'phone_screen',
        jobDescriptionId: job2.id,
        resumeId: resume1.id,
        appliedAt: new Date('2026-09-22'),
        nextAction: 'Phone screen with Engineering Manager',
        nextActionDate: new Date('2026-10-09'),
        notes: 'Applied via LinkedIn. Fast response — 2 days. They liked the microservices experience.',
        salaryMin: 1800000,
        salaryMax: 3000000,
        currency: 'INR',
      },
      {
        userId: user.id,
        company: 'CRED',
        role: 'Full Stack Engineer',
        location: 'Bangalore',
        remote: false,
        status: 'applied',
        jobDescriptionId: job3.id,
        resumeId: resume1.id,
        appliedAt: new Date('2026-09-28'),
        notes: 'Dream company. Applied through careers page. Waiting for response.',
        salaryMin: 2500000,
        salaryMax: 4000000,
        currency: 'INR',
      },
      {
        userId: user.id,
        company: 'Swiggy',
        role: 'Software Development Engineer II',
        location: 'Bangalore',
        remote: false,
        status: 'technical',
        appliedAt: new Date('2026-09-10'),
        nextAction: 'DSA + System Design round',
        nextActionDate: new Date('2026-10-10'),
        notes: 'Cleared two rounds. Final technical with Staff Engineer coming up.',
        salaryMin: 2200000,
        salaryMax: 3800000,
        currency: 'INR',
      },
      {
        userId: user.id,
        company: 'PhonePe',
        role: 'Frontend Engineer',
        location: 'Bangalore',
        remote: false,
        status: 'offer',
        appliedAt: new Date('2026-09-02'),
        notes: 'Offer received! ₹22 LPA. Comparing with Razorpay before deciding. Strong product, great team.',
        salaryMin: 2200000,
        salaryMax: 2200000,
        currency: 'INR',
      },
      {
        userId: user.id,
        company: 'Flipkart',
        role: 'SDE-1',
        location: 'Bangalore',
        remote: false,
        status: 'rejected',
        appliedAt: new Date('2026-08-25'),
        notes: 'Rejected after final round. Feedback: system design needs improvement. Will reattempt in 6 months.',
      },
    ]
  });

  console.log('Created 6 applications');
  console.log('\n✅ Demo seed complete!');
  console.log('Login: demo@resumeiq.dev / Demo1234!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
