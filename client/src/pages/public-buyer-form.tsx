/**
 * Public Buyer Inquiry Form Page
 * Accessible via token, no authentication required
 * Standalone form matching the buyer profile form exactly
 */

import { useState, useRef } from 'react';
import { useRoute } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Loader2, Home, X } from 'lucide-react';

// Format currency for display
const formatCurrencyDisplay = (value: number): string => {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

// Parse currency input (allows $, commas, decimals)
const parseCurrencyInput = (value: string): number | null => {
  const cleaned = value.replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

export default function PublicBuyerForm() {
  const [, params] = useRoute('/public/buyer-form/:token');
  const token = params?.token;
  
  // Form state - matching buyer profile form structure
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    budgetMin: '',
    budgetMax: '',
    bedsMin: '',
    bathsMin: '',
    propertyType: '',
    preferredSuburbs: [] as string[],
    mustHaves: [] as string[],
    dealBreakers: [] as string[],
    financeStatus: '',
    timeline: '',
    freeNotes: '',
    _hp: '', // Honeypot field
  });

  // Refs for array inputs
  const preferredSuburbsInputRef = useRef<HTMLInputElement>(null);
  const mustHavesInputRef = useRef<HTMLInputElement>(null);
  const dealBreakersInputRef = useRef<HTMLInputElement>(null);

  // Display values for budget (allows currency formatting)
  const [budgetMinDisplay, setBudgetMinDisplay] = useState<string>('');
  const [budgetMaxDisplay, setBudgetMaxDisplay] = useState<string>('');

  // Fetch form metadata
  const { data: formMetadata, isLoading: metadataLoading, error: metadataError } = useQuery({
    queryKey: ['/public/buyer-form', token],
    queryFn: () => apiClient.getPublicBuyerFormMetadata(token!),
    enabled: !!token,
    retry: false,
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (data: any) => apiClient.submitPublicBuyerForm(token!, data),
  });

  // Add item to array field
  const addArrayItem = (field: 'preferredSuburbs' | 'mustHaves' | 'dealBreakers', value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;
    
    setFormData((prev) => {
      const currentArray = prev[field] || [];
      const newArray = [...currentArray, trimmedValue];
      return { ...prev, [field]: newArray };
    });
  };

  // Remove item from array field
  const removeArrayItem = (field: 'preferredSuburbs' | 'mustHaves' | 'dealBreakers', index: number) => {
    setFormData((prev) => {
      const currentArray = prev[field] || [];
      const newArray = currentArray.filter((_, i) => i !== index);
      return { ...prev, [field]: newArray };
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Honeypot check (should be empty)
    if (formData._hp.trim() !== '') {
      // Silently fail - don't submit
      return;
    }

    // Parse budget values
    const budgetMinValue = budgetMinDisplay ? parseCurrencyInput(budgetMinDisplay) : null;
    const budgetMaxValue = budgetMaxDisplay ? parseCurrencyInput(budgetMaxDisplay) : null;

    // Build submission data
    const submissionData: any = {
      fullName: formData.fullName.trim(),
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      preferredSuburbs: formData.preferredSuburbs.length > 0 ? formData.preferredSuburbs : undefined,
      budgetMin: budgetMinValue !== null ? budgetMinValue : undefined,
      budgetMax: budgetMaxValue !== null ? budgetMaxValue : undefined,
      bedsMin: formData.bedsMin ? Number(formData.bedsMin) : undefined,
      bathsMin: formData.bathsMin ? Number(formData.bathsMin) : undefined,
      propertyType: formData.propertyType || undefined,
      mustHaves: formData.mustHaves.length > 0 ? formData.mustHaves : undefined,
      dealBreakers: formData.dealBreakers.length > 0 ? formData.dealBreakers : undefined,
      financeStatus: formData.financeStatus || undefined,
      timeline: formData.timeline || undefined,
      freeNotes: formData.freeNotes.trim() || undefined,
    };

    submitMutation.mutate(submissionData);
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Invalid Link</h2>
              <p className="text-slate-600">This form link is invalid.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (metadataLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-slate-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (metadataError || !formMetadata || !formMetadata.valid) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                {formMetadata?.message || 'Form Not Available'}
              </h2>
              <p className="text-slate-600">
                {formMetadata?.message || 'This form link is no longer valid or has expired.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitMutation.isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">Thank You!</h2>
              <p className="text-slate-600 mb-4">
                Your inquiry has been submitted successfully. We'll be in touch soon!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          {formMetadata.orgLogoUrl && (
            <img 
              src={formMetadata.orgLogoUrl} 
              alt={formMetadata.orgName}
              className="h-12 mx-auto mb-4"
            />
          )}
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Buyer Inquiry Form
          </h1>
          <p className="text-slate-600">
            {formMetadata.orgName && `Submitted to ${formMetadata.orgName}`}
          </p>
        </div>

        {/* Property Summary (if linked to property) */}
        {formMetadata.property && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="w-5 h-5" />
                Property
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                {formMetadata.property.photoUrl && (
                  <img
                    src={formMetadata.property.photoUrl}
                    alt={formMetadata.property.address}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                )}
                <div>
                  <p className="font-medium text-slate-900">{formMetadata.property.address}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Your Requirements</CardTitle>
            <CardDescription>
              Please fill out the form below with your property requirements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Contact Information</h3>
                
                <div>
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input
                    id="fullName"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="John Smith"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required={!formData.phone}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    required={!formData.email}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+61 400 000 000"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Budget Range */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Budget</h3>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">Budget Min</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={budgetMinDisplay}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        setBudgetMinDisplay(inputValue);
                      }}
                      onBlur={(e) => {
                        const parsed = parseCurrencyInput(e.target.value);
                        if (parsed !== null) {
                          const formatted = formatCurrencyDisplay(parsed);
                          setBudgetMinDisplay(formatted);
                        } else {
                          setBudgetMinDisplay('');
                        }
                      }}
                      placeholder="$0"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Budget Max</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={budgetMaxDisplay}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        setBudgetMaxDisplay(inputValue);
                      }}
                      onBlur={(e) => {
                        const parsed = parseCurrencyInput(e.target.value);
                        if (parsed !== null) {
                          const formatted = formatCurrencyDisplay(parsed);
                          setBudgetMaxDisplay(formatted);
                        } else {
                          setBudgetMaxDisplay('');
                        }
                      }}
                      placeholder="$0"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              {/* Beds/Baths */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Min Beds</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.bedsMin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setFormData({ ...formData, bedsMin: val });
                    }}
                    placeholder="Beds"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Min Baths</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={formData.bathsMin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      setFormData({ ...formData, bathsMin: val });
                    }}
                    placeholder="Baths"
                    className="mt-1"
                  />
                </div>
              </div>

              {/* Property Type */}
              <div>
                <Label className="text-sm">Property Type</Label>
                <Select
                  value={formData.propertyType || undefined}
                  onValueChange={(v) => setFormData({ ...formData, propertyType: v || '' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="house">House</SelectItem>
                    <SelectItem value="townhouse">Townhouse</SelectItem>
                    <SelectItem value="apartment">Apartment</SelectItem>
                    <SelectItem value="land">Land</SelectItem>
                    <SelectItem value="acreage">Acreage</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preferred Suburbs */}
              <div>
                <Label className="text-sm">Preferred Suburbs</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    ref={preferredSuburbsInputRef}
                    placeholder="Add suburb"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = preferredSuburbsInputRef.current;
                        if (input) {
                          addArrayItem('preferredSuburbs', input.value);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = preferredSuburbsInputRef.current;
                      if (input) {
                        addArrayItem('preferredSuburbs', input.value);
                        input.value = '';
                        input.focus();
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {formData.preferredSuburbs.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.preferredSuburbs.map((suburb, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {suburb}
                        <button
                          type="button"
                          onClick={() => removeArrayItem('preferredSuburbs', idx)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Finance Status */}
              <div>
                <Label className="text-sm">Finance Status</Label>
                <Select
                  value={formData.financeStatus || undefined}
                  onValueChange={(v) => setFormData({ ...formData, financeStatus: v || '' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preapproved">Pre-approved</SelectItem>
                    <SelectItem value="needsFinance">Needs Finance</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Timeline */}
              <div>
                <Label className="text-sm">Timeline</Label>
                <Select
                  value={formData.timeline || undefined}
                  onValueChange={(v) => setFormData({ ...formData, timeline: v || '' })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select timeline" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asap">ASAP</SelectItem>
                    <SelectItem value="30days">30 Days</SelectItem>
                    <SelectItem value="60days">60 Days</SelectItem>
                    <SelectItem value="3to6months">3-6 Months</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Must Haves */}
              <div>
                <Label className="text-sm">Must Haves</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    ref={mustHavesInputRef}
                    placeholder="Add requirement"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = mustHavesInputRef.current;
                        if (input) {
                          addArrayItem('mustHaves', input.value);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = mustHavesInputRef.current;
                      if (input) {
                        addArrayItem('mustHaves', input.value);
                        input.value = '';
                        input.focus();
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {formData.mustHaves.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.mustHaves.map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {item}
                        <button
                          type="button"
                          onClick={() => removeArrayItem('mustHaves', idx)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Deal Breakers */}
              <div>
                <Label className="text-sm">Deal Breakers</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    ref={dealBreakersInputRef}
                    placeholder="Add deal breaker"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const input = dealBreakersInputRef.current;
                        if (input) {
                          addArrayItem('dealBreakers', input.value);
                          input.value = '';
                        }
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const input = dealBreakersInputRef.current;
                      if (input) {
                        addArrayItem('dealBreakers', input.value);
                        input.value = '';
                        input.focus();
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
                {formData.dealBreakers.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.dealBreakers.map((item, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {item}
                        <button
                          type="button"
                          onClick={() => removeArrayItem('dealBreakers', idx)}
                          className="ml-1 hover:text-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Free Notes */}
              <div>
                <Label className="text-sm">Notes</Label>
                <Textarea
                  value={formData.freeNotes}
                  onChange={(e) => setFormData({ ...formData, freeNotes: e.target.value })}
                  placeholder="Additional notes..."
                  className="mt-1"
                  rows={3}
                />
              </div>

              {/* Honeypot field (hidden) */}
              <input
                type="text"
                name="_hp"
                value={formData._hp}
                onChange={(e) => setFormData({ ...formData, _hp: e.target.value })}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={submitMutation.isPending}
                className="w-full"
                size="lg"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Inquiry'
                )}
              </Button>

              {submitMutation.isError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-sm text-red-800">
                  <AlertCircle className="w-4 h-4" />
                  <span>
                    {submitMutation.error instanceof Error
                      ? submitMutation.error.message
                      : 'Something went wrong. Please try again.'}
                  </span>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
