import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOrgs } from "@/hooks/useOrgs";
import { 
  Palette, 
  DollarSign, 
  FileText,
  Save,
  Building
} from "lucide-react";

interface OrganizationSettingsProps {
  orgId: string | null;
}

export function OrganizationSettings({ orgId }: OrganizationSettingsProps) {
  const [formData, setFormData] = useState({
    currencyCode: 'AUD',
    taxRate: '0.10',
    depositDefaultPct: '0.30',
    validityDays: '30',
    pdfTerms: '',
  });
  const [brandingData, setBrandingData] = useState({
    primaryColor: '#000000',
    secondaryColor: '#fafafa',
    accentColor: '#6366f1',
    logoUrl: '',
  });

  const { toast } = useToast();
  const { data: orgs = [] } = useOrgs();

  const { data: settings } = useQuery({
    queryKey: ['/api/settings', orgId],
    queryFn: () => orgId ? apiClient.getSettings(orgId) : Promise.resolve(null),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: organization } = useQuery({
    queryKey: ['/api/orgs', orgId],
    queryFn: () => orgId ? apiClient.getOrg(orgId) : Promise.resolve(null),
    enabled: !!orgId,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        currencyCode: settings.currencyCode || 'AUD',
        taxRate: settings.taxRate || '0.10',
        depositDefaultPct: settings.depositDefaultPct || '0.30',
        validityDays: settings.validityDays?.toString() || '30',
        pdfTerms: settings.pdfTerms || '',
      });
    }
  }, [settings]);

  useEffect(() => {
    if (organization) {
      const brandColors = organization.brandColors as { primary?: string; secondary?: string; accent?: string } | null || {};
      setBrandingData({
        primaryColor: brandColors.primary || '#000000',
        secondaryColor: brandColors.secondary || '#fafafa',
        accentColor: brandColors.accent || '#6366f1',
        logoUrl: organization.logoUrl || '',
      });
    }
  }, [organization]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => orgId ? apiClient.updateSettings(orgId, data) : Promise.reject('No org selected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Settings saved",
        description: "Your organization settings have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: (data: any) => orgId ? apiClient.updateOrg(orgId, data) : Promise.reject('No org selected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orgs'] });
      toast({
        title: "Branding saved",
        description: "Your organization branding has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error saving branding",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const settingsData = {
      ...formData,
      taxRate: parseFloat(formData.taxRate),
      depositDefaultPct: parseFloat(formData.depositDefaultPct),
      validityDays: parseInt(formData.validityDays),
    };

    updateSettingsMutation.mutate(settingsData);

    const brandingPayload = {
      brandColors: {
        primary: brandingData.primaryColor,
        secondary: brandingData.secondaryColor,
        accent: brandingData.accentColor,
      },
      logoUrl: brandingData.logoUrl || null,
    };

    updateOrgMutation.mutate(brandingPayload);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!orgId) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Building className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900 mb-2">No organization selected</h3>
          <p className="text-slate-500">
            Please select an organization to configure settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Organization Selector */}
      {orgs.length > 1 && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <Building className="w-5 h-5 text-slate-600" />
              <div className="flex-1">
                <Label className="text-sm font-medium">Organization</Label>
                <p className="text-sm text-slate-600 mt-1">
                  {organization?.name || 'Loading...'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Financial Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select 
                value={formData.currencyCode} 
                onValueChange={(value) => handleInputChange('currencyCode', value)}
              >
                <SelectTrigger className="mt-1" id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUD">Australian Dollar (AUD)</SelectItem>
                  <SelectItem value="USD">US Dollar (USD)</SelectItem>
                  <SelectItem value="EUR">Euro (EUR)</SelectItem>
                  <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="taxRate">Tax Rate (%)</Label>
              <Input
                id="taxRate"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.taxRate}
                onChange={(e) => handleInputChange('taxRate', e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter as decimal (e.g., 0.10 for 10%)
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="depositPct">Default Deposit (%)</Label>
              <Input
                id="depositPct"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={formData.depositDefaultPct}
                onChange={(e) => handleInputChange('depositDefaultPct', e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter as decimal (e.g., 0.30 for 30%)
              </p>
            </div>
            
            <div>
              <Label htmlFor="validityDays">Quote Validity (Days)</Label>
              <Input
                id="validityDays"
                type="number"
                min="1"
                max="365"
                value={formData.validityDays}
                onChange={(e) => handleInputChange('validityDays', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Branding & Colors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Logo Upload */}
            <div>
              <Label>Company Logo</Label>
              <div className="mt-2 flex items-center gap-4">
                {brandingData.logoUrl && (
                  <img 
                    src={brandingData.logoUrl} 
                    alt="Company logo" 
                    className="h-16 w-auto object-contain border border-slate-200 rounded"
                  />
                )}
                <div className="flex-1">
                  <Input
                    value={brandingData.logoUrl}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Enter a URL to your company logo (will appear on PDF quotes)
                  </p>
                </div>
              </div>
            </div>

            {/* Primary Color */}
            <div>
              <Label>Primary Brand Color</Label>
              <div className="flex items-center gap-4 mt-2">
                <input
                  type="color"
                  value={brandingData.primaryColor}
                  onChange={(e) => setBrandingData(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <div className="flex-1">
                  <Input
                    value={brandingData.primaryColor}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, primaryColor: e.target.value }))}
                    placeholder="#000000"
                    className="font-mono"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Used for headers, borders, and accents in PDF quotes
              </p>
            </div>
            
            {/* Secondary Color */}
            <div>
              <Label>Secondary Color</Label>
              <div className="flex items-center gap-4 mt-2">
                <input
                  type="color"
                  value={brandingData.secondaryColor}
                  onChange={(e) => setBrandingData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <div className="flex-1">
                  <Input
                    value={brandingData.secondaryColor}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                    placeholder="#1f2937"
                    className="font-mono"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Used for text and headings in PDF quotes
              </p>
            </div>

            {/* Accent Color */}
            <div>
              <Label>Accent Color</Label>
              <div className="flex items-center gap-4 mt-2">
                <input
                  type="color"
                  value={brandingData.accentColor}
                  onChange={(e) => setBrandingData(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="w-12 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <div className="flex-1">
                  <Input
                    value={brandingData.accentColor}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, accentColor: e.target.value }))}
                    placeholder="#10b981"
                    className="font-mono"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Used for highlights and call-to-action elements
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quote Terms */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quote Terms & Conditions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div>
            <Label htmlFor="pdfTerms">Default Terms & Conditions</Label>
            <Textarea
              id="pdfTerms"
              value={formData.pdfTerms}
              onChange={(e) => handleInputChange('pdfTerms', e.target.value)}
              placeholder="Enter your standard terms and conditions for quotes..."
              rows={8}
              className="mt-1"
            />
            <p className="text-xs text-slate-500 mt-1">
              These terms will be automatically included in all PDF quotes
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button 
          type="submit"
          className="min-w-32"
          disabled={updateSettingsMutation.isPending || updateOrgMutation.isPending}
        >
          {(updateSettingsMutation.isPending || updateOrgMutation.isPending) ? (
            'Saving...'
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

