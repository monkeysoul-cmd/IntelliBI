import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', type = 'button', icon, children, ...props }, ref) => {
    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
        'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-xs dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100 dark:active:bg-slate-200 border border-blue-600 dark:border-white/90 font-semibold',
      secondary:
        'bg-white text-slate-800 hover:bg-slate-50/80 active:bg-slate-100 border border-slate-200/90 shadow-2xs dark:bg-[#161A26] dark:text-slate-200 dark:border-white/[0.08] dark:hover:bg-[#1C2232] dark:active:bg-[#20273A]',
      outline:
        'bg-transparent text-slate-700 hover:bg-slate-100/80 border border-slate-300/80 dark:text-slate-300 dark:border-white/[0.12] dark:hover:bg-white/[0.05]',
      ghost:
        'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 border border-transparent dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/[0.06]',
      danger:
        'bg-rose-600 text-white hover:bg-rose-700 border border-rose-600 shadow-xs dark:bg-rose-500/90 dark:hover:bg-rose-500',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
      md: 'h-9 px-3.5 text-sm gap-2 rounded-lg',
      lg: 'h-10 px-4 text-sm gap-2 rounded-xl',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center font-medium whitespace-nowrap shrink-0 transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-slate-950',
          'disabled:opacity-40 disabled:pointer-events-none cursor-pointer active:scale-[0.98]',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {icon && <span className="shrink-0">{icon}</span>}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export function Surface({
  className,
  hover = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  className?: string;
  hover?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-[#11141D] border border-slate-200/80 dark:border-white/[0.07] rounded-xl shadow-2xs',
        hover && 'transition-all duration-150 hover:border-slate-300 dark:hover:border-white/[0.12] hover:shadow-xs',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function Badge({
  variant = 'neutral',
  className,
  dot,
  children,
}: {
  variant?: 'neutral' | 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
  className?: string;
  dot?: boolean;
  children: React.ReactNode;
}) {
  const styles = {
    neutral:
      'bg-slate-100 text-slate-700 border-slate-200/80 dark:bg-white/[0.05] dark:text-slate-300 dark:border-white/[0.08]',
    blue: 'bg-blue-50 text-blue-700 border-blue-200/80 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
    emerald:
      'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    amber:
      'bg-amber-50 text-amber-700 border-amber-200/80 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    rose: 'bg-rose-50 text-rose-700 border-rose-200/80 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
    purple:
      'bg-purple-50 text-purple-700 border-purple-200/80 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20',
  };

  const dotColors = {
    neutral: 'bg-slate-400 dark:bg-slate-500',
    blue: 'bg-blue-500 dark:bg-blue-400',
    emerald: 'bg-emerald-500 dark:bg-emerald-400',
    amber: 'bg-amber-500 dark:bg-amber-400',
    rose: 'bg-rose-500 dark:bg-rose-400',
    purple: 'bg-purple-500 dark:bg-purple-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border tabular-nums leading-tight shrink-0',
        styles[variant],
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])} />}
      {children}
    </span>
  );
}

export function Keycap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-mono font-medium rounded-md border',
        'bg-slate-100 text-slate-600 border-slate-200 dark:bg-[#1A1F2C] dark:text-slate-400 dark:border-white/[0.1] shadow-2xs',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-slate-200/80 dark:bg-white/[0.06]',
        className
      )}
    />
  );
}
