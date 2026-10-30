import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer';

  const variants: Record<string, string> = {
    primary: 'bg-[#3157A4] text-white hover:bg-[#274987] focus-visible:outline-[#3157A4]',
    secondary: 'bg-[#F5F7FA] text-[#172033] border border-[#E4E8EF] hover:bg-[#EDF0F5]',
    ghost: 'text-[#667085] hover:bg-[#F5F7FA] hover:text-[#172033]',
    danger: 'bg-[#D64545] text-white hover:bg-[#B83838]',
    outline: 'border border-[#3157A4] text-[#3157A4] hover:bg-[#EBF3FF]',
  };

  const sizes: Record<string, string> = {
    sm: 'text-xs px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5',
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}

