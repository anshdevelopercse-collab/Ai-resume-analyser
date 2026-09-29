import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, Briefcase, BarChart2, Trash2, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { api, getApiError } from '@/lib/api';
import { jobDescriptionSchema, type JobDescriptionInput } from '@resumeiq/shared';
import { formatDate } from '@/lib/utils';

export default function JobsPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<string>('');
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: async () => {
      const { data } = await api.get('/jobs');
      return data;
    },
  });

  const { data: resumesData } = useQuery({
    queryKey: ['resumes'],
    queryFn: async () => {
      const { data } = await api.get('/resumes?limit=20');
      return data;
    },
  });

  const { data: matchesData, isLoading: matchesLoading } = useQuery({
    queryKey: ['jobMatches'],
    queryFn: async () => {
      const { data } = await api.get('/jobs/matches?limit=10');
      return data;
    },
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<JobDescriptionInput>({
    resolver: zodResolver(jobDescriptionSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: JobDescriptionInput) => {
      const res = await api.post('/jobs', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job description saved');
      setShowAdd(false);
      reset();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/jobs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job description deleted');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const matchMutation = useMutation({
    mutationFn: async ({ jobId, resumeId }: { jobId: string; resumeId: string }) => {
      const { data } = await api.post(`/jobs/${jobId}/match`, { resumeId });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobMatches'] });
      toast.success(data.meta?.demoMode ? 'Demo match analysis started' : 'Job match analysis started');
      setSelectedJob(null);
      // Poll for completion
      const poll = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ['jobMatches'] });
      }, 3000);
      setTimeout(() => clearInterval(poll), 30000);
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Job Descriptions</h1>
          <p className="text-muted-foreground mt-1">Save job descriptions and match them against your resumes</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Job
        </Button>
      </div>

      {/* Add job dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Job Description</DialogTitle>
            <DialogDescription>Save a job description to match against your resumes</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Job Title *</Label>
                <Input placeholder="e.g. Senior Software Engineer" {...register('title')} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Input placeholder="e.g. Acme Corp" {...register('company')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Job Description *</Label>
              <Textarea
                placeholder="Paste the full job description here..."
                className="min-h-[200px]"
                {...register('description')}
              />
              {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="San Francisco, CA" {...register('location')} />
              </div>
              <div className="space-y-1.5">
                <Label>Job URL</Label>
                <Input placeholder="https://..." {...register('url')} />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button type="submit" loading={createMutation.isPending}>Save Job</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Match dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Match Resume to Job</DialogTitle>
            <DialogDescription>
              Select a resume to compare against this job description
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Select Resume</Label>
              <select
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background"
                value={selectedResume}
                onChange={(e) => setSelectedResume(e.target.value)}
              >
                <option value="">-- Choose a resume --</option>
                {resumesData?.data?.map((r: any) => (
                  <option key={r._id} value={r._id}>
                    {r.label || r.originalName}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setSelectedJob(null)}>Cancel</Button>
              <Button
                disabled={!selectedResume || matchMutation.isPending}
                loading={matchMutation.isPending}
                onClick={() => selectedJob && matchMutation.mutate({
                  jobId: selectedJob,
                  resumeId: selectedResume
                })}
              >
                Start Match Analysis
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Jobs list */}
      <div>
        <h2 className="text-base font-semibold mb-3">Saved Jobs</h2>
        {jobsLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20" />)}</div>
        ) : jobsData?.data?.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground border rounded-xl">
            <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No job descriptions yet. Add your first one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobsData?.data?.map((job: any) => (
              <Card key={job._id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-violet-50 dark:bg-violet-950 flex items-center justify-center shrink-0">
                    <Briefcase className="h-5 w-5 text-violet-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{job.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {job.company && `${job.company} · `}
                      {job.location && `${job.location} · `}
                      {formatDate(job.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedJob(job._id)}
                    >
                      <BarChart2 className="mr-1.5 h-4 w-4" /> Match Resume
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => confirm('Delete this job description?') && deleteMutation.mutate(job._id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Match results */}
      <div>
        <h2 className="text-base font-semibold mb-3">Match Results</h2>
        {matchesLoading ? (
          <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-20" />)}</div>
        ) : matchesData?.data?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border rounded-xl">
            <p className="text-sm">No match analyses yet. Match a resume to a job above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {matchesData?.data?.map((match: any) => (
              <Card key={match._id}>
                <CardContent className="p-4">
                  <button
                    className="w-full flex items-center gap-4 text-left"
                    onClick={() => setExpandedMatch(expandedMatch === match._id ? null : match._id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {match.resumeId?.label || match.resumeId?.originalName || 'Resume'}
                        </span>
                        <span className="text-muted-foreground text-xs">→</span>
                        <span className="font-medium text-sm">
                          {match.jobDescriptionId?.title || 'Job'}
                        </span>
                      </div>
                      {match.status === 'completed' && match.result && (
                        <div className="flex items-center gap-3">
                          <Progress value={match.result.matchScore} className="h-1.5 flex-1 max-w-32" />
                          <span className="text-sm font-semibold">{match.result.matchScore}% match</span>
                        </div>
                      )}
                      {match.status === 'processing' && <Badge variant="info">Processing...</Badge>}
                      {match.status === 'failed' && <Badge variant="destructive">Failed</Badge>}
                    </div>
                    {expandedMatch === match._id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {expandedMatch === match._id && match.result && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      {match.provider === 'demo' && (
                        <div className="flex gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-700 dark:text-amber-300">{match.result.disclaimer}</p>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-semibold text-green-600 mb-2">Matching Skills</div>
                          <div className="flex flex-wrap gap-1.5">
                            {match.result.matchingSkills?.map((s: string) => (
                              <Badge key={s} variant="success" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-red-600 mb-2">Missing Skills</div>
                          <div className="flex flex-wrap gap-1.5">
                            {match.result.missingSkills?.map((s: string) => (
                              <Badge key={s} variant="destructive" className="text-xs">{s}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      {match.result.qualificationGaps?.length > 0 && (
                        <div>
                          <div className="text-xs font-semibold mb-2">Qualification Gaps</div>
                          <ul className="space-y-1">
                            {match.result.qualificationGaps.map((g: string, i: number) => (
                              <li key={i} className="text-xs flex gap-2">
                                <span className="text-red-400">•</span>{g}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p className="text-sm text-muted-foreground">{match.result.summary}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
