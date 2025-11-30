import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, Building2, Briefcase, FileText, UserCheck, UserPlus, 
  Loader2, AlertCircle, Camera, Package, TrendingUp, Activity,
  Target, BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TimeSeriesChart } from './charts/TimeSeriesChart';
import { IndustryBreakdownChart } from './charts/IndustryBreakdownChart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Format number with commas
const formatNumber = (num: number) => {
  return new Intl.NumberFormat('en-US').format(num);
};

// Format currency
const formatCurrency = (num: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AUD' }).format(num);
};

export function AdminOverview() {
  const [timeRange, setTimeRange] = useState<30 | 90 | 365>(30);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => apiClient.getAdminOverview(),
    staleTime: 30 * 1000, // 30 seconds
  });

  const { data: timeSeriesData, isLoading: timeSeriesLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'time-series', timeRange],
    queryFn: () => apiClient.getAdminAnalyticsTimeSeries(timeRange),
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: growthData, isLoading: growthLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'growth'],
    queryFn: () => apiClient.getAdminAnalyticsGrowth(),
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: industryData, isLoading: industryLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'industry-breakdown'],
    queryFn: () => apiClient.getAdminAnalyticsIndustryBreakdown(),
    staleTime: 60 * 1000, // 1 minute
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ['admin', 'analytics', 'activity'],
    queryFn: () => apiClient.getAdminAnalyticsActivity(10),
    staleTime: 30 * 1000, // 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-red-600">
          <AlertCircle className="h-8 w-8 mx-auto mb-4" />
          <p>Error loading overview: {error instanceof Error ? error.message : 'Unknown error'}</p>
        </CardContent>
      </Card>
    );
  }

  const stats = data?.stats || {
    totalUsers: 0,
    totalOrgs: 0,
    totalJobs: 0,
    totalQuotes: 0,
    totalPhotos: 0,
    totalMaterials: 0,
    activeUsers: 0,
    recentSignups: 0,
    onboardingCompleted: 0,
    totalQuoteValue: 0,
    avgJobsPerUser: '0.00',
    avgQuotesPerJob: '0.00',
    avgPhotosPerJob: '0.00',
    onboardingCompletionRate: '0.0',
    avgQuoteValue: '0.00',
  };

  const statCards = [
    {
      title: 'Total Users',
      value: formatNumber(stats.totalUsers),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Total Organizations',
      value: formatNumber(stats.totalOrgs),
      icon: Building2,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Total Jobs',
      value: formatNumber(stats.totalJobs),
      icon: Briefcase,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Total Quotes',
      value: formatNumber(stats.totalQuotes),
      icon: FileText,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Total Photos',
      value: formatNumber(stats.totalPhotos),
      icon: Camera,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
    {
      title: 'Total Materials',
      value: formatNumber(stats.totalMaterials),
      icon: Package,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Active Users (30d)',
      value: formatNumber(stats.activeUsers),
      icon: UserCheck,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
    {
      title: 'Recent Signups (7d)',
      value: formatNumber(stats.recentSignups),
      icon: UserPlus,
      color: 'text-pink-600',
      bgColor: 'bg-pink-50',
    },
    {
      title: 'Total Quote Value',
      value: formatCurrency(stats.totalQuoteValue),
      icon: FileText,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
  ];

  const engagementCards = [
    {
      title: 'Avg Jobs per User',
      value: stats.avgJobsPerUser,
      icon: Briefcase,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Avg Quotes per Job',
      value: stats.avgQuotesPerJob,
      icon: FileText,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Avg Photos per Job',
      value: stats.avgPhotosPerJob,
      icon: Camera,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50',
    },
    {
      title: 'Onboarding Completion',
      value: `${stats.onboardingCompletionRate}%`,
      icon: Target,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  {stat.title}
                </CardTitle>
                <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                  <Icon className={cn('h-5 w-5', stat.color)} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Engagement Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Engagement Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {engagementCards.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    {stat.title}
                  </CardTitle>
                  <div className={cn('p-2 rounded-lg', stat.bgColor)}>
                    <Icon className={cn('h-4 w-4', stat.color)} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Growth Metrics */}
      {growthData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Growth Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-slate-600 mb-1">Week over Week</div>
                <div className={cn(
                  "text-2xl font-bold",
                  parseFloat(growthData.growth?.users?.weekOverWeek || '0') >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {growthData.growth?.users?.weekOverWeek || '0.0'}%
                </div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-slate-600 mb-1">Month over Month</div>
                <div className={cn(
                  "text-2xl font-bold",
                  parseFloat(growthData.growth?.users?.monthOverMonth || '0') >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {growthData.growth?.users?.monthOverMonth || '0.0'}%
                </div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-sm text-slate-600 mb-1">Year over Year</div>
                <div className={cn(
                  "text-2xl font-bold",
                  parseFloat(growthData.growth?.users?.yearOverYear || '0') >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {growthData.growth?.users?.yearOverYear || '0.0'}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Time Series Chart */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Activity Over Time</h3>
          <div className="flex gap-2">
            <Button
              variant={timeRange === 30 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(30)}
            >
              30 Days
            </Button>
            <Button
              variant={timeRange === 90 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(90)}
            >
              90 Days
            </Button>
            <Button
              variant={timeRange === 365 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(365)}
            >
              1 Year
            </Button>
          </div>
        </div>
        {timeSeriesLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            </CardContent>
          </Card>
        ) : (
          <TimeSeriesChart data={timeSeriesData?.data || []} />
        )}
      </div>

      {/* Industry Breakdown */}
      {industryData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IndustryBreakdownChart
            data={industryData.breakdown?.users || []}
            title="Users by Industry"
            dataKey="count"
            label="Users"
          />
          <IndustryBreakdownChart
            data={industryData.breakdown?.jobs || []}
            title="Jobs by Industry"
            dataKey="count"
            label="Jobs"
          />
        </div>
      )}

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : activityData?.activities && activityData.activities.length > 0 ? (
            <div className="space-y-3">
              {activityData.activities.slice(0, 10).map((activity: any, index: number) => {
                const getActivityLabel = () => {
                  if (activity.type === 'user_signup') {
                    return `New user signed up: ${activity.email || activity.username}`;
                  }
                  if (activity.type === 'job_created') {
                    return `New job created: ${activity.clientName || 'Untitled'}`;
                  }
                  if (activity.type === 'quote_created') {
                    return `New quote created: ${formatCurrency(Number(activity.total || 0))}`;
                  }
                  return 'Unknown activity';
                };

                const getActivityBadge = () => {
                  if (activity.type === 'user_signup') return { label: 'User', color: 'bg-blue-100 text-blue-800' };
                  if (activity.type === 'job_created') return { label: 'Job', color: 'bg-purple-100 text-purple-800' };
                  if (activity.type === 'quote_created') return { label: 'Quote', color: 'bg-orange-100 text-orange-800' };
                  return { label: 'Activity', color: 'bg-gray-100 text-gray-800' };
                };

                const badge = getActivityBadge();
                const date = new Date(activity.createdAt);
                const timeAgo = date.toLocaleDateString() === new Date().toLocaleDateString()
                  ? `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                  : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge className={badge.color}>{badge.label}</Badge>
                      <span className="text-sm text-slate-700">{getActivityLabel()}</span>
                    </div>
                    <span className="text-xs text-slate-500">{timeAgo}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">No recent activity</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
