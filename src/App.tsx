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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#090D16] text-slate-600 dark:text-slate-300 text-sm">
        Initializing IntelliBI analytics workspace...
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
