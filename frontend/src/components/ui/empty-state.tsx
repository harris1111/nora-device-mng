import { ReactNode } from 'react';

interface Props {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: 'default' | 'subtle';
}

export default function EmptyState({ icon, title, description, action, variant = 'default' }: Props) {
  const containerClass =
    variant === 'subtle'
      ? 'text-center py-16 flex flex-col items-center'
      : 'text-center py-20 bg-white rounded-3xl border border-slate-100 border-dashed shadow-sm flex flex-col items-center';

  const iconWrapClass =
    variant === 'subtle'
      ? 'w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mb-4'
      : 'w-20 h-20 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-4';

  return (
    <div className={containerClass}>
      <div className={iconWrapClass}>{icon}</div>
      <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-2 text-slate-500 text-sm max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
