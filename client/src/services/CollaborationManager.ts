/**
 * Collaboration Notifications System
 * Handles team collaboration, comments, and shared project updates
 */

import { Project } from '../types/project';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  avatar?: string;
  status: 'online' | 'away' | 'offline';
  lastActive: Date;
  permissions: TeamPermissions;
}

export interface TeamPermissions {
  canEdit: boolean;
  canDelete: boolean;
  canInvite: boolean;
  canComment: boolean;
  canViewAnalytics: boolean;
}

export interface CollaborationComment {
  id: string;
  projectId: string;
  photoId?: string;
  maskId?: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  lastModified: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  mentions: string[]; // User IDs mentioned in the comment
  attachments?: CollaborationAttachment[];
  replies: CollaborationReply[];
}

export interface CollaborationReply {
  id: string;
  commentId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: Date;
  mentions: string[];
}

export interface CollaborationAttachment {
  id: string;
  name: string;
  type: 'image' | 'document' | 'link';
  url: string;
  size?: number;
  uploadedBy: string;
  uploadedAt: Date;
}

export interface CollaborationNotification {
  id: string;
  type: 'comment_added' | 'comment_replied' | 'mention' | 'project_shared' | 'permission_changed' | 'member_joined' | 'member_left' | 'project_updated';
  projectId: string;
  projectName: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  message: string;
  data?: any; // Additional context data
  createdAt: Date;
  read: boolean;
  readAt?: Date;
  priority: 'low' | 'medium' | 'high';
  actionRequired: boolean;
  actionUrl?: string;
}

export interface ProjectCollaboration {
  projectId: string;
  teamMembers: TeamMember[];
  comments: CollaborationComment[];
  notifications: CollaborationNotification[];
  sharedAt: Date;
  lastActivity: Date;
  settings: CollaborationSettings;
}

export interface CollaborationSettings {
  allowComments: boolean;
  allowMentions: boolean;
  notifyOnMentions: boolean;
  notifyOnComments: boolean;
  notifyOnProjectUpdates: boolean;
  autoResolveComments: boolean;
  commentModeration: boolean;
}

class CollaborationManager {
  private collaborations: Map<string, ProjectCollaboration> = new Map();
  private teamMembers: Map<string, TeamMember> = new Map();

  /**
   * Initialize collaboration for a project
   */
  initializeProjectCollaboration(
    projectId: string, 
    ownerId: string, 
    ownerName: string,
    settings?: Partial<CollaborationSettings>
  ): ProjectCollaboration {
    const defaultSettings: CollaborationSettings = {
      allowComments: true,
      allowMentions: true,
      notifyOnMentions: true,
      notifyOnComments: true,
      notifyOnProjectUpdates: true,
      autoResolveComments: false,
      commentModeration: false,
    };

    const collaboration: ProjectCollaboration = {
      projectId,
      teamMembers: [{
        id: ownerId,
        name: ownerName,
        email: '',
        role: 'owner',
        status: 'online',
        lastActive: new Date(),
        permissions: {
          canEdit: true,
          canDelete: true,
          canInvite: true,
          canComment: true,
          canViewAnalytics: true,
        }
      }],
      comments: [],
      notifications: [],
      sharedAt: new Date(),
      lastActivity: new Date(),
      settings: { ...defaultSettings, ...settings },
    };

    this.collaborations.set(projectId, collaboration);
    console.log('[CollaborationManager] Initialized collaboration for project:', projectId);
    return collaboration;
  }

