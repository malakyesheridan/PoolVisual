// client/src/components/enhancement/charts/SuccessRateChart.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface SuccessRateData {
  period: string;
  successRate: number;
  total: number;
}

interface SuccessRateChartProps {
  data: SuccessRateData[];
}

export function SuccessRateChart({ data }: SuccessRateChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No success rate data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
        <YAxis 
          tick={{ fontSize: 12 }}
          label={{ value: 'Success Rate (%)', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip 
          contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
          formatter={(value: number) => [`${value.toFixed(1)}%`, 'Success Rate']}
        />
        <Legend />
        <Bar 
          dataKey="successRate" 
          fill="#10b981"
          name="Success Rate (%)"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

