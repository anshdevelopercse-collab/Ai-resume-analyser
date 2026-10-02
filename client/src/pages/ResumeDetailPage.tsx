import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BarChart2, FileText, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Info, Loader2, AlertCircle
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiError } from '@/lib/api';
import { scoreColor, scoreLabel, scoreBgColor, formatDate } from '@/lib/utils';

function ScoreRing({ score, label, size = 'md' }: { score: number; label: string; size?: 'sm' | 'md' | 'lg' }) {
  const r = size === 'lg' ? 40 : size === 'md' ? 30 : 22;
  const circumference = 2 * Math.PI * r;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={r * 2 + 20} height={r * 2 + 20} className="-rotate-90">
          <circle cx={r + 10} cy={r + 10} r={r} fill="none" stroke="currentColor" strokeWidth="6"
            className="text-muted" />
          <circle cx={r + 10} cy={r + 10} r={r} fill="none" strokeWidth="6"
            stroke={score >= 80 ? '#22c55e' : score >= 60 ? '#eab308' : score >= 40 ? '#f97316' : '#ef4444'}
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round" className="transition-all duration-1000" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-bold ${size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-base' : 'text-xs'} ${scoreColor(score)}`}>
            {score}
          </span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  );
}

function SectionCard({ section }: { section: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{section.section}</span>
            <span className={`text-xs font-semibold ${scoreColor(section.score)}`}>
              {section.score}/{section.maxScore}
            </span>
          </div>
          <Progress value={section.score} className="h-1.5 mt-2 max-w-xs" />
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {expanded && (
        <div className="p-4 pt-0 space-y-3 border-t bg-muted/20">
          {section.issues?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Issues
              </div>
              <ul className="space-y-1">
                {section.issues.map((issue: string, i: number) => (
                  <li key={i} className="text-xs text-foreground flex gap-2">
                    <span className="text-red-400 mt-0.5">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {section.suggestions?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Suggestions
              </div>
              <ul className="space-y-1">
                {section.suggestions.map((s: string, i: number) => (
                  <li key={i} className="text-xs text-foreground flex gap-2">
                    <span className="text-emerald-500 mt-0.5">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {section.evidence?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-1.5 flex items-center gap-1">
                <Info className="h-3 w-3" /> Evidence
              </div>
              <ul className="space-y-1">
                {section.evidence.map((e: string, i: number) => (
                  <li key={i} className="text-xs text-muted-foreground italic">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: resumeData, isLoading: resumeLoading } = useQuery({
    queryKey: ['resume', id],
    queryFn: async () => {
      const { data } = await api.get(`/resumes/${id}`);
      return data.data;
    },
  });

  const { data: analysesData, isLoading: analysesLoading } = useQuery({
    queryKey: ['analyses', id],
    queryFn: async () => {
      const { data } = await api.get(`/resumes/analyses/all?limit=5`);
      return data.data?.filter((a: any) =>
      a.resumeId === id || a.resumeId?.id === id || a.resumeId?._id === id
    );
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/resumes/${id}/analyses`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      toast.success(data.meta?.demoMode
        ? 'Demo analysis started'
        : 'AI analysis started'
      );
      // Poll every 3s for up to 90s to catch completion or failure
      const poll = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['analyses', id] });
      }, 3000);
      setTimeout(() => clearInterval(poll), 90000);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  if (resumeLoading) {
    return <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-24" />)}</div>;
  }

  const latestAnalysis = analysesData?.[0];
  const completedAnalysis = analysesData?.find((a: any) => a.status === 'completed');
  const result = completedAnalysis?.result;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{resumeData?.label || resumeData?.originalName}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Uploaded {resumeData?.createdAt ? formatDate(resumeData.createdAt) : ''} ·
            {resumeData?.wordCount ?? 0} words
          </p>
        </div>
        <Button
          onClick={() => analyzeMutation.mutate()}
          disabled={analyzeMutation.isPending}
        >
          {analyzeMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <BarChart2 className="mr-2 h-4 w-4" />
          )}
          {completedAnalysis ? 'Re-analyze' : 'Analyze Resume'}
        </Button>
      </div>

      {latestAnalysis?.status === 'failed' && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/20 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-300">Analysis failed</p>
            <p className="text-xs text-red-700 dark:text-red-400 mt-1">
              {latestAnalysis.error || 'The AI analysis could not be completed. Check that an AI API key is configured on the server, then click Re-analyze.'}
            </p>
          </div>
        </div>
      )}
      {latestAnalysis?.status === 'processing' && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin shrink-0" />
          <p className="text-sm text-blue-700 dark:text-blue-300">AI analysis in progress…</p>
        </div>
      )}

      <Tabs defaultValue={result ? 'analysis' : 'text'}>
        <TabsList>
          <TabsTrigger value="text">Extracted Text</TabsTrigger>
          <TabsTrigger value="analysis" disabled={!result}>
            Analysis
            {result && <Badge variant="secondary" className="ml-2">{result.overallScore}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="text">
          <Card>
            <CardContent className="p-4">
              {resumeData?.extractedText ? (
                <pre className="text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground max-h-96 overflow-y-auto">
                  {resumeData.extractedText}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">No text extracted from this resume.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analysis">
          {analysesLoading ? (
            <Skeleton className="h-64" />
          ) : !result ? (
            <Card>
              <CardContent className="p-8 text-center">
                <BarChart2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">Click "Analyze Resume" above to get AI-powered feedback</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Demo mode notice */}
              {latestAnalysis?.provider === 'demo' && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 flex gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    <strong>Demo Mode:</strong> {result.disclaimer}
                  </p>
                </div>
              )}

              {/* Scores */}
              <Card>
                <CardHeader>
                  <CardTitle>Overall Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-8 justify-center sm:justify-start">
                    <ScoreRing score={result.overallScore} label="Overall" size="lg" />
                    <ScoreRing score={result.atsScore} label="ATS" />
                    <ScoreRing score={result.formattingScore} label="Formatting" />
                    <ScoreRing score={result.contentScore} label="Content" />
                    <ScoreRing score={result.impactScore} label="Impact" />
                  </div>
                  <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                    <p className="text-xs text-muted-foreground">{result.scoringMethodology}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-green-600">Strengths</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.strengths?.map((s: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-red-600">Weaknesses</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {result.weaknesses?.map((w: string, i: number) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                          {w}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Priority Improvements */}
              {result.improvements?.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Priority Improvements</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {result.improvements?.map((imp: any, i: number) => (
                        <div key={i} className="flex gap-3 p-3 rounded-lg bg-muted/40">
                          <Badge
                            variant={
                              imp.priority === 'high' ? 'destructive' :
                              imp.priority === 'medium' ? 'warning' : 'secondary'
                            }
                            className="shrink-0 h-5 text-xs"
                          >
                            {imp.priority}
                          </Badge>
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-muted-foreground mb-0.5">{imp.category}</div>
                            <div className="text-sm font-medium mb-1">{imp.issue}</div>
                            <div className="text-sm text-muted-foreground">{imp.suggestion}</div>
                            {imp.evidence && (
                              <div className="text-xs text-muted-foreground italic mt-1">{imp.evidence}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Section scores */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Section Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {result.sections?.map((section: any) => (
                      <SectionCard key={section.section} section={section} />
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Skills */}
              {result.skills && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Skills Inventory</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {Object.entries(result.skills).map(([cat, skills]) => (
                        <div key={cat}>
                          <div className="text-xs font-semibold text-muted-foreground mb-2 capitalize">{cat}</div>
                          <div className="flex flex-wrap gap-1.5">
                            {(skills as string[]).map((s: string) => (
                              <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                            {(skills as string[]).length === 0 && (
                              <span className="text-xs text-muted-foreground">None identified</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
