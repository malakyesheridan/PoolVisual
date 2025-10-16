/**
 * Deadline Alerts and Timeline Component
 * Displays project deadlines, alerts, and timeline management
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useProjectStore } from '../../stores/projectStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Plus,
  Edit,
  Eye,
  Target,
  TrendingUp,
  Users,
  FileText,
  Mail,
  Phone,
  MapPin,
  Zap,
  Bell,
  BellOff
} from 'lucide-react';
import { formatDistanceToNow, format, isAfter, isBefore, addDays } from 'date-fns';
import { 
  deadlineManager, 
  ProjectDeadline, 
  DeadlineAlert, 
  ProjectTimeline 
} from '../../services/DeadlineManager';
import { NotificationActionButton } from '../notifications/EnhancedNotificationItem';

interface DeadlineAlertsProps {
  className?: string;
  projectId?: string;
}

export function DeadlineAlerts({ className = '', projectId }: DeadlineAlertsProps) {
  const [, navigate] = useLocation();
  const { project } = useProjectStore();
  
  const [activeTab, setActiveTab] = useState<'alerts' | 'timeline' | 'deadlines'>('alerts');
  const [isCreatingDeadline, setIsCreatingDeadline] = useState(false);
  const [newDeadline, setNewDeadline] = useState({
    title: '',
    description: '',
    dueDate: '',
    type: 'milestone' as ProjectDeadline['type'],
    priority: 'medium' as ProjectDeadline['priority'],
  });

  const currentProject = projectId ? project : project;
  const timeline = currentProject ? deadlineManager.getProjectTimeline(currentProject.id) : null;
  const alerts = currentProject ? deadlineManager.getProjectAlerts(currentProject.id) : [];
  const deadlines = currentProject ? deadlineManager.getProjectDeadlines(currentProject.id) : [];
  const upcomingDeadlines = currentProject ? deadlineManager.getUpcomingDeadlines(currentProject.id, 7) : [];
  const overdueDeadlines = currentProject ? deadlineManager.getOverdueDeadlines(currentProject.id) : [];

  const handleCreateDeadline = () => {
    if (!currentProject || !newDeadline.title || !newDeadline.dueDate) return;

    deadlineManager.addDeadline(currentProject.id, {
      projectId: currentProject.id,
      title: newDeadline.title,
      description: newDeadline.description,
      dueDate: new Date(newDeadline.dueDate),
      type: newDeadline.type,
      priority: newDeadline.priority,
      status: 'pending',
    });

    setNewDeadline({
      title: '',
      description: '',
      dueDate: '',
      type: 'milestone',
      priority: 'medium',
    });
    setIsCreatingDeadline(false);
  };

  const handleAcknowledgeAlert = (alertId: string) => {
    deadlineManager.acknowledgeAlert(alertId);
  };

  const handleUpdateDeadlineStatus = (deadlineId: string, status: ProjectDeadline['status']) => {
    if (!currentProject) return;
    deadlineManager.updateDeadlineStatus(currentProject.id, deadlineId, status);
  };

  const getAlertIcon = (alert: DeadlineAlert) => {
    switch (alert.type) {
      case 'approaching': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'overdue': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'milestone_reached': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'phase_complete': return <Target className="w-4 h-4 text-blue-500" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getAlertColor = (alert: DeadlineAlert) => {
    switch (alert.severity) {
      case 'critical': return 'border-red-300 bg-red-50';
      case 'error': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'info': return 'border-blue-200 bg-blue-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  const getDeadlineStatusColor = (status: ProjectDeadline['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'overdue': return 'text-red-600 bg-red-50';
      case 'cancelled': return 'text-gray-600 bg-gray-50';
      default: return 'text-yellow-600 bg-yellow-50';
    }
  };

  const getPriorityColor = (priority: ProjectDeadline['priority']) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50';
      case 'high': return 'text-orange-600 bg-orange-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  // Auto-generate timeline if project exists but no timeline
  useEffect(() => {
    if (currentProject && !timeline) {
      deadlineManager.generateDefaultTimeline(currentProject.id, currentProject);
    }
  }, [currentProject, timeline]);

  if (!currentProject) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-600 mb-4">No project loaded</p>
          <Button onClick={() => navigate('/jobs')} variant="outline">
            Browse Projects
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Timeline & Deadlines
            {(alerts.length > 0 || overdueDeadlines.length > 0) && (
              <Badge variant="destructive" className="text-xs">
                {alerts.length + overdueDeadlines.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreatingDeadline(true)}
              title="Add deadline"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 mt-4">
          {[
            { id: 'alerts', label: 'Alerts', icon: Bell },
            { id: 'timeline', label: 'Timeline', icon: TrendingUp },
            { id: 'deadlines', label: 'Deadlines', icon: Target }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'alerts' && alerts.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {alerts.length}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Create Deadline Modal */}
        {isCreatingDeadline && (
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h4 className="text-sm font-semibold mb-3">Create New Deadline</h4>
            <div className="space-y-3">
              <div>
                <input
                  type="text"
                  placeholder="Deadline title"
                  value={newDeadline.title}
                  onChange={(e) => setNewDeadline(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <textarea
                  placeholder="Description (optional)"
                  value={newDeadline.description}
                  onChange={(e) => setNewDeadline(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input
                    type="date"
                    value={newDeadline.dueDate}
                    onChange={(e) => setNewDeadline(prev => ({ ...prev, dueDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <select
                    value={newDeadline.type}
                    onChange={(e) => setNewDeadline(prev => ({ ...prev, type: e.target.value as ProjectDeadline['type'] }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <option value="milestone">Milestone</option>
                    <option value="deadline">Deadline</option>
                    <option value="review">Review</option>
                    <option value="delivery">Delivery</option>
                    <option value="meeting">Meeting</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={newDeadline.priority}
                  onChange={(e) => setNewDeadline(prev => ({ ...prev, priority: e.target.value as ProjectDeadline['priority'] }))}
                  className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                  <option value="critical">Critical</option>
                </select>
                <Button size="sm" onClick={handleCreateDeadline}>
                  Create
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsCreatingDeadline(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <BellOff className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-sm font-medium">No active alerts</p>
                  <p className="text-xs text-slate-400 mt-1">Deadline alerts will appear here</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-4 rounded-lg border ${getAlertColor(alert)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          {getAlertIcon(alert)}
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-slate-900 mb-1">
                            {alert.message}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-600 mb-2">
                            <Calendar className="w-3 h-3" />
                            <span>Due: {format(alert.dueDate, 'MMM dd, yyyy')}</span>
                            <span>•</span>
                            <span>{alert.daysUntilDue} days</span>
                          </div>
                          {alert.suggestedActions && alert.suggestedActions.length > 0 && (
                            <div className="text-xs text-slate-600">
                              <span className="font-medium">Suggested actions:</span>
                              <ul className="list-disc list-inside mt-1">
                                {alert.suggestedActions.map((action, index) => (
                                  <li key={index}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                        className="text-xs"
                      >
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {timeline ? (
                <>
                  {/* Timeline Overview */}
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-blue-900">Project Timeline</h4>
                      <Badge className="text-blue-600 bg-blue-100">
                        {timeline.progressPercentage}% Complete
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-blue-700">
                      <span>Start: {format(timeline.startDate, 'MMM dd')}</span>
                      <span>End: {format(timeline.endDate, 'MMM dd')}</span>
                      <span>Duration: {timeline.totalDuration} days</span>
                    </div>
                    <div className="mt-2">
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${timeline.progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {/* Phases */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-slate-900">Project Phases</h4>
                    {timeline.phases.map((phase) => (
                      <div
                        key={phase.id}
                        className="p-3 border border-slate-200 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-medium text-slate-900">{phase.name}</h5>
                          <Badge className={getDeadlineStatusColor(phase.status)}>
                            {phase.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-600">
                          <span>{format(new Date(phase.startDate), 'MMM dd')} - {format(new Date(phase.endDate), 'MMM dd')}</span>
                          <span>{phase.milestones.length} milestones</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-sm font-medium">No timeline created</p>
                  <p className="text-xs text-slate-400 mt-1">Timeline will be generated automatically</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'deadlines' && (
            <div className="space-y-4">
              {/* Overdue Deadlines */}
              {overdueDeadlines.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Overdue Deadlines ({overdueDeadlines.length})
                  </h4>
                  <div className="space-y-2">
                    {overdueDeadlines.map((deadline) => (
                      <div
                        key={deadline.id}
                        className="p-3 border border-red-200 bg-red-50 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-sm font-semibold text-red-900">{deadline.title}</h5>
                            <div className="flex items-center gap-2 text-xs text-red-700 mt-1">
                              <span>Due: {format(deadline.dueDate, 'MMM dd, yyyy')}</span>
                              <Badge className="text-red-600 bg-red-100">{deadline.priority}</Badge>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUpdateDeadlineStatus(deadline.id, 'completed')}
                            className="text-xs"
                          >
                            Mark Complete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Deadlines */}
              {upcomingDeadlines.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Upcoming Deadlines ({upcomingDeadlines.length})
                  </h4>
                  <div className="space-y-2">
                    {upcomingDeadlines.map((deadline) => (
                      <div
                        key={deadline.id}
                        className="p-3 border border-slate-200 rounded-lg"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h5 className="text-sm font-semibold text-slate-900">{deadline.title}</h5>
                            <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                              <span>Due: {format(deadline.dueDate, 'MMM dd, yyyy')}</span>
                              <Badge className={getPriorityColor(deadline.priority)}>
                                {deadline.priority}
                              </Badge>
                              <Badge className={getDeadlineStatusColor(deadline.status)}>
                                {deadline.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateDeadlineStatus(deadline.id, 'in_progress')}
                              className="text-xs"
                            >
                              Start
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleUpdateDeadlineStatus(deadline.id, 'completed')}
                              className="text-xs"
                            >
                              Complete
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {deadlines.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <Target className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-sm font-medium">No deadlines set</p>
                  <p className="text-xs text-slate-400 mt-1">Create deadlines to track project milestones</p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
