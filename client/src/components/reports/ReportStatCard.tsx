import { ReactNode } from 'react';

interface ReportStatCardProps {
  label: string;
  value: string | number | ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function ReportStatCard({ label, value, icon, className = '' }: ReportStatCardProps) {
  return (
    <div className={`bg-gray-50 rounded-lg p-4 border border-gray-200 ${className}`}>
      {icon && <div className="mb-2 text-gray-600">{icon}</div>}
      <div className="text-sm font-medium text-gray-600 mb-1">{label}</div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}

