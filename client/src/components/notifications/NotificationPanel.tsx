/**
 * Notification Panel
 * Displays real-time status updates and notifications
 */

import React, { useEffect, useState } from 'react';
import { useStatusSyncStore } from '../../stores/statusSyncStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Bell, 
  BellOff, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  AlertTriangle,
  Settings,
  Volume2,
  VolumeX,
  RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface NotificationPanelProps {
  className?: string;
}

export function NotificationPanel({ className = '' }: NotificationPanelProps) {
  const { 
    notifications, 
    settings, 
    isOnline,
    removeNotification, 
    clearNotifications, 
    updateSettings,
    markAsRead,
    checkForUpdates
  } = useStatusSyncStore();
  
  const [showSettings, setShowSettings] = useState(false);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);

  // Auto-check for updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline) {
        checkForUpdates();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isOnline, checkForUpdates]);

  const handleCheckUpdates = async () => {
    setIsCheckingUpdates(true);
    try {
      await checkForUpdates();
    } finally {
      setIsCheckingUpdates(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return 'border-green-200 bg-green-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'error': return 'border-red-200 bg-red-50';
      default: return 'border-blue-200 bg-blue-50';
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCheckUpdates}
            disabled={isCheckingUpdates || !isOnline}
            className="h-6 px-2"
          >
            <RefreshCw className={`w-3 h-3 ${isCheckingUpdates ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            className="h-6 px-2"
          >
            <Settings className="w-3 h-3" />
          </Button>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearNotifications}
              className="h-6 px-2"
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <h4 className="text-xs font-medium text-gray-700 mb-2">Notification Settings</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Enable Notifications</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateSettings({ enabled: !settings.enabled })}
                className="h-6 px-2"
              >
                {settings.enabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Browser Notifications</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateSettings({ showBrowser: !settings.showBrowser })}
                className="h-6 px-2"
              >
                {settings.showBrowser ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">Sound</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
                className="h-6 px-2"
              >
                {settings.soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status */}
      <div className="mb-3">
        <div className={`flex items-center gap-2 text-xs ${
          isOnline ? 'text-green-600' : 'text-red-600'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-green-500' : 'bg-red-500'
          }`} />
          {isOnline ? 'Connected' : 'Offline'}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-center text-gray-500 py-6">
            <Bell className="w-6 h-6 mx-auto mb-2 text-gray-300" />
            <p className="text-xs">No notifications</p>
            <p className="text-xs text-gray-400 mt-1">
              Status updates will appear here
            </p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-3 rounded-lg border text-xs ${getSeverityColor(notification.severity)} ${
                notification.read ? 'opacity-60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1">
                  {getSeverityIcon(notification.severity)}
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">
                      {notification.message}
                    </p>
                    <p className="text-gray-500 mt-1">
                      {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                    </p>
                    {notification.data && (
                      <div className="mt-1 text-gray-600">
                        {Object.entries(notification.data).map(([key, value]) => (
                          <span key={key} className="mr-2">
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!notification.read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => markAsRead(notification.id)}
                      className="h-4 px-1"
                    >
                      <CheckCircle className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeNotification(notification.id)}
                    className="h-4 px-1"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="mt-3 pt-2 border-t text-xs text-gray-400 text-center">
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
