import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import { api } from '@/lib/api';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import DashboardPage from '@/pages/DashboardPage';
import ResumesPage from '@/pages/ResumesPage';
import ResumeDetailPage from '@/pages/ResumeDetailPage';
import JobsPage from '@/pages/JobsPage';
import ApplicationsPage from '@/pages/ApplicationsPage';
import InterviewPage from '@/pages/InterviewPage';
import RoadmapPage from '@/pages/RoadmapPage';
import SettingsPage from '@/pages/SettingsPage';
import AdminPage from '@/pages/AdminPage';

export default function App() {
  const { isAuthenticated, login } = useAuthStore();
  const autoLoginAttempted = useRef(false);

  useEffect(() => {
    if (isAuthenticated || autoLoginAttempted.current) return;
    autoLoginAttempted.current = true;

    // Check if server has DISABLE_AUTH=true, then auto-login without credentials
    api.get('/../../ready')
      .then(({ data }) => {
        if (data.disableAuth) {
          return api.get('/auth/auto-login');
        }
      })
      .then((res) => {
        if (res?.data?.success) {
          login(res.data.data.user, res.data.data.accessToken);
        }
      })
      .catch(() => {/* server not ready or auth not disabled — normal login flow */});
  }, [isAuthenticated, login]);

  return (
    <Routes>
      {/* Public routes — redirect to dashboard if already authenticated */}
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/verify-email/:token" element={<VerifyEmailPage />} />

      {/* Protected app routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/resumes" element={<ResumesPage />} />
          <Route path="/resumes/:id" element={<ResumeDetailPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/interview" element={<InterviewPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin>
              <AdminPage />
            </ProtectedRoute>
          } />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
