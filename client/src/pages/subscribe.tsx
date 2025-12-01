import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Check, Loader2, AlertCircle, CreditCard, Building2, Home, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/lib/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Industry = 'trades' | 'real_estate';
type BillingPeriod = 'monthly' | 'yearly';

interface Plan {
  key: 'solo' | 'pro' | 'business';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number; // Monthly equivalent when billed yearly
  monthlyCredits: number;
  features: string[];
  stripePriceIdMonthly: string;
  stripePriceIdYearly?: string; // Will be added when yearly plans are created
}

const PLANS: Plan[] = [
  {
    key: 'solo',
    name: 'Solo',
    monthlyPrice: 149,
    yearlyPrice: 119.2, // 20% off: 149 * 0.8 = 119.2
    monthlyCredits: 250,
    features: [
      '250 credits/month',
      'Basic Enhancements',
      'Custom Prompts',
      'Credit Top-Ups',
    ],
    stripePriceIdMonthly: 'price_1SZRhzEdvdAX5C3kg43xSFBd',
  },
  {
    key: 'pro',
    name: 'Pro',
    monthlyPrice: 299,
    yearlyPrice: 239.2, // 20% off: 299 * 0.8 = 239.2
    monthlyCredits: 500,
    features: [
      '500 credits/month',
      'All Solo features',
      'Brush Tool',
      'Masked Prompts',
      'Preset Library',
      'Before/After Slideshow',
    ],
    stripePriceIdMonthly: 'price_1SZRIGEdvdAX5C3ketcnQIeO',
  },
  {
    key: 'business',
    name: 'Business',
    monthlyPrice: 995,
    yearlyPrice: 796, // 20% off: 995 * 0.8 = 796
    monthlyCredits: 1700,
    features: [
      '1700 credits/month',
      'All Pro features',
      'White-Label Export',
      'Priority Queue Access',
    ],
    stripePriceIdMonthly: 'price_1SZRiaEdvdAX5C3kEekpnwAR',
  },
];

const FEATURE_COMPARISON = [
  { feature: 'Monthly Credits', solo: '250', pro: '500', business: '1700' },
  { feature: 'Custom Prompts', solo: true, pro: true, business: true },
  { feature: 'Brush Tool', solo: false, pro: true, business: true },
  { feature: 'Masked Prompts', solo: false, pro: true, business: true },
  { feature: 'Staging Preset Library (Real Estate)', solo: false, pro: true, business: true },
  { feature: 'Before/After Slideshow Export', solo: false, pro: true, business: true },
  { feature: 'White-Label Export', solo: false, pro: false, business: true },
  { feature: 'Priority Queue', solo: false, pro: false, business: true },
];

