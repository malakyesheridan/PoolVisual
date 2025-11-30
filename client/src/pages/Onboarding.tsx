import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { useOrgStore } from '@/stores/orgStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';
import { getIndustryTerm, getIndustryQuestionOptions } from '@/lib/industry-terminology';

type OnboardingStep = 'welcome' | 'industry_selection' | 'questionnaire' | 'preview' | 'upload' | 'material_demo' | 'workspace_setup' | 'completed';

interface OnboardingResponses {
  industry?: string;
  role?: string;
  useCase?: string;
  experience?: string;
}

const STEPS: { id: OnboardingStep; title: string; description: string }[] = [
  { id: 'welcome', title: 'Welcome', description: 'Get started with EasyFlow Studio' },
  { id: 'industry_selection', title: 'Select Industry', description: 'Choose your primary trade' },
  { id: 'questionnaire', title: 'Tell Us About Yourself', description: 'Help us personalize your experience' },
  { id: 'preview', title: 'Preview', description: 'See what you can do' },
  { id: 'upload', title: 'Upload Your First Photo', description: 'Get hands-on experience' },
  { id: 'material_demo', title: 'Explore Materials', description: 'See how materials work' },
  { id: 'workspace_setup', title: 'Workspace Setup', description: 'Configure your workspace' },
];

export default function Onboarding() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  const { currentOrg, setCurrentOrg } = useOrgStore();
  const queryClient = useQueryClient();

  // Use refs to prevent race conditions with server state
  const isInitialized = useRef(false);
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [responses, setResponses] = useState<OnboardingResponses>({});
  const [isNavigating, setIsNavigating] = useState(false);

  // Fetch onboarding status
  const { data: onboarding, isLoading } = useQuery({
    queryKey: ['/api/onboarding/status'],
    queryFn: () => apiClient.getOnboardingStatus(),
    enabled: !!user,
    retry: false,
    staleTime: 5000, // Don't refetch too often
  });

  // Update onboarding mutation (debounced for responses, immediate for step changes)
  const updateOnboardingMutation = useMutation({
    mutationFn: (data: { step: string; responses?: any }) => apiClient.updateOnboarding(data),
    // Don't invalidate on every update - only on step changes
    onSuccess: (data, variables) => {
      // Only invalidate if step changed
      if (variables.step !== currentStep) {
        queryClient.setQueryData(['/api/onboarding/status'], data);
      }
    },
  });

  // Update org industry mutation
  const updateOrgIndustryMutation = useMutation({
    mutationFn: async (industry: string) => {
      if (!currentOrg?.id) {
        // Get user's orgs if we don't have currentOrg
        const orgs = await apiClient.getMyOrgs();
        if (orgs.length > 0) {
          const org = await apiClient.getOrg(orgs[0].id);
          await apiClient.updateOrg(orgs[0].id, { industry });
          return { ...org, industry };
        }
        return null;
      } else {
        await apiClient.updateOrg(currentOrg.id, { industry });
        return { ...currentOrg, industry };
      }
    },
    onSuccess: (updatedOrg) => {
      if (updatedOrg) {
        setCurrentOrg(updatedOrg);
        queryClient.invalidateQueries({ queryKey: ['/api/me/orgs'] });
      }
    },
  });

  // Complete onboarding mutation
  const completeOnboardingMutation = useMutation({
    mutationFn: () => apiClient.completeOnboarding(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/status'] });
      navigate('/dashboard');
    },
  });

  // Initialize step from onboarding data (only once)
  useEffect(() => {
    if (onboarding && !isInitialized.current) {
      const serverStep = onboarding.step || 'welcome';
      const serverResponses = onboarding.responses || {};
      
      setCurrentStep(serverStep);
      setResponses(serverResponses);
      isInitialized.current = true;
    }
  }, [onboarding]);

  // If onboarding is already completed, redirect to dashboard
  useEffect(() => {
    if (onboarding?.completed) {
      navigate('/dashboard');
    }
  }, [onboarding?.completed, navigate]);

  // Debounced response update
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const updateResponse = useCallback((key: keyof OnboardingResponses, value: string) => {
    const newResponses = { ...responses, [key]: value };
    setResponses(newResponses);

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Debounce the API call
    debounceTimer.current = setTimeout(() => {
      updateOnboardingMutation.mutate({
        step: currentStep,
        responses: newResponses,
      });
    }, 500); // 500ms debounce
  }, [responses, currentStep, updateOnboardingMutation]);

  // Update industry and save to org
  const handleIndustrySelect = useCallback(async (industry: string) => {
    setResponses(prev => ({ ...prev, industry }));
    
    // Update onboarding immediately
    await updateOnboardingMutation.mutateAsync({
      step: currentStep,
      responses: { ...responses, industry },
    });

    // Update org industry
    updateOrgIndustryMutation.mutate(industry);
  }, [responses, currentStep, updateOnboardingMutation, updateOrgIndustryMutation]);

  const handleNext = useCallback(async () => {
    if (isNavigating) return;
    setIsNavigating(true);

    try {
      const currentIndex = STEPS.findIndex(s => s.id === currentStep);
      if (currentIndex >= 0 && currentIndex < STEPS.length - 1) {
        const nextStep = STEPS[currentIndex + 1];
        if (nextStep) {
          // Update local state immediately
          setCurrentStep(nextStep.id);
          
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
  }, [currentStep, responses, isNavigating, updateOnboardingMutation]);

  const handleBack = useCallback(async () => {
    if (isNavigating) return;
    setIsNavigating(true);

    try {
      const currentIndex = STEPS.findIndex(s => s.id === currentStep);
      if (currentIndex > 0) {
        const prevStep = STEPS[currentIndex - 1];
        if (prevStep) {
          // Update local state immediately
          setCurrentStep(prevStep.id);
          
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
  }, [currentStep, responses, isNavigating, updateOnboardingMutation]);

  const handleComplete = async () => {
    await completeOnboardingMutation.mutateAsync();
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

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
              Step {currentStepIndex + 1} of {STEPS.length}
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
                selectedIndustry={responses.industry}
                onSelect={handleIndustrySelect}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'questionnaire' && (
              <QuestionnaireStep
                industry={responses.industry}
                responses={responses}
                onUpdate={updateResponse}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'preview' && (
              <PreviewStep
                industry={responses.industry}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'upload' && (
              <UploadStep
                industry={responses.industry}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'material_demo' && (
              <MaterialDemoStep
                industry={responses.industry || 'pool'}
                onNext={handleNext}
                onBack={handleBack}
                disabled={isNavigating}
              />
            )}
            {currentStep === 'workspace_setup' && (
              <WorkspaceSetupStep
                industry={responses.industry}
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
}: {
  selectedIndustry?: string | undefined;
  onSelect: (industry: string) => void | Promise<void>;
  onNext: () => void | Promise<void>;
  onBack: () => void | Promise<void>;
  disabled?: boolean;
}) {
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
