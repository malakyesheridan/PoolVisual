/**
 * Public Buyer Inquiry Form Page
 * Accessible via token, no authentication required
 */

import { useState, useEffect } from 'react';
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
import { CheckCircle, AlertCircle, Loader2, Home } from 'lucide-react';

export default function PublicBuyerForm() {
  const [, params] = useRoute('/public/buyer-form/:token');
  const token = params?.token;
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    preferredSuburbs: '',
    budgetMin: '',
    budgetMax: '',
    bedsMin: '',
    bathsMin: '',
    propertyType: '',
    mustHaves: '',
    dealBreakers: '',
    financeStatus: '',
    timeline: '',
    freeNotes: '',
    _hp: '', // Honeypot field
  });

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
    onSuccess: () => {
      setFormData({
        fullName: '',
        email: '',
        phone: '',
        preferredSuburbs: '',
        budgetMin: '',
        budgetMax: '',
        bedsMin: '',
        bathsMin: '',
        propertyType: '',
        mustHaves: '',
        dealBreakers: '',
        financeStatus: '',
        timeline: '',
        freeNotes: '',
        _hp: '',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Honeypot check (should be empty)
    if (formData._hp.trim() !== '') {
      // Silently fail - don't submit
      return;
    }

    submitMutation.mutate({
      fullName: formData.fullName.trim(),
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      preferredSuburbs: formData.preferredSuburbs.trim() || undefined,
      budgetMin: formData.budgetMin.trim() || undefined,
      budgetMax: formData.budgetMax.trim() || undefined,
      bedsMin: formData.bedsMin.trim() || undefined,
      bathsMin: formData.bathsMin.trim() || undefined,
      propertyType: formData.propertyType || undefined,
      mustHaves: formData.mustHaves.trim() || undefined,
      dealBreakers: formData.dealBreakers.trim() || undefined,
      financeStatus: formData.financeStatus || undefined,
      timeline: formData.timeline || undefined,
      freeNotes: formData.freeNotes.trim() || undefined,
    });
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
                  />
                </div>
              </div>

              {/* Budget */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Budget</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="budgetMin">Min Budget</Label>
                    <Input
                      id="budgetMin"
                      type="number"
                      min="0"
                      value={formData.budgetMin}
                      onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                      placeholder="$0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="budgetMax">Max Budget</Label>
                    <Input
                      id="budgetMax"
                      type="number"
                      min="0"
                      value={formData.budgetMax}
                      onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                      placeholder="$0"
                    />
                  </div>
                </div>
              </div>

              {/* Property Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Property Details</h3>
                
                <div>
                  <Label htmlFor="preferredSuburbs">Preferred Suburbs</Label>
                  <Input
                    id="preferredSuburbs"
                    value={formData.preferredSuburbs}
                    onChange={(e) => setFormData({ ...formData, preferredSuburbs: e.target.value })}
                    placeholder="Suburb 1, Suburb 2, Suburb 3"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Separate multiple suburbs with commas
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="bedsMin">Min Beds</Label>
                    <Input
                      id="bedsMin"
                      type="number"
                      min="0"
                      value={formData.bedsMin}
                      onChange={(e) => setFormData({ ...formData, bedsMin: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bathsMin">Min Baths</Label>
                    <Input
                      id="bathsMin"
                      type="number"
                      min="0"
                      step="0.5"
                      value={formData.bathsMin}
                      onChange={(e) => setFormData({ ...formData, bathsMin: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="propertyType">Property Type</Label>
                  <Select
                    value={formData.propertyType}
                    onValueChange={(value) => setFormData({ ...formData, propertyType: value })}
                  >
                    <SelectTrigger id="propertyType">
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
              </div>

              {/* Finance & Timeline */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Finance & Timeline</h3>
                
                <div>
                  <Label htmlFor="financeStatus">Finance Status</Label>
                  <Select
                    value={formData.financeStatus}
                    onValueChange={(value) => setFormData({ ...formData, financeStatus: value })}
                  >
                    <SelectTrigger id="financeStatus">
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

                <div>
                  <Label htmlFor="timeline">Timeline</Label>
                  <Select
                    value={formData.timeline}
                    onValueChange={(value) => setFormData({ ...formData, timeline: value })}
                  >
                    <SelectTrigger id="timeline">
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
              </div>

              {/* Must Haves & Deal Breakers */}
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Requirements</h3>
                
                <div>
                  <Label htmlFor="mustHaves">Must Haves</Label>
                  <Textarea
                    id="mustHaves"
                    value={formData.mustHaves}
                    onChange={(e) => setFormData({ ...formData, mustHaves: e.target.value })}
                    placeholder="One requirement per line"
                    rows={3}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    List one requirement per line
                  </p>
                </div>

                <div>
                  <Label htmlFor="dealBreakers">Deal Breakers</Label>
                  <Textarea
                    id="dealBreakers"
                    value={formData.dealBreakers}
                    onChange={(e) => setFormData({ ...formData, dealBreakers: e.target.value })}
                    placeholder="One deal breaker per line"
                    rows={3}
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    List one deal breaker per line
                  </p>
                </div>
              </div>

              {/* Additional Notes */}
              <div>
                <Label htmlFor="freeNotes">Additional Notes</Label>
                <Textarea
                  id="freeNotes"
                  value={formData.freeNotes}
                  onChange={(e) => setFormData({ ...formData, freeNotes: e.target.value })}
                  placeholder="Any additional information..."
                  rows={4}
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

