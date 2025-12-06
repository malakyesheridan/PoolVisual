import { ReactNode } from 'react';

interface ReportSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function ReportSection({ title, children, className = '' }: ReportSectionProps) {
  return (
    <section className={`mb-10 ${className}`}>
      <h2 className="text-2xl font-semibold mb-4 tracking-tight text-gray-900">{title}</h2>
      <div className="border-b border-gray-200 mb-6"></div>
      {children}
    </section>
  );
}

