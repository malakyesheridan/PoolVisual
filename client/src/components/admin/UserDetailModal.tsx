import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Loader2, User, Building2, Briefcase, FileText, Camera, 
  Shield, Clock, AlertCircle, CheckCircle2, XCircle, Mail,
  Phone, MapPin, Calendar, Activity, Key, UserCheck, UserX,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';

interface UserDetailModalProps {
  userId: string;
  open: boolean;
  onClose: () => void;
}

export function UserDetailModal({ userId, open, onClose }: UserDetailModalProps) {
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => apiClient.getAdminUser(userId),
    enabled: open && !!userId,
  });

  if (!open) return null;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading User Details</DialogTitle>
            <DialogDescription>Please wait while we fetch the user information.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isError || !data?.ok) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Error Loading User</DialogTitle>
            <DialogDescription>There was an error loading the user details. Please try again.</DialogDescription>
          </DialogHeader>
          <div className="text-center text-red-600">
            <AlertCircle className="h-8 w-8 mx-auto mb-4" />
            <p>Error loading user details</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { user, organizations, jobs, quotes, photos, onboarding, sessions, securityEvents, loginAttempts, usageStats } = data;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            User Profile: {user.username || user.email}
          </DialogTitle>
          <DialogDescription>
            Comprehensive user information and activity
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="organizations">Organizations</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="text-sm">{user.email}</span>
                  </div>
                  {user.displayName && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-slate-400" />
                      <span className="text-sm">{user.displayName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="text-sm">
                      Joined {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span className="text-sm">
                      Last login: {user.lastLoginAt 
                        ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                        : 'Never'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Account Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    {user.isActive ? (
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Inactive
                      </Badge>
                    )}
                  </div>
                  {user.isAdmin && (
                    <Badge className="bg-primary text-white">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                  )}
                  <div className="text-sm text-slate-600">
                    Login count: {user.loginCount || 0}
                  </div>
                  <div className="text-sm text-slate-600">
                    Email verified: {user.emailVerified ? 'Yes' : 'No'}
                  </div>
                </CardContent>
              </Card>
            </div>

            {onboarding && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Onboarding Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-slate-600">Current Step: {onboarding.step}</div>
                      <div className="text-sm text-slate-600">
                        Completed: {onboarding.completed ? 'Yes' : 'No'}
                      </div>
                    </div>
                    {onboarding.completed && (
                      <Badge className="bg-green-100 text-green-800">Completed</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="organizations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Organizations ({organizations.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {organizations.length === 0 ? (
                  <p className="text-sm text-slate-500">No organizations</p>
                ) : (
                  <div className="space-y-2">
                    {organizations.map((org: any) => (
                      <div
                        key={org.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          onClose();
                          // Navigate to admin dashboard with organizations section and view param
                          navigate(`/admin?section=organizations&view=${org.id}`);
                          // The AdminOrganizations component will handle opening the modal
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className="h-4 w-4 text-slate-400" />
                          <div>
                            <div className="font-medium">{org.name}</div>
                            <div className="text-sm text-slate-500">{org.industry || 'N/A'}</div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          View <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    Jobs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usageStats.totalJobs}</div>
                  <div className="text-sm text-slate-500">{usageStats.jobsThisMonth} this month</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Quotes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usageStats.totalQuotes}</div>
                  <div className="text-sm text-slate-500">{usageStats.quotesThisMonth} this month</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Photos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usageStats.totalPhotos}</div>
                  <div className="text-sm text-slate-500">{usageStats.photosThisMonth} this month</div>
                </CardContent>
              </Card>
            </div>

            {jobs.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Jobs ({jobs.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {jobs.slice(0, 10).map((job: any) => (
                      <div key={job.id} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div>
                          <div className="font-medium">{job.clientName || 'Untitled'}</div>
                          <div className="text-slate-500">{new Date(job.createdAt).toLocaleDateString()}</div>
                        </div>
                        <Badge variant="outline">{job.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active Sessions ({sessions.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {sessions.length === 0 ? (
                  <p className="text-sm text-slate-500">No active sessions</p>
                ) : (
                  <div className="space-y-2">
                    {sessions.map((session: any) => (
                      <div key={session.id} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div>
                          <div className="font-medium">{session.ipAddress || 'Unknown IP'}</div>
                          <div className="text-slate-500">
                            Last active: {formatDistanceToNow(new Date(session.lastActive), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Security Events ({securityEvents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {securityEvents.length === 0 ? (
                  <p className="text-sm text-slate-500">No security events</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {securityEvents.map((event: any) => (
                      <div key={event.id} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div>
                          <div className="font-medium">{event.eventType}</div>
                          <div className="text-slate-500">{new Date(event.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent Login Attempts ({loginAttempts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {loginAttempts.length === 0 ? (
                  <p className="text-sm text-slate-500">No login attempts</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {loginAttempts.map((attempt: any) => (
                      <div key={attempt.id} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            {attempt.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className="font-medium">{attempt.success ? 'Success' : 'Failed'}</span>
                          </div>
                          <div className="text-slate-500">{new Date(attempt.createdAt).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Usage Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-600">Total Jobs</div>
                    <div className="text-2xl font-bold">{usageStats.totalJobs}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Jobs This Month</div>
                    <div className="text-2xl font-bold">{usageStats.jobsThisMonth}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Total Quotes</div>
                    <div className="text-2xl font-bold">{usageStats.totalQuotes}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Quotes This Month</div>
                    <div className="text-2xl font-bold">{usageStats.quotesThisMonth}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Total Photos</div>
                    <div className="text-2xl font-bold">{usageStats.totalPhotos}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Photos This Month</div>
                    <div className="text-2xl font-bold">{usageStats.photosThisMonth}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
