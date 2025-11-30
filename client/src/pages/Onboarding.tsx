import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

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
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [responses, setResponses] = useState<OnboardingResponses>({});

  // Fetch onboarding status
  const { data: onboarding, isLoading } = useQuery({
    queryKey: ['/api/onboarding/status'],
    queryFn: () => apiClient.getOnboardingStatus(),
    enabled: !!user,
    retry: false,
  });

  // Update onboarding mutation
  const updateOnboardingMutation = useMutation({
    mutationFn: (data: { step: string; responses?: any }) => apiClient.updateOnboarding(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/onboarding/status'] });
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

  // Initialize step from onboarding data
  useEffect(() => {
    if (onboarding) {
      setCurrentStep(onboarding.step || 'welcome');
      setResponses(onboarding.responses || {});
    }
  }, [onboarding]);

  // If onboarding is already completed, redirect to dashboard
  useEffect(() => {
    if (onboarding?.completed) {
      navigate('/dashboard');
    }
  }, [onboarding, navigate]);

  const handleNext = async () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex >= 0 && currentIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentIndex + 1];
      if (nextStep) {
        setCurrentStep(nextStep.id);
        await updateOnboardingMutation.mutateAsync({
          step: nextStep.id,
          responses,
        });
      }
    }
  };

  const handleBack = async () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      const prevStep = STEPS[currentIndex - 1];
      if (prevStep) {
        setCurrentStep(prevStep.id);
        await updateOnboardingMutation.mutateAsync({
          step: prevStep.id,
          responses,
        });
      }
    }
  };

  const handleComplete = async () => {
    await completeOnboardingMutation.mutateAsync();
  };

  const updateResponse = (key: keyof OnboardingResponses, value: string) => {
    const newResponses = { ...responses, [key]: value };
    setResponses(newResponses);
    updateOnboardingMutation.mutate({
      step: currentStep,
      responses: newResponses,
    });
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="space-y-2">
            <CardTitle className="text-2xl">Welcome to EasyFlow Studio</CardTitle>
            <CardDescription>
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
                onSelect={(industry) => updateResponse('industry', industry)}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}
            {currentStep === 'questionnaire' && (
              <QuestionnaireStep
                responses={responses}
                onUpdate={updateResponse}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}
            {currentStep === 'preview' && (
              <PreviewStep onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 'upload' && (
              <UploadStep onNext={handleNext} onBack={handleBack} />
            )}
            {currentStep === 'material_demo' && (
              <MaterialDemoStep
                industry={responses.industry || 'pool'}
                onNext={handleNext}
                onBack={handleBack}
              />
            )}
            {currentStep === 'workspace_setup' && (
              <WorkspaceSetupStep
                onComplete={handleComplete}
                onBack={handleBack}
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
}: {
  selectedIndustry?: string | undefined;
  onSelect: (industry: string) => void;
  onNext: () => void | Promise<void>;
  onBack: () => void | Promise<void>;
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
          >
            <span className="text-2xl mb-2">{industry.icon}</span>
            <span>{industry.label}</span>
          </Button>
        ))}
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!selectedIndustry}>
          Next
        </Button>
      </div>
    </div>
  );
}

function QuestionnaireStep({
  responses,
  onUpdate,
  onNext,
  onBack,
}: {
  responses: OnboardingResponses;
  onUpdate: (key: keyof OnboardingResponses, value: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <h3 className="text-xl font-semibold">Tell us about yourself</h3>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium">What's your role?</label>
          <select
            className="w-full mt-2 p-2 border rounded"
            value={responses.role || ''}
            onChange={(e) => onUpdate('role', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="owner">Business Owner</option>
            <option value="manager">Project Manager</option>
            <option value="estimator">Estimator</option>
            <option value="designer">Designer</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">How do you plan to use EasyFlow Studio?</label>
          <select
            className="w-full mt-2 p-2 border rounded"
            value={responses.useCase || ''}
            onChange={(e) => onUpdate('useCase', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="quotes">Creating Quotes</option>
            <option value="design">Design Visualization</option>
            <option value="project_management">Project Management</option>
            <option value="all">All of the above</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Experience level?</label>
          <select
            className="w-full mt-2 p-2 border rounded"
            value={responses.experience || ''}
            onChange={(e) => onUpdate('experience', e.target.value)}
          >
            <option value="">Select...</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}

function PreviewStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">See what you can do</h3>
      <p className="text-muted-foreground">
        EasyFlow Studio helps you create professional quotes and visualizations quickly.
      </p>
      <div className="mt-6 space-y-4">
        <div className="p-4 border rounded">
          <h4 className="font-medium">📸 Upload Photos</h4>
          <p className="text-sm text-muted-foreground">Upload project photos to get started</p>
        </div>
        <div className="p-4 border rounded">
          <h4 className="font-medium">🎨 Apply Materials</h4>
          <p className="text-sm text-muted-foreground">Visualize different materials on your photos</p>
        </div>
        <div className="p-4 border rounded">
          <h4 className="font-medium">💰 Generate Quotes</h4>
          <p className="text-sm text-muted-foreground">Create professional quotes automatically</p>
        </div>
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}

function UploadStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Upload Your First Photo</h3>
      <p className="text-muted-foreground">
        Ready to get started? Upload a photo to create your first project.
      </p>
      <div className="mt-6">
        <Button onClick={() => {
          // Navigate to jobs/new to create a job and upload photo
          window.location.href = '/jobs/new';
        }} size="lg" className="w-full">
          Create Your First Project
        </Button>
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button variant="ghost" onClick={onNext}>
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
}: {
  industry: string;
  onNext: () => void;
  onBack: () => void;
}) {
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/trade-categories', industry],
    queryFn: () => apiClient.getTradeCategories(industry),
    enabled: !!industry,
  });

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Explore Materials</h3>
      <p className="text-muted-foreground">
        Here are some material categories available for your industry:
      </p>
      <div className="mt-6 grid grid-cols-2 gap-4">
        {categories.slice(0, 4).map((cat: any) => (
          <div key={cat.id} className="p-4 border rounded">
            <h4 className="font-medium">{cat.categoryLabel}</h4>
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}

function WorkspaceSetupStep({
  onComplete,
  onBack,
}: {
  onComplete: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">You're all set!</h3>
      <p className="text-muted-foreground">
        Your workspace is ready. You can start creating projects and quotes right away.
      </p>
      <div className="mt-6">
        <Button onClick={onComplete} size="lg" className="w-full">
          Start Using EasyFlow Studio
        </Button>
      </div>
      <div className="mt-4">
        <Button variant="outline" onClick={onBack} className="w-full">
          Back
        </Button>
      </div>
    </div>
  );
}

