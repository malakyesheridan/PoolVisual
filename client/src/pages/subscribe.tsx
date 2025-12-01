import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Check, 
  Loader2, 
  AlertCircle, 
  CreditCard, 
  X, 
  Sparkles, 
  Brush, 
  Layers, 
  Image, 
  Film, 
  Zap, 
  Shield, 
  Headphones, 
  Download,
  Infinity,
  FileText,
  Palette,
  Wand2
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/lib/toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type BillingPeriod = 'monthly' | 'yearly';

interface Plan {
  key: 'solo' | 'pro' | 'business';
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyCredits: number;
  features: Array<{ text: string; icon: any }>;
  stripePriceIdMonthly: string;
  stripePriceIdYearly?: string;
}

const PLANS: Plan[] = [
  {
    key: 'solo',
    name: 'Solo',
    monthlyPrice: 149,
    yearlyPrice: 119.2,
    monthlyCredits: 250,
    features: [
      { text: '250 credits/month', icon: Sparkles },
      { text: 'AI Image Enhancements', icon: Wand2 },
      { text: 'Custom Prompts', icon: FileText },
      { text: 'Credit Top-Ups Available', icon: CreditCard },
      { text: 'Standard Export Formats', icon: Download },
      { text: 'Email Support', icon: Headphones },
    ],
    stripePriceIdMonthly: 'price_1SZRhzEdvdAX5C3kg43xSFBd',
  },
  {
    key: 'pro',
    name: 'Pro',
    monthlyPrice: 299,
    yearlyPrice: 239.2,
    monthlyCredits: 500,
    features: [
      { text: '500 credits/month', icon: Sparkles },
      { text: 'All Solo features included', icon: Check },
      { text: 'Advanced Brush Tool', icon: Brush },
      { text: 'Masked Prompts & Selections', icon: Layers },
      { text: 'Preset Library Access', icon: Palette },
      { text: 'Before/After Slideshow', icon: Film },
      { text: 'Priority Email Support', icon: Headphones },
    ],
    stripePriceIdMonthly: 'price_1SZRiGEdvdAX5C3ketcnQIeO',
  },
  {
    key: 'business',
    name: 'Business',
    monthlyPrice: 995,
    yearlyPrice: 796,
    monthlyCredits: 1700,
    features: [
      { text: '1700 credits/month', icon: Sparkles },
      { text: 'All Pro features included', icon: Check },
      { text: 'White-Label Export', icon: Shield },
      { text: 'Priority Processing Queue', icon: Zap },
      { text: 'API Access', icon: Infinity },
      { text: 'Dedicated Support', icon: Headphones },
      { text: 'Custom Integrations', icon: Layers },
    ],
    stripePriceIdMonthly: 'price_1SZRiaEdvdAX5C3kEekpnwAR',
  },
];

const FEATURE_COMPARISON = [
  { feature: 'Monthly Credits', solo: '250', pro: '500', business: '1700' },
  { feature: 'AI Image Enhancements', solo: true, pro: true, business: true },
  { feature: 'Custom Prompts', solo: true, pro: true, business: true },
  { feature: 'Credit Top-Ups', solo: true, pro: true, business: true },
  { feature: 'Standard Export Formats', solo: true, pro: true, business: true },
  { feature: 'Advanced Brush Tool', solo: false, pro: true, business: true },
  { feature: 'Masked Prompts & Selections', solo: false, pro: true, business: true },
  { feature: 'Preset Library Access', solo: false, pro: true, business: true },
  { feature: 'Before/After Slideshow Export', solo: false, pro: true, business: true },
  { feature: 'White-Label Export', solo: false, pro: false, business: true },
  { feature: 'Priority Processing Queue', solo: false, pro: false, business: true },
  { feature: 'API Access', solo: false, pro: false, business: true },
  { feature: 'Custom Integrations', solo: false, pro: false, business: true },
  { feature: 'Email Support', solo: true, pro: true, business: true },
  { feature: 'Priority Support', solo: false, pro: true, business: true },
  { feature: 'Dedicated Support', solo: false, pro: false, business: true },
  { feature: '14-Day Free Trial', solo: true, pro: true, business: true },
  { feature: 'Cancel Anytime', solo: true, pro: true, business: true },
];

