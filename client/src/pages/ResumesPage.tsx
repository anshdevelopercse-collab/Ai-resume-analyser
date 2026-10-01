import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Upload, FileText, Trash2, Download, BarChart2,
  MoreHorizontal, File, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { api, getApiError } from '@/lib/api';
import { formatDate, formatFileSize } from '@/lib/utils';
import { FILE_LIMITS } from '@resumeiq/shared';

export default function ResumesPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: async () => {
      const { data } = await api.get('/resumes');
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post('/resumes', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      toast.success('Resume uploaded and parsed successfully');
      setUploading(false);
      setUploadProgress(0);
    },
    onError: (err) => {
      toast.error(getApiError(err));
      setUploading(false);
      setUploadProgress(0);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/resumes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      toast.success('Resume deleted');
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const analyzeMutation = useMutation({
    mutationFn: async (resumeId: string) => {
      const { data } = await api.post(`/resumes/${resumeId}/analyses`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
      toast.success(data.meta?.demoMode
        ? 'Demo analysis started (configure AI provider for real results)'
        : 'AI analysis started'
      );
    },
    onError: (err) => toast.error(getApiError(err)),
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    if (file.size > FILE_LIMITS.MAX_SIZE_BYTES) {
      toast.error(`File too large. Maximum is ${FILE_LIMITS.MAX_SIZE_MB}MB`);
      return;
    }
    setUploading(true);
    uploadMutation.mutate(file);
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: FILE_LIMITS.MAX_SIZE_BYTES,
    maxFiles: 1,
    disabled: uploading,
  });

  const handleDownload = async (resumeId: string, filename: string) => {
    try {
      const response = await api.get(`/resumes/${resumeId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resumes</h1>
        <p className="text-muted-foreground mt-1">Upload and manage your resume files</p>
      </div>

      {/* Upload dropzone */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className="space-y-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-pulse">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Uploading and parsing...</p>
              <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
            </div>
            <Progress value={uploadProgress} className="max-w-xs mx-auto" />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-sm">
                {isDragActive ? 'Drop your resume here' : 'Drag & drop your resume, or click to browse'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports PDF and DOCX · Max {FILE_LIMITS.MAX_SIZE_MB}MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Resumes list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <File className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-1">No resumes yet</p>
          <p className="text-sm">Upload your first resume above to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.data?.map((resume: any) => (
            <Card key={resume.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm truncate">
                      {resume.label || resume.originalName}
                    </span>
                    <Badge variant="secondary" className="shrink-0">
                      {resume.mimeType === 'application/pdf' ? 'PDF' : 'DOCX'}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatFileSize(resume.sizeBytes)} · {resume.wordCount ?? 0} words
                    {resume.pageCount ? ` · ${resume.pageCount} pages` : ''}
                    · Uploaded {formatDate(resume.createdAt)}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => analyzeMutation.mutate(resume.id)}
                    disabled={analyzeMutation.isPending}
                  >
                    <BarChart2 className="mr-1.5 h-4 w-4" />
                    Analyze
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                  >
                    <Link to={`/resumes/${resume.id}`}>View</Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleDownload(resume.id, resume.originalName)}>
                        <Download className="mr-2 h-4 w-4" /> Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm('Delete this resume?')) {
                            deleteMutation.mutate(resume.id);
                          }
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
