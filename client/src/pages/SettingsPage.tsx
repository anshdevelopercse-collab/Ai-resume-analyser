import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { User, Lock, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMe, useLogout } from '@/hooks/useAuth';
import { updateProfileSchema, changePasswordSchema, type UpdateProfileInput, type ChangePasswordInput } from '@resumeiq/shared';
import { api, getApiError } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

export default function SettingsPage() {
  const { data: me } = useMe();
  const { mutate: logout } = useLogout();
  const updateUser = useAuthStore(s => s.updateUser);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      firstName: me?.firstName || '',
      lastName: me?.lastName || '',
    },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
  });

  const onUpdateProfile = async (data: UpdateProfileInput) => {
    try {
      const res = await api.patch('/auth/me', data);
      updateUser(res.data.data);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const onChangePassword = async (data: ChangePasswordInput) => {
    try {
      await api.post('/auth/change-password', data);
      toast.success('Password changed. Please log in again.');
      passwordForm.reset();
      logout();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('This will permanently delete your account and all data. This cannot be undone. Continue?')) return;
    const confirmation = prompt('Type DELETE to confirm:');
    if (confirmation !== 'DELETE') return;
    setDeletingAccount(true);
    try {
      await api.delete('/auth/me');
      logout();
    } catch (err) {
      toast.error(getApiError(err));
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </CardTitle>
          <CardDescription>Update your name and display information</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={profileForm.handleSubmit(onUpdateProfile)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input placeholder="First name" {...profileForm.register('firstName')} />
                {profileForm.formState.errors.firstName && (
                  <p className="text-xs text-destructive">{profileForm.formState.errors.firstName.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input placeholder="Last name" {...profileForm.register('lastName')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={me?.email || ''} disabled className="opacity-60" />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            <Button type="submit" loading={profileForm.formState.isSubmitting}>
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" /> Password
          </CardTitle>
          <CardDescription>Change your password</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrent ? 'text' : 'password'}
                  placeholder="Current password"
                  className="pr-10"
                  autoComplete="current-password"
                  {...passwordForm.register('currentPassword')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowCurrent(!showCurrent)}
                >
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Min 8 characters"
                  className="pr-10"
                  autoComplete="new-password"
                  {...passwordForm.register('newPassword')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <Button type="submit" loading={passwordForm.formState.isSubmitting}>
              Update password
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Danger Zone
          </CardTitle>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
            <div>
              <div className="font-medium text-sm">Delete Account</div>
              <div className="text-xs text-muted-foreground">
                Permanently deletes your account, all resumes, analyses, and data.
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={deletingAccount}
              onClick={handleDeleteAccount}
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
