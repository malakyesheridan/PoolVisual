import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOrgs } from "@/hooks/useOrgs";
import { 
  Settings as SettingsIcon, 
  Palette, 
  DollarSign, 
  FileText,
  Save,
  User,
  Building
} from "lucide-react";

export default function Settings() {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    currencyCode: 'AUD',
    taxRate: '0.10',
    depositDefaultPct: '0.30',
    validityDays: '30',
    pdfTerms: '',
  });
  const [brandingData, setBrandingData] = useState({
    primaryColor: '#0ea5e9',
    secondaryColor: '#1f2937',
    accentColor: '#10b981',
    logoUrl: '',
  });

  const { toast } = useToast();

  const { data: orgs = [] } = useOrgs();

  const { data: settings } = useQuery({
    queryKey: ['/api/settings', selectedOrgId],
    queryFn: () => selectedOrgId ? apiClient.getSettings(selectedOrgId) : Promise.resolve(null),
    enabled: !!selectedOrgId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const { data: organization } = useQuery({
    queryKey: ['/api/orgs', selectedOrgId],
    queryFn: () => selectedOrgId ? apiClient.getOrg(selectedOrgId) : Promise.resolve(null),
    enabled: !!selectedOrgId,
    staleTime: 2 * 60 * 1000,
  });

  // Update form data when settings change
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

  // Update branding data when organization changes
  useEffect(() => {
    if (organization) {
      const brandColors = organization.brandColors as { primary?: string; secondary?: string; accent?: string } | null || {};
      setBrandingData({
        primaryColor: brandColors.primary || '#0ea5e9',
        secondaryColor: brandColors.secondary || '#1f2937',
        accentColor: brandColors.accent || '#10b981',
        logoUrl: organization.logoUrl || '',
      });
    }
  }, [organization]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => selectedOrgId ? apiClient.updateSettings(selectedOrgId, data) : Promise.reject('No org selected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Settings saved",
        description: "Your organization settings have been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateOrgMutation = useMutation({
    mutationFn: (data: any) => selectedOrgId ? apiClient.updateOrg(selectedOrgId, data) : Promise.reject('No org selected'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orgs'] });
      toast({
        title: "Branding saved",
        description: "Your organization branding has been updated.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error saving branding",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Auto-select first org if available (use effect to avoid render issues)
  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [selectedOrgId, orgs.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const settingsData = {
      ...formData,
      taxRate: parseFloat(formData.taxRate),
      depositDefaultPct: parseFloat(formData.depositDefaultPct),
      validityDays: parseInt(formData.validityDays),
    };

    updateSettingsMutation.mutate(settingsData);

    // Also save branding
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

  return (
    <div className="bg-slate-50">      
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <SettingsIcon className="w-8 h-8 text-slate-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">
              Organization Settings
            </h1>
            <p className="text-slate-600 mt-1">
              Configure your organization's quoting preferences and branding
            </p>
          </div>
        </div>

        {/* Organization Selector */}
        {orgs.length > 1 && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Building className="w-5 h-5 text-slate-600" />
                <div className="flex-1">
                  <Label className="text-sm font-medium">Organization</Label>
                  <Select value={selectedOrgId || ''} onValueChange={setSelectedOrgId}>
                    <SelectTrigger className="mt-1" data-testid="select-organization">
                      <SelectValue placeholder="Select organization to configure" />
                    </SelectTrigger>
                    <SelectContent>
                      {orgs.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {selectedOrgId && (
          <form onSubmit={handleSubmit} className="space-y-6">
            
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
                      <SelectTrigger className="mt-1" data-testid="select-currency">
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
                      data-testid="input-tax-rate"
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
                      data-testid="input-deposit-percentage"
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
                      data-testid="input-validity-days"
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
                          data-testid="input-logo-url"
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
                        data-testid="input-primary-color"
                      />
                      <div className="flex-1">
                        <Input
                          value={brandingData.primaryColor}
                          onChange={(e) => setBrandingData(prev => ({ ...prev, primaryColor: e.target.value }))}
                          placeholder="#0ea5e9"
                          className="font-mono"
                          data-testid="input-primary-color-text"
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
                        data-testid="input-secondary-color"
                      />
                      <div className="flex-1">
                        <Input
                          value={brandingData.secondaryColor}
                          onChange={(e) => setBrandingData(prev => ({ ...prev, secondaryColor: e.target.value }))}
                          placeholder="#1f2937"
                          className="font-mono"
                          data-testid="input-secondary-color-text"
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
                        data-testid="input-accent-color"
                      />
                      <div className="flex-1">
                        <Input
                          value={brandingData.accentColor}
                          onChange={(e) => setBrandingData(prev => ({ ...prev, accentColor: e.target.value }))}
                          placeholder="#10b981"
                          className="font-mono"
                          data-testid="input-accent-color-text"
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
                    data-testid="textarea-pdf-terms"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    These terms will be automatically included in all PDF quotes
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* User Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  User Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Date Format</Label>
                    <Select defaultValue="dd/mm/yyyy">
                      <SelectTrigger className="mt-1" data-testid="select-date-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dd/mm/yyyy">DD/MM/YYYY</SelectItem>
                        <SelectItem value="mm/dd/yyyy">MM/DD/YYYY</SelectItem>
                        <SelectItem value="yyyy-mm-dd">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label>Measurement Units</Label>
                    <Select defaultValue="metric">
                      <SelectTrigger className="mt-1" data-testid="select-units">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="metric">Metric (m, m²)</SelectItem>
                        <SelectItem value="imperial">Imperial (ft, ft²)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button 
                type="submit"
                className="min-w-32"
                disabled={updateSettingsMutation.isPending}
                data-testid="button-save-settings"
              >
                {updateSettingsMutation.isPending ? (
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
        )}

        {!selectedOrgId && orgs.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <Building className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No organization found</h3>
              <p className="text-slate-500">
                You need to be a member of an organization to configure settings.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