export default function Subscribe() {
  const [, navigate] = useLocation();
  const { user } = useAuthStore();
  
  // State
  const [selectedPlan, setSelectedPlan] = useState<'solo' | 'pro' | 'business' | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<{ planKey: string; status: string } | null>(null);

  // Check if user already has subscription
  useEffect(() => {
    checkExistingSubscription();
  }, []);

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
      const planKeyMap: Record<string, string> = {
        solo: 'easyflow_solo',
        pro: 'easyflow_pro',
        business: 'easyflow_business',
      };

      const stripePlanKey = planKeyMap[selectedPlan];
      if (!stripePlanKey) {
        throw new Error('Invalid plan selected');
      }

      const response = await apiClient.createCheckoutSession({
        planKey: stripePlanKey,
        billingPeriod,
      });

      if (response.ok && response.url) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-100 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-6">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 bg-clip-text text-transparent mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Select the perfect plan for your business. All plans include a 14-day free trial.
          </p>
        </div>

        {/* Billing Period Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-2 p-1.5 bg-white border-2 border-slate-200 rounded-xl shadow-lg">
            <Button
              variant={billingPeriod === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-8 transition-all ${
                billingPeriod === 'monthly' 
                  ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md hover:shadow-lg' 
                  : 'hover:bg-slate-50'
              }`}
            >
              Monthly
            </Button>
            <Button
              variant={billingPeriod === 'yearly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setBillingPeriod('yearly')}
              className={`px-8 transition-all ${
                billingPeriod === 'yearly' 
                  ? 'bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-md hover:shadow-lg' 
                  : 'hover:bg-slate-50'
              }`}
            >
              Yearly
              <Badge variant="secondary" className="ml-2 text-xs bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {PLANS.map((plan) => {
            const price = billingPeriod === 'monthly' ? plan.monthlyPrice : plan.yearlyPrice;
            const isSelected = selectedPlan === plan.key;
            const isPopular = plan.key === 'pro';
            const isCurrentPlan = getCurrentPlanKey() === plan.key;

            return (
              <Card
                key={plan.key}
                className={`relative transition-all duration-300 cursor-pointer group ${
                  isSelected
                    ? 'border-2 border-blue-500 shadow-2xl scale-105 ring-4 ring-blue-500/20'
                    : 'border-slate-200 shadow-lg hover:shadow-xl hover:scale-[1.02]'
                } ${
                  isPopular 
                    ? 'ring-2 ring-blue-500/30 bg-gradient-to-b from-white to-blue-50/20' 
                    : 'bg-white'
                } ${isCurrentPlan ? 'opacity-75' : ''}`}
                onClick={() => !isCurrentPlan && setSelectedPlan(plan.key)}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1.5 text-sm font-semibold shadow-lg">
                      ⭐ Most Popular
                    </Badge>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute top-4 right-4 z-10">
                    <Badge variant="outline" className="bg-slate-100 border-slate-300 font-medium">
                      Current Plan
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="pb-6 pt-8">
                  <div className="flex items-center justify-between mb-4">
                    <CardTitle className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                      {plan.name}
                    </CardTitle>
                    {isPopular && (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                        <Zap className="h-6 w-6 text-white" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-5xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                      {formatPrice(price)}
                    </span>
                    <span className="text-lg text-slate-500 font-medium">
                      /month
                    </span>
                  </div>
                  
                  {billingPeriod === 'yearly' && (
                    <p className="text-sm text-slate-500 mb-3">
                      Billed yearly ({formatPrice(Math.round(plan.yearlyPrice * 12))}/year)
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-4 px-3 py-2 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <p className="text-sm font-semibold text-slate-700">
                      {plan.monthlyCredits} credits/month
                    </p>
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <Separator className="mb-6" />
                  
                  <ul className="space-y-4 mb-8">
                    {plan.features.map((feature, idx) => {
                      const Icon = feature.icon;
                      return (
                        <li key={idx} className="flex items-start gap-3 group/item">
                          <div className="mt-0.5 p-1.5 rounded-md bg-gradient-to-br from-blue-100 to-purple-100 group-hover/item:scale-110 transition-transform">
                            <Icon className="h-4 w-4 text-blue-600" />
                          </div>
                          <span className="text-sm text-slate-700 font-medium leading-relaxed flex-1">
                            {feature.text}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  
                  <Button
                    className={`w-full h-12 text-base font-semibold transition-all duration-300 ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
                        : 'bg-slate-900 hover:bg-slate-800 text-white shadow-md hover:shadow-lg'
                    }`}
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
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing...
                      </>
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : isSelected ? (
                      <>
                        <CreditCard className="mr-2 h-5 w-5" />
                        Continue to Checkout
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
        <Card className="mb-8 border-2 shadow-xl bg-white">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-2xl font-bold">Feature Comparison</CardTitle>
            </div>
            <CardDescription className="text-base">
              Compare all features across our plans to find the perfect fit
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                    <TableHead className="w-[250px] font-semibold text-slate-900">Feature</TableHead>
                    <TableHead className="text-center font-semibold text-slate-900">Solo</TableHead>
                    <TableHead className="text-center font-semibold text-slate-900">Pro</TableHead>
                    <TableHead className="text-center font-semibold text-slate-900">Business</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {FEATURE_COMPARISON.map((row, idx) => (
                    <TableRow 
                      key={idx} 
                      className={`hover:bg-slate-50/50 transition-colors ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                      }`}
                    >
                      <TableCell className="font-medium text-slate-700 py-4">
                        {row.feature}
                      </TableCell>
                      <TableCell className="text-center py-4">
                        {typeof row.solo === 'boolean' ? (
                          row.solo ? (
                            <div className="flex justify-center">
                              <div className="p-1.5 rounded-full bg-green-100">
                                <Check className="h-5 w-5 text-green-600" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <div className="p-1.5 rounded-full bg-slate-100">
                                <X className="h-5 w-5 text-slate-300" />
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="font-semibold text-slate-700">{row.solo}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-4">
                        {typeof row.pro === 'boolean' ? (
                          row.pro ? (
                            <div className="flex justify-center">
                              <div className="p-1.5 rounded-full bg-green-100">
                                <Check className="h-5 w-5 text-green-600" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <div className="p-1.5 rounded-full bg-slate-100">
                                <X className="h-5 w-5 text-slate-300" />
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="font-semibold text-slate-700">{row.pro}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center py-4">
                        {typeof row.business === 'boolean' ? (
                          row.business ? (
                            <div className="flex justify-center">
                              <div className="p-1.5 rounded-full bg-green-100">
                                <Check className="h-5 w-5 text-green-600" />
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-center">
                              <div className="p-1.5 rounded-full bg-slate-100">
                                <X className="h-5 w-5 text-slate-300" />
                              </div>
                            </div>
                          )
                        ) : (
                          <span className="font-semibold text-slate-700">{row.business}</span>
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
        <div className="text-center space-y-3 max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2 text-slate-600">
            <Shield className="h-5 w-5 text-green-600" />
            <p className="text-base font-medium">
              Cancel anytime. 14-day free trial included.
            </p>
          </div>
          <p className="text-sm text-slate-500">
            No payment is collected until trial ends. All plans include full feature access during trial.
          </p>
        </div>
      </div>
    </div>
  );
}
