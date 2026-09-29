import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link.');
      return;
    }
    api.get(`/auth/verify-email/${token}`)
      .then(() => {
        setStatus('success');
        setMessage('Your email has been verified successfully.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.error || 'Verification failed. The link may have expired.');
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {status === 'loading' && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Verifying your email…</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Email verified!</h1>
              <p className="text-muted-foreground text-sm">{message}</p>
            </div>
            <Link to="/login">
              <Button className="w-full">Continue to login</Button>
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-950/30 flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold">Verification failed</h1>
              <p className="text-muted-foreground text-sm">{message}</p>
            </div>
            <div className="flex flex-col gap-3">
              <Link to="/login"><Button className="w-full">Go to login</Button></Link>
              <Link to="/forgot-password">
                <Button variant="outline" className="w-full">Request new link</Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
