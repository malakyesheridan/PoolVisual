/**
 * Workflow Suggestions Component
 * Displays intelligent workflow suggestions based on project state
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useStatusSyncStore } from '../../stores/statusSyncStore';
import { useProjectStore } from '../../stores/projectStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Lightbulb,
  Zap,
  Clock,
  CheckCircle,
  ArrowRight,
  X,
  RefreshCw,
  Target,
  TrendingUp,
  AlertTriangle,
  Info,
  Star,
  Play,
  Calendar,
  User,
  FileText,
  Palette,
  Package
} from 'lucide-react';
import { WorkflowSuggestion } from '../../services/SmartNotificationEngine';
import { NotificationActionButton } from '../notifications/EnhancedNotificationItem';

interface WorkflowSuggestionsProps {
  className?: string;
  projectId?: string;
  maxSuggestions?: number;
}

export function WorkflowSuggestions({ className = '', projectId, maxSuggestions = 5 }: WorkflowSuggestionsProps) {
  const [, navigate] = useLocation();
  const { 
    workflowSuggestions, 
    generateWorkflowSuggestions, 
    executeSuggestion,
    markSuggestionCompleted,
    userPreferences 
  } = useStatusSyncStore();
  const { project } = useProjectStore();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [completedSuggestions, setCompletedSuggestions] = useState<Set<string>>(new Set());

  // Filter suggestions for current project
  const projectSuggestions = React.useMemo(() => {
    if (!projectId) return workflowSuggestions;
    return workflowSuggestions.filter(suggestion => 
      suggestion.actionData?.path?.includes(projectId) || 
      suggestion.title.toLowerCase().includes('project')
    );
  }, [workflowSuggestions, projectId]);

  // Get suggestions to display
  const displaySuggestions = projectSuggestions
    .filter(suggestion => !completedSuggestions.has(suggestion.id))
    .slice(0, maxSuggestions);

  const handleGenerateSuggestions = async () => {
    if (!projectId) return;
    
    setIsGenerating(true);
    try {
      await generateWorkflowSuggestions(projectId);
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteSuggestion = async (suggestion: WorkflowSuggestion) => {
    try {
      await executeSuggestion(suggestion.id);
      setCompletedSuggestions(prev => new Set([...prev, suggestion.id]));
      
      // Show completion feedback
      setTimeout(() => {
        markSuggestionCompleted(suggestion.id);
        setCompletedSuggestions(prev => {
          const newSet = new Set(prev);
          newSet.delete(suggestion.id);
          return newSet;
        });
      }, 2000);
    } catch (error) {
      console.error('Failed to execute suggestion:', error);
    }
  };

  const handleDismissSuggestion = (suggestionId: string) => {
    markSuggestionCompleted(suggestionId);
    setCompletedSuggestions(prev => new Set([...prev, suggestionId]));
  };

  const getSuggestionIcon = (suggestion: WorkflowSuggestion) => {
    const title = suggestion.title.toLowerCase();
    
    if (title.includes('upload') || title.includes('photo')) return <Package className="w-4 h-4" />;
    if (title.includes('mask')) return <Palette className="w-4 h-4" />;
    if (title.includes('material')) return <Package className="w-4 h-4" />;
    if (title.includes('quote')) return <FileText className="w-4 h-4" />;
    if (title.includes('contact') || title.includes('client')) return <User className="w-4 h-4" />;
    if (title.includes('review') || title.includes('check')) return <Target className="w-4 h-4" />;
    if (title.includes('milestone') || title.includes('achievement')) return <Star className="w-4 h-4" />;
    
    return <Lightbulb className="w-4 h-4" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-primary bg-primary/5 border-primary/20';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertTriangle className="w-3 h-3" />;
      case 'medium': return <Info className="w-3 h-3" />;
      case 'low': return <TrendingUp className="w-3 h-3" />;
      default: return <Info className="w-3 h-3" />;
    }
  };

  // Auto-generate suggestions when project changes
  useEffect(() => {
    if (projectId && project && userPreferences.enableWorkflowSuggestions) {
      handleGenerateSuggestions();
    }
  }, [projectId, project?.id]);

  if (!userPreferences.enableWorkflowSuggestions) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Lightbulb className="w-12 h-12 mx-auto mb-4 text-slate-300" />
          <p className="text-slate-600 mb-4">Workflow suggestions are disabled</p>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => useStatusSyncStore.getState().updateUserPreferences({ 
              enableWorkflowSuggestions: true 
            })}
          >
            Enable Suggestions
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
            <Lightbulb className="w-5 h-5 text-yellow-600" />
            Workflow Suggestions
            {displaySuggestions.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {displaySuggestions.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerateSuggestions}
              disabled={isGenerating || !projectId}
              title="Generate new suggestions"
            >
              <RefreshCw className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {displaySuggestions.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Lightbulb className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-sm font-medium">No suggestions available</p>
            <p className="text-xs text-slate-400 mt-1">
              {projectId 
                ? 'Workflow suggestions will appear here based on your project progress'
                : 'Load a project to see workflow suggestions'
              }
            </p>
            {projectId && (
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={handleGenerateSuggestions}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Generate Suggestions
                  </>
                )}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {displaySuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${getPriorityColor(suggestion.priority)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getSuggestionIcon(suggestion)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-sm font-semibold text-slate-900">
                          {suggestion.title}
                        </h4>
                        <div className="flex items-center gap-1">
                          {getPriorityIcon(suggestion.priority)}
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                          >
                            {suggestion.priority}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">
                        {suggestion.description}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        {suggestion.estimatedTime && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{suggestion.estimatedTime} min</span>
                          </div>
                        )}
                        {suggestion.prerequisites && suggestion.prerequisites.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Target className="w-3 h-3" />
                            <span>{suggestion.prerequisites.length} prerequisites</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <NotificationActionButton
                      suggestion={suggestion}
                      onExecute={handleExecuteSuggestion}
                      onDismiss={() => handleDismissSuggestion(suggestion.id)}
                    />
                  </div>
                </div>
                
                {/* Prerequisites */}
                {suggestion.prerequisites && suggestion.prerequisites.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200">
                    <div className="text-xs text-slate-500 mb-2">Prerequisites:</div>
                    <div className="flex flex-wrap gap-1">
                      {suggestion.prerequisites.map((prereq, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {prereq}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {displaySuggestions.length > 0 && (
          <div className="p-3 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Showing {displaySuggestions.length} suggestions</span>
              <Button variant="ghost" size="sm" className="text-xs h-6">
                View All
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
