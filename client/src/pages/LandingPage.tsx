import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText, BarChart2, Briefcase, MessageSquare,
  ArrowRight, CheckCircle, Star, Zap, Shield, TrendingUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

const features = [
  {
    icon: BarChart2,
    title: 'AI Resume Analysis',
    description: 'Get evidence-backed scores, section-by-section feedback, and actionable improvements powered by real AI.',
  },
  {
    icon: Briefcase,
    title: 'Job Description Matching',
    description: 'Paste any job description and see exactly how your resume measures up with transparent gap analysis.',
  },
  {
    icon: FileText,
    title: 'Resume Builder',
    description: 'Build ATS-friendly resumes from scratch with professional templates and live preview.',
  },
  {
    icon: MessageSquare,
    title: 'Interview Preparation',
    description: 'Practice role-specific questions generated from your resume with AI feedback.',
  },
  {
    icon: TrendingUp,
    title: 'Skill Gap Roadmap',
    description: 'Discover missing skills for your target role and get a personalized learning plan.',
  },
  {
    icon: BarChart2,
    title: 'Application Tracker',
    description: 'Track every application from wishlist to offer with Kanban and table views.',
  },
];

const pricingPlans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Get started with the essentials',
    features: [
      '3 resume uploads',
      '5 AI analyses',
      '3 job matches',
      '20 tracked applications',
      'Basic interview prep',
    ],
    cta: 'Start Free',
    href: '/register',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'For serious job seekers',
    features: [
      '50 resume uploads',
      '100 AI analyses',
      '50 job matches',
      '500 tracked applications',
      'Full interview prep',
      'Skill roadmaps',
      'Resume builder & export',
    ],
    cta: 'Start Pro',
    href: '/register',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For teams and career centers',
    features: [
      'Unlimited everything',
      'Team management',
      'Admin dashboard',
      'Priority support',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    href: '/register',
    highlighted: false,
  },
];

const faqs = [
  {
    q: 'How accurate are the ATS scores?',
    a: 'Our scores reflect an AI-based assessment using a transparent rubric. They are not scores from any specific ATS vendor system, which are proprietary. Use them as a signal, not a guarantee.',
  },
  {
    q: 'Does ResumeIQ see my resume data?',
    a: 'Your resumes are stored securely and only used to generate your analysis. We do not sell your data. Review our privacy policy for details.',
  },
  {
    q: 'What AI provider does ResumeIQ use?',
    a: 'We support Anthropic Claude and OpenAI GPT models, configurable via environment variables. A clearly labeled demo mode is available without an API key.',
  },
  {
    q: 'Can ResumeIQ guarantee I get hired?',
    a: 'No, and we never will. ResumeIQ provides evidence-based feedback to help you present yourself better. Hiring decisions depend on many factors beyond resume quality.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="font-bold text-lg">ResumeIQ</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Log in</Link>
            </Button>
            <Button size="sm" variant="gradient" asChild>
              <Link to="/register">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 sm:py-32">
        <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-gray-950 [background:radial-gradient(125%_125%_at_50%_10%,#fff_40%,#e0e7ff_100%)] dark:[background:radial-gradient(125%_125%_at_50%_10%,#0a0a0a_40%,#1e1b4b_100%)]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm">
              <Zap className="h-3 w-3 mr-1 text-indigo-500" />
              AI-powered career platform
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-[1.1]">
              Get your resume{' '}
              <span className="gradient-text">analysis-ready</span>
              {' '}in minutes
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
              ResumeIQ analyzes your resume with real AI, identifies gaps, matches you to job descriptions,
              and helps you prepare for interviews — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="xl" variant="gradient" asChild>
                <Link to="/register">
                  Analyze My Resume Free <ArrowRight className="ml-1 h-5 w-5" />
                </Link>
              </Button>
              <Button size="xl" variant="outline" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              No credit card required · Free tier available · Demo mode without API keys
            </p>
          </motion.div>

          {/* Dashboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-16 mx-auto max-w-5xl"
          >
            <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
              <div className="bg-muted/50 h-10 flex items-center px-4 gap-2">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-yellow-400" />
                <div className="h-3 w-3 rounded-full bg-green-400" />
                <div className="flex-1 mx-4 bg-background rounded h-5 text-xs text-muted-foreground flex items-center px-3">
                  resumeiq.app/dashboard
                </div>
              </div>
              <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Resume Score', value: '78', sub: 'Good · 5 improvements', color: 'text-indigo-600' },
                  { label: 'Job Match', value: '68%', sub: 'Senior Dev role', color: 'text-violet-600' },
                  { label: 'Applications', value: '12', sub: '3 in interview stage', color: 'text-emerald-600' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-background border rounded-xl p-4 text-left">
                    <div className="text-sm text-muted-foreground mb-1">{stat.label}</div>
                    <div className={`text-3xl font-bold mb-1 ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 sm:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need to land your next role</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              ResumeIQ combines AI analysis, job matching, interview prep, and application tracking in one seamless platform.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                viewport={{ once: true }}
              >
                <Card className="h-full hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="h-11 w-11 rounded-xl bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center mb-4">
                      <feature.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 sm:py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Transparent pricing</h2>
            <p className="text-muted-foreground text-lg">Choose the plan that fits your job search journey</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'rounded-2xl border p-8',
                  plan.highlighted
                    ? 'bg-gradient-to-b from-indigo-600 to-violet-700 text-white border-indigo-500 shadow-xl shadow-indigo-200/50 dark:shadow-indigo-900/50 scale-105'
                    : 'bg-card'
                )}
              >
                <div className="mb-6">
                  <h3 className={cn('font-bold text-lg mb-1', plan.highlighted && 'text-white')}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className={cn('text-4xl font-bold', plan.highlighted && 'text-white')}>{plan.price}</span>
                    <span className={cn('text-muted-foreground', plan.highlighted && 'text-indigo-200')}>{plan.period}</span>
                  </div>
                  <p className={cn('text-sm mt-2', plan.highlighted ? 'text-indigo-200' : 'text-muted-foreground')}>{plan.description}</p>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className={cn('h-4 w-4 shrink-0', plan.highlighted ? 'text-indigo-200' : 'text-green-500')} />
                      <span className={plan.highlighted ? 'text-indigo-100' : ''}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={plan.highlighted ? 'secondary' : 'outline'}
                  asChild
                >
                  <Link to={plan.href}>{plan.cta}</Link>
                </Button>
              </div>
            ))}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">
            Pricing is for reference. No live payments are processed until a billing provider is configured.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 sm:py-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Frequently asked questions</h2>
          </div>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="border rounded-xl p-6">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-32 bg-gradient-to-br from-indigo-600 to-violet-700 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to improve your resume?</h2>
          <p className="text-indigo-200 text-lg mb-8">Join thousands of job seekers getting AI-powered career insights.</p>
          <Button size="xl" variant="secondary" asChild>
            <Link to="/register">Get Started Free <ArrowRight className="ml-2 h-5 w-5" /></Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">R</span>
              </div>
              <span className="font-bold">ResumeIQ</span>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-powered career platform · Results are not guarantees of employment · {new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
