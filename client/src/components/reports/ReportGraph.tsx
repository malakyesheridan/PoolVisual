interface ReportGraphProps {
  data: Array<{ label: string; value: number; color?: string }>;
  title: string;
  type?: 'donut' | 'bar';
}

export function ReportGraph({ data, title, type = 'donut' }: ReportGraphProps) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value));
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (type === 'donut') {
    // Pure SVG donut chart
    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    let currentOffset = 0;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900">{title}</h3>
        <div className="flex items-center justify-center">
          <svg width="200" height="200" viewBox="0 0 200 200" className="transform -rotate-90">
            {data.map((item, index) => {
              const percentage = total > 0 ? (item.value / total) * 100 : 0;
              const strokeDasharray = (percentage / 100) * circumference;
              const strokeDashoffset = currentOffset;
              currentOffset -= strokeDasharray;

              return (
                <circle
                  key={index}
                  cx="100"
                  cy="100"
                  r={radius}
                  fill="none"
                  stroke={item.color || `hsl(${(index * 360) / data.length}, 70%, 50%)`}
                  strokeWidth="30"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              );
            })}
            <text
              x="100"
              y="100"
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-gray-900 text-2xl font-bold"
              transform="rotate(90 100 100)"
            >
              {total}
            </text>
          </svg>
        </div>
        <div className="mt-6 space-y-2">
          {data.map((item, index) => {
            const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
            return (
              <div key={index} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{
                      backgroundColor: item.color || `hsl(${(index * 360) / data.length}, 70%, 50%)`,
                    }}
                  />
                  <span className="text-gray-700">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{item.value}</span>
                  <span className="text-gray-500">({percentage}%)</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Bar chart
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900">{title}</h3>
      <div className="space-y-3">
        {data.map((item, index) => {
          const percentage = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          return (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{item.label}</span>
                <span className="text-sm font-semibold text-gray-900">{item.value}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: item.color || `hsl(${(index * 360) / data.length}, 70%, 50%)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

