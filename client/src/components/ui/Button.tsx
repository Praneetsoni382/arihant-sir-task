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
    'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer';

  const variants: Record<string, string> = {
    primary: 'bg-[#2458D3] text-white hover:bg-[#1A47B8] shadow-sm shadow-[#2458D3]/20 focus-visible:outline-[#2458D3]',
    secondary: 'bg-white text-[#14213D] border border-[#D5E0F2] hover:bg-[#F1F4FC] hover:border-[#2458D3]/40 shadow-2xs',
    ghost: 'text-[#687894] hover:bg-[#F1F4FC] hover:text-[#14213D]',
    danger: 'bg-[#E34D59] text-white hover:bg-[#C93844] shadow-sm shadow-[#E34D59]/20',
    outline: 'border border-[#2458D3] text-[#2458D3] hover:bg-[#EAF2FF]',
  };

  const sizes: Record<string, string> = {
    sm: 'text-xs px-3 py-1.5 rounded-lg',
    md: 'text-sm px-4 py-2 rounded-xl',
    lg: 'text-base px-5 py-2.5 rounded-xl',
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