  /**
   * Add team member to project
   */
  addTeamMember(
    projectId: string,
    member: Omit<TeamMember, 'id' | 'lastActive' | 'status'>,
    invitedBy: string
  ): TeamMember {
    const collaboration = this.collaborations.get(projectId);
    if (!collaboration) {
      throw new Error('Project collaboration not initialized');
    }

    const newMember: TeamMember = {
      ...member,
      id: `member_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'offline',
      lastActive: new Date(),
    };

    collaboration.teamMembers.push(newMember);
    collaboration.lastActivity = new Date();

    // Add notification for member joining
    this.addNotification(projectId, {
      type: 'member_joined',
      projectId,
      projectName: collaboration.projectName || `Project ${projectId}`,
      fromUserId: invitedBy,
      fromUserName: 'System',
      toUserId: 'all',
      message: `${newMember.name} joined the project`,
      createdAt: new Date(),
      read: false,
      priority: 'medium',
      actionRequired: false,
    });

    console.log('[CollaborationManager] Added team member:', newMember);
    return newMember;
  }

  /**
   * Add comment to project
   */
  addComment(
    projectId: string,
    comment: Omit<CollaborationComment, 'id' | 'createdAt' | 'lastModified' | 'resolved' | 'replies'>
  ): CollaborationComment {
    const collaboration = this.collaborations.get(projectId);
    if (!collaboration) {
      throw new Error('Project collaboration not initialized');
    }

    const newComment: CollaborationComment = {
      ...comment,
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      lastModified: new Date(),
      resolved: false,
      replies: [],
    };

    collaboration.comments.push(newComment);
    collaboration.lastActivity = new Date();

    // Add notification for comment
    this.addNotification(projectId, {
      type: 'comment_added',
      projectId,
      projectName: collaboration.projectName || `Project ${projectId}`,
      fromUserId: comment.authorId,
      fromUserName: comment.authorName,
      toUserId: 'all',
      message: `${comment.authorName} added a comment`,
      createdAt: new Date(),
      read: false,
      priority: 'medium',
      actionRequired: false,
      actionUrl: `#comment-${newComment.id}`,
      data: { commentId: newComment.id, content: comment.content },
    });

    // Add mention notifications
    if (comment.mentions && comment.mentions.length > 0) {
      comment.mentions.forEach(mentionId => {
        this.addNotification(projectId, {
          type: 'mention',
          projectId,
          projectName: collaboration.projectName || `Project ${projectId}`,
          fromUserId: comment.authorId,
          fromUserName: comment.authorName,
          toUserId: mentionId,
          message: `${comment.authorName} mentioned you in a comment`,
          createdAt: new Date(),
          read: false,
          priority: 'high',
          actionRequired: true,
          actionUrl: `#comment-${newComment.id}`,
          data: { commentId: newComment.id, content: comment.content },
        });
      });
    }

