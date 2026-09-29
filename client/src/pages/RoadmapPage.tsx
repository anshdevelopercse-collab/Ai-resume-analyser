import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Map, Plus, CheckCircle, Circle, ChevronDown, ChevronUp, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { api, getApiError } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-300',
};

export default function RoadmapPage() {
  const [showGenerate, setShowGenerate] = useState(false);
  const [expandedRoadmap, setExpandedRoadmap] = useState<string | null>(null);
  const [genForm, setGenForm] = useState({ resumeId: '', jobDescriptionId: '', targetRole: '' });
  const queryClient = useQueryClient();

  const { data: roadmapsData, isLoading } = useQuery({
    queryKey: ['roadmaps'],
    queryFn: async () => {
      const { data } = await api.get('/roadmaps');
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
      const { data } = await api.post('/roadmaps/generate', genForm);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] });
      toast.success(data.meta?.demoMode ? 'Demo roadmap generated' : 'Skill roadmap generated');
      setShowGenerate(false);
      if (data.data?._id) setExpandedRoadmap(data.data._id);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: async ({ roadmapId, milestoneId, completed }: { roadmapId: string; milestoneId: string; completed: boolean }) => {
      const { data } = await api.patch(`/roadmaps/${roadmapId}/milestones/${milestoneId}`, { completed });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roadmaps'] });
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skill Roadmap</h1>
          <p className="text-muted-foreground mt-1">AI-generated learning paths to close skill gaps</p>
        </div>
        <Button onClick={() => setShowGenerate(true)}>
          <Plus className="mr-2 h-4 w-4" /> Generate Roadmap
        </Button>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <strong>Note:</strong> Roadmaps are AI-generated suggestions based on your resume and target role.
          Timelines are estimates; actual learning time varies by individual.
        </p>
      </div>

      {/* Generate dialog */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Skill Roadmap</DialogTitle>
            <DialogDescription>Get a personalized learning path to reach your target role</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Target Role *</Label>
              <input
                type="text"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                placeholder="e.g. Senior Frontend Engineer"
                value={genForm.targetRole}
                onChange={(e) => setGenForm(f => ({ ...f, targetRole: e.target.value }))}
              />
            </div>
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
                  <option key={j._id} value={j._id}>{j.title}{j.company && ` — ${j.company}`}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
              <Button
                disabled={!genForm.targetRole.trim() || generateMutation.isPending}
                onClick={() => generateMutation.mutate()}
                loading={generateMutation.isPending}
              >
                Generate Roadmap
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Roadmaps list */}
      {isLoading ? (
        <div className="space-y-3">{[1, 2].map(i => <Skeleton key={i} className="h-24" />)}</div>
      ) : roadmapsData?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl">
          <Map className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No roadmaps yet</p>
          <p className="text-sm mb-4">Generate a personalized skill roadmap above</p>
          <Button onClick={() => setShowGenerate(true)}>
            <Plus className="mr-2 h-4 w-4" /> Generate Your First Roadmap
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {roadmapsData?.map((roadmap: any) => {
            const milestones = roadmap.milestones || [];
            const completed = milestones.filter((m: any) => m.completed).length;
            const pct = milestones.length > 0 ? Math.round((completed / milestones.length) * 100) : 0;
            const isExpanded = expandedRoadmap === roadmap._id;

            return (
              <Card key={roadmap._id}>
                <CardHeader className="pb-3">
                  <button
                    className="w-full flex items-center gap-3 text-left"
                    onClick={() => setExpandedRoadmap(isExpanded ? null : roadmap._id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">{roadmap.targetRole}</CardTitle>
                        {roadmap.provider === 'demo' && (
                          <Badge variant="warning" className="text-xs">Demo</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={pct} className="h-1.5 flex-1 max-w-40" />
                        <span className="text-xs text-muted-foreground">
                          {completed}/{milestones.length} milestones · {pct}%
                        </span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  </button>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0">
                    {roadmap.provider === 'demo' && (
                      <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg mb-4">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                          Demo Mode: This is sample data. Configure an AI provider for a personalized roadmap.
                        </p>
                      </div>
                    )}

                    {roadmap.summary && (
                      <p className="text-sm text-muted-foreground mb-4">{roadmap.summary}</p>
                    )}

                    {roadmap.skillGaps?.length > 0 && (
                      <div className="mb-4">
                        <div className="text-xs font-semibold text-muted-foreground mb-2">Identified Skill Gaps</div>
                        <div className="flex flex-wrap gap-1.5">
                          {roadmap.skillGaps.map((skill: string) => (
                            <Badge key={skill} variant="destructive" className="text-xs">{skill}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">Learning Milestones</div>
                      {milestones.map((milestone: any, idx: number) => (
                        <div
                          key={milestone.id || idx}
                          className={`flex gap-3 p-3 rounded-lg border transition-colors ${
                            milestone.completed ? 'bg-muted/30 opacity-70' : 'bg-background'
                          }`}
                        >
                          <button
                            className="shrink-0 mt-0.5"
                            onClick={() => toggleMilestoneMutation.mutate({
                              roadmapId: roadmap._id,
                              milestoneId: milestone.id || String(idx),
                              completed: !milestone.completed,
                            })}
                          >
                            {milestone.completed
                              ? <CheckCircle className="h-5 w-5 text-green-500" />
                              : <Circle className="h-5 w-5 text-muted-foreground" />
                            }
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2 flex-wrap">
                              <span className={`font-medium text-sm ${milestone.completed ? 'line-through text-muted-foreground' : ''}`}>
                                {milestone.title}
                              </span>
                              {milestone.priority && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[milestone.priority] || ''}`}>
                                  {milestone.priority}
                                </span>
                              )}
                              {milestone.estimatedWeeks && (
                                <span className="text-xs text-muted-foreground">~{milestone.estimatedWeeks}w</span>
                              )}
                            </div>
                            {milestone.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{milestone.description}</p>
                            )}
                            {milestone.resources?.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {milestone.resources.map((r: string, i: number) => (
                                  <span key={i} className="text-xs bg-muted px-2 py-0.5 rounded">{r}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground text-right">
                      Generated {formatRelativeTime(roadmap.createdAt)}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
