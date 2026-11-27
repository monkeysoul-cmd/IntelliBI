import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { AuthScreen } from './components/auth/AuthScreen';
import { OverviewPage } from './pages/OverviewPage';
import { AnalystPage } from './pages/AnalystPage';
import { DashboardsPage } from './pages/DashboardsPage';
import { DataSourcesPage } from './pages/DataSourcesPage';
import { HistoryPage } from './pages/HistoryPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

function WorkspaceRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-[#141415] text-[#525252] dark:text-[#a1a1a6] text-sm">
        Loading workspace
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/analyst" element={<AnalystPage />} />
        <Route path="/dashboards" element={<DashboardsPage />} />
        <Route path="/data-sources" element={<DataSourcesPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <WorkspaceRouter />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
