/**
 * Revenue Intelligence Panel
 * Displays key revenue metrics with visual indicators and trends
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Calendar,
  Target
} from 'lucide-react';
import { formatCurrency } from '../../lib/measurement-utils';

interface RevenueIntelligenceProps {
  jobs: any[];
  quotes: any[];
  className?: string;
}

export function RevenueIntelligence({ jobs, quotes, className = '' }: RevenueIntelligenceProps) {
  // Calculate revenue metrics
  const totalPipelineValue = quotes.reduce((sum, quote) => {
    return sum + parseFloat(quote.total || '0');
  }, 0);

  const closedThisMonth = quotes
    .filter(quote => {
      const quoteDate = new Date(quote.createdAt);
      const now = new Date();
      return quoteDate.getMonth() === now.getMonth() && 
             quoteDate.getFullYear() === now.getFullYear() &&
             quote.status === 'accepted';
    })
    .reduce((sum, quote) => sum + parseFloat(quote.total || '0'), 0);

  const avgProjectValue = jobs.length > 0 
    ? totalPipelineValue / jobs.length 
    : 0;

  const conversionRate = jobs.length > 0 
    ? (quotes.filter(q => q.status === 'accepted').length / jobs.length) * 100
    : 0;

  // Calculate month-over-month growth (mock data for now)
  const monthlyGrowth = 23; // This would be calculated from historical data
  const isGrowthPositive = monthlyGrowth >= 0;

  const metrics = [
    {
      title: "Total Pipeline",
      value: jobs.length > 0 ? formatCurrency(totalPipelineValue) : "$0.00",
      subtitle: `${jobs.length} projects`,
      icon: DollarSign,
      color: "text-primary",
      bgColor: "bg-primary/10"
    },
    {
      title: "Closed This Month",
      value: jobs.length > 0 ? formatCurrency(closedThisMonth) : "$0.00",
      subtitle: "Accepted quotes",
      icon: Calendar,
      color: "text-green-600",
      bgColor: "bg-green-100"
    },
    {
      title: "Avg Project Value",
      value: jobs.length > 0 ? formatCurrency(avgProjectValue) : "$0.00",
      subtitle: "Per project",
      icon: Target,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    },
    {
      title: "Conversion Rate",
      value: jobs.length > 0 ? `${conversionRate.toFixed(1)}%` : "0%",
      subtitle: "Quote success",
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100"
    }
  ];

  return (
    <Card className={`bg-gradient-to-br from-blue-50 to-indigo-100 border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            Revenue Intelligence
          </CardTitle>
          <Badge className={`${isGrowthPositive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'} border px-3 py-1`}>
            {isGrowthPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {isGrowthPositive ? '+' : ''}{monthlyGrowth}% MoM
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {metrics.map((metric, index) => (
            <div key={index} className="text-center group hover:scale-105 transition-transform duration-200">
              <div className={`w-14 h-14 ${metric.bgColor} rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:shadow-lg transition-shadow duration-200`}>
                <metric.icon className={`w-7 h-7 ${metric.color}`} />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">{metric.value}</div>
              <div className="text-sm font-semibold text-gray-700 mb-1">{metric.title}</div>
              <div className="text-xs text-gray-500">{metric.subtitle}</div>
            </div>
          ))}
        </div>
        
        {/* Mini trend visualization */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-700">Revenue Trend</h4>
            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Last 6 months</span>
          </div>
          <div className="h-20 bg-gradient-to-r from-blue-100 via-indigo-100 to-purple-100 rounded-lg flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-200/20 to-purple-200/20 animate-pulse"></div>
            <div className="text-sm text-gray-600 flex items-center gap-2 z-10">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <span className="font-medium">Steady growth trajectory</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
