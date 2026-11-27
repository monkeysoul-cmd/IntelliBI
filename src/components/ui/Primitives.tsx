import React from 'react';
import { cn } from '../../utils/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'secondary', size = 'md', type = 'button', icon, children, ...props }, ref) => {
    const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
      primary:
      'bg-[#171717] hover:bg-[#2a2a2c] text-white border border-[#171717] shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:bg-[#ededed] dark:text-[#141415] dark:border-[#ededed] dark:hover:bg-white font-medium',
      accent:
        'bg-[#2563eb] hover:bg-[#1d4ed8] text-white border border-[#2563eb] shadow-[inset_0_1px_0_rgba(255,255,255,0.14)] dark:bg-[#3b82f6] dark:hover:bg-[#2563eb] dark:border-[#3b82f6] font-medium',
      secondary:
      'bg-white text-[#171717] hover:bg-[#f4f4f5] border border-[#171717]/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:bg-[#232325] dark:text-[#ededed] dark:border-[#ededed]/[0.08] dark:hover:bg-[#2c2c2f] dark:shadow-none font-medium',
      outline:
      'bg-transparent text-[#525252] hover:text-[#171717] hover:bg-[#f4f4f5] border border-[#171717]/[0.12] dark:text-[#a1a1a6] dark:border-[#ededed]/[0.12] dark:hover:text-[#ededed] dark:hover:bg-[#232325]',
      ghost:
      'bg-transparent text-[#525252] hover:text-[#171717] hover:bg-[#171717]/[0.05] border border-transparent dark:text-[#a1a1a6] dark:hover:text-[#ededed] dark:hover:bg-[#ededed]/[0.06]',
      danger:
      'bg-[#dc2626] text-white hover:bg-[#b91c1c] border border-[#dc2626] dark:bg-[#e5484d] dark:hover:bg-[#dc2626]',
    };

    const sizes: Record<NonNullable<ButtonProps['size']>, string> = {
      xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
      sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
      md: 'h-9 px-4 text-sm gap-2 rounded-lg',
      lg: 'h-10 px-4 text-sm gap-2 rounded-lg',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex items-center justify-center font-medium whitespace-nowrap shrink-0',
          'transition-[background-color,border-color,color,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]/50 focus-visible:ring-offset-1 dark:focus-visible:ring-[#3b82f6]/50 dark:focus-visible:ring-offset-[#141415]',
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
        'bg-white dark:bg-[#19191b] border border-[#171717]/[0.08] dark:border-[#ededed]/[0.08] rounded-xl shadow-[0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none',
        hover &&
        'transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#171717]/[0.16] dark:hover:border-[#ededed]/[0.16]',
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
    'bg-[#f4f4f5] text-[#525252] border-[#171717]/[0.08] dark:bg-[#232325] dark:text-[#a1a1a6] dark:border-[#ededed]/[0.08]',
    blue:
      'bg-[#eff6ff] text-[#1d4ed8] border-[#2563eb]/20 dark:bg-[#2563eb]/15 dark:text-[#93c5fd] dark:border-[#3b82f6]/25',
    emerald:
    'bg-[#f0fdf4] text-[#15803d] border-[#16a34a]/20 dark:bg-[#4cc38a]/12 dark:text-[#4cc38a] dark:border-[#4cc38a]/25',
    amber:
    'bg-[#fffbeb] text-[#b45309] border-[#d97706]/20 dark:bg-[#d97706]/12 dark:text-[#fbbf24] dark:border-[#d97706]/25',
    rose:
      'bg-[#fef2f2] text-[#dc2626] border-[#dc2626]/20 dark:bg-[#e5484d]/12 dark:text-[#e5484d] dark:border-[#e5484d]/25',
    purple:
    'bg-[#f4f4f5] text-[#525252] border-[#171717]/[0.08] dark:bg-[#232325] dark:text-[#a1a1a6] dark:border-[#ededed]/[0.08]',
  };

  const dotColors = {
    neutral: 'bg-[#737373] dark:bg-[#85858b]',
    blue: 'bg-[#2563eb] dark:bg-[#3b82f6]',
    emerald: 'bg-[#16a34a] dark:bg-[#4cc38a]',
    amber: 'bg-[#b45309] dark:bg-[#fbbf24]',
    rose: 'bg-[#dc2626] dark:bg-[#e5484d]',
    purple: 'bg-[#737373] dark:bg-[#85858b]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-normal border tabular-nums leading-4 shrink-0',
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
        'inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[11px] font-mono font-normal rounded border leading-none',
        'bg-[#f4f4f5] text-[#525252] border-[#171717]/[0.1] dark:bg-[#232325] dark:text-[#a1a1a6] dark:border-[#ededed]/[0.12]',
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
        'animate-pulse rounded-lg bg-[#171717]/[0.06] dark:bg-[#ededed]/[0.06]',
        className
      )}
    />
  );
}
