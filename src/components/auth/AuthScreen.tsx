import React, { useState } from 'react';
import { ArrowRight, Lock, Mail, Terminal, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button, Surface } from '../ui/Primitives';
import { BrandMark } from '../layout/AppShell';

export function AuthScreen() {
  const { login, register, loginDemo } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(axiosMsg || 'Authentication failed. Check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginDemo();
    } catch {
      setError('Unable to start demo analyst session.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
            <div className="min-h-screen flex items-center justify-center bg-[#fafafa] dark:bg-[#141415] p-6">
              <div className="w-full max-w-sm space-y-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex justify-center">
                    <BrandMark />
                  </div>
                    <h1 className="text-2xl font-medium text-[#171717] dark:text-[#ededed]">IntelliBI</h1>
                    <p className="text-sm text-[#525252] dark:text-[#a1a1a6]">
                      PostgreSQL analytics workstation
                    </p>
                </div>

                  <Surface className="p-6 space-y-5">
                    {/* Segmented Mode Selector */}
                    <div
                      className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-[#f4f4f5] dark:bg-[#232325] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08]"
                      role="tablist"
                      aria-label="Authentication mode"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={mode === 'login'}
                        onClick={() => {
                          setMode('login');
                          setError(null);
                        }}
                        className={`h-8 text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer ${
                          mode === 'login'
                            ? 'bg-white dark:bg-[#19191b] text-[#171717] dark:text-[#ededed] shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none'
                            : 'text-[#737373] dark:text-[#85858b] hover:text-[#171717] dark:hover:text-[#ededed]'
                        }`}
                      >
                        Sign in
                      </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
                        className = {`h-8 text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer ${mode === 'register'
                              ? 'bg-white dark:bg-[#19191b] text-[#171717] dark:text-[#ededed] shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-none'
                              : 'text-[#737373] dark:text-[#85858b] hover:text-[#171717] dark:hover:text-[#ededed]'
                          }`}
            >
                      Create account
                    </button>
                  </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                      {mode === 'register' && (
                            <div className="space-y-1.5">
                              <label
                                htmlFor="auth-name"
                                className="block text-xs font-medium text-[#525252] dark:text-[#a1a1a6]"
                              >
                                Full name
                              </label>
                              <div className="relative">
                                <User
                                  className="w-4 h-4 text-[#737373] dark:text-[#85858b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                  strokeWidth={1.5}
                                />
                                <input
                                  id="auth-name"
                                  type="text"
                                  required
                                  minLength={2}
                                  value={name}
                                  onChange={(e) => setName(e.target.value)}
                                  placeholder="Jordan Patel"
                                  className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.1] dark:border-[#ededed]/[0.1] text-[#171717] dark:text-[#ededed] placeholder:text-[#737373] dark:placeholder:text-[#85858b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 dark:focus:ring-[#3b82f6]/40 transition-colors duration-150"
                                />
                              </div>
                            </div>
            )}

                                <div className="space-y-1.5">
                                  <label
                                    htmlFor="auth-email"
                                    className="block text-xs font-medium text-[#525252] dark:text-[#a1a1a6]"
                                  >
                                    Work email
                                  </label>
                                  <div className="relative">
                                    <Mail
                                      className="w-4 h-4 text-[#737373] dark:text-[#85858b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                      strokeWidth={1.5}
                                    />
                                    <input
                                      id="auth-email"
                                      type="email"
                                      required
                                      value={email}
                                      onChange={(e) => setEmail(e.target.value)}
                                      placeholder="demo@intellibi.ai"
                                      className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.1] dark:border-[#ededed]/[0.1] text-[#171717] dark:text-[#ededed] placeholder:text-[#737373] dark:placeholder:text-[#85858b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 dark:focus:ring-[#3b82f6]/40 transition-colors duration-150 font-mono"
                                    />
                                  </div>
                                </div>

                                    <div className="space-y-1.5">
                                      <label
                                        htmlFor="auth-password"
                                        className="block text-xs font-medium text-[#525252] dark:text-[#a1a1a6]"
                                      >
                                        Password
                                      </label>
                                      <div className="relative">
                                        <Lock
                                          className="w-4 h-4 text-[#737373] dark:text-[#85858b] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                                          strokeWidth={1.5}
                                        />
                                        <input
                                          id="auth-password"
                                          type="password"
                                          required
                                          minLength={mode === 'register' ? 8 : 1}
                                          value={password}
                                          onChange={(e) => setPassword(e.target.value)}
                                          placeholder={mode === 'register' ? 'Minimum 8 characters' : 'Password'}
                                          className="w-full h-9 pl-9 pr-3 text-sm rounded-lg bg-[#fafafa] dark:bg-[#141415] border border-[#171717]/[0.1] dark:border-[#ededed]/[0.1] text-[#171717] dark:text-[#ededed] placeholder:text-[#737373] dark:placeholder:text-[#85858b] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/40 dark:focus:ring-[#3b82f6]/40 transition-colors duration-150"
                                        />
                                      </div>
                                    </div>

                                    {error && (
                                      <div
                                        role="alert"
                                        className="p-3 rounded-lg bg-[#fef2f2] dark:bg-[#e5484d]/10 border border-[#dc2626]/20 dark:border-[#e5484d]/25 text-xs text-[#dc2626] dark:text-[#e5484d]"
                                      >
                                        {error}
                                      </div>
                                    )}

                                    <Button type="submit" variant="primary" size="md" className="w-full" disabled={submitting}>
                                      <span>{submitting ? 'Authenticating...' : mode === 'login' ? 'Sign in' : 'Create account'}</span>
                                      <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
                                    </Button>
                                  </form>

                                    <div className="pt-4 border-t border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] space-y-2">
                                      <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        className="w-full"
                                        onClick={handleDemo}
                                        disabled={submitting}
                                      >
                                        <Terminal className="w-4 h-4 text-[#737373] dark:text-[#85858b]" strokeWidth={1.5} />
                                        <span>Open demo workspace</span>
                                      </Button>
                                        <p className="text-[11px] text-center text-[#737373] dark:text-[#85858b] font-mono">
                                          demo@intellibi.ai · DemoPass123!
                                        </p>
                                    </div>
                                  </Surface>
                                </div>
                            </div>
                            );
}
