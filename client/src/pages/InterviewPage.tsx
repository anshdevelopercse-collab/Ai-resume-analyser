import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MessageSquare, Plus, ChevronDown, ChevronUp, Send, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api, getApiError } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

const QUESTION_TYPE_COLORS: Record<string, string> = {
  technical: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  behavioral: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  project: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  situational: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
};

export default function InterviewPage() {
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [expandedQ, setExpandedQ] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittingAnswer, setSubmittingAnswer] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const [genForm, setGenForm] = useState({ resumeId: '', jobDescriptionId: '', title: '' });

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['interviewSessions'],
    queryFn: async () => {
      const { data } = await api.get('/interviews');
      return data.data;
    },
  });

  const { data: resumesData } = useQuery({
    queryKey: ['resumes'],
    queryFn: async () => {
      const { data } = await api.get('/resumes?limit=20');
      return data;
    },
  });

  const { data: jobsData } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data } = await api.get('/jobs?limit=20');
      return data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/interviews/generate', genForm);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['interviewSessions'] });
      toast.success(data.meta?.demoMode ? 'Demo interview questions generated' : 'Interview questions generated');
      setShowGenerate(false);
      setSelectedSession(data.data);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const submitAnswerMutation = useMutation({
    mutationFn: async ({ sessionId, questionId, answer }: { sessionId: string; questionId: string; answer: string }) => {
      const { data } = await api.post(`/interviews/${sessionId}/answers`, { questionId, answer });
      return data.data;
    },
    onSuccess: (data, vars) => {
      toast.success('Answer submitted');
      setSubmittingAnswer(null);
      // Update session locally to show feedback
      queryClient.invalidateQueries({ queryKey: ['interviewSessions'] });
    },
    onError: (err) => {
      toast.error(getApiError(err));
      setSubmittingAnswer(null);
    },
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Interview Preparation</h1>
          <p className="text-muted-foreground mt-1">Practice with AI-generated role-specific questions</p>
        </div>
        <Button onClick={() => setShowGenerate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Generate Questions
        </Button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Disclaimer:</strong> These questions are AI-generated for practice purposes only. They do not reflect
          actual interview content from any specific employer. Practice answers are for your own development.
        </p>
      </div>

      {/* Generate dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Interview Questions</DialogTitle>
            <DialogDescription>Select your resume and a job description to get role-specific questions</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Resume (optional)</Label>
              <select
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={genForm.resumeId}
                onChange={(e) => setGenForm(f => ({ ...f, resumeId: e.target.value }))}
              >
                <option value="">No resume selected</option>
                {resumesData?.data?.map((r: any) => (
                  <option key={r._id} value={r._id}>{r.label || r.originalName}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Job Description (optional)</Label>
              <select
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={genForm.jobDescriptionId}
                onChange={(e) => setGenForm(f => ({ ...f, jobDescriptionId: e.target.value }))}
              >
                <option value="">No job selected</option>
                {jobsData?.data?.map((j: any) => (
                  <option key={j._id} value={j._id}>{j.title} {j.company && `— ${j.company}`}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Session Title (optional)</Label>
              <input
                type="text"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="e.g. Frontend Engineer Interview"
                value={genForm.title}
                onChange={(e) => setGenForm(f => ({ ...f, title: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button onClick={() => generateMutation.mutate()} loading={generateMutation.isPending}>
                Generate Questions
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Active session */}
      {selectedSession && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{selectedSession.title}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)}>Close</Button>
            </div>
            {selectedSession.provider === 'demo' && (
              <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg mt-2">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Demo Mode: Questions are sample data. Configure an AI provider for role-specific questions.
                </p>
              </div>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedSession.questions?.map((q: any) => (
                <div key={q.id} className="border rounded-xl overflow-hidden">
                  <button
                    className="w-full flex items-start gap-3 p-4 hover:bg-muted/50 text-left"
                    onClick={() => setExpandedQ(expandedQ === q.id ? null : q.id)}
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${QUESTION_TYPE_COLORS[q.type] || ''}`}>
                      {q.type}
                    </span>
                    <span className="flex-1 text-sm font-medium">{q.question}</span>
                    {expandedQ === q.id ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  </button>

                  {expandedQ === q.id && (
                    <div className="p-4 pt-0 border-t space-y-4">
                      <div>
                        <div className="text-xs font-semibold text-muted-foreground mb-1">Guidance</div>
                        <p className="text-sm">{q.guidance}</p>
                      </div>
                      {q.followUps?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">Follow-up Questions</div>
                          <ul className="space-y-1">
                            {q.followUps.map((fu: string, i: number) => (
                              <li key={i} className="text-xs text-muted-foreground flex gap-2">
                                <span>•</span>{fu}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {q.sampleAnswer && (
                        <details className="group">
                          <summary className="text-xs font-semibold text-indigo-600 cursor-pointer list-none flex items-center gap-1">
                            <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />
                            Sample Answer (Example Only)
                          </summary>
                          <p className="text-sm text-muted-foreground mt-2 p-3 bg-muted/40 rounded-lg italic">
                            {q.sampleAnswer}
                          </p>
                        </details>
                      )}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-muted-foreground">Your Practice Answer</div>
                        <Textarea
                          placeholder="Type your answer here to practice..."
                          value={answers[q.id] || ''}
                          onChange={(e) => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
                          className="min-h-[100px]"
                        />
                        <Button
                          size="sm"
                          disabled={!answers[q.id]?.trim() || submittingAnswer === q.id}
                          onClick={async () => {
                            setSubmittingAnswer(q.id);
                            await submitAnswerMutation.mutateAsync({
                              sessionId: selectedSession._id,
                              questionId: q.id,
                              answer: answers[q.id],
                            });
                          }}
                        >
                          {submittingAnswer === q.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="mr-2 h-4 w-4" />
                          )}
                          Get AI Feedback
                        </Button>
                        {q.aiFeedback && (
                          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg">
                            <div className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-1">AI Feedback</div>
                            <p className="text-sm">{q.aiFeedback}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Previous sessions */}
      <div>
        <h2 className="text-base font-semibold mb-3">Previous Sessions</h2>
        {isLoading ? (
          <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-16" />)}</div>
        ) : sessionsData?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-xl">
            <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No interview sessions yet. Generate your first set of questions above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessionsData?.map((session: any) => (
              <div
                key={session._id}
                className="flex items-center gap-4 p-4 border rounded-xl hover:bg-accent cursor-pointer transition-colors"
                onClick={() => setSelectedSession(session)}
              >
                <MessageSquare className="h-5 w-5 text-indigo-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">{session.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {session.questions?.length ?? 0} questions · {formatRelativeTime(session.createdAt)}
                  </div>
                </div>
                <Badge variant="secondary">{session.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
