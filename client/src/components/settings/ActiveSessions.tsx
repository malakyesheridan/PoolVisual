import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Tablet, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface UserSession {
  id: string;
  sessionId: string;
  deviceInfo?: {
    deviceType?: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    browser?: string;
    os?: string;
    isMobile?: boolean;
  };
  ipAddress?: string;
  userAgent?: string;
  lastActive: string | Date;
  createdAt: string | Date;
}

function getDeviceIcon(deviceType?: string) {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className="w-4 h-4" />;
    case 'tablet':
      return <Tablet className="w-4 h-4" />;
    case 'desktop':
      return <Monitor className="w-4 h-4" />;
    default:
      return <Monitor className="w-4 h-4" />;
  }
}

function formatDeviceInfo(session: UserSession): string {
  const { deviceInfo } = session;
  if (!deviceInfo) {
    return 'Unknown Device';
  }
  
  const parts: string[] = [];
  if (deviceInfo.browser) parts.push(deviceInfo.browser);
  if (deviceInfo.os) parts.push(deviceInfo.os);
  if (deviceInfo.deviceType && deviceInfo.deviceType !== 'unknown') {
    parts.push(deviceInfo.deviceType);
  }
  
  return parts.length > 0 ? parts.join(' • ') : 'Unknown Device';
}

export function ActiveSessions() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);

  const { data: sessions, isLoading, error } = useQuery({
    queryKey: ['/api/user/sessions'],
    queryFn: () => apiClient.getUserSessions(),
    staleTime: 30 * 1000, // 30 seconds
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (sessionId: string) => apiClient.revokeSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/sessions'] });
      toast({
        title: "Session revoked",
        description: "The session has been successfully revoked.",
      });
      setRevokingSessionId(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error revoking session",
        description: error.message || "Failed to revoke session.",
        variant: "destructive",
      });
      setRevokingSessionId(null);
    },
  });

  const revokeAllMutation = useMutation({
    mutationFn: () => apiClient.revokeAllOtherSessions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/sessions'] });
      toast({
        title: "Sessions revoked",
        description: "All other sessions have been successfully revoked.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error revoking sessions",
        description: error.message || "Failed to revoke sessions.",
        variant: "destructive",
      });
    },
  });

  const handleRevoke = (sessionId: string) => {
    setRevokingSessionId(sessionId);
    revokeSessionMutation.mutate(sessionId);
  };

  const handleRevokeAll = () => {
    if (window.confirm('Are you sure you want to revoke all other sessions? You will remain logged in on this device.')) {
      revokeAllMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/4"></div>
            <div className="h-20 bg-slate-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-2">Failed to load sessions</p>
            <p className="text-sm text-slate-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentSessionId = (sessions?.[0]?.sessionId); // Assume first is current (most recent)
  const otherSessions = sessions?.filter(s => s.sessionId !== currentSessionId) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Sessions</CardTitle>
        <CardDescription>
          Manage your active sessions across different devices. Revoke any session you don't recognize.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessions && sessions.length > 0 ? (
          <>
            {/* Current Session */}
            {sessions[0] && (
              <div className="border rounded-lg p-4 bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">
                      {getDeviceIcon(sessions[0].deviceInfo?.deviceType)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">{formatDeviceInfo(sessions[0])}</p>
                        <Badge variant="default" className="text-xs">Current Session</Badge>
                      </div>
                      <p className="text-sm text-slate-600">
                        {sessions[0].ipAddress && `IP: ${sessions[0].ipAddress} • `}
                        Last active {formatDistanceToNow(new Date(sessions[0].lastActive), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Other Sessions */}
            {otherSessions.length > 0 && (
              <>
                <div className="flex items-center justify-between mt-6 mb-4">
                  <h3 className="font-medium">Other Sessions</h3>
                  <Button
                    onClick={handleRevokeAll}
                    variant="outline"
                    size="sm"
                    disabled={revokeAllMutation.isPending}
                  >
                    {revokeAllMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Revoking...
                      </>
                    ) : (
                      'Revoke All'
                    )}
                  </Button>
                </div>
                <div className="space-y-3">
                  {otherSessions.map((session) => (
                    <div key={session.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-1">
                            {getDeviceIcon(session.deviceInfo?.deviceType)}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium mb-1">{formatDeviceInfo(session)}</p>
                            <p className="text-sm text-slate-600">
                              {session.ipAddress && `IP: ${session.ipAddress} • `}
                              Last active {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={() => handleRevoke(session.sessionId)}
                          variant="ghost"
                          size="sm"
                          disabled={revokingSessionId === session.sessionId}
                        >
                          {revokingSessionId === session.sessionId ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {otherSessions.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">
                No other active sessions
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">
            No active sessions found
          </p>
        )}
      </CardContent>
    </Card>
  );
}

