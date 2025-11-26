/**
 * Collaboration Notifications Component
 * Displays team collaboration, comments, and shared project updates
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useProjectStore } from '../../stores/projectStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Users,
  MessageSquare,
  AtSign,
  Share2,
  UserPlus,
  UserMinus,
  Edit,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  Reply,
  MoreHorizontal,
  Bell,
  BellOff,
  Settings
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { 
  collaborationManager,
  CollaborationNotification,
  CollaborationComment,
  TeamMember
} from '../../services/CollaborationManager';
import { NotificationActionButton } from '../notifications/EnhancedNotificationItem';

interface CollaborationNotificationsProps {
  className?: string;
  projectId?: string;
  userId?: string;
}

export function CollaborationNotifications({ 
  className = '', 
  projectId, 
  userId = 'current-user' 
}: CollaborationNotificationsProps) {
  const [, navigate] = useLocation();
  const { project } = useProjectStore();
  
  const [activeTab, setActiveTab] = useState<'notifications' | 'comments' | 'team'>('notifications');
  const [showSettings, setShowSettings] = useState(false);
  const [newComment, setNewComment] = useState({
    content: '',
    photoId: '',
    maskId: '',
  });

  const currentProject = projectId ? project : project;
  const collaboration = currentProject ? collaborationManager.getProjectCollaboration(currentProject.id) : null;
  const notifications = userId ? collaborationManager.getUserNotifications(userId) : [];
  const unreadCount = userId ? collaborationManager.getUnreadNotificationCount(userId) : 0;
  const teamMembers = collaboration?.teamMembers || [];
  const comments = collaboration?.comments || [];
  const onlineMembers = currentProject ? collaborationManager.getOnlineTeamMembers(currentProject.id) : [];

  // Initialize collaboration if project exists but no collaboration
  useEffect(() => {
    if (currentProject && !collaboration) {
      collaborationManager.initializeProjectCollaboration(
        currentProject.id,
        userId,
        'Current User'
      );
    }
  }, [currentProject, collaboration, userId]);

  const handleAddComment = () => {
    if (!currentProject || !newComment.content.trim()) return;

    collaborationManager.addComment(currentProject.id, {
      projectId: currentProject.id,
      authorId: userId,
      authorName: 'Current User',
      content: newComment.content,
      photoId: newComment.photoId || undefined,
      maskId: newComment.maskId || undefined,
      mentions: [],
      attachments: [],
    });

    setNewComment({ content: '', photoId: '', maskId: '' });
  };

  const handleMarkAsRead = (notificationId: string) => {
    collaborationManager.markNotificationAsRead(notificationId, userId);
  };

  const handleResolveComment = (commentId: string) => {
    if (!currentProject) return;
    collaborationManager.resolveComment(currentProject.id, commentId, userId);
  };

  const getNotificationIcon = (notification: CollaborationNotification) => {
    switch (notification.type) {
      case 'comment_added': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'comment_replied': return <Reply className="w-4 h-4 text-green-500" />;
      case 'mention': return <AtSign className="w-4 h-4 text-purple-500" />;
      case 'project_shared': return <Share2 className="w-4 h-4 text-orange-500" />;
      case 'member_joined': return <UserPlus className="w-4 h-4 text-green-500" />;
      case 'member_left': return <UserMinus className="w-4 h-4 text-red-500" />;
      case 'project_updated': return <Edit className="w-4 h-4 text-gray-500" />;
      default: return <Bell className="w-4 h-4 text-gray-500" />;
    }
  };

  const getNotificationColor = (notification: CollaborationNotification) => {
    if (notification.read) {
      return 'border-gray-200 bg-gray-50';
    }
    
    switch (notification.priority) {
      case 'high': return 'border-red-200 bg-red-50';
      case 'medium': return 'border-yellow-200 bg-yellow-50';
      case 'low': return 'border-primary/20 bg-primary/5';
      default: return 'border-gray-200 bg-white';
    }
  };

  const getMemberStatusColor = (status: TeamMember['status']) => {
    switch (status) {
      case 'online': return 'text-green-600 bg-green-50';
      case 'away': return 'text-yellow-600 bg-yellow-50';
      case 'offline': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getCommentStatusColor = (comment: CollaborationComment) => {
    if (comment.resolved) {
      return 'border-green-200 bg-green-50';
    }
    return 'border-gray-200 bg-white';
  };

  if (!currentProject) {
    return (
      <Card className={className}>
        <CardContent className="text-center py-8">
          <Users className="w-12 h-12 mx-auto mb-4 text-slate-300" />
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
            <Users className="w-5 h-5 text-primary" />
            Team Collaboration
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex items-center border-b border-slate-200 mt-4">
          {[
            { id: 'notifications', label: 'Notifications', icon: Bell },
            { id: 'comments', label: 'Comments', icon: MessageSquare },
            { id: 'team', label: 'Team', icon: Users }
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'notifications' && unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {unreadCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        {/* Settings Panel */}
        {showSettings && (
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h4 className="text-sm font-semibold mb-3">Collaboration Settings</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Allow Comments</span>
                <Badge className="text-green-600 bg-green-50">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Notify on Mentions</span>
                <Badge className="text-green-600 bg-green-50">Enabled</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Auto-resolve Comments</span>
                <Badge className="text-gray-600 bg-gray-50">Disabled</Badge>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="p-4">
          {activeTab === 'notifications' && (
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <BellOff className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <p className="text-sm font-medium">No notifications</p>
                  <p className="text-xs text-slate-400 mt-1">Team notifications will appear here</p>
                </div>
              ) : (
                notifications.slice(0, 10).map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 rounded-lg border transition-colors hover:shadow-sm ${getNotificationColor(notification)}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification)}
                        </div>
                        <div className="flex-1">
                          <h4 className={`text-sm font-medium ${notification.read ? 'text-slate-600' : 'text-slate-900'}`}>
                            {notification.message}
                          </h4>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <span>by {notification.fromUserName}</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(notification.createdAt, { addSuffix: true })}</span>
                            {notification.priority === 'high' && (
                              <>
                                <span>•</span>
                                <Badge className="text-red-600 bg-red-50">High Priority</Badge>
                              </>
                            )}
                          </div>
                          {notification.actionRequired && (
                            <div className="mt-2 text-xs text-primary">
                              Action required
                            </div>
                          )}
                        </div>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-xs"
                        >
                          Mark Read
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* Add Comment */}
              <div className="p-4 border border-slate-200 rounded-lg">
                <h4 className="text-sm font-semibold mb-3">Add Comment</h4>
                <div className="space-y-3">
                  <textarea
                    placeholder="Add a comment..."
                    value={newComment.content}
                    onChange={(e) => setNewComment(prev => ({ ...prev, content: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    rows={3}
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={handleAddComment} disabled={!newComment.content.trim()}>
                      <MessageSquare className="w-4 h-4 mr-1" />
                      Add Comment
                    </Button>
                  </div>
                </div>
              </div>

              {/* Comments List */}
              <div className="space-y-3">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <MessageSquare className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                    <p className="text-sm font-medium">No comments yet</p>
                    <p className="text-xs text-slate-400 mt-1">Start the conversation</p>
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className={`p-4 rounded-lg border ${getCommentStatusColor(comment)}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="text-sm font-semibold text-slate-900">
                              {comment.authorName}
                            </h5>
                            <Badge className="text-xs text-slate-500">
                              {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
                            </Badge>
                            {comment.resolved && (
                              <Badge className="text-green-600 bg-green-50">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Resolved
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mb-3">
                            {comment.content}
                          </p>
                          {comment.mentions.length > 0 && (
                            <div className="flex items-center gap-1 text-xs text-purple-600 mb-2">
                              <AtSign className="w-3 h-3" />
                              <span>Mentioned: {comment.mentions.join(', ')}</span>
                            </div>
                          )}
                          {comment.replies.length > 0 && (
                            <div className="text-xs text-slate-500 mb-2">
                              {comment.replies.length} replies
                            </div>
                          )}
                        </div>
                        {!comment.resolved && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResolveComment(comment.id)}
                            className="text-xs"
                          >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-4">
              {/* Online Members */}
              {onlineMembers.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Online Now ({onlineMembers.length})
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {onlineMembers.map((member) => (
                      <div
                        key={member.id}
                        className="p-3 border border-green-200 bg-green-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm font-medium text-green-900">
                            {member.name}
                          </span>
                        </div>
                        <div className="text-xs text-green-700 mt-1">
                          {member.role}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Team Members */}
              <div>
                <h4 className="text-sm font-semibold text-slate-900 mb-3">Team Members</h4>
                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          member.status === 'online' ? 'bg-green-500' :
                          member.status === 'away' ? 'bg-yellow-500' : 'bg-gray-400'
                        }`}></div>
                        <div>
                          <h5 className="text-sm font-semibold text-slate-900">
                            {member.name}
                          </h5>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Badge className={getMemberStatusColor(member.status)}>
                              {member.status}
                            </Badge>
                            <Badge variant="outline">
                              {member.role}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDistanceToNow(member.lastActive, { addSuffix: true })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Invite Team Member */}
              <div className="p-4 border border-slate-200 rounded-lg">
                <h4 className="text-sm font-semibold mb-3">Invite Team Member</h4>
                <div className="space-y-3">
                  <input
                    type="email"
                    placeholder="Email address"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                  <div className="flex items-center gap-2">
                    <select className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button size="sm">
                      <UserPlus className="w-4 h-4 mr-1" />
                      Invite
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