export default function Subscribe() {
  const [, navigate] = useLocation();
  const { user, setUser } = useAuthStore();
  
  // State
  const [selectedIndustry, setSelectedIndustry] = useState<Industry>('trades');
  const [selectedPlan, setSelectedPlan] = useState<'solo' | 'pro' | 'business' | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<{ planKey: string; status: string } | null>(null);

  // Check if user already has subscription
  useEffect(() => {
    checkExistingSubscription();
  }, []);

  // Save industry selection to user profile
  useEffect(() => {
    if (user && selectedIndustry && user.industryType !== selectedIndustry) {
      saveIndustrySelection();
    }
  }, [selectedIndustry, user]);

  const checkExistingSubscription = async () => {
    try {
      const status = await apiClient.getSubscriptionStatus();
      if (status.ok && status.subscription?.status === 'active') {
        const planKey = status.subscription.planKey || '';
        setCurrentSubscription({
          planKey: planKey.replace('easyflow_', ''),
          status: status.subscription.status,
        });
      }
    } catch (err) {
      // Ignore errors - user might not have subscription yet
      console.log('No existing subscription or error checking:', err);
    }
  };

  const saveIndustrySelection = async () => {
    if (!user) return;
    try {
      // Map 'trades' to 'pool' for database constraint (database doesn't allow 'trades')
      const dbIndustryType = selectedIndustry === 'trades' ? 'pool' : selectedIndustry;
      // Update user's industry type via API
      await apiClient.updateUserProfile({ industryType: dbIndustryType });
      // Update local store with the original selection (for UI purposes)
      setUser({ ...user, industryType: selectedIndustry });
    } catch (err) {
      console.error('Failed to save industry selection:', err);
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
      // Map plan key to Stripe plan key format
      const planKeyMap: Record<string, string> = {
        solo: 'easyflow_solo',
        pro: 'easyflow_pro',
        business: 'easyflow_business',
      };

      const stripePlanKey = planKeyMap[selectedPlan];
      if (!stripePlanKey) {
        throw new Error('Invalid plan selected');
      }

      // Create Stripe checkout session
      const response = await apiClient.createCheckoutSession({
        planKey: stripePlanKey,
        billingPeriod,
      });

      if (response.ok && response.url) {
        // Redirect to Stripe checkout
        window.location.href = response.url;
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

  const formatPrice = (price: number): string => {
    return `$${price.toFixed(2)}`;
  };

  const getCurrentPlanKey = (): string | null => {
    if (!currentSubscription) return null;
    return currentSubscription.planKey;
  };

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
              Choose the industry that best matches your business (this affects app behavior, not pricing)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedIndustry}
              onValueChange={(v) => setSelectedIndustry(v as Industry)}
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
          <div className="inline-flex items-center gap-2 p-1 bg-white border-2 border-slate-200 rounded-lg shadow-sm">
            <Button
              variant={billingPeriod === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-6 ${billingPeriod === 'monthly' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
            >
              Monthly
            </Button>
            <Button
              variant={billingPeriod === 'yearly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('yearly')}
              className={`px-6 ${billingPeriod === 'yearly' ? 'bg-slate-900 text-white hover:bg-slate-800' : ''}`}
            >
              Yearly
              <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-800">
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

        {/* Three-Card Pricing Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {PLANS.map((plan) => {
            const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const isSelected = selectedPlan === plan.key;
            const isPopular = plan.key === 'pro';
            const isCurrentPlan = getCurrentPlanKey() === plan.key;

            return (
              <Card
                key={plan.key}
                className={`relative transition-all ${
                  isSelected
                    ? 'border-primary border-2 shadow-lg scale-105'
                    : 'border-slate-200 shadow-md'
                } ${isPopular ? 'ring-2 ring-primary/20' : ''} ${isCurrentPlan ? 'opacity-75' : ''}`}
                onClick={() => !isCurrentPlan && setSelectedPlan(plan.key)}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-white">Most Popular</Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-4 right-4">
                    <Badge variant="outline" className="bg-slate-100">
                      Current Plan
                    </Badge>
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      {formatPrice(price)}
                    </span>
                    <span className="text-slate-500">
                      /{billingPeriod === 'monthly' ? 'month' : 'month'}
                    </span>
                  </div>
                  {billingPeriod === 'yearly' && (
                    <p className="text-sm text-slate-500 mt-1">
                      Billed yearly ({formatPrice(Math.round(plan.yearlyPrice * 12))}/year)
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-2">
                    {plan.monthlyCredits} credits/month
                  </p>
                </CardHeader>
                <CardContent>
                  <Separator className="mb-4" />
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isCurrentPlan) {
                        if (isSelected) {
                          handleSubscribe();
                        } else {
                          setSelectedPlan(plan.key);
                        }
                      }
                    }}
                    disabled={processing || isCurrentPlan}
                  >
                    {processing && isSelected ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : isSelected ? (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Selected – Continue
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

        {/* Feature Comparison Table */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Feature Comparison</CardTitle>
            <CardDescription>
              Compare features across all plans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Feature</TableHead>
                    <TableHead className="text-center">Solo</TableHead>
                    <TableHead className="text-center">Pro</TableHead>
                    <TableHead className="text-center">Business</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FEATURE_COMPARISON.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{row.feature}</TableCell>
                      <TableCell className="text-center">
                        {typeof row.solo === 'boolean' ? (
                          row.solo ? (
                            <Check className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-slate-300 mx-auto" />
                          )
                        ) : (
                          row.solo
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {typeof row.pro === 'boolean' ? (
                          row.pro ? (
                            <Check className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-slate-300 mx-auto" />
                          )
                        ) : (
                          row.pro
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {typeof row.business === 'boolean' ? (
                          row.business ? (
                            <Check className="h-5 w-5 text-green-600 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-slate-300 mx-auto" />
                          )
                        ) : (
                          row.business
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="text-center text-sm text-slate-500 max-w-3xl mx-auto">
          <p className="mb-2">
            Cancel anytime. 14-day free trial included.
          </p>
          <p>
            No payment is collected until trial ends.
          </p>
        </div>
      </div>
    </div>
  );
}
