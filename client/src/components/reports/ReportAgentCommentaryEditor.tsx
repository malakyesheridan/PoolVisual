import { useState, useEffect } from 'react';
import { ReportSection } from './ReportSection';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface ReportAgentCommentaryEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

export function ReportAgentCommentaryEditor({
  value,
  onChange,
  label = 'Agent Commentary'
}: ReportAgentCommentaryEditorProps) {
  return (
    <ReportSection title={label}>
      <div className="space-y-2">
        <Label htmlFor="commentary">Add your insights and commentary</Label>
        <Textarea
          id="commentary"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your market insights, property highlights, and recommendations..."
          className="min-h-[150px] resize-none"
        />
        <p className="text-xs text-gray-500">
          This commentary will appear in the final report.
        </p>
      </div>
    </ReportSection>
  );
}

