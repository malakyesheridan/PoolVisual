import { ReportSection } from './ReportSection';
import { Textarea } from '@/components/ui/textarea';

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
      <div className="bg-gray-50 rounded-lg p-4">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your insights, property highlights, and recommendations..."
          className="text-sm leading-relaxed text-gray-700 min-h-[120px] resize-none border-none bg-transparent focus:ring-0 focus-visible:ring-0 shadow-none p-0"
        />
        <p className="text-xs text-gray-500 mt-2">
          This commentary will appear in the final report.
        </p>
      </div>
    </ReportSection>
  );
}

