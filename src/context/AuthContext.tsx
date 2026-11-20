import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, getAuthToken, setAuthToken } from '../services/api';
import type { UserProfile, WorkspaceSettings } from '../types/api';

interface AuthContextValue {
  user: UserProfile | null;
  settings: WorkspaceSettings;
  loading: boolean;
  isSignedOut: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => void;
  updateSettings: (settings: WorkspaceSettings) => Promise<void>;
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  maxRows: 250,
  queryTimeoutMs: 5000,
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [isSignedOut, setIsSignedOut] = useState(false);

  const bootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const existingToken = getAuthToken();
      if (existingToken) {
        const res = await authApi.me();
        setUser(res.user);
        setSettings(res.settings);
        setIsSignedOut(false);
        return;
      }

      // Auto-initialize demo analyst workspace on first visit unless user explicitly signed out
      const explicitSignOut = window.sessionStorage.getItem('intellibi_signed_out') === '1';
      if (!explicitSignOut) {
        const demo = await authApi.demoSession();
        setAuthToken(demo.token);
        setUser(demo.user);
        setSettings(demo.settings);
        setIsSignedOut(false);
      } else {
        setUser(null);
        setIsSignedOut(true);
      }
    } catch {
      setAuthToken(null);
      try {
        const demo = await authApi.demoSession();
        setAuthToken(demo.token);
        setUser(demo.user);
        setSettings(demo.settings);
        setIsSignedOut(false);
      } catch {
        setUser(null);
        setIsSignedOut(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    window.sessionStorage.removeItem('intellibi_signed_out');
    setAuthToken(res.token);
    setUser(res.user);
    setSettings(res.settings);
    setIsSignedOut(false);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await authApi.register(name, email, password);
    window.sessionStorage.removeItem('intellibi_signed_out');
    setAuthToken(res.token);
    setUser(res.user);
    setSettings(res.settings);
    setIsSignedOut(false);
  };

  const loginDemo = async () => {
    const res = await authApi.demoSession();
    window.sessionStorage.removeItem('intellibi_signed_out');
    setAuthToken(res.token);
    setUser(res.user);
    setSettings(res.settings);
    setIsSignedOut(false);
  };

  const logout = () => {
    window.sessionStorage.setItem('intellibi_signed_out', '1');
    setAuthToken(null);
    setUser(null);
    setIsSignedOut(true);
  };

  const updateSettings = async (next: WorkspaceSettings) => {
    const res = await authApi.updateSettings(next);
    setSettings(res.settings);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        loading,
        isSignedOut,
        login,
        register,
        loginDemo,
        logout,
        updateSettings,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
