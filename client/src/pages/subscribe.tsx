import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Check, Loader2, AlertCircle, CreditCard, Building2, Home } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

// Helper to check if a plan is a placeholder (test plan)
const isPlaceholderPlan = (plan: Plan): boolean => {
  const monthlyId = (plan as any).stripePriceIdMonthly;
  const yearlyId = (plan as any).stripePriceIdYearly;
  return monthlyId?.startsWith('placeholder_') || 
         yearlyId?.startsWith('placeholder_') || false;
};
import { Separator } from '@/components/ui/separator';
import { toast } from '@/lib/toast';

type Industry = 'trades' | 'real_estate';
type BillingPeriod = 'monthly' | 'yearly';

interface Plan {
  id: string;
  planKey: string;
  name: string;
  industry: Industry;
  tier: 't1' | 't2' | 't3';
  priceMonthly: number | null;
  priceYearly: number | null;
  features: {
    materials?: boolean;
    quotes?: boolean;
    enhancements?: string[];
    bulkOperations?: boolean;
    apiAccess?: boolean;
  };
  isActive: boolean;
  displayOrder: number;
}

interface PlanFeature {
  label: string;
  included: boolean;
  highlight?: boolean;
}

export default function Subscribe() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  // Removed unused setCurrentOrg - org is updated via API calls
  
  // State
  const [selectedIndustry, setSelectedIndustry] = useState<Industry>('trades');
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  // Load plans when industry changes
  useEffect(() => {
    loadPlans(selectedIndustry);
  }, [selectedIndustry]);

  // Check if user already has subscription
  useEffect(() => {
    checkExistingSubscription();
  }, []);

  const loadPlans = async (industry: Industry) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.getSubscriptionPlans(industry);
      if (response.ok && response.plans) {
        setPlans(response.plans);
        // Auto-select first plan if none selected
        if (!selectedPlan && response.plans.length > 0) {
          setSelectedPlan(response.plans[0].planKey);
        }
      } else {
        setError('Failed to load plans. Please try again.');
      }
    } catch (err: any) {
      console.error('Failed to load plans:', err);
      setError(err.message || 'Failed to load plans. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const checkExistingSubscription = async () => {
    try {
      const status = await apiClient.getSubscriptionStatus();
      if (status.ok && status.subscription?.status === 'active') {
        // User already has active subscription, redirect to dashboard
        toast.info('You already have an active subscription');
        navigate('/dashboard');
      }
    } catch (err) {
      // Ignore errors - user might not have subscription yet
      console.log('No existing subscription or error checking:', err);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedPlan) {
      toast.error('Please select a plan');
      return;
    }

    if (!user) {
      toast.error('Please log in to continue');
      navigate('/login');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // Create Stripe checkout session
      const response = await apiClient.createCheckoutSession({
        planKey: selectedPlan,
        billingPeriod,
      });

      if (response.ok && response.url) {
        // Check if this is a placeholder plan (no Stripe redirect needed)
        if (response.isPlaceholder) {
          // For placeholder plans, redirect directly to success page
          navigate(response.url);
        } else {
          // Redirect to Stripe checkout for real plans
          window.location.href = response.url;
        }
      } else {
        setError(response.error || 'Failed to create checkout session');
        toast.error('Failed to start checkout. Please try again.');
      }
    } catch (err: any) {
      console.error('Failed to create checkout session:', err);
      setError(err.message || 'An error occurred. Please try again.');
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const getPlanFeatures = (plan: Plan): PlanFeature[] => {
    const features: PlanFeature[] = [];

    // Industry-specific features
    if (selectedIndustry === 'trades') {
      features.push({
        label: 'Material Library',
        included: plan.features.materials === true,
        highlight: true,
      });
      features.push({
        label: 'Quote Generation',
        included: plan.features.quotes === true,
        highlight: true,
      });
      if (plan.features.enhancements) {
        features.push({
          label: `${plan.features.enhancements.length} Enhancement Types`,
          included: plan.features.enhancements.length > 0,
          highlight: false,
        });
      }
      if (plan.features.bulkOperations) {
        features.push({
          label: 'Bulk Operations',
          included: true,
          highlight: false,
        });
      }
    } else {
      // Real estate
      if (plan.features.enhancements) {
        plan.features.enhancements.forEach((enhancement) => {
          features.push({
            label: formatEnhancementName(enhancement),
            included: true,
            highlight: true,
          });
        });
      }
      if (plan.tier === 't3' && plan.features.materials) {
        features.push({
          label: 'Material Library (T3 Only)',
          included: true,
          highlight: false,
        });
      }
      if (plan.features.bulkOperations) {
        features.push({
          label: 'Bulk Operations',
          included: true,
          highlight: false,
        });
      }
    }

    if (plan.features.apiAccess) {
      features.push({
        label: 'API Access',
        included: true,
        highlight: false,
      });
    }

    return features;
  };

  const formatEnhancementName = (enhancement: string): string => {
    const names: Record<string, string> = {
      image_enhancement: 'Image Enhancement',
      day_to_dusk: 'Day to Dusk',
      stage_room: 'Virtual Staging',
      item_removal: 'Item Removal',
    };
    return names[enhancement] || enhancement;
  };

  const getPrice = (plan: Plan): number | null => {
    const price = billingPeriod === 'monthly' ? plan.priceMonthly : plan.priceYearly;
    if (price === null || price === undefined) return null;
    // Ensure price is a number
    const numPrice = typeof price === 'string' ? parseFloat(price) : price;
    return isNaN(numPrice) ? null : numPrice;
  };

  const formatPrice = (price: number | null | string | undefined): string => {
    if (price === null || price === undefined) return 'Contact us';
    // Ensure price is a number
    const numPrice = typeof price === 'string' ? parseFloat(price) : Number(price);
    if (isNaN(numPrice) || !isFinite(numPrice)) return 'Contact us';
    return `$${numPrice.toFixed(2)}`;
  };

  const getTierBadge = (tier: string) => {
    const badges = {
      t1: { label: 'Starter', variant: 'secondary' as const },
      t2: { label: 'Pro', variant: 'default' as const },
      t3: { label: 'Enterprise', variant: 'outline' as const },
    };
    return badges[tier as keyof typeof badges] || { label: tier, variant: 'secondary' as const };
  };

  // Loading state
  if (loading && plans.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-slate-600">Loading plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-900 mb-4">
            Choose Your Plan
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Select the perfect plan for your business. All plans include a 14-day free trial.
          </p>
        </div>

        {/* Industry Selection */}
        <Card className="mb-8 border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Select Your Industry
            </CardTitle>
            <CardDescription>
              Choose the industry that best matches your business
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedIndustry}
              onValueChange={(v) => {
                setSelectedIndustry(v as Industry);
                setSelectedPlan(null); // Reset selection when industry changes
              }}
              className="flex gap-6"
            >
              <Label
                htmlFor="trades"
                className={`flex flex-col items-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedIndustry === 'trades'
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <RadioGroupItem value="trades" id="trades" className="sr-only" />
                <Building2 className="h-8 w-8 mb-2 text-slate-600" />
                <span className="font-semibold text-lg">Trades</span>
                <span className="text-sm text-slate-500 mt-1">
                  Pool, Landscaping, Building, etc.
                </span>
              </Label>
              <Label
                htmlFor="real_estate"
                className={`flex flex-col items-center p-6 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedIndustry === 'real_estate'
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <RadioGroupItem value="real_estate" id="real_estate" className="sr-only" />
                <Home className="h-8 w-8 mb-2 text-slate-600" />
                <span className="font-semibold text-lg">Real Estate</span>
                <span className="text-sm text-slate-500 mt-1">
                  Agents, Photographers, Staging
                </span>
              </Label>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 p-1 bg-slate-200 rounded-lg">
            <Button
              variant={billingPeriod === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('monthly')}
              className="px-6"
            >
              Monthly
            </Button>
            <Button
              variant={billingPeriod === 'yearly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('yearly')}
              className="px-6"
            >
              Yearly
              <Badge variant="secondary" className="ml-2 text-xs">
                Save 20%
              </Badge>
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-8 max-w-3xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Plans Grid */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : plans.length === 0 ? (
          <Alert className="max-w-3xl mx-auto">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No plans available for this industry. Please contact support.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {plans.map((plan) => {
              const tierBadge = getTierBadge(plan.tier);
              const price = getPrice(plan);
              const features = getPlanFeatures(plan);
              const isSelected = selectedPlan === plan.planKey;
              const isHovered = hoveredPlan === plan.planKey;
              const isPopular = plan.tier === 't2'; // Mark Pro as popular

              return (
                <Card
                  key={plan.id}
                  className={`relative transition-all cursor-pointer ${
                    isSelected
                      ? 'border-primary border-2 shadow-lg scale-105'
                      : isHovered
                      ? 'border-slate-300 shadow-md'
                      : 'border-slate-200'
                  } ${isPopular ? 'ring-2 ring-primary/20' : ''}`}
                  onClick={() => setSelectedPlan(plan.planKey)}
                  onMouseEnter={() => setHoveredPlan(plan.planKey)}
                  onMouseLeave={() => setHoveredPlan(null)}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-white">Most Popular</Badge>
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between mb-2">
                      <CardTitle className="text-xl flex items-center gap-2">
                        {plan.name}
                        {isPlaceholderPlan(plan) && (
                          <Badge variant="outline" className="text-xs">
                            Test Plan
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge variant={tierBadge.variant}>{tierBadge.label}</Badge>
                    </div>
                    {isPlaceholderPlan(plan) && (
                      <p className="text-xs text-amber-600 mt-1">
                        No payment required - for testing only
                      </p>
                    )}
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold">
                        {formatPrice(price)}
                      </span>
                      {price !== null && (
                        <span className="text-slate-500">
                          /{billingPeriod === 'monthly' ? 'month' : 'year'}
                        </span>
                      )}
                    </div>
                    {billingPeriod === 'yearly' && price !== null && plan.priceMonthly && (() => {
                      const monthlyPrice = typeof plan.priceMonthly === 'number' 
                        ? plan.priceMonthly 
                        : (typeof plan.priceMonthly === 'string' ? parseFloat(plan.priceMonthly) : 0);
                      const yearlyEquivalent = !isNaN(monthlyPrice) ? monthlyPrice * 12 : 0;
                      return yearlyEquivalent > 0 ? (
                        <p className="text-sm text-slate-500 mt-1">
                          ${yearlyEquivalent.toFixed(2)} billed monthly
                        </p>
                      ) : null;
                    })()}
                  </CardHeader>
                  <CardContent>
                    <Separator className="mb-4" />
                    <ul className="space-y-3 mb-6">
                      {features.map((feature, idx) => (
                        <li
                          key={idx}
                          className={`flex items-start gap-2 ${
                            feature.included ? 'text-slate-900' : 'text-slate-400'
                          }`}
                        >
                          {feature.included ? (
                            <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-slate-300 flex-shrink-0 mt-0.5" />
                          )}
                          <span
                            className={
                              feature.highlight ? 'font-medium' : 'text-sm'
                            }
                          >
                            {feature.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      className="w-full"
                      variant={isSelected ? 'default' : 'outline'}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubscribe();
                      }}
                      disabled={processing || !isSelected}
                    >
                      {processing && isSelected ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : isSelected ? (
                        <>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Selected - Continue
                        </>
                      ) : (
                        'Select Plan'
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer Info */}
        <div className="text-center text-sm text-slate-500 max-w-3xl mx-auto">
          <p className="mb-2">
            All plans include a 14-day free trial. Cancel anytime.
          </p>
          <p>
            Need help choosing?{' '}
            <a href="/contact" className="text-primary hover:underline">
              Contact our sales team
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
