import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function Onboarding() {
  const [, navigate] = useLocation();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // CRITICAL FIX: Use refs to store ALL mutation results - no direct state updates
  const pendingUserUpdateRef = useRef<{ user: any; invalidateQueries: string[] } | null>(null);
  const pendingNavigationRef = useRef<string | null>(null);
  const pendingQueryUpdateRef = useRef<{ queryKey: string[]; invalidate?: boolean } | null>(null);
  const isProcessingUpdatesRef = useRef(false);

  // Update user industry mutation
  const updateUserIndustryMutation = useMutation({
    mutationFn: async (industry: string) => {
      // Update user's industryType
      await apiClient.updateUserProfile({ industryType: industry });
      // Refresh user data
      const updatedUser = await apiClient.getUserProfile();
      return updatedUser;
    },
    onSuccess: (updatedUser) => {
      if (updatedUser) {
        // Store in ref - will be processed in useLayoutEffect
        pendingUserUpdateRef.current = {
          user: updatedUser,
          invalidateQueries: ['/api/user/profile']
        };
        // Complete onboarding
        pendingQueryUpdateRef.current = {
          queryKey: ['/api/onboarding/status'],
          invalidate: true,
        };
        pendingNavigationRef.current = '/dashboard';
      }
    },
  });

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: () => apiClient.completeOnboarding(),
    onSuccess: () => {
      // Store in refs - will be processed in effects
      pendingQueryUpdateRef.current = {
        queryKey: ['/api/onboarding/status'],
        invalidate: true,
      };
    },
  });

  // CRITICAL FIX: Update store in useLayoutEffect (synchronous, before paint)
  useLayoutEffect(() => {
    if (pendingUserUpdateRef.current && !isProcessingUpdatesRef.current) {
      isProcessingUpdatesRef.current = true;
      const { user: updatedUser, invalidateQueries } = pendingUserUpdateRef.current;
      
      // Update store synchronously
      useAuthStore.getState().setUser(updatedUser);
      pendingUserUpdateRef.current = null;
      
      // Schedule query invalidations for next effect cycle
      if (invalidateQueries.length > 0) {
        pendingQueryUpdateRef.current = {
          queryKey: invalidateQueries,
          invalidate: true,
        };
      }
      
      isProcessingUpdatesRef.current = false;
    }
  });

  // CRITICAL FIX: Handle query updates in useEffect (asynchronous, after paint)
  useEffect(() => {
    if (pendingQueryUpdateRef.current && !isProcessingUpdatesRef.current) {
      isProcessingUpdatesRef.current = true;
      const { queryKey, invalidate } = pendingQueryUpdateRef.current;
      
      if (invalidate) {
        queryClient.invalidateQueries({ queryKey });
      }
      
      pendingQueryUpdateRef.current = null;
      isProcessingUpdatesRef.current = false;
    }
  }, [queryClient]);

  // CRITICAL FIX: Handle navigation in useEffect (asynchronous, after paint)
  useEffect(() => {
    if (pendingNavigationRef.current && !isProcessingUpdatesRef.current) {
      const path = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      navigate(path);
    }
  }, [navigate]);

  const industries = [
    { id: 'trades', label: 'Trades', icon: '🔧', description: 'Pool renovation, landscaping, construction, electrical, plumbing, and other trade services' },
    { id: 'real_estate', label: 'Real Estate', icon: '🏠', description: 'Real estate and property management' },
  ];

  const handleIndustrySelect = (industryId: string) => {
    setSelectedIndustry(industryId);
  };

  const handleConfirm = async () => {
    if (!selectedIndustry) return;
    
    setIsProcessing(true);
    setShowConfirmation(false);
    
    try {
      // Map 'trades' to 'pool' (default trade industry) and 'real_estate' to 'real_estate'
      const industryValue = selectedIndustry === 'real_estate' ? 'real_estate' : 'pool';
      
      // Update user industry
      await updateUserIndustryMutation.mutateAsync(industryValue);
      // Complete onboarding
      await completeOnboardingMutation.mutateAsync();
    } catch (error) {
      console.error('[Onboarding] Failed to save industry:', error);
      setIsProcessing(false);
    }
  };

  const handleShowConfirmation = () => {
    if (!selectedIndustry) return;
    setShowConfirmation(true);
  };

  const getIndustryLabel = (id: string) => {
    return industries.find(ind => ind.id === id)?.label || id;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl md:text-3xl">Welcome to EasyFlow Studio</CardTitle>
          <CardDescription className="text-base mt-2">
            Select your industry to get started. This selection determines which version of the app you'll use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Warning Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Important: Industry selection cannot be changed later
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Please choose carefully. This selection will determine the tools and features available to you.
              </p>
            </div>
          </div>

          {/* Industry Selection Grid - 2 Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 max-w-2xl mx-auto">
            {industries.map((industry) => (
              <button
                key={industry.id}
                onClick={() => handleIndustrySelect(industry.id)}
                disabled={isProcessing}
                className={`p-8 border-2 rounded-lg text-center transition-all ${
                  selectedIndustry === industry.id
                    ? 'border-primary bg-primary/5 ring-2 ring-primary ring-offset-2'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <div className="text-6xl mb-4">{industry.icon}</div>
                <div className="font-semibold text-xl mb-2">{industry.label}</div>
                <div className="text-sm text-muted-foreground">{industry.description}</div>
              </button>
            ))}
          </div>

          {/* Continue Button */}
          <div className="flex justify-center mt-8">
            <Button
              onClick={handleShowConfirmation}
              disabled={!selectedIndustry || isProcessing}
              size="lg"
              className="min-w-[200px]"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Continue'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Industry Selection</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You have selected: <strong>{getIndustryLabel(selectedIndustry || '')}</strong>
              </p>
              <p className="text-amber-600 font-medium">
                ⚠️ This selection cannot be changed later. Are you sure you want to proceed?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={isProcessing}
              className="bg-primary hover:bg-primary/90"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming...
                </>
              ) : (
                'Confirm & Continue'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
