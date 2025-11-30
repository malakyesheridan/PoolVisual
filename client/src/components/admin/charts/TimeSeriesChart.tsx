import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TimeSeriesData {
  date: string;
  users: number;
  jobs: number;
  quotes: number;
  activeUsers: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesData[];
  title?: string;
}

export function TimeSeriesChart({ data, title = 'Activity Over Time' }: TimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-slate-500">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  // Format dates for display
  const formattedData = data.map(item => ({
    ...item,
    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
              dataKey="users" 
              stroke="#3b82f6" 
              strokeWidth={2}
              name="New Users"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="jobs" 
              stroke="#10b981" 
              strokeWidth={2}
              name="Jobs Created"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="quotes" 
              stroke="#f59e0b" 
              strokeWidth={2}
              name="Quotes Created"
              dot={{ r: 3 }}
            />
            <Line 
              type="monotone" 
              dataKey="activeUsers" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              name="Active Users"
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

