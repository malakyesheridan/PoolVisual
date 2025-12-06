import { ReactNode } from 'react';

interface ReportSectionProps {
  title: string;
  children: ReactNode;
  className?: string;
}

export function ReportSection({ title, children, className = '' }: ReportSectionProps) {
  return (
    <section className={`mb-8 ${className}`}>
      <h2 className="text-xl font-semibold mb-4 text-gray-900 border-b border-gray-200 pb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

