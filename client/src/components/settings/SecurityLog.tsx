import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Shield, Lock, Mail, LogIn, LogOut } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { formatDistanceToNow } from 'date-fns';

interface SecurityEvent {
  id: string;
  eventType: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
  createdAt: string | Date;
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case 'login_success':
      return <LogIn className="w-4 h-4 text-green-600" />;
    case 'login_failed':
      return <LogIn className="w-4 h-4 text-red-600" />;
    case 'logout':
      return <LogOut className="w-4 h-4 text-slate-600" />;
    case 'password_changed':
      return <Lock className="w-4 h-4 text-blue-600" />;
    case 'email_verified':
      return <Mail className="w-4 h-4 text-green-600" />;
    default:
      return <Shield className="w-4 h-4 text-slate-600" />;
  }
}

function getEventBadgeVariant(eventType: string): "default" | "secondary" | "destructive" | "outline" {
  switch (eventType) {
    case 'login_success':
    case 'email_verified':
      return 'default';
    case 'login_failed':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function formatEventType(eventType: string): string {
  return eventType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function SecurityLog() {
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  const { data: events, isLoading, error } = useQuery({
    queryKey: ['/api/user/security-log', eventTypeFilter],
    queryFn: () => apiClient.getSecurityLog({
      limit: 50,
      eventType: eventTypeFilter === 'all' ? undefined : eventTypeFilter,
    }),
    staleTime: 60 * 1000, // 1 minute
  });

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
            <p className="text-red-600 mb-2">Failed to load security log</p>
            <p className="text-sm text-slate-500">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Security Log</CardTitle>
            <CardDescription>
              View your account's security events and activity history.
            </CardDescription>
          </div>
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              <SelectItem value="login_success">Login Success</SelectItem>
              <SelectItem value="login_failed">Login Failed</SelectItem>
              <SelectItem value="logout">Logout</SelectItem>
              <SelectItem value="password_changed">Password Changed</SelectItem>
              <SelectItem value="email_verified">Email Verified</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {events && events.length > 0 ? (
          <div className="space-y-3">
            {events.map((event: SecurityEvent) => (
              <div key={event.id} className="border rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {getEventIcon(event.eventType)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{formatEventType(event.eventType)}</p>
                      <Badge variant={getEventBadgeVariant(event.eventType)} className="text-xs">
                        {formatEventType(event.eventType)}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      {event.ipAddress && <p>IP: {event.ipAddress}</p>}
                      <p>
                        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 text-center py-8">
            No security events found
          </p>
        )}
      </CardContent>
    </Card>
  );
}

