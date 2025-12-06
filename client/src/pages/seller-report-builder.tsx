import { useState, useRef, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Mail, Loader2 } from 'lucide-react';
import { ReportLayout } from '@/components/reports/ReportLayout';
import { ReportHeroImage } from '@/components/reports/ReportHeroImage';
import { ReportCampaignOverview } from '@/components/reports/ReportCampaignOverview';
import { ReportPropertyOverview } from '@/components/reports/ReportPropertyOverview';
import { ReportBuyerMatchSection } from '@/components/reports/ReportBuyerMatchSection';
import { ReportMarketOverview } from '@/components/reports/ReportMarketOverview';
import { ReportImageGallery } from '@/components/reports/ReportImageGallery';
import { ReportAgentCommentaryEditor } from '@/components/reports/ReportAgentCommentaryEditor';
import { exportToPdf, exportToPdfBase64 } from '@/lib/pdf/clientPdfExporter';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function SellerReportBuilder() {
  const [, params] = useRoute('/seller-report-builder/:propertyId');
  const [, navigate] = useLocation();
  const propertyId = params?.propertyId;
  const { toast } = useToast();
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [agentCommentary, setAgentCommentary] = useState('');
  const [marketInsights, setMarketInsights] = useState('');
  const [heroSummary, setHeroSummary] = useState('');
  const [propertySummary, setPropertySummary] = useState('');
  const [medianSuburbPrice, setMedianSuburbPrice] = useState('');
  const [daysOnMarket, setDaysOnMarket] = useState('');
  const [recentComparableSales, setRecentComparableSales] = useState('');
  const [selectedImages, setSelectedImages] = useState<{
    heroImageId?: string | null;
    additionalImageIds?: string[];
    // Legacy support
    heroImage?: string | null;
    additionalImages?: string[];
  }>({
    heroImageId: null,
    additionalImageIds: [],
    heroImage: null,
    additionalImages: [],
  });
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [headshotUrl, setHeadshotUrl] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [agentTitle, setAgentTitle] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentEmail, setAgentEmail] = useState('');

  // Load property data
  const { data: property, isLoading: propertyLoading } = useQuery({
    queryKey: ['/api/jobs', propertyId],
    queryFn: () => propertyId ? apiClient.getJob(propertyId) : Promise.resolve(null),
    enabled: !!propertyId,
  });

  // Load property photos
  const { data: photos = [] } = useQuery({
    queryKey: ['/api/jobs', propertyId, 'photos', 'marketing'],
    queryFn: () => propertyId ? apiClient.getJobPhotos(propertyId, 'marketing') : Promise.resolve([]),
    enabled: !!propertyId,
  });

  // Load matched buyers
  const { data: matchedBuyers, isLoading: buyersLoading } = useQuery({
    queryKey: ['/api/jobs', propertyId, 'matched-buyers'],
    queryFn: () => propertyId ? apiClient.getMatchedBuyers(propertyId) : Promise.resolve(null),
    enabled: !!propertyId,
  });

  // Load selected images from URL params or localStorage
  useEffect(() => {
    if (propertyId) {
      const stored = localStorage.getItem(`report-images-${propertyId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSelectedImages(parsed);
        } catch (e) {
          console.error('Failed to parse stored images', e);
        }
      }
    }
  }, [propertyId]);

  // Save selected images to localStorage
  useEffect(() => {
    if (propertyId && (selectedImages.heroImageId || selectedImages.heroImage)) {
      localStorage.setItem(`report-images-${propertyId}`, JSON.stringify(selectedImages));
    }
  }, [propertyId, selectedImages]);

  // Email mutation
  const emailReportMutation = useMutation({
    mutationFn: async ({ to, pdfBase64, propertyId }: { to: string; pdfBase64: string; propertyId: string }) => {
      return fetch('/api/send-report-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ to, pdfBase64, propertyId }),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to send email');
        return res.json();
      });
    },
    onSuccess: () => {
      toast({
        title: 'Email sent',
        description: 'The report has been sent successfully.',
      });
      setShowEmailDialog(false);
      setEmailAddress('');
    },
    onError: (error: Error) => {
      toast({
        title: 'Error sending email',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDownloadPdf = async () => {
    if (!reportRef.current) {
      toast({
        title: 'Error',
        description: 'Report content not found',
        variant: 'destructive',
      });
      return;
    }

    try {
      const filename = `seller-report-${property?.address || propertyId || 'report'}-${new Date().toISOString().split('T')[0]}.pdf`;
      await exportToPdf(reportRef.current, {
        filename,
        format: 'a4',
        orientation: 'portrait',
        margin: 10,
      });
      
      toast({
        title: 'PDF downloaded',
        description: 'The report has been downloaded successfully.',
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: 'Error generating PDF',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const handleEmailReport = async () => {
    if (!reportRef.current || !propertyId) return;

    try {
      const pdfBase64 = await exportToPdfBase64(reportRef.current, {
        format: 'a4',
        orientation: 'portrait',
        margin: 10,
      });

      emailReportMutation.mutate({
        to: emailAddress,
        pdfBase64,
        propertyId,
      });
    } catch (error) {
      console.error('PDF export error:', error);
      toast({
        title: 'Error generating PDF',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  if (propertyLoading || buyersLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Property not found</h1>
          <Button onClick={() => navigate('/properties')}>Back to Properties</Button>
        </div>
      </div>
    );
  }

  // Helper to safely get URL from photo, returning null if none exist
  const getPhotoUrl = (photo: typeof photos[0]): string | null => {
    const url = photo?.originalUrl || photo?.url || photo?.thumbnailUrl;
    return url && url.trim() !== '' ? url : null;
  };

  // Helper to get photo by ID
  const getPhotoById = (photoId: string) => photos.find(p => p.id === photoId);

  // Resolve hero image URL: prefer ID-based lookup, fallback to legacy URL or first photo
  let heroImageUrl: string | null = null;
  if (selectedImages.heroImageId) {
    const photo = getPhotoById(selectedImages.heroImageId);
    heroImageUrl = photo ? getPhotoUrl(photo) : null;
  } else if (selectedImages.heroImage) {
    // Legacy support: use stored URL directly
    heroImageUrl = selectedImages.heroImage;
  } else {
    // Fallback to first photo
    heroImageUrl = getPhotoUrl(photos[0]) ?? null;
  }

  // Resolve additional image URLs: prefer ID-based lookup, fallback to legacy URLs or photos
  let additionalImageUrls: string[] = [];
  if (selectedImages.additionalImageIds && selectedImages.additionalImageIds.length > 0) {
    additionalImageUrls = selectedImages.additionalImageIds
      .map(id => {
        const photo = getPhotoById(id);
        return photo ? getPhotoUrl(photo) : null;
      })
      .filter((url): url is string => url !== null && url.trim() !== '');
  } else if (selectedImages.additionalImages && selectedImages.additionalImages.length > 0) {
    // Legacy support: use stored URLs directly
    additionalImageUrls = selectedImages.additionalImages.filter(
      (url): url is string => url !== null && url.trim() !== ''
    );
  } else {
    // Fallback to remaining photos
    additionalImageUrls = photos.slice(1, 7).map(getPhotoUrl).filter((url): url is string => url !== null);
  }

  // Prepare buyer match data
  const buyerMatches = matchedBuyers?.matches || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toolbar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/properties/${propertyId}`)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <h1 className="text-lg font-semibold">Seller Activity Report</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleDownloadPdf}
                variant="outline"
              >
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              <Button
                onClick={() => setShowEmailDialog(true)}
              >
                <Mail className="w-4 h-4 mr-2" />
                Email Report
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar for Branding */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sticky top-24">
              <h3 className="text-lg font-medium mb-4">Branding</h3>
              
              {/* Logo Upload */}
              <div className="mb-4">
                <Label htmlFor="logo-upload" className="text-sm text-gray-500 mb-2 block">
                  Logo
                </Label>
                <Input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setLogoUrl(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="text-sm"
                />
                {logoUrl && (
                  <div className="mt-2">
                    <img src={logoUrl} alt="Logo preview" className="max-w-[120px] h-auto object-contain" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setLogoUrl(null)}
                      className="mt-1 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              {/* Headshot Upload */}
              <div className="mb-4">
                <Label htmlFor="headshot-upload" className="text-sm text-gray-500 mb-2 block">
                  Agent Headshot
                </Label>
                <Input
                  id="headshot-upload"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setHeadshotUrl(event.target?.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="text-sm"
                />
                {headshotUrl && (
                  <div className="mt-2">
                    <img src={headshotUrl} alt="Headshot preview" className="w-16 h-16 rounded-full object-cover" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setHeadshotUrl(null)}
                      className="mt-1 text-xs"
                    >
                      Remove
                    </Button>
                  </div>
                )}
              </div>

              {/* Agent Details */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="agent-name" className="text-sm text-gray-500 mb-1 block">
                    Agent Name
                  </Label>
                  <Input
                    id="agent-name"
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="John Smith"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="agent-title" className="text-sm text-gray-500 mb-1 block">
                    Title
                  </Label>
                  <Input
                    id="agent-title"
                    type="text"
                    value={agentTitle}
                    onChange={(e) => setAgentTitle(e.target.value)}
                    placeholder="Senior Sales Agent"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="agent-phone" className="text-sm text-gray-500 mb-1 block">
                    Phone
                  </Label>
                  <Input
                    id="agent-phone"
                    type="text"
                    value={agentPhone}
                    onChange={(e) => setAgentPhone(e.target.value)}
                    placeholder="+61 400 000 000"
                    className="text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="agent-email" className="text-sm text-gray-500 mb-1 block">
                    Email
                  </Label>
                  <Input
                    id="agent-email"
                    type="email"
                    value={agentEmail}
                    onChange={(e) => setAgentEmail(e.target.value)}
                    placeholder="agent@example.com"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Main Report Content */}
          <div ref={reportRef} className="bg-white tracking-tight flex-1">
            <ReportLayout>
              {/* Hero Image with Address and Summary */}
              <ReportHeroImage
                imageUrl={heroImageUrl}
                address={property.address || property.clientName}
                summary={heroSummary}
                onSummaryChange={setHeroSummary}
                logoUrl={logoUrl}
                headshotUrl={headshotUrl}
                agentName={agentName}
                agentTitle={agentTitle}
                agentPhone={agentPhone}
                agentEmail={agentEmail}
              />

            {/* Campaign Overview */}
            <ReportCampaignOverview
              daysOnMarket={(() => {
                if (!property.listingDate) return undefined;
                try {
                  const listingDate = new Date(property.listingDate);
                  const listingTime = listingDate.getTime();
                  // Check if date is valid (getTime returns NaN for invalid dates)
                  if (isNaN(listingTime)) return undefined;
                  const days = Math.floor((Date.now() - listingTime) / (1000 * 60 * 60 * 24));
                  // Ensure result is a valid number
                  return isNaN(days) ? undefined : days;
                } catch {
                  return undefined;
                }
              })()}
              advertisedPrice={property.estimatedPrice ? Number(property.estimatedPrice) : undefined}
              enquiries={buyerMatches.length}
            />

            {/* Property Overview */}
            <ReportPropertyOverview
              bedrooms={property.bedrooms}
              bathrooms={property.bathrooms}
              carSpaces={property.garageSpaces}
              landSize={property.landSizeM2 || property.landSize}
              summary={propertySummary}
              onSummaryChange={setPropertySummary}
            />

            {/* Market Overview */}
            <ReportMarketOverview
              medianSuburbPrice={medianSuburbPrice}
              daysOnMarket={daysOnMarket}
              recentComparableSales={recentComparableSales}
              onMedianPriceChange={setMedianSuburbPrice}
              onDaysOnMarketChange={setDaysOnMarket}
              onComparableSalesChange={setRecentComparableSales}
            />

            {/* Buyer Match Analysis */}
            {buyerMatches.length > 0 && (
              <ReportBuyerMatchSection matches={buyerMatches} />
            )}

            {/* Image Gallery */}
            {additionalImageUrls.length > 0 && (
              <ReportImageGallery
                images={additionalImageUrls}
                title="Property Images"
              />
            )}

            {/* Agent Commentary */}
            <ReportAgentCommentaryEditor
              value={agentCommentary}
              onChange={setAgentCommentary}
              label="Agent Commentary"
            />

            {/* Market Insights */}
            <ReportAgentCommentaryEditor
              value={marketInsights}
              onChange={setMarketInsights}
              label="Market Insights"
            />
          </ReportLayout>
          </div>
        </div>
      </div>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Recipient Email</Label>
              <Input
                id="email"
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEmailDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleEmailReport}
              disabled={!emailAddress || emailReportMutation.isPending}
            >
              {emailReportMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Email'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

