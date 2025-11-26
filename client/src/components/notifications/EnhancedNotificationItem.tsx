/**
 * Enhanced Notification Component with Action Buttons
 * Provides interactive notifications with actionable buttons
 */

import React, { useState } from 'react';
import { SmartNotification, WorkflowSuggestion } from '../../services/SmartNotificationEngine';
import { useStatusSyncStore } from '../../stores/statusSyncStore';
import { 
  CheckCircle, 
  X, 
  ArrowRight, 
  Clock, 
  Calendar, 
  Mail, 
  Phone, 
  ExternalLink,
  Play,
  Pause,
  RefreshCw,
  Eye,
  EyeOff,
  Star,
  Flag,
  Archive,
  Trash2,
  Edit,
  Copy,
  Share2
} from 'lucide-react';

interface NotificationActionButtonProps {
  suggestion: WorkflowSuggestion;
  onExecute: (suggestionId: string) => void;
  onDismiss?: () => void;
  disabled?: boolean;
}

export const NotificationActionButton: React.FC<NotificationActionButtonProps> = ({
  suggestion,
  onExecute,
  onDismiss,
  disabled = false
}) => {
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    setIsExecuting(true);
    try {
      await onExecute(suggestion.id);
    } finally {
      setIsExecuting(false);
    }
  };

  const getActionIcon = () => {
    switch (suggestion.actionType) {
      case 'navigate': return <ArrowRight className="w-4 h-4" />;
      case 'execute': return <Play className="w-4 h-4" />;
      case 'schedule': return <Calendar className="w-4 h-4" />;
      case 'contact': return <Mail className="w-4 h-4" />;
      default: return <ArrowRight className="w-4 h-4" />;
    }
  };

  const getActionColor = () => {
    switch (suggestion.priority) {
      case 'high': return 'bg-red-600 hover:bg-red-700 text-white';
      case 'medium': return 'bg-primary hover:bg-primary/90 text-white';
      case 'low': return 'bg-gray-600 hover:bg-gray-700 text-white';
      default: return 'bg-primary hover:bg-primary/90 text-white';
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <button
        onClick={handleExecute}
        disabled={disabled || isExecuting}
        className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${getActionColor()} ${
          disabled || isExecuting ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isExecuting ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          getActionIcon()
        )}
        <span>{suggestion.action}</span>
      </button>
      
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
          title="Dismiss suggestion"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

interface EnhancedNotificationItemProps {
  notification: SmartNotification;
  onMarkAsRead?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onArchive?: (id: string) => void;
  onFlag?: (id: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export const EnhancedNotificationItem: React.FC<EnhancedNotificationItemProps> = ({
  notification,
  onMarkAsRead,
  onDismiss,
  onArchive,
  onFlag,
  showActions = true,
  compact = false
}) => {
  const { executeSuggestion, markSuggestionCompleted } = useStatusSyncStore();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFlagged, setIsFlagged] = useState(false);
  const [isArchived, setIsArchived] = useState(false);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-green-500 bg-green-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'workflow': return <RefreshCw className="w-4 h-4" />;
      case 'deadline': return <Clock className="w-4 h-4" />;
      case 'collaboration': return <Mail className="w-4 h-4" />;
      case 'system': return <CheckCircle className="w-4 h-4" />;
      case 'achievement': return <Star className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const handleExecuteSuggestion = async (suggestionId: string) => {
    try {
      await executeSuggestion(suggestionId);
      markSuggestionCompleted(suggestionId);
    } catch (error) {
      console.error('Failed to execute suggestion:', error);
    }
  };

  const handleFlag = () => {
    setIsFlagged(!isFlagged);
    onFlag?.(notification.id);
  };

  const handleArchive = () => {
    setIsArchived(!isArchived);
    onArchive?.(notification.id);
  };

  const handleDismiss = () => {
    onDismiss?.(notification.id);
  };

  const handleMarkAsRead = () => {
    onMarkAsRead?.(notification.id);
  };

  if (isArchived) return null;

  return (
    <div className={`border-l-4 ${getPriorityColor(notification.priority)} rounded-r-lg p-4 transition-all hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="flex-shrink-0 mt-1">
            {getCategoryIcon(notification.category)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="text-sm font-medium text-slate-900 truncate">
                {notification.title}
              </h4>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                notification.priority === 'urgent' ? 'bg-red-100 text-red-800' :
                notification.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }`}>
                {notification.priority}
              </span>
            </div>
            
            <p className="text-sm text-slate-600 mb-2">
              {notification.message}
            </p>

            {/* Context Information */}
            {notification.context && (
              <div className="text-xs text-slate-500 mb-2">
                {notification.context.projectName && (
                  <span>Project: {notification.context.projectName}</span>
                )}
                {notification.context.timeOfDay && (
                  <span className="ml-2">Time: {notification.context.timeOfDay}</span>
                )}
              </div>
            )}

            {/* Suggestions */}
            {notification.suggestions && notification.suggestions.length > 0 && (
              <div className="space-y-2">
                {!isExpanded && notification.suggestions.length > 1 && (
                  <button
                    onClick={() => setIsExpanded(true)}
                    className="text-xs text-primary hover:text-primary"
                  >
                    Show {notification.suggestions.length - 1} more suggestions
                  </button>
                )}
                
                <div className="space-y-2">
                  {(isExpanded ? notification.suggestions : notification.suggestions.slice(0, 1)).map((suggestion) => (
                    <div key={suggestion.id} className="bg-white rounded-lg p-3 border border-slate-200">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h5 className="text-sm font-medium text-slate-900">{suggestion.title}</h5>
                          <p className="text-xs text-slate-600">{suggestion.description}</p>
                        </div>
                        {suggestion.estimatedTime && (
                          <span className="text-xs text-slate-500 flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {suggestion.estimatedTime}m
                          </span>
                        )}
                      </div>
                      
                      {showActions && (
                        <NotificationActionButton
                          suggestion={suggestion}
                          onExecute={handleExecuteSuggestion}
                          onDismiss={() => markSuggestionCompleted(suggestion.id)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Entities */}
            {notification.relatedEntities && notification.relatedEntities.length > 0 && (
              <div className="mt-2">
                <div className="text-xs text-slate-500 mb-1">Related:</div>
                <div className="flex flex-wrap gap-1">
                  {notification.relatedEntities.map((entity, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded"
                    >
                      {entity.type}: {entity.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-1 ml-4">
          {!compact && (
            <>
              <button
                onClick={handleFlag}
                className={`p-1 rounded transition-colors ${
                  isFlagged ? 'text-yellow-600 bg-yellow-100' : 'text-slate-400 hover:text-slate-600'
                }`}
                title={isFlagged ? 'Unflag' : 'Flag'}
              >
                <Flag className="w-4 h-4" />
              </button>
              
              <button
                onClick={handleArchive}
                className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                title="Archive"
              >
                <Archive className="w-4 h-4" />
              </button>
            </>
          )}
          
          <button
            onClick={handleDismiss}
            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Timestamp */}
      <div className="mt-2 text-xs text-slate-500">
        {new Date(notification.createdAt).toLocaleString()}
        {notification.expiresAt && (
          <span className="ml-2">
            Expires: {new Date(notification.expiresAt).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
};

interface NotificationGroupItemProps {
  group: {
    id: string;
    title: string;
    notifications: SmartNotification[];
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    createdAt: Date;
    expiresAt?: Date;
  };
  onExpand?: (groupId: string) => void;
  onCollapse?: (groupId: string) => void;
  isExpanded?: boolean;
}

export const NotificationGroupItem: React.FC<NotificationGroupItemProps> = ({
  group,
  onExpand,
  onCollapse,
  isExpanded = false
}) => {
  const [isGroupExpanded, setIsGroupExpanded] = useState(isExpanded);

  const handleToggleExpanded = () => {
    setIsGroupExpanded(!isGroupExpanded);
    if (isGroupExpanded) {
      onCollapse?.(group.id);
    } else {
      onExpand?.(group.id);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-green-500 bg-green-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className={`border-l-4 ${getPriorityColor(group.priority)} rounded-r-lg p-4 transition-all hover:shadow-md`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 flex-1">
          <button
            onClick={handleToggleExpanded}
            className="flex-shrink-0 p-1 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {isGroupExpanded ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
          
          <div className="flex-1">
            <h4 className="text-sm font-medium text-slate-900">{group.title}</h4>
            <p className="text-xs text-slate-600">
              {group.notifications.length} notifications
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            group.priority === 'urgent' ? 'bg-red-100 text-red-800' :
            group.priority === 'high' ? 'bg-orange-100 text-orange-800' :
            group.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
            'bg-green-100 text-green-800'
          }`}>
            {group.priority}
          </span>
          
          <span className="text-xs text-slate-500">
            {new Date(group.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      {isGroupExpanded && (
        <div className="mt-4 space-y-3">
          {group.notifications.map((notification) => (
            <EnhancedNotificationItem
              key={notification.id}
              notification={notification}
              compact={true}
            />
          ))}
        </div>
      )}
    </div>
  );
};
