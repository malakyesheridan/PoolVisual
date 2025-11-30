import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOrgStore } from '@/stores/orgStore';

export default function SubscribeSuccess() {
  const [, navigate] = useLocation();
  const { setCurrentOrg } = useOrgStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Get session_id from URL query params
  const sessionId = new URLSearchParams(window.location.search).get('session_id');

  useEffect(() => {
    if (!sessionId) {
      setError('Missing session ID');
      setLoading(false);
      return;
    }

    // Verify session and refresh org data
    verifySession();
  }, [sessionId]);

  const verifySession = async () => {
    try {
      // Check if this is a placeholder session (no webhook needed)
      const isPlaceholder = sessionId?.startsWith('placeholder_');
      
      if (isPlaceholder) {
        // For placeholder plans, subscription is already activated
        // Just refresh org data immediately
        try {
          const orgResponse = await apiClient.getOrg();
          if (orgResponse.ok && orgResponse.org) {
            setCurrentOrg(orgResponse.org);
          }
        } catch (orgError) {
          console.warn('Failed to refresh org data:', orgError);
        }
        
        // Check subscription status
        const statusResponse = await apiClient.getSubscriptionStatus();
        if (statusResponse.ok && statusResponse.subscription?.status === 'active') {
          setLoading(false);
        } else {
          // Even if status check fails, assume success for placeholder
          setLoading(false);
        }
        return;
      }

      // For real Stripe sessions, wait for webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Refresh org data
      try {
        const orgResponse = await apiClient.getOrg();
        if (orgResponse.ok && orgResponse.org) {
          setCurrentOrg(orgResponse.org);
        }
      } catch (orgError) {
        console.warn('Failed to refresh org data:', orgError);
      }

      // Check subscription status
      const statusResponse = await apiClient.getSubscriptionStatus();
      if (statusResponse.ok && statusResponse.subscription?.status === 'active') {
        setLoading(false);
      } else {
        setError('Subscription not yet active. Please wait a moment and refresh.');
      }
    } catch (err: any) {
      console.error('Failed to verify session:', err);
      setError('Failed to verify subscription. Please contact support.');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-slate-600">Verifying your subscription...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Verification Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Retry
              </Button>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Subscription Activated!</CardTitle>
          <CardDescription>
            Your subscription is now active. You can start using all features.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-slate-50 p-4 rounded-lg">
            <p className="text-sm text-slate-600 mb-2">What's next?</p>
            <ul className="text-sm space-y-1 text-slate-700">
              <li>• Complete your onboarding</li>
              <li>• Upload your first photo</li>
              <li>• Start creating projects</li>
            </ul>
          </div>
          <Button
            className="w-full"
            onClick={() => navigate('/onboarding')}
          >
            Continue to Onboarding
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