    console.log('[CollaborationManager] Added comment:', newComment);
    return newComment;
  }

  /**
   * Reply to comment
   */
  addReply(
    projectId: string,
    commentId: string,
    reply: Omit<CollaborationReply, 'id' | 'createdAt'>
  ): CollaborationReply {
    const collaboration = this.collaborations.get(projectId);
    if (!collaboration) {
      throw new Error('Project collaboration not initialized');
    }

    const comment = collaboration.comments.find(c => c.id === commentId);
    if (!comment) {
      throw new Error('Comment not found');
    }

    const newReply: CollaborationReply = {
      ...reply,
      id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    comment.replies.push(newReply);
    comment.lastModified = new Date();
    collaboration.lastActivity = new Date();

    // Add notification for reply
    this.addNotification(projectId, {
      type: 'comment_replied',
      projectId,
      projectName: collaboration.projectName || `Project ${projectId}`,
      fromUserId: reply.authorId,
      fromUserName: reply.authorName,
      toUserId: comment.authorId,
      message: `${reply.authorName} replied to your comment`,
      createdAt: new Date(),
      read: false,
      priority: 'medium',
      actionRequired: false,
      actionUrl: `#comment-${commentId}`,
      data: { commentId, replyId: newReply.id, content: reply.content },
    });

    console.log('[CollaborationManager] Added reply:', newReply);
    return newReply;
  }

  /**
   * Share project with team member
   */
  shareProject(
    projectId: string,
    userId: string,
    role: TeamMember['role'],
    sharedBy: string
  ): void {
    const collaboration = this.collaborations.get(projectId);
    if (!collaboration) {
      throw new Error('Project collaboration not initialized');
    }

    // Add notification for project sharing
    this.addNotification(projectId, {
      type: 'project_shared',
      projectId,
      projectName: collaboration.projectName || `Project ${projectId}`,
      fromUserId: sharedBy,
      fromUserName: 'System',
      toUserId: userId,
      message: `Project has been shared with you (${role} access)`,
      createdAt: new Date(),
      read: false,
      priority: 'high',
      actionRequired: true,
      actionUrl: `/projects/${projectId}`,
      data: { role, sharedBy },
    });

    console.log('[CollaborationManager] Shared project:', { projectId, userId, role });
  }

  /**
   * Update project and notify team
   */
  notifyProjectUpdate(
    projectId: string,
    updateType: string,
    updatedBy: string,
    updateData?: any
  ): void {
    const collaboration = this.collaborations.get(projectId);
    if (!collaboration) {
      return;
    }

    if (!collaboration.settings.notifyOnProjectUpdates) {
      return;
    }

    this.addNotification(projectId, {
      type: 'project_updated',
      projectId,
      projectName: collaboration.projectName || `Project ${projectId}`,
      fromUserId: updatedBy,
      fromUserName: 'System',
      toUserId: 'all',
      message: `Project updated: ${updateType}`,
      createdAt: new Date(),
      read: false,
      priority: 'low',
      actionRequired: false,
      data: { updateType, updateData },
    });

    console.log('[CollaborationManager] Notified project update:', updateType);
  }

  /**
   * Get collaboration data for project
   */
  getProjectCollaboration(projectId: string): ProjectCollaboration | null {
    return this.collaborations.get(projectId) || null;
  }

  /**
   * Get notifications for user
   */
  getUserNotifications(userId: string): CollaborationNotification[] {
    const allNotifications: CollaborationNotification[] = [];
    
    for (const collaboration of this.collaborations.values()) {
      const userNotifications = collaboration.notifications.filter(
        n => n.toUserId === userId || n.toUserId === 'all'
      );
      allNotifications.push(...userNotifications);
    }

    return allNotifications.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Mark notification as read
   */
  markNotificationAsRead(notificationId: string, userId: string): void {
    for (const collaboration of this.collaborations.values()) {
      const notification = collaboration.notifications.find(n => n.id === notificationId);
      if (notification && (notification.toUserId === userId || notification.toUserId === 'all')) {
        notification.read = true;
        notification.readAt = new Date();
        console.log('[CollaborationManager] Marked notification as read:', notificationId);
        break;
      }
    }
  }

  /**
   * Get unread notification count for user
   */
  getUnreadNotificationCount(userId: string): number {
    const notifications = this.getUserNotifications(userId);
    return notifications.filter(n => !n.read).length;
  }

  /**
   * Add notification helper
   */
  private addNotification(projectId: string, notification: Omit<CollaborationNotification, 'id'>): void {
    const collaboration = this.collaborations.get(projectId);
    if (!collaboration) return;

    const newNotification: CollaborationNotification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    collaboration.notifications.push(newNotification);
  }

  /**
   * Update team member status
   */
  updateMemberStatus(userId: string, status: TeamMember['status']): void {
    for (const collaboration of this.collaborations.values()) {
      const member = collaboration.teamMembers.find(m => m.id === userId);
      if (member) {
        member.status = status;
        member.lastActive = new Date();
        break;
      }
    }
  }

  /**
   * Get online team members for project
   */
  getOnlineTeamMembers(projectId: string): TeamMember[] {
    const collaboration = this.collaborations.get(projectId);
    if (!collaboration) return [];

    return collaboration.teamMembers.filter(member => member.status === 'online');
  }

  /**
   * Resolve comment
   */
  resolveComment(projectId: string, commentId: string, resolvedBy: string): void {
    const collaboration = this.collaborations.get(projectId);
    if (!collaboration) return;

    const comment = collaboration.comments.find(c => c.id === commentId);
    if (comment) {
      comment.resolved = true;
      comment.resolvedAt = new Date();
      comment.resolvedBy = resolvedBy;
      collaboration.lastActivity = new Date();

      console.log('[CollaborationManager] Resolved comment:', commentId);
    }
  }
}

export const collaborationManager = new CollaborationManager();
