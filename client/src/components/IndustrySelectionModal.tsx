import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

const industries = [
  { id: 'pool', label: 'Pool Renovation', icon: '🏊', description: 'Pool builders and renovators' },
  { id: 'landscaping', label: 'Landscaping', icon: '🌳', description: 'Landscape designers and contractors' },
  { id: 'building', label: 'Building & Construction', icon: '🏗️', description: 'General contractors and builders' },
  { id: 'electrical', label: 'Electrical', icon: '⚡', description: 'Electricians and electrical contractors' },
  { id: 'plumbing', label: 'Plumbing', icon: '🔧', description: 'Plumbers and plumbing contractors' },
  { id: 'real_estate', label: 'Real Estate', icon: '🏠', description: 'Real estate agents and property managers' },
  { id: 'other', label: 'Other', icon: '📋', description: 'Other trades and industries' },
];

const STORAGE_KEY = 'industry_selection_completed';

export function IndustrySelectionModal() {
  const { user, setUser } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Check if industry is missing and modal hasn't been shown
  useEffect(() => {
    if (!user) return;
    
    // If user already has industry, don't show
    if (user.industryType) {
      // Clear localStorage flag if industry is set
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    // Check if we've already shown this modal (localStorage fallback)
    const hasShown = localStorage.getItem(STORAGE_KEY);
    if (hasShown === 'true') {
      return;
    }

    // Show modal if industry is missing
    setIsOpen(true);
  }, [user]);

  const updateIndustryMutation = useMutation({
    mutationFn: async (industry: string) => {
      // Update user profile with industry
      const updatedUser = await apiClient.updateUserProfile({ industryType: industry });
      
      // Also store in localStorage as backup
      localStorage.setItem('user_industry', industry);
      localStorage.setItem(STORAGE_KEY, 'true');
      
      return { updatedUser, industry };
    },
    onSuccess: async ({ updatedUser, industry }) => {
      // Refresh user profile to get latest data
      try {
        const freshUser = await apiClient.getUserProfile();
        setUser(freshUser);
      } catch (error) {
        // If refresh fails, use the updated user from the response
        setUser(updatedUser);
      }
      
      // Invalidate user-related queries
      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/status'] });
      
      // Close modal
      setIsOpen(false);
      
      toast({
        title: 'Industry selected',
        description: `Your industry has been set to ${industries.find(i => i.id === industry)?.label || industry}.`,
      });
    },
    onError: (error: any) => {
      console.error('[IndustrySelectionModal] Failed to update industry:', error);
      
      // Even if API fails, store in localStorage as fallback
      if (selectedIndustry) {
        localStorage.setItem('user_industry', selectedIndustry);
        localStorage.setItem(STORAGE_KEY, 'true');
        
        // Update local user state with localStorage value
        setUser({ ...user!, industryType: selectedIndustry });
        
        toast({
          title: 'Industry saved locally',
          description: 'Your industry selection has been saved. We\'ll sync it with your account when possible.',
          variant: 'default',
        });
        
        setIsOpen(false);
      } else {
        toast({
          title: 'Error',
          description: error?.message || 'Failed to save industry selection. Please try again.',
          variant: 'destructive',
        });
      }
    },
  });

  const handleSelect = (industry: string) => {
    setSelectedIndustry(industry);
  };

  const handleContinue = () => {
    if (!selectedIndustry) return;
    updateIndustryMutation.mutate(selectedIndustry);
  };

  // Don't render if user has industry or modal shouldn't be shown
  if (!user || user.industryType || !isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-2xl">Select Your Industry</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Choose your primary industry to customize your experience. This helps us show you the right features and terminology.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {industries.map((industry) => (
              <Button
                key={industry.id}
                variant={selectedIndustry === industry.id ? 'default' : 'outline'}
                className={`h-auto py-4 px-4 flex flex-col items-center justify-center gap-2 transition-all ${
                  selectedIndustry === industry.id 
                    ? 'ring-2 ring-primary ring-offset-2' 
                    : 'hover:bg-slate-50'
                }`}
                onClick={() => handleSelect(industry.id)}
                disabled={updateIndustryMutation.isPending}
              >
                <span className="text-3xl">{industry.icon}</span>
                <span className="font-medium text-sm">{industry.label}</span>
                <span className="text-xs text-slate-500 mt-1">{industry.description}</span>
              </Button>
            ))}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button
            onClick={handleContinue}
            disabled={!selectedIndustry || updateIndustryMutation.isPending}
            size="lg"
            className="min-w-[120px]"
          >
            {updateIndustryMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Saving...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

