// client/src/components/enhancement/charts/JobTimelineChart.tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TimelineData {
  date: string;
  jobs: number;
  completed: number;
  failed: number;
}

interface JobTimelineChartProps {
  data: TimelineData[];
}

export function JobTimelineChart({ data }: JobTimelineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No timeline data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="date" 
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip 
          contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
        />
        <Legend />
        <Line 
          type="monotone" 
          dataKey="jobs" 
          stroke="#3b82f6" 
          strokeWidth={2}
          name="Total Jobs"
          dot={{ r: 4 }}
        />
        <Line 
          type="monotone" 
          dataKey="completed" 
          stroke="#10b981" 
          strokeWidth={2}
          name="Completed"
          dot={{ r: 4 }}
        />
        <Line 
          type="monotone" 
          dataKey="failed" 
          stroke="#ef4444" 
          strokeWidth={2}
          name="Failed"
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

