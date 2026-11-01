import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  bg?: string;
  color?: string;
  border?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  bg = '#F5F7FA',
  color = '#667085',
  border = '#E4E8EF',
  size = 'sm',
  className = '',
}: BadgeProps) {
  return (
    <span
      className={className}
      style={{
        backgroundColor: bg,
        color,
        border: `1px solid ${border}`,
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '9999px',
        padding: size === 'sm' ? '3px 10px' : '4px 12px',
        fontSize: size === 'sm' ? '11px' : '12px',
        fontWeight: 500,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

