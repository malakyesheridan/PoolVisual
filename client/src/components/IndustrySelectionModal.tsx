import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

export function IndustrySelectionModal() {
  const { user, setUser } = useAuthStore();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Check if industry is missing
  useEffect(() => {
    if (!user) return;
    
    // If user already has industry, don't show
    if (user.industryType) {
      return;
    }

    // Show modal if industry is missing (non-dismissible)
    setIsOpen(true);
  }, [user]);

  const updateIndustryMutation = useMutation({
    mutationFn: async (industryValue: string) => {
      // API call only - no localStorage fallback
      const updatedUser = await apiClient.updateUserProfile({ industryType: industryValue });
      return updatedUser;
    },
    onSuccess: (updatedUser) => {
      // CRITICAL FIX: Defer state update to prevent "Cannot update component while rendering" error
      // This ensures the update happens after the current render cycle completes
      setTimeout(() => {
        setUser(updatedUser);
        
        // Close modal and redirect to dashboard
        setIsOpen(false);
        setLocation('/dashboard');
        toast({
          title: 'Industry selected',
          description: 'Your industry preference has been saved.',
        });
      }, 0);
    },
    onError: (error: any) => {
      console.error('[IndustrySelectionModal] Failed to update industry:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save industry selection. Please try again.',
        variant: 'destructive',
      });
      // Don't allow user to proceed if API fails
    },
  });

  const handleSelect = (industry: 'trades' | 'real_estate') => {
    setSelectedIndustry(industry);
    // Map 'trades' to 'pool' (default trade industry) and 'real_estate' to 'real_estate'
    const industryValue = industry === 'real_estate' ? 'real_estate' : 'pool';
    updateIndustryMutation.mutate(industryValue);
  };

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

