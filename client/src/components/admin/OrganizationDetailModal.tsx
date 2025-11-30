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
  Loader2, Building2, Users, CreditCard, DollarSign, Calendar, Mail, Phone, MapPin,
  ExternalLink, CheckCircle2, Clock, AlertTriangle, Settings
} from 'lucide-react';
import { useLocation } from 'wouter';

interface OrganizationDetailModalProps {
  orgId: string;
  open: boolean;
  onClose: () => void;
}

const formatCurrency = (num: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'AUD' }).format(num);
};

export function OrganizationDetailModal({ orgId, open, onClose }: OrganizationDetailModalProps) {
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'organization', orgId],
    queryFn: () => apiClient.getAdminOrganization(orgId),
    enabled: open && !!orgId,
  });

  if (!open) return null;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Loading Organization Details</DialogTitle>
            <DialogDescription>Please wait while we fetch the organization information.</DialogDescription>
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
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Error Loading Organization</DialogTitle>
            <DialogDescription>There was an error loading the organization details. Please try again.</DialogDescription>
          </DialogHeader>
          <div className="text-center text-red-600">
            <AlertTriangle className="h-8 w-8 mx-auto mb-4" />
            <p>Error loading organization details</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const { 
    organization, 
    subscriptionPlan, 
    subscriptionHistory, 
    members, 
    jobs, 
    quotes, 
    photos,
    materials,
    settings,
    usageStats,
    financialSummary 
  } = data;

  const getSubscriptionStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>;
      case 'trial':
        return <Badge className="bg-amber-100 text-amber-800"><Clock className="h-3 w-3 mr-1" />Trial</Badge>;
      case 'past_due':
        return <Badge className="bg-red-100 text-red-800"><AlertTriangle className="h-3 w-3 mr-1" />Past Due</Badge>;
      case 'canceled':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Canceled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Organization: {organization.name}
          </DialogTitle>
          <DialogDescription>
            Comprehensive organization information and activity
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {organization.contactEmail && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-slate-400" />
                      <span className="text-sm">{organization.contactEmail}</span>
                    </div>
                  )}
                  {organization.contactPhone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-slate-400" />
                      <span className="text-sm">{organization.contactPhone}</span>
                    </div>
                  )}
                  {organization.address && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      <span className="text-sm">{organization.address}</span>
                    </div>
                  )}
                  {organization.abn && (
                    <div className="text-sm text-slate-600">ABN: {organization.abn}</div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span className="text-sm">
                      Created {new Date(organization.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Organization Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    Industry: <Badge variant="outline">{organization.industry || 'N/A'}</Badge>
                  </div>
                  {organization.industryLocked && (
                    <Badge className="bg-slate-100 text-slate-800">Industry Locked</Badge>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Usage Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-slate-600">Total Jobs</div>
                    <div className="text-2xl font-bold">{usageStats.totalJobs}</div>
                    <div className="text-xs text-slate-500">{usageStats.jobsThisMonth} this month</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Total Quotes</div>
                    <div className="text-2xl font-bold">{usageStats.totalQuotes}</div>
                    <div className="text-xs text-slate-500">{usageStats.quotesThisMonth} this month</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Total Photos</div>
                    <div className="text-2xl font-bold">{usageStats.totalPhotos}</div>
                    <div className="text-xs text-slate-500">{usageStats.photosThisMonth} this month</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Materials</div>
                    <div className="text-2xl font-bold">{usageStats.totalMaterials}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Current Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">
                      {subscriptionPlan?.name || 'No Plan'}
                    </div>
                    {subscriptionPlan && (
                      <div className="text-sm text-slate-500">
                        Tier: {organization.subscriptionTier?.toUpperCase() || 'N/A'}
                      </div>
                    )}
                  </div>
                  {getSubscriptionStatusBadge(organization.subscriptionStatus || 'trial')}
                </div>
                
                {subscriptionPlan && (
                  <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                    <div>
                      <div className="text-sm text-slate-600">Monthly Price</div>
                      <div className="font-medium">
                        {subscriptionPlan.priceMonthly 
                          ? formatCurrency(Number(subscriptionPlan.priceMonthly))
                          : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-slate-600">Yearly Price</div>
                      <div className="font-medium">
                        {subscriptionPlan.priceYearly 
                          ? formatCurrency(Number(subscriptionPlan.priceYearly))
                          : 'N/A'}
                      </div>
                    </div>
                  </div>
                )}

                {organization.subscriptionStartedAt && (
                  <div className="text-sm text-slate-600">
                    Started: {new Date(organization.subscriptionStartedAt).toLocaleDateString()}
                  </div>
                )}
                {organization.subscriptionExpiresAt && (
                  <div className="text-sm text-slate-600">
                    Expires: {new Date(organization.subscriptionExpiresAt).toLocaleDateString()}
                  </div>
                )}
                {organization.subscriptionTrialEndsAt && (
                  <div className="text-sm text-amber-600">
                    Trial ends: {new Date(organization.subscriptionTrialEndsAt).toLocaleDateString()}
                  </div>
                )}
              </CardContent>
            </Card>

            {subscriptionHistory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Subscription History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {subscriptionHistory.map((event: any) => (
                      <div key={event.id} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div>
                          <div className="font-medium">{event.eventType}</div>
                          <div className="text-slate-500">{new Date(event.createdAt).toLocaleString()}</div>
                        </div>
                        {event.toStatus && (
                          <Badge variant="outline">{event.toStatus}</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Members ({members.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-slate-500">No members</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
                        onClick={() => {
                          onClose();
                          // Navigate to admin dashboard with users section and view param
                          navigate(`/admin?section=users&view=${member.userId}`);
                          // The AdminUsers component will handle opening the modal
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Users className="h-4 w-4 text-slate-400" />
                          <div>
                            <div className="font-medium">{member.user.username || member.user.email}</div>
                            <div className="text-sm text-slate-500">{member.user.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{member.role}</Badge>
                          <Button variant="ghost" size="sm">
                            View <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Jobs</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usageStats.totalJobs}</div>
                  <div className="text-sm text-slate-500">{usageStats.jobsThisMonth} this month</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Quotes</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{usageStats.totalQuotes}</div>
                  <div className="text-sm text-slate-500">{usageStats.quotesThisMonth} this month</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Photos</CardTitle>
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

            {quotes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Recent Quotes ({quotes.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {quotes.slice(0, 10).map((quote: any) => (
                      <div key={quote.id} className="flex items-center justify-between p-2 border rounded text-sm">
                        <div>
                          <div className="font-medium">{quote.name || 'Untitled Quote'}</div>
                          <div className="text-slate-500">
                            {formatCurrency(Number(quote.total || 0))} • {new Date(quote.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant="outline">{quote.status}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {materials.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Materials Library ({materials.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-slate-600">
                    {materials.length} materials available
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="financial" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-slate-600">Total Quote Value</div>
                    <div className="text-2xl font-bold">{formatCurrency(financialSummary.totalQuoteValue)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Average Quote Value</div>
                    <div className="text-2xl font-bold">{formatCurrency(financialSummary.avgQuoteValue)}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Quotes This Month</div>
                    <div className="text-2xl font-bold">{financialSummary.quotesThisMonth}</div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600">Quote Value This Month</div>
                    <div className="text-2xl font-bold">{formatCurrency(financialSummary.quoteValueThisMonth)}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            {settings && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Organization Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Currency:</span> {settings.currencyCode || 'AUD'}
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Tax Rate:</span> {Number(settings.taxRate || 0) * 100}%
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Default Deposit:</span> {Number(settings.depositDefaultPct || 0) * 100}%
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">Quote Validity:</span> {settings.validityDays || 30} days
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
