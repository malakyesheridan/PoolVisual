// client/src/components/enhancement/AnalyticsDashboard.tsx
import { X, TrendingUp, Clock, CheckCircle2, XCircle, BarChart3 } from 'lucide-react';
import { JobTimelineChart } from './charts/JobTimelineChart';
import { SuccessRateChart } from './charts/SuccessRateChart';
import { ProcessingTimeChart } from './charts/ProcessingTimeChart';
import { MaterialUsageChart } from './charts/MaterialUsageChart';
import { ErrorAnalysisChart } from './charts/ErrorAnalysisChart';

interface AnalyticsData {
  timeline: Array<{ date: string; jobs: number; completed: number; failed: number }>;
  successRates: { daily: number; weekly: number; monthly: number };
  processingTimes: { byType: Record<string, number>; average: number };
  materialUsage: Record<string, number>;
  errorBreakdown: Record<string, number>;
}

interface AnalyticsDashboardProps {
  data: AnalyticsData | null;
  onClose: () => void;
}

export function AnalyticsDashboard({ data, onClose }: AnalyticsDashboardProps) {
  if (!data) {
    return (
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close analytics"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="text-sm text-gray-500">No analytics data available</div>
      </div>
    );
  }

  // Transform data for charts
  const timelineData = data.timeline || [];
  const successRateData = [
    { period: 'Daily', successRate: data.successRates.daily || 0, total: 0 },
    { period: 'Weekly', successRate: data.successRates.weekly || 0, total: 0 },
    { period: 'Monthly', successRate: data.successRates.monthly || 0, total: 0 },
  ];
  
  const processingTimeData = Object.entries(data.processingTimes.byType || {}).map(([type, time]) => ({
    type: type === 'add_pool' ? 'Add Pool' : type === 'add_decoration' ? 'Add Decoration' : type === 'blend_materials' ? 'Blend Materials' : type,
    averageTime: time,
    count: 0,
  }));

  const materialUsageData = Object.entries(data.materialUsage || {}).map(([materialId, count]) => ({
    materialId,
    count,
  }));

  const errorAnalysisData = Object.entries(data.errorBreakdown || {}).map(([errorType, count]) => {
    const total = Object.values(data.errorBreakdown || {}).reduce((sum, c) => sum + c, 0);
    return {
      errorType: errorType.charAt(0).toUpperCase() + errorType.slice(1),
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    };
  });

  return (
    <div className="border-b bg-gradient-to-r from-blue-50 to-purple-50 p-4 max-h-[600px] overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Analytics Dashboard
        </h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
          aria-label="Close analytics"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600">Success Rate (Daily)</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {data.successRates.daily?.toFixed(1) || 0}%
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-primary" />
              <span className="text-xs text-gray-600">Avg Processing Time</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {data.processingTimes.average ? `${Math.round(data.processingTimes.average)}s` : 'N/A'}
            </div>
          </div>
        </div>

        {/* Timeline Chart */}
        {timelineData.length > 0 && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Job Timeline</h4>
            <JobTimelineChart data={timelineData} />
          </div>
        )}

        {/* Success Rate Chart */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Success Rates</h4>
          <SuccessRateChart data={successRateData} />
        </div>

        {/* Processing Time Chart */}
        {processingTimeData.length > 0 && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Processing Time by Type</h4>
            <ProcessingTimeChart data={processingTimeData} />
          </div>
        )}

        {/* Material Usage Chart */}
        {materialUsageData.length > 0 && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Material Usage</h4>
            <MaterialUsageChart data={materialUsageData} />
          </div>
        )}

        {/* Error Analysis Chart */}
        {errorAnalysisData.length > 0 && (
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Error Analysis</h4>
            <ErrorAnalysisChart data={errorAnalysisData} />
          </div>
        )}
      </div>
    </div>
  );
}

