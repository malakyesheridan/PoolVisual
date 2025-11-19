// client/src/components/presence/PresenceIndicator.tsx
import React, { useState, useEffect } from 'react';
import { AlertTriangle, Users, WifiOff, Loader2 } from 'lucide-react';
import { lockManager } from '../../services/presence/lockManager';

interface PresenceIndicatorProps {
  users: Array<{ userId: string; userName: string; avatarUrl?: string }>;
  currentUser?: { userId: string; userName: string };
  isLocked: boolean;
  lockedBy?: string;
  lockExpiresAt?: number;
  connectionState: 'connecting' | 'degraded' | 'online' | 'offline';
}

export function PresenceIndicator({
  users,
  currentUser,
  isLocked,
  lockedBy,
  lockExpiresAt,
  connectionState,
}: PresenceIndicatorProps) {
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null);
  
  useEffect(() => {
    if (!lockExpiresAt) {
      setTimeUntilExpiry(null);
      return;
    }
    
    const updateExpiry = () => {
      const remaining = Math.max(0, Math.floor((lockExpiresAt - Date.now()) / 1000));
      setTimeUntilExpiry(remaining);
    };
    
    updateExpiry();
    const interval = setInterval(updateExpiry, 1000);
    
    return () => clearInterval(interval);
  }, [lockExpiresAt]);
  
  const otherUsers = users.filter(u => u.userId !== currentUser?.userId);
  
  return (
    <div className="presence-indicator flex items-center gap-2 text-sm bg-[var(--surface-panel)]/90 backdrop-blur-sm px-3 py-1.5 rounded-[var(--radius-md)] shadow-[var(--elevation-md)] border border-[var(--border-default)]">
      {/* Connection state - Always visible */}
      <div className={`presence-connection presence-${connectionState} flex items-center gap-1.5`}>
        {connectionState === 'connecting' && <Loader2 className="w-4 h-4 animate-spin text-[var(--primary-default)]" />}
        {connectionState === 'degraded' && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
        {connectionState === 'offline' && <WifiOff className="w-4 h-4 text-red-500" />}
        {connectionState === 'online' && (
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
        <span className="text-xs font-medium">
          {connectionState === 'connecting' && 'Connecting...'}
          {connectionState === 'degraded' && 'Connection degraded'}
          {connectionState === 'offline' && 'Offline'}
          {connectionState === 'online' && 'Online'}
        </span>
      </div>
      
      {/* Lock status with expiry */}
      {isLocked && lockedBy && (
        <div className="presence-lock-warning flex items-center gap-2 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded-[var(--radius-sm)]" role="alert">
          <AlertTriangle className="w-4 h-4 text-yellow-600" />
          <span className="text-xs text-yellow-800">
            Locked by {users.find(u => u.userId === lockedBy)?.userName || 'Someone'}
          </span>
          {timeUntilExpiry !== null && timeUntilExpiry > 0 && (
            <span className="text-xs text-yellow-600">
              (expires in {timeUntilExpiry}s)
            </span>
          )}
        </div>
      )}
      
      {/* Other users */}
      {otherUsers.length > 0 && (
        <div className="presence-users flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <span className="text-xs text-gray-600">
            {otherUsers.length} other{otherUsers.length !== 1 ? 's' : ''} editing
          </span>
          <div className="presence-avatars flex -space-x-2">
            {otherUsers.slice(0, 3).map(user => (
              <img
                key={user.userId}
                src={user.avatarUrl || '/default-avatar.png'}
                alt={user.userName}
                title={user.userName}
                className="w-6 h-6 rounded-full border-2 border-white"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

