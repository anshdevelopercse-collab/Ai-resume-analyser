import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Plus, LayoutGrid, List, Search, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api, getApiError } from '@/lib/api';
import { applicationSchema, type ApplicationInput, APPLICATION_STATUS } from '@resumeiq/shared';
import { formatDate, capitalize } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  wishlist: 'bg-gray-100 text-gray-700',
  applied: 'bg-blue-100 text-blue-700',
  phone_screen: 'bg-purple-100 text-purple-700',
  interview: 'bg-indigo-100 text-indigo-700',
  technical: 'bg-violet-100 text-violet-700',
  offer: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  withdrawn: 'bg-gray-100 text-gray-600',
  accepted: 'bg-emerald-100 text-emerald-700',
};

function ApplicationCard({ app, onDelete, onEdit }: {
  app: any;
  onDelete: (id: string) => void;
  onEdit: (app: any) => void;
}) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div>
            <div className="font-semibold text-sm">{app.role}</div>
            <div className="text-muted-foreground text-xs">{app.company}</div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-700'}`}>
            {app.status.replace('_', ' ')}
          </span>
        </div>
        {app.location && <div className="text-xs text-muted-foreground mb-2">{app.location}</div>}
        {app.appliedAt && (
          <div className="text-xs text-muted-foreground">Applied {formatDate(app.appliedAt)}</div>
        )}
        {app.nextAction && (
          <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">
            Next: {app.nextAction}
            {app.nextActionDate && ` · ${formatDate(app.nextActionDate)}`}
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => onEdit(app)}>
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-destructive hover:text-destructive"
            onClick={() => confirm('Delete this application?') && onDelete(app.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ApplicationsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['applications', search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      const { data } = await api.get(`/applications?${params}`);
      return data;
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ['applicationStats'],
    queryFn: async () => {
      const { data } = await api.get('/applications/stats');
      return data.data;
    },
  });

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<ApplicationInput>({
    resolver: zodResolver(applicationSchema),
    defaultValues: { status: 'wishlist', interviewDates: [] },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ApplicationInput) => {
      if (editingApp) {
        const res = await api.put(`/applications/${editingApp.id}`, data);
        return res.data.data;
      }
      const res = await api.post('/applications', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationStats'] });
      toast.success(editingApp ? 'Application updated' : 'Application added');
      setShowForm(false);
      setEditingApp(null);
      reset();
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/applications/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      queryClient.invalidateQueries({ queryKey: ['applicationStats'] });
      toast.success('Application deleted');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const handleEdit = (app: any) => {
    setEditingApp(app);
    Object.entries(app).forEach(([k, v]) => {
      if (k !== 'id' && k !== 'userId') setValue(k as any, v);
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-muted-foreground mt-1">Track your job applications</p>
        </div>
        <Button onClick={() => { setEditingApp(null); reset(); setShowForm(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Application
        </Button>
      </div>

      {/* Stats */}
      {statsData && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
          {['applied', 'phone_screen', 'interview', 'offer', 'rejected'].map((status) => (
            <div key={status} className="text-center p-3 border rounded-xl">
              <div className="text-xl font-bold">{statsData[status] ?? 0}</div>
              <div className="text-xs text-muted-foreground capitalize">{status.replace('_', ' ')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search company or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-input rounded-lg px-3 py-2 text-sm bg-background"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          {APPLICATION_STATUS.map(s => (
            <option key={s} value={s}>{capitalize(s.replace('_', ' '))}</option>
          ))}
        </select>
      </div>

      {/* Applications grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground border rounded-xl">
          <List className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">No applications yet</p>
          <p className="text-sm mb-4">Start tracking your job search journey</p>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add First Application
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.data?.map((app: any) => (
            <ApplicationCard
              key={app.id}
              app={app}
              onDelete={(id) => deleteMutation.mutate(id)}
              onEdit={handleEdit}
            />
          ))}
        </div>
      )}

      {/* Form dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) { setEditingApp(null); reset(); }}}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingApp ? 'Edit Application' : 'Add Application'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Company *</Label>
                <Input placeholder="Company name" {...register('company')} />
                {errors.company && <p className="text-xs text-destructive">{errors.company.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Input placeholder="Job title" {...register('role')} />
                {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Location</Label>
                <Input placeholder="City, Remote..." {...register('location')} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <select className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background" {...register('status')}>
                  {APPLICATION_STATUS.map(s => (
                    <option key={s} value={s}>{capitalize(s.replace('_', ' '))}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Applied Date</Label>
                <Input type="date" {...register('appliedAt')} />
              </div>
              <div className="space-y-1.5">
                <Label>Deadline</Label>
                <Input type="date" {...register('deadline')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <textarea
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background min-h-[80px] resize-none"
                placeholder="Additional notes..."
                {...register('notes')}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" type="button" onClick={() => { setShowForm(false); setEditingApp(null); reset(); }}>
                Cancel
              </Button>
              <Button type="submit" loading={createMutation.isPending}>
                {editingApp ? 'Update' : 'Add Application'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
