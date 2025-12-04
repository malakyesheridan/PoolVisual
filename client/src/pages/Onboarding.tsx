import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, Sunset, Home as HomeIcon, Eraser, Info } from 'lucide-react';
import { getIndustryTerm, getIndustryQuestionOptions } from '@/lib/industry-terminology';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

type OnboardingStep = 'welcome' | 'industry_selection' | 'questionnaire' | 'preview' | 'upload' | 'material_demo' | 'enhancement_demo' | 'workspace_setup' | 'completed';

interface OnboardingResponses {
  industry?: string;
  role?: string;
  useCase?: string;
  experience?: string;
}

// Dynamic steps based on industry
const getOnboardingSteps = (industry: string | undefined): Array<{
  id: OnboardingStep;
  title: string;
  description: string;
}> => {
  const baseSteps = [
    { id: 'welcome' as const, title: 'Welcome', description: 'Get started with EasyFlow Studio' },
    { id: 'industry_selection' as const, title: 'Select Industry', description: 'Choose your primary trade' },
  ];

  // Industry should already be set from subscription, but allow override for admin
  if (industry === 'real_estate') {
    return [
      ...baseSteps,
      { id: 'questionnaire' as const, title: 'Tell Us About Yourself', description: 'Help us personalize your experience' },
      { id: 'preview' as const, title: 'Preview', description: 'See what you can do' },
      { id: 'upload' as const, title: 'Upload Your First Photo', description: 'Get hands-on experience' },
      { id: 'enhancement_demo' as const, title: 'Try Enhancement', description: 'Enhance your photo' },
      { id: 'workspace_setup' as const, title: 'Workspace Setup', description: 'Configure your workspace' },
    ];
  }

  // Trades flow (existing)
  return [
    ...baseSteps,
    { id: 'questionnaire' as const, title: 'Tell Us About Yourself', description: 'Help us personalize your experience' },
    { id: 'preview' as const, title: 'Preview', description: 'See what you can do' },
    { id: 'upload' as const, title: 'Upload Your First Photo', description: 'Get hands-on experience' },
    { id: 'material_demo' as const, title: 'Explore Materials', description: 'See how materials work' },
    { id: 'workspace_setup' as const, title: 'Workspace Setup', description: 'Configure your workspace' },
  ];
};

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  // Use refs to prevent race conditions with server state
  const isInitialized = useRef(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<OnboardingResponses>({});
  const [isNavigating, setIsNavigating] = useState(false);

  // Use user industry if available, otherwise onboarding industry (user-centric)
  const effectiveIndustry = user?.industryType || responses.industry || 'pool';
  // CRITICAL FIX: Memoize steps to prevent infinite loop in useEffect
  const steps = useMemo(() => getOnboardingSteps(effectiveIndustry), [effectiveIndustry]);
  const currentStep = steps[currentStepIndex]?.id || 'welcome';

  // Fetch onboarding status
  const { data: onboarding, isLoading } = useQuery({
    queryKey: ['/api/onboarding/status'],
    queryFn: () => apiClient.getOnboardingStatus(),
    enabled: !!user,
    retry: false,
    staleTime: 5000, // Don't refetch too often
  });

  // Update onboarding mutation (debounced for responses, immediate for step changes)
  // CRITICAL FIX: Store result in ref, update in useLayoutEffect
  const updateOnboardingMutation = useMutation({
    mutationFn: (data: { step: string; responses?: any }) => apiClient.updateOnboarding(data),
    // Don't invalidate on every update - only on step changes
    onSuccess: (data, variables) => {
      // Get current step from query data to avoid stale closure
      const currentOnboarding = queryClient.getQueryData<any>(['/api/onboarding/status']);
      const currentStepFromData = currentOnboarding?.step || 'welcome';
      
      // Only update if step changed - store in ref for useLayoutEffect
      if (variables.step !== currentStepFromData) {
        pendingQueryUpdateRef.current = {
          queryKey: ['/api/onboarding/status'],
          data
        };
      }
    },
  });

  // CRITICAL FIX: Use refs to store mutation results and update in useLayoutEffect
  // This prevents state updates during render
  const pendingUserUpdateRef = useRef<{ user: any; invalidateQueries: string[] } | null>(null);
  const pendingNavigationRef = useRef<string | null>(null);
  const pendingQueryUpdateRef = useRef<{ queryKey: string[]; data?: any } | null>(null);

  // Update user industry mutation (user-centric)
  // CRITICAL FIX: Store result in ref, update in useLayoutEffect
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
        // Store result in ref - will be processed in useLayoutEffect
        pendingUserUpdateRef.current = {
          user: updatedUser,
          invalidateQueries: ['/api/user/profile']
        };
      }
    },
  });

  // CRITICAL FIX: Update store in useLayoutEffect to prevent render conflicts
  useLayoutEffect(() => {
    if (pendingUserUpdateRef.current) {
      const { user, invalidateQueries } = pendingUserUpdateRef.current;
      useAuthStore.getState().setUser(user);
      invalidateQueries.forEach(key => {
        queryClient.invalidateQueries({ queryKey: [key] });
      });
      pendingUserUpdateRef.current = null;
    }
  });

  // CRITICAL FIX: Handle navigation in useEffect (not in mutation callback)
  useEffect(() => {
    if (pendingNavigationRef.current) {
      const path = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      navigate(path);
    }
  }, [navigate]);

  // CRITICAL FIX: Handle query updates in useLayoutEffect
  useLayoutEffect(() => {
    if (pendingQueryUpdateRef.current) {
      const { queryKey, data } = pendingQueryUpdateRef.current;
      if (data) {
        queryClient.setQueryData(queryKey, data);
      } else {
        queryClient.invalidateQueries({ queryKey });
      }
      pendingQueryUpdateRef.current = null;
    }
  });

  // Complete onboarding mutation
  // CRITICAL FIX: Store navigation in ref, handle in useEffect
  const completeOnboardingMutation = useMutation({
    mutationFn: () => apiClient.completeOnboarding(),
    onSuccess: () => {
      // Store navigation and query invalidation in refs
      pendingQueryUpdateRef.current = {
        queryKey: ['/api/onboarding/status']
      };
      pendingNavigationRef.current = '/dashboard';
    },
  });

  // Initialize step from onboarding data (only once)
  useEffect(() => {
    if (onboarding && !isInitialized.current) {
      const serverStep = onboarding.step || 'welcome';
      const serverResponses = onboarding.responses || {};
      
      // Find step index in current steps array
      const stepIndex = steps.findIndex(s => s.id === serverStep);
      if (stepIndex >= 0) {
        setCurrentStepIndex(stepIndex);
      }
      
      setResponses(serverResponses);
      isInitialized.current = true;
    }
    // CRITICAL FIX: Only depend on onboarding, not steps (steps is memoized and stable)
  }, [onboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  // If onboarding is already completed, redirect to dashboard
  useEffect(() => {
    if (onboarding?.completed) {
      navigate('/dashboard');
    }
  }, [onboarding?.completed, navigate]);

  // Debounced response update
  // CRITICAL FIX: Use refs to avoid stale closures and prevent infinite loops
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const responsesRef = useRef(responses);
  const currentStepIndexRef = useRef(currentStepIndex);
  const stepsRef = useRef(steps);
  
  // Keep refs in sync
  useEffect(() => {
    responsesRef.current = responses;
    currentStepIndexRef.current = currentStepIndex;
    stepsRef.current = steps;
  }, [responses, currentStepIndex, steps]);
  
  const updateResponse = useCallback((key: keyof OnboardingResponses, value: string) => {
    const newResponses = { ...responsesRef.current, [key]: value };
    setResponses(newResponses);

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the API call
    debounceTimer.current = setTimeout(() => {
      updateOnboardingMutation.mutate({
        step: stepsRef.current[currentStepIndexRef.current]?.id || 'welcome',
        responses: newResponses,
      });
    }, 500); // 500ms debounce
  }, [updateOnboardingMutation]);

  // Update industry and save to user (user-centric)
  const handleIndustrySelect = useCallback(async (industry: string) => {
    setResponses(prev => ({ ...prev, industry }));
    
    // Update onboarding immediately - use refs to avoid stale closures
    await updateOnboardingMutation.mutateAsync({
      step: stepsRef.current[currentStepIndexRef.current]?.id || 'welcome',
      responses: { ...responsesRef.current, industry },
    });

    // Update user industryType (user-centric architecture)
    updateUserIndustryMutation.mutate(industry);
  }, [updateOnboardingMutation, updateUserIndustryMutation]);

  const handleNext = useCallback(async () => {
    if (isNavigating) return;
    setIsNavigating(true);

    try {
      if (currentStepIndex < steps.length - 1) {
        const nextStep = steps[currentStepIndex + 1];
        if (nextStep) {
          // Update local state immediately
          setCurrentStepIndex(currentStepIndex + 1);
          
          // Save to server
          await updateOnboardingMutation.mutateAsync({
            step: nextStep.id,
            responses,
          });
        }
      }
    } finally {
      setIsNavigating(false);
    }
  }, [currentStepIndex, steps, responses, isNavigating, updateOnboardingMutation]);

  const handleBack = useCallback(async () => {
    if (isNavigating) return;
    setIsNavigating(true);

    try {
      if (currentStepIndex > 0) {
        const prevStep = steps[currentStepIndex - 1];
        if (prevStep) {
          // Update local state immediately
          setCurrentStepIndex(currentStepIndex - 1);
          
          // Save to server
          await updateOnboardingMutation.mutateAsync({
            step: prevStep.id,
            responses,
          });
        }
      }
    } finally {
      setIsNavigating(false);
    }
  }, [currentStepIndex, steps, responses, isNavigating, updateOnboardingMutation]);

  const handleComplete = async () => {
    await completeOnboardingMutation.mutateAsync();
  };

  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4 pb-20 md:pb-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="text-xl md:text-2xl mobile-text-xl">Welcome to EasyFlow Studio</CardTitle>
            <CardDescription className="mobile-text-base">
              Let's get you set up in just a few steps
            </CardDescription>
          </div>
          <div className="mt-4">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground mt-2">
              Step {currentStepIndex + 1} of {steps.length}
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step Content */}
          <div className="min-h-[400px]">
            {currentStep === 'welcome' && (
              <WelcomeStep onNext={handleNext} />
            )}
            {currentStep === 'industry_selection' && (
              <IndustrySelectionStep
                selectedIndustry={effectiveIndustry}
                onSelect={handleIndustrySelect}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'questionnaire' && (
              <QuestionnaireStep
                industry={effectiveIndustry}
                responses={responses}
                onUpdate={updateResponse}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'preview' && (
              <PreviewStep
                industry={effectiveIndustry}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'upload' && (
              <UploadStep
                industry={effectiveIndustry}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'material_demo' && effectiveIndustry !== 'real_estate' && (
              <MaterialDemoStep
                industry={effectiveIndustry || 'pool'}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'enhancement_demo' && effectiveIndustry === 'real_estate' && (
              <EnhancementDemoStep
                industry={effectiveIndustry}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'workspace_setup' && (
              <WorkspaceSetupStep
                industry={effectiveIndustry}
                onComplete={handleComplete}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Step Components
function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="space-y-4 text-center">
      <h3 className="text-xl font-semibold">Welcome to EasyFlow Studio!</h3>
      <p className="text-muted-foreground">
        We're excited to help you streamline your workflow. This quick setup will take just a few minutes.
      </p>
      <div className="mt-8">
        <Button onClick={onNext} size="lg">
          Get Started
        </Button>
      </div>
    </div>
  );
}

function IndustrySelectionStep({
  selectedIndustry,
  onSelect,
  onNext,
  onBack,
  disabled,
  industryLocked,
}: {
  selectedIndustry?: string | undefined;
  onSelect: (industry: string) => void | Promise<void>;
  onNext: () => void | Promise<void>;
  onBack: () => void | Promise<void>;
  disabled?: boolean;
  industryLocked?: boolean; // Deprecated, kept for backward compatibility
}) {
  // Industry is no longer locked (user-centric architecture)
  // Users can change their industry at any time

  const industries = [
    { id: 'pool', label: 'Pool Renovation', icon: '🏊' },
    { id: 'landscaping', label: 'Landscaping', icon: '🌳' },
    { id: 'building', label: 'Building & Construction', icon: '🏗️' },
    { id: 'electrical', label: 'Electrical', icon: '⚡' },
    { id: 'plumbing', label: 'Plumbing', icon: '🔧' },
    { id: 'real_estate', label: 'Real Estate', icon: '🏠' },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">What's your primary industry?</h3>
      <p className="text-muted-foreground">
        Select the industry you work in most often. You can change this later.
      </p>
      <div className="grid grid-cols-2 gap-4 mt-6">
        {industries.map((industry) => (
          <Button
            key={industry.id}
            variant={selectedIndustry === industry.id ? 'default' : 'outline'}
            className="h-20 flex flex-col items-center justify-center"
            onClick={() => onSelect(industry.id)}
            disabled={disabled}
          >
            <span className="text-2xl mb-2">{industry.icon}</span>
            <span>{industry.label}</span>
          </Button>
        ))}
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack} disabled={disabled}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!selectedIndustry || disabled}>
          Next
        </Button>
      </div>
    </div>
  );
}

function QuestionnaireStep({
  industry,
  responses,
  onUpdate,
  onNext,
  onBack,
  disabled,
}: {
  industry?: string;
  responses: OnboardingResponses;
  onUpdate: (key: keyof OnboardingResponses, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const options = getIndustryQuestionOptions(industry);
  
  // Map role values
  const roleValueMap: Record<string, string> = {
    'Business Owner': 'owner',
    'Project Manager': 'manager',
    'Estimator': 'estimator',
    'Designer': 'designer',
    'Landscape Designer': 'designer',
    'Architect': 'designer',
    'Electrician': 'other',
    'Plumber': 'other',
    'Real Estate Agent': 'other',
    'Property Manager': 'manager',
    'Photographer': 'other',
    'Staging Professional': 'other',
    'Other': 'other',
  };

  // Map use case values
  const useCaseValueMap: Record<string, string> = {
    'Creating Quotes': 'quotes',
    'Creating Estimates': 'quotes',
    'Creating Proposals': 'quotes',
    'Design Visualization': 'design',
    'Project Management': 'project_management',
    'Property Staging': 'design',
    'Photo Enhancement': 'design',
    'All of the above': 'all',
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Tell us about yourself</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">What's your role?</label>
          <select
            className="w-full mt-2 p-2 border rounded"
            value={responses.role || ''}
            onChange={(e) => {
              const displayValue = e.target.value;
              const mappedValue = roleValueMap[displayValue] || displayValue;
              onUpdate('role', mappedValue);
            }}
            disabled={disabled}
          >
            <option value="">Select...</option>
            {options.roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">How do you plan to use EasyFlow Studio?</label>
          <select
            className="w-full mt-2 p-2 border rounded"
            value={responses.useCase || ''}
            onChange={(e) => {
              const displayValue = e.target.value;
              const mappedValue = useCaseValueMap[displayValue] || displayValue;
              onUpdate('useCase', mappedValue);
            }}
            disabled={disabled}
          >
            <option value="">Select...</option>
            {options.useCases.map((useCase) => (
              <option key={useCase} value={useCase}>
                {useCase}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Experience level?</label>
          <select
            className="w-full mt-2 p-2 border rounded"
            value={responses.experience || ''}
            onChange={(e) => onUpdate('experience', e.target.value)}
            disabled={disabled}
          >
            <option value="">Select...</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack} disabled={disabled}>
          Back
        </Button>
        <Button onClick={onNext} disabled={disabled}>
          Next
        </Button>
      </div>
    </div>
  );
}

function PreviewStep({
  industry,
  onNext,
  onBack,
  disabled,
}: {
  industry?: string;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const jobTerm = getIndustryTerm(industry, 'job');
  const quoteTerm = getIndustryTerm(industry, 'quote');
  const materialTerm = getIndustryTerm(industry, 'material');

  const features = [
    {
      icon: '📸',
      title: `Upload Photos`,
      description: `Upload ${jobTerm.toLowerCase()} photos to get started`,
    },
    {
      icon: '🎨',
      title: `Apply ${materialTerm}s`,
      description: `Visualize different ${materialTerm.toLowerCase()}s on your photos`,
    },
    {
      icon: '💰',
      title: `Generate ${quoteTerm}s`,
      description: `Create professional ${quoteTerm.toLowerCase()}s automatically`,
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">See what you can do</h3>
      <p className="text-muted-foreground">
        EasyFlow Studio helps you create professional {quoteTerm.toLowerCase()}s and visualizations quickly.
      </p>
      <div className="mt-6 space-y-4">
        {features.map((feature, idx) => (
          <div key={idx} className="p-4 border rounded">
            <h4 className="font-medium">{feature.icon} {feature.title}</h4>
            <p className="text-sm text-muted-foreground">{feature.description}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack} disabled={disabled}>
          Back
        </Button>
        <Button onClick={onNext} disabled={disabled}>
          Next
        </Button>
      </div>
    </div>
  );
}

function UploadStep({
  industry,
  onNext,
  onBack,
  disabled,
}: {
  industry?: string;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const [, navigate] = useLocation();
  const jobTerm = getIndustryTerm(industry, 'job');
  const createJobText = getIndustryTerm(industry, 'createJob');

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Upload Your First Photo</h3>
      <p className="text-muted-foreground">
        Ready to get started? Upload a photo to create your first {jobTerm.toLowerCase()}.
      </p>
      <div className="mt-6">
        <Button
          onClick={() => {
            navigate('/jobs/new');
          }}
          size="lg"
          className="w-full"
          disabled={disabled}
        >
          {createJobText}
        </Button>
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack} disabled={disabled}>
          Back
        </Button>
        <Button variant="ghost" onClick={onNext} disabled={disabled}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

function MaterialDemoStep({
  industry,
  onNext,
  onBack,
  disabled,
}: {
  industry: string;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/trade-categories', industry],
    queryFn: () => apiClient.getTradeCategories(industry),
    enabled: !!industry,
  });

  const materialTerm = getIndustryTerm(industry, 'material');

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Explore {materialTerm}s</h3>
      <p className="text-muted-foreground">
        Here are some {materialTerm.toLowerCase()} categories available for your industry:
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {categories.slice(0, 4).map((cat: any) => (
          <div key={cat.id} className="p-4 border rounded">
            <h4 className="font-medium">{cat.categoryLabel}</h4>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack} disabled={disabled}>
          Back
        </Button>
        <Button onClick={onNext} disabled={disabled}>
          Next
        </Button>
      </div>
    </div>
  );
}

function EnhancementDemoStep({
  industry,
  onNext,
  onBack,
  disabled,
}: {
  industry?: string;
  onNext: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const [demoImage, setDemoImage] = useState<string | null>(null);
  const [enhancementType, setEnhancementType] = useState<string>('image_enhancement');

  // Load demo image
  useEffect(() => {
    // Use a sample real estate photo
    setDemoImage('/demo-images/real-estate-sample.jpg');
  }, []);

  const enhancementTypes = [
    { key: 'image_enhancement', label: 'Image Enhancement', icon: Sparkles },
    { key: 'day_to_dusk', label: 'Day to Dusk', icon: Sunset },
    { key: 'stage_room', label: 'Virtual Staging', icon: HomeIcon },
    { key: 'item_removal', label: 'Item Removal', icon: Eraser },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold mb-2">Try Photo Enhancement</h3>
        <p className="text-slate-600">
          Enhance your uploaded photo with AI-powered tools designed for real estate.
        </p>
      </div>

      {/* Enhancement Type Selector */}
      <div>
        <Label className="mb-3 block">Select Enhancement Type</Label>
        <div className="grid grid-cols-2 gap-3">
          {enhancementTypes.map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.key}
                onClick={() => setEnhancementType(type.key)}
                disabled={disabled}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  enhancementType === type.key
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 hover:border-slate-300'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <Icon className="h-6 w-6 mb-2 text-slate-600" />
                <div className="font-medium">{type.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Demo Preview */}
      {demoImage && (
        <div className="border rounded-lg p-4 bg-slate-50">
          <div className="text-sm text-slate-600 mb-2">
            Preview: {enhancementTypes.find(t => t.key === enhancementType)?.label}
          </div>
          <div className="relative aspect-video bg-slate-200 rounded overflow-hidden">
            <img
              src={demoImage}
              alt="Demo"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="text-white text-center">
                <Sparkles className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Enhancement Preview</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          You can enhance photos directly from the editor. Try different enhancement types
          to see which works best for your listings.
        </AlertDescription>
      </Alert>

      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack} disabled={disabled}>
          Back
        </Button>
        <Button onClick={onNext} disabled={disabled}>
          Continue
        </Button>
      </div>
    </div>
  );
}

function WorkspaceSetupStep({
  industry,
  onComplete,
  onBack,
  disabled,
}: {
  industry?: string;
  onComplete: () => void;
  onBack: () => void;
  disabled?: boolean;
}) {
  const jobTerm = getIndustryTerm(industry, 'job');
  const quoteTerm = getIndustryTerm(industry, 'quote');

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">You're all set!</h3>
      <p className="text-muted-foreground">
        Your workspace is ready. You can start creating {jobTerm.toLowerCase()}s and {quoteTerm.toLowerCase()}s right away.
      </p>
      <div className="mt-6">
        <Button onClick={onComplete} size="lg" className="w-full" disabled={disabled}>
          Start Using EasyFlow Studio
        </Button>
      </div>
      <div className="mt-4">
        <Button variant="outline" onClick={onBack} className="w-full" disabled={disabled}>
          Back
        </Button>
      </div>
    </div>
  );
}
