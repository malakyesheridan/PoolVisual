// client/src/components/enhancement/charts/ErrorAnalysisChart.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface ErrorAnalysisData {
  errorType: string;
  count: number;
  percentage: number;
}

interface ErrorAnalysisChartProps {
  data: ErrorAnalysisData[];
}

const ERROR_COLORS: Record<string, string> = {
  network: '#ef4444',
  timeout: '#f59e0b',
  validation: '#8b5cf6',
  provider: '#ec4899',
  unknown: '#6b7280',
};

export function ErrorAnalysisChart({ data }: ErrorAnalysisChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No error data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="errorType" 
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip 
          contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
          formatter={(value: number, name: string) => {
            if (name === 'count') return [value, 'Count'];
            if (name === 'percentage') return [`${value.toFixed(1)}%`, 'Percentage'];
            return [value, name];
          }}
        />
        <Legend />
        <Bar 
          dataKey="count" 
          name="Error Count"
          radius={[8, 8, 0, 0]}
        >
          {data.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={ERROR_COLORS[entry.errorType] || ERROR_COLORS.unknown} 
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

