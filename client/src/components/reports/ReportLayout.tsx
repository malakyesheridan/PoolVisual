import { ReactNode } from 'react';

interface ReportLayoutProps {
  children: ReactNode;
  className?: string;
}

export function ReportLayout({ children, className = '' }: ReportLayoutProps) {
  return (
    <div className={`min-h-screen bg-white ${className}`}>
      <div className="max-w-4xl mx-auto pt-12 pb-8 px-12">
        {children}
      </div>
    </div>
  );
}

