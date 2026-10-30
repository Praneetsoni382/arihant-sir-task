import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="mb-3 p-3 rounded-xl bg-[#F5F7FA] text-[#667085] border border-[#E4E8EF]">{icon}</div>
      )}
      <h3 className="text-[15px] font-semibold text-[#172033] mb-1">{title}</h3>
      {description && <p className="text-sm text-[#667085] max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

