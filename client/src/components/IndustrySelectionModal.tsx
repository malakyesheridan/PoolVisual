import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export function IndustrySelectionModal() {
  // CRITICAL FIX: Use selector to subscribe only to user, not entire store
  // This prevents unnecessary re-renders when other parts of store update
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // CRITICAL FIX: Delay mount until after initial render to decouple from other components
  // This ensures modal doesn't render during the same render cycle as Onboarding
  useLayoutEffect(() => {
    setIsMounted(true);
  }, []);

  // CRITICAL FIX: Use refs to store ALL mutation results - no direct state updates
  // All updates will be processed in effects AFTER render completes
  const pendingUserUpdateRef = useRef<any>(null);
  const pendingNavigationRef = useRef<string | null>(null);
  const pendingModalCloseRef = useRef(false);
  const pendingToastRef = useRef<{ title: string; description: string; variant?: 'default' | 'destructive' } | null>(null);
  const isProcessingUpdatesRef = useRef(false);

  // Check if industry is missing (only after mount delay)
  useEffect(() => {
    if (!isMounted || !user) return;
    
    // If user already has industry, don't show
    if (user.industryType) {
      setIsOpen(false);
      return;
    }

    // Show modal if industry is missing (non-dismissible)
    setIsOpen(true);
  }, [user, isMounted]);

  // CRITICAL FIX: Update store in useLayoutEffect (synchronous, before paint)
  // This ensures store updates happen after render but before browser paint
  useLayoutEffect(() => {
    if (pendingUserUpdateRef.current && !isProcessingUpdatesRef.current) {
      isProcessingUpdatesRef.current = true;
      const updatedUser = pendingUserUpdateRef.current;
      
      // Update store synchronously
      setUser(updatedUser);
      pendingUserUpdateRef.current = null;
      
      isProcessingUpdatesRef.current = false;
    }
  }, [setUser]);

  // CRITICAL FIX: Handle navigation and UI updates in useEffect (asynchronous, after paint)
  // This prevents UI updates from triggering re-renders during render phase
  useEffect(() => {
    if (isProcessingUpdatesRef.current) return;
    
    if (pendingNavigationRef.current) {
      const path = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      setLocation(path);
    }
    
    if (pendingModalCloseRef.current) {
      setIsOpen(false);
      pendingModalCloseRef.current = false;
    }
    
    if (pendingToastRef.current) {
      toast(pendingToastRef.current);
      pendingToastRef.current = null;
    }
  }, [setLocation, toast]);

  const updateIndustryMutation = useMutation({
    mutationFn: async (industryValue: string) => {
      // API call only - no localStorage fallback
      const updatedUser = await apiClient.updateUserProfile({ industryType: industryValue });
      return updatedUser;
    },
    onSuccess: (updatedUser) => {
      // CRITICAL FIX: Store results in refs, update in useLayoutEffect/useEffect
      pendingUserUpdateRef.current = updatedUser;
      pendingModalCloseRef.current = true;
      pendingNavigationRef.current = '/dashboard';
      pendingToastRef.current = {
        title: 'Industry selected',
        description: 'Your industry preference has been saved.',
      };
    },
    onError: (error: any) => {
      console.error('[IndustrySelectionModal] Failed to update industry:', error);
      // CRITICAL FIX: Store error toast in ref, process in useEffect
      pendingToastRef.current = {
        title: 'Error',
        description: error.message || 'Failed to save industry selection. Please try again.',
        variant: 'destructive',
      };
    },
  });

  const handleSelect = (industry: 'trades' | 'real_estate') => {
    setSelectedIndustry(industry);
    // Map 'trades' to 'pool' (default trade industry) and 'real_estate' to 'real_estate'
    const industryValue = industry === 'real_estate' ? 'real_estate' : 'pool';
    updateIndustryMutation.mutate(industryValue);
  };

  // CRITICAL FIX: Don't render until mount delay completes
  if (!isMounted) {
    return null;
  }

  // Don't render if user has industry or modal shouldn't be shown
  if (!user || user.industryType || !isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Prevent closing without selection - this modal is mandatory
      if (!open && !user?.industryType) {
        return; // Block closing
      }
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Select Your Industry</DialogTitle>
          <DialogDescription className="text-center mt-2">
            Please select your industry to continue. This cannot be skipped.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-6">
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant={selectedIndustry === 'trades' ? 'default' : 'outline'}
              className={`h-32 flex flex-col items-center justify-center gap-3 transition-all ${
                selectedIndustry === 'trades' 
                  ? 'ring-2 ring-primary ring-offset-2' 
                  : 'hover:bg-slate-50'
              }`}
              onClick={() => handleSelect('trades')}
              disabled={updateIndustryMutation.isPending}
            >
              <span className="text-4xl">🔧</span>
              <span className="font-semibold text-lg">Trades</span>
            </Button>
            
            <Button
              variant={selectedIndustry === 'real_estate' ? 'default' : 'outline'}
              className={`h-32 flex flex-col items-center justify-center gap-3 transition-all ${
                selectedIndustry === 'real_estate' 
                  ? 'ring-2 ring-primary ring-offset-2' 
                  : 'hover:bg-slate-50'
              }`}
              onClick={() => handleSelect('real_estate')}
              disabled={updateIndustryMutation.isPending}
            >
              <span className="text-4xl">🏠</span>
              <span className="font-semibold text-lg">Real Estate</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
