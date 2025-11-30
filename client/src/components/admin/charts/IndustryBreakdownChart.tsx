import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface IndustryData {
  industry: string;
  count: number;
  totalValue?: number;
}

interface IndustryBreakdownChartProps {
  data: IndustryData[];
  title: string;
  dataKey: 'count' | 'totalValue';
  label: string;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export function IndustryBreakdownChart({ data, title, dataKey, label }: IndustryBreakdownChartProps) {
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

  // Format industry names
  const formattedData = data.map(item => ({
    ...item,
    industry: item.industry === 'unknown' ? 'Unknown' : item.industry.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={formattedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="industry" 
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '6px' }}
              formatter={(value: number) => {
                if (dataKey === 'totalValue') {
                  return [`$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, label];
                }
                return [value, label];
              }}
            />
            <Legend />
            <Bar 
              dataKey={dataKey} 
              name={label}
              radius={[8, 8, 0, 0]}
            >
              {formattedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

