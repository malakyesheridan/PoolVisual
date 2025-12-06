import { ReactNode } from 'react';

interface ReportSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function ReportSection({ title, children, className = '' }: ReportSectionProps) {
  return (
    <section className={`mt-8 mb-6 ${className}`}>
      <h2 className="text-2xl font-semibold mb-2 tracking-tight text-gray-900">{title}</h2>
      <div className="border-b border-gray-200 my-3"></div>
      {children}
    </section>
  );
}

