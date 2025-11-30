/**
 * Simplified Metric Cards Component
 * Displays 4 essential metrics in clean, simple cards
 * Uses the same data source as the Jobs page for consistency
 */

import { Card, CardContent } from '../ui/card';
import { 
  Briefcase, 
  Activity, 
  DollarSign, 
  Calendar,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../../lib/measurement-utils';
import { useIndustryTerm } from '../../hooks/useIndustryTerm';

interface MetricCardsProps {
  jobs: any[];
  quotes?: any[];
  isLoading?: boolean;
  error?: Error | null;
  className?: string;
}

export function MetricCards({ 
  jobs, 
  quotes = [], 
  isLoading = false,
  error = null,
  className = '' 
}: MetricCardsProps) {
  const { projects, quote } = useIndustryTerm();
  
  // Calculate metrics from real job data (same logic as Jobs page)
  const totalProjects = jobs.length;
  
  // Active projects: same statuses used by Jobs page for "in progress" work
  const activeProjects = jobs.filter(job => 
    ['new', 'estimating', 'sent', 'accepted', 'scheduled'].includes(job.status)
  ).length;
  
  // Projects created this month: use createdAt field (same as Jobs page uses for sorting)
  const thisMonth = new Date();
  thisMonth.setDate(1); // First day of current month
  thisMonth.setHours(0, 0, 0, 0);
  const projectsThisMonth = jobs.filter(job => {
    if (!job.createdAt) return false;
    const createdAt = new Date(job.createdAt);
    return !isNaN(createdAt.getTime()) && createdAt >= thisMonth;
  }).length;
  
  // Total Value: sum of quote.total field (same field used throughout the app)
  const totalQuoteValue = quotes.reduce((sum, quote) => {
    const value = parseFloat(quote.total || '0');
    return sum + (isNaN(value) ? 0 : value);
  }, 0);

  const metrics = [
    {
      title: `Total ${projects}`,
      value: totalProjects,
      icon: Briefcase,
      color: "text-primary",
      bgColor: "bg-primary/5"
    },
    {
      title: `Active ${projects}`, 
      value: activeProjects,
      icon: Activity,
      color: "text-green-600",
      bgColor: "bg-green-50"
    },
    {
      title: "This Month",
      value: projectsThisMonth,
      icon: Calendar,
      color: "text-orange-600",
      bgColor: "bg-orange-50"
    },
    {
      title: "Total Value",
      value: formatCurrency(totalQuoteValue),
      icon: DollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50"
    }
  ];

  // Get microtext descriptions
  const getMicrotext = (metric: typeof metrics[0]) => {
    if (metric.title === `Total ${projects}`) {
      return `All time ${projects.toLowerCase()}`;
    }
    if (metric.title === `Active ${projects}`) {
      return "In progress";
    }
    if (metric.title === "This Month") {
      return "New this month";
    }
    if (metric.title === "Total Value") {
      return `${quote} value`;
    }
    return "";
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
        {[1, 2, 3, 4].map((index) => (
          <Card 
            key={index} 
            className="bg-white border border-gray-100 rounded-xl shadow-sm"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-24 mb-2 animate-pulse"></div>
                  <div className="h-8 bg-gray-200 rounded w-16 mb-2 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-20 animate-pulse"></div>
                </div>
                <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
        {metrics.map((metric, index) => (
          <Card 
            key={index} 
            className="bg-white border border-gray-100 rounded-xl shadow-sm"
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600 mb-1">{metric.title}</p>
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <p className="text-sm">Error loading data</p>
                  </div>
                </div>
                <div className={`w-16 h-16 ${metric.bgColor} rounded-xl flex items-center justify-center flex-shrink-0 opacity-50`}>
                  <metric.icon className={`w-8 h-8 ${metric.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 ${className}`}>
      {metrics.map((metric, index) => (
        <Card 
          key={index} 
          className="bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-150"
        >
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">{metric.title}</p>
                <p className="text-2xl font-semibold text-gray-900 mb-1">{metric.value}</p>
                <p className="text-xs text-gray-500">{getMicrotext(metric)}</p>
              </div>
              <div className={`w-16 h-16 ${metric.bgColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <metric.icon className={`w-8 h-8 ${metric.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

