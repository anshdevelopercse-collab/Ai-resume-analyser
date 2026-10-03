import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  FileText, TrendingUp, Briefcase, BarChart2,
  ArrowRight, Upload, Plus, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import { formatRelativeTime, scoreColor, scoreLabel } from '@/lib/utils';

function StatCard({ title, value, sub, icon: Icon, color, href }: {
  title: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  color: string;
  href: string;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          <Link to={href} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="text-2xl font-bold mb-1">{value}</div>
        <div className="text-sm text-muted-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}

function DemoBanner() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 flex gap-3">
      <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
      <div>
        <div className="font-medium text-amber-900 dark:text-amber-300 text-sm">Demo Mode Active</div>
        <div className="text-amber-700 dark:text-amber-400 text-xs mt-1">
          AI analysis is using sample data. To enable real AI analysis, configure{' '}
          <code className="bg-amber-200 dark:bg-amber-900 px-1 rounded">ANTHROPIC_API_KEY</code> or{' '}
          <code className="bg-amber-200 dark:bg-amber-900 px-1 rounded">OPENAI_API_KEY</code> in your server environment.
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: resumesData, isLoading: resumesLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: async () => {
      const { data } = await api.get('/resumes?limit=3');
      return data;
    },
  });

  const { data: analysesData, isLoading: analysesLoading } = useQuery({
    queryKey: ['analyses'],
    queryFn: async () => {
      const { data } = await api.get('/resumes/analyses/all?limit=3');
      return data;
    },
  });

  const { data: appStats } = useQuery({
    queryKey: ['applicationStats'],
    queryFn: async () => {
      const { data } = await api.get('/applications/stats');
      return data.data;
    },
  });

  const { data: readyData } = useQuery({
    queryKey: ['serverReady'],
    queryFn: async () => {
      const { data } = await api.get('/../../ready');
      return data;
    },
    retry: false,
  });

  const isDemoMode = readyData?.demoMode;

  const latestAnalysis = analysesData?.data?.[0];
  const analysisScore = latestAnalysis?.result?.overallScore;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Good {getTimeOfDay()}, {user?.firstName}
          </h1>
          <p className="text-muted-foreground mt-1">Here's your career progress overview</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link to="/resumes"><Upload className="mr-2 h-4 w-4" /> Upload Resume</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/applications/new"><Plus className="mr-2 h-4 w-4" /> Add Application</Link>
          </Button>
        </div>
      </div>

      {isDemoMode && <DemoBanner />}

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Resumes"
          value={resumesData?.pagination?.total ?? '–'}
          sub="Uploaded documents"
          icon={FileText}
          color="bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
          href="/resumes"
        />
        <StatCard
          title="Latest Score"
          value={analysisScore != null ? `${analysisScore}/100` : '–'}
          sub={analysisScore != null ? scoreLabel(analysisScore) : 'No analyses yet'}
          icon={TrendingUp}
          color="bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
          href="/resumes"
        />
        <StatCard
          title="Applications"
          value={appStats?.total ?? '–'}
          sub={appStats ? `${appStats.interview ?? 0} in interviews` : 'No applications yet'}
          icon={Briefcase}
          color="bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          href="/applications"
        />
        <StatCard
          title="Job Matches"
          value="–"
          sub="Run a match analysis"
          icon={BarChart2}
          color="bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
          href="/jobs"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Resumes */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Resumes</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/resumes">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {resumesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : resumesData?.data?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm mb-4">No resumes uploaded yet</p>
                <Button size="sm" asChild>
                  <Link to="/resumes"><Upload className="mr-2 h-4 w-4" /> Upload Your First Resume</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {resumesData?.data?.map((resume: any) => (
                  <Link
                    key={resume.id}
                    to={`/resumes/${resume.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors"
                  >
                    <div className="h-9 w-9 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-indigo-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{resume.label || resume.originalName}</div>
                      <div className="text-xs text-muted-foreground">{formatRelativeTime(resume.createdAt)}</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Analyses */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Analyses</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/resumes">View all <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {analysesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : analysesData?.data?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm mb-4">No analyses yet. Upload a resume to get started.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {analysesData?.data?.map((analysis: any) => (
                  <div key={analysis.id} className="p-3 rounded-lg border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium truncate">
                        {(analysis.resume as any)?.label || (analysis.resume as any)?.originalName || 'Resume'}
                      </div>
                      {analysis.status === 'completed' && analysis.result && (
                        <span className={`text-sm font-bold ${scoreColor(analysis.result.overallScore)}`}>
                          {analysis.result.overallScore}/100
                        </span>
                      )}
                      {analysis.status === 'processing' && (
                        <Badge variant="info">Processing</Badge>
                      )}
                      {analysis.status === 'failed' && (
                        <Badge variant="destructive">Failed</Badge>
                      )}
                    </div>
                    {analysis.status === 'completed' && analysis.result && (
                      <Progress value={analysis.result.overallScore} className="h-1.5" />
                    )}
                    <div className="text-xs text-muted-foreground mt-1">{formatRelativeTime(analysis.createdAt)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-base font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/resumes', label: 'Analyze Resume', icon: TrendingUp, color: 'text-indigo-600' },
            { href: '/jobs', label: 'Match to Job', icon: Briefcase, color: 'text-violet-600' },
            { href: '/interviews', label: 'Interview Prep', icon: BarChart2, color: 'text-emerald-600' },
            { href: '/roadmap', label: 'Skill Roadmap', icon: ArrowRight, color: 'text-orange-600' },
          ].map((action) => (
            <Link
              key={action.href}
              to={action.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border hover:bg-accent hover:border-primary/30 transition-all text-center"
            >
              <action.icon className={`h-6 w-6 ${action.color}`} />
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
