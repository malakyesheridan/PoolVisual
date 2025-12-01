import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { useMutation } from '@tanstack/react-query';

const STORAGE_KEY = 'industry_selection_completed';

export function IndustrySelectionModal() {
  const { user, setUser } = useAuthStore();
  const [, setLocation] = useLocation();
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Check if industry is missing and modal hasn't been shown
  useEffect(() => {
    if (!user) return;
    
    // If user already has industry, don't show
    if (user.industryType) {
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
    mutationFn: async (industryValue: 'real_estate' | null) => {
      try {
        const updatedUser = await apiClient.updateUserProfile({ industryType: industryValue });
        localStorage.setItem('user_industry', industryValue || '');
        localStorage.setItem(STORAGE_KEY, 'true');
        return updatedUser;
      } catch (error) {
        // Fallback to localStorage if API fails
        localStorage.setItem('user_industry', industryValue || '');
        localStorage.setItem(STORAGE_KEY, 'true');
        return { ...user!, industryType: industryValue };
      }
    },
    onSuccess: (updatedUser) => {
      // Update user state
      setUser(updatedUser);
      
      // Close modal and redirect to dashboard
      setIsOpen(false);
      setLocation('/dashboard');
    },
    onError: (error: any) => {
      console.error('[IndustrySelectionModal] Failed to update industry:', error);
      
      // Even if API fails, store in localStorage and update local state
      if (selectedIndustry) {
        const industryValue = selectedIndustry === 'real_estate' ? 'real_estate' : null;
        localStorage.setItem('user_industry', industryValue || '');
        localStorage.setItem(STORAGE_KEY, 'true');
        setUser({ ...user!, industryType: industryValue });
        setIsOpen(false);
        setLocation('/dashboard');
      }
    },
  });

  const handleSelect = (industry: 'trades' | 'real_estate') => {
    setSelectedIndustry(industry);
    // Auto-save on selection - convert to database value
    const industryValue = industry === 'real_estate' ? 'real_estate' : null;
    updateIndustryMutation.mutate(industryValue);
  };

  // Don't render if user has industry or modal shouldn't be shown
  if (!user || user.industryType || !isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Select Your Industry</DialogTitle>
          <DialogDescription className="text-center mt-2">
            Choose your industry to get started
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

