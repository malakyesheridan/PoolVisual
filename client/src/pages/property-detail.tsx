import { useState, useRef, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Camera, 
  User, 
  MapPin, 
  Phone, 
  Mail,
  Calendar,
  FileText,
  Upload,
  Edit,
  Trash2,
  Plus,
  Eye,
  Send,
  X,
  ImageIcon,
  DollarSign
} from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { PhotoGridSkeleton } from "@/components/ui/skeleton-variants";
import { Breadcrumbs } from "@/components/common/Breadcrumbs";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/measurement-utils";
import { QuoteEditorModal } from "@/components/quotes/QuoteEditorModal";
import { useEditorStore } from "@/new_editor/store";
import { Modal } from "@/components/common/Modal";
import { Form } from "@/components/ui/form";
import { FormField } from "@/components/common/FormField";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { editClientSchema, type EditClientFormData } from "@/lib/form-validation";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { useIsRealEstate } from "@/hooks/useIsRealEstate";
import { useAuthStore } from "@/stores/auth-store";
import { PhotoCard } from "@/components/photos/PhotoCard";
import { PropertyDetailsForm } from "@/components/properties/PropertyDetailsForm";
import { PropertyNotes } from "@/components/properties/PropertyNotes";

export default function PropertyDetail() {
  const [, params] = useRoute('/properties/:id');
  const [, navigate] = useLocation();
  const jobId = params?.id;
  const { toast } = useToast();
  const [previewPhoto, setPreviewPhoto] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeletePhotoConfirm, setShowDeletePhotoConfirm] = useState<string | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);
  const [showQuoteEditor, setShowQuoteEditor] = useState(false);
  const isRealEstate = useIsRealEstate();
  const { user } = useAuthStore();

  // This is the real estate page, so isRealEstate should always be true
  // But we'll keep the check for safety

  const editForm = useForm<EditClientFormData>({
    resolver: zodResolver(editClientSchema),
    defaultValues: {
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      address: '',
    }
  });

  const { data: job, isLoading } = useQuery({
    queryKey: ['/api/jobs', jobId],
    queryFn: () => jobId ? apiClient.getJob(jobId) : Promise.resolve(null),
    enabled: !!jobId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['/api/quotes', jobId],
    queryFn: () => jobId ? apiClient.getQuotes(job?.orgId || '', { jobId }) : Promise.resolve([]),
    enabled: !!jobId && !!job?.orgId,
    staleTime: 30 * 1000, // 30 seconds - quotes can change more frequently
  });

  // Fetch linked opportunities for this property (real estate only)
  const { data: linkedOpportunities = [], isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['/api/opportunities', jobId, 'linked'],
    queryFn: () => jobId ? apiClient.getOpportunities({ propertyJobId: jobId }) : Promise.resolve([]),
    enabled: !!jobId && isRealEstate,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  // For real estate: separate queries for marketing and renovation photos
  // For trades: single query for all photos
  const { data: allPhotos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['/api/jobs', jobId, 'photos'],
    queryFn: () => jobId ? apiClient.getJobPhotos(jobId) : Promise.resolve([]),
    enabled: !!jobId && !isRealEstate,
    staleTime: 1 * 60 * 1000, // 1 minute
  });

  const { data: marketingPhotos = [], isLoading: marketingPhotosLoading } = useQuery({
    queryKey: ['/api/jobs', jobId, 'photos', 'marketing'],
    queryFn: () => jobId ? apiClient.getJobPhotos(jobId, 'marketing') : Promise.resolve([]),
    enabled: !!jobId && isRealEstate,
    staleTime: 1 * 60 * 1000,
  });

  const { data: renovationPhotos = [], isLoading: renovationPhotosLoading } = useQuery({
    queryKey: ['/api/jobs', jobId, 'photos', 'renovation_buyer'],
    queryFn: () => jobId ? apiClient.getJobPhotos(jobId, 'renovation_buyer') : Promise.resolve([]),
    enabled: !!jobId && isRealEstate,
    staleTime: 1 * 60 * 1000,
  });

  // Use appropriate photos based on industry
  const photos = isRealEstate ? marketingPhotos : allPhotos;
  const renovationBuyerPhotos = isRealEstate ? renovationPhotos : [];

  // Listen for photo refresh events from the editor
  useEffect(() => {
    const handleRefreshJobPhotos = (event: CustomEvent) => {
      if (event.detail.jobId === jobId) {
        // Refresh the photos query
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      }
    };

    window.addEventListener('refreshJobPhotos', handleRefreshJobPhotos as EventListener);
    return () => {
      window.removeEventListener('refreshJobPhotos', handleRefreshJobPhotos as EventListener);
    };
  }, [jobId, queryClient]);

  const createQuoteMutation = useMutation({
    mutationFn: (data: any) => apiClient.createQuote(data),
    onSuccess: (quote) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', jobId] });
      toast({
        title: "Quote created",
        description: "The quote has been created successfully.",
      });
      navigate(`/quotes/${quote.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error creating quote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadPhotoMutation = useMutation({
    mutationFn: ({ file, jobId, category }: { file: File; jobId: string; category?: 'marketing' | 'renovation_buyer' }) => 
      apiClient.uploadPhoto(file, jobId, category || 'marketing'),
    onSuccess: (photo) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      if (isRealEstate) {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos', 'marketing'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos', 'renovation_buyer'] });
      }
      toast({
        title: "Photo uploaded",
        description: "The photo has been uploaded successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error uploading photo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => apiClient.deletePhoto(photoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
      if (isRealEstate) {
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos', 'marketing'] });
        queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos', 'renovation_buyer'] });
      }
      toast({
        title: "Photo deleted",
        description: "The photo has been deleted successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting photo",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const sendQuoteMutation = useMutation({
    mutationFn: ({ quoteId, clientEmail }: { quoteId: string; clientEmail?: string }) => 
      apiClient.sendQuote(quoteId, clientEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', jobId] });
      toast({
        title: "Quote sent",
        description: "The quote has been sent successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error sending quote",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const duplicateJobMutation = useMutation({
    mutationFn: (jobData: any) => apiClient.createJob(jobData),
    onSuccess: (newJob) => {
      navigate(`/properties/${newJob.id}`);
      toast({
        title: "Property duplicated",
        description: "The property has been duplicated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error duplicating job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateJobMutation = useMutation({
    mutationFn: (data: any) => apiClient.updateJob(jobId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      setShowEditModal(false);
      toast({
        title: "Client info updated",
        description: "The client information has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating client info",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePropertyDetailsMutation = useMutation({
    mutationFn: (data: any) => apiClient.updateJob(jobId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId] });
      toast({
        title: "Property details updated",
        description: "The property details have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating property details",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Quote item management mutations
  const addQuoteItemMutation = useMutation({
    mutationFn: (data: { quoteId: string; item: any }) => 
      apiClient.addQuoteItem(data.quoteId, data.item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', editingQuoteId] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', editingQuoteId, 'items'] });
      toast({ title: "Item added to quote" });
    },
    onError: (error) => {
      toast({
        title: "Error adding item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateQuoteItemMutation = useMutation({
    mutationFn: (data: { quoteId: string; itemId: string; updates: any }) => 
      apiClient.updateQuoteItem(data.quoteId, data.itemId, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', editingQuoteId] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', editingQuoteId, 'items'] });
      toast({ title: "Quote item updated" });
    },
    onError: (error) => {
      toast({
        title: "Error updating item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteQuoteItemMutation = useMutation({
    mutationFn: (data: { quoteId: string; itemId: string }) => 
      apiClient.removeQuoteItem(data.quoteId, data.itemId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', editingQuoteId] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', editingQuoteId, 'items'] });
      toast({ title: "Quote item removed" });
    },
    onError: (error) => {
      toast({
        title: "Error removing item",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const syncFromCanvasMutation = useMutation({
    mutationFn: (data: { quoteId: string; itemId: string; measurementData: any }) => 
      apiClient.updateQuoteItemFromCanvas(data.quoteId, data.itemId, data.measurementData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', editingQuoteId] });
      queryClient.invalidateQueries({ queryKey: ['/api/quotes', editingQuoteId, 'items'] });
      toast({ title: "Quote item synced from canvas" });
    },
    onError: (error) => {
      toast({
        title: "Error syncing from canvas",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const renovationFileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>, category: 'marketing' | 'renovation_buyer' = 'marketing') => {
    const file = event.target.files?.[0];
    if (file && jobId) {
      uploadPhotoMutation.mutate({ file, jobId, category });
    }
    // Reset input
    event.target.value = '';
  };

  const handleUploadClick = (category: 'marketing' | 'renovation_buyer' = 'marketing') => {
    if (category === 'renovation_buyer') {
      renovationFileInputRef.current?.click();
    } else {
      fileInputRef.current?.click();
    }
  };

  if (isLoading) {
    return (
      <div className="bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="animate-pulse">
            <div className="h-8 bg-slate-200 rounded w-64 mb-4"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card className="h-48"></Card>
                <Card className="h-32"></Card>
              </div>
              <div className="space-y-6">
                <Card className="h-64"></Card>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="bg-slate-50">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Property not found</h1>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // Build breadcrumbs
  const breadcrumbs = [
    { label: 'Properties', href: '/properties', icon: FileText },
    { label: job?.clientName || 'Property Details', href: null }
  ];

  const getQuoteStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-primary/10 text-primary';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleCreateQuote = () => {
    if (!job) return;
    
    const quoteData = {
      jobId: job.id,
      orgId: job.orgId,
      clientName: job.clientName,
      clientEmail: job.clientEmail,
      clientPhone: job.clientPhone,
      address: job.address,
      status: 'draft',
      items: [],
      subtotal: '0',
      gst: '0',
      total: '0',
      depositPct: '0.3'
    };

    createQuoteMutation.mutate(quoteData);
  };

  const handleDuplicateJob = () => {
    if (!job) return;
    
    const duplicateData = {
      orgId: job.orgId,
      clientName: `${job.clientName} (Copy)`,
      clientPhone: job.clientPhone,
      clientEmail: job.clientEmail,
      address: job.address,
      status: 'new' as const,
    };
    
    duplicateJobMutation.mutate(duplicateData);
  };

  const handleEditClientInfo = () => {
    if (!job) return;
    
    setEditForm({
      clientName: job.clientName || '',
      clientPhone: job.clientPhone || '',
      clientEmail: job.clientEmail || '',
      address: job.address || '',
    });
    setShowEditModal(true);
  };

  const handleSaveClientInfo = async (data: EditClientFormData) => {
    updateJobMutation.mutate(data);
  };

  const handleEditJob = () => {
    // For now, just show a toast message since we don't have a full property edit modal
    toast({
      title: "Edit Property",
      description: "Property editing functionality will be available soon.",
    });
  };

  const handleDeleteJob = () => {
    // For now, just show a toast message since we don't have delete functionality
    toast({
      title: "Delete Property",
      description: "Property deletion functionality will be available soon.",
      variant: "destructive",
    });
  };

  return (
    <div className="bg-slate-50 pb-20 md:pb-0">      
      <div className="w-full max-w-[98%] xl:max-w-[1600px] mx-auto px-3 md:px-6 py-4 md:py-8">
        {/* Mobile Header */}
        <div className="md:hidden safe-top bg-white border-b border-gray-200 px-4 py-3 -mx-4 md:mx-0 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/dashboard')}
                data-testid="button-back-mobile"
                className="tap-target"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <h1 className="font-semibold mobile-text-lg" data-testid="text-client-name-mobile">
                {job.clientName}
              </h1>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleEditJob} 
              data-testid="button-edit-job-mobile"
              className="tap-target"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Desktop Breadcrumbs */}
        <div className="hidden md:block mb-6">
          <Breadcrumbs items={breadcrumbs} />
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/dashboard')}
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1" data-testid="text-client-name">
                {job.clientName}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleEditJob} data-testid="button-edit-job">
              <Edit className="w-4 h-4 mr-2" />
              Edit Property
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Photos Section - Conditional rendering based on industry */}
            {isRealEstate ? (
              <>
                {/* Marketing Photos Section (Real Estate) */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Marketing Photos ({marketingPhotos.length})
                    </CardTitle>
                    <Button 
                      size="sm" 
                      data-testid="button-upload-marketing-photo"
                      onClick={() => handleUploadClick('marketing')}
                      disabled={uploadPhotoMutation.isPending}
                      className="h-11 md:h-auto tap-target"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">{uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload Photo'}</span>
                      <span className="sm:hidden">{uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload'}</span>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {marketingPhotosLoading ? (
                      <PhotoGridSkeleton count={6} />
                    ) : marketingPhotos.length === 0 ? (
                      <EmptyState
                        icon={ImageIcon}
                        title="No marketing photos uploaded yet"
                        description="Upload marketing photos for property listings. These photos will be used for marketing and showcasing the property."
                        primaryAction={{
                          label: uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload Photo',
                          onClick: () => handleUploadClick('marketing'),
                          icon: Upload
                        }}
                      />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {marketingPhotos.map((photo) => (
                          <PhotoCard 
                            key={photo.id} 
                            photo={photo} 
                            photos={marketingPhotos}
                            jobId={jobId}
                            navigate={navigate}
                            setPreviewPhoto={setPreviewPhoto}
                            setShowDeletePhotoConfirm={setShowDeletePhotoConfirm}
                            deletePhotoMutation={deletePhotoMutation}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Renovation / Buyer Photos Section (Real Estate) */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Camera className="w-5 h-5" />
                      Renovation / Buyer Photos ({renovationPhotos.length})
                    </CardTitle>
                    <Button 
                      size="sm" 
                      data-testid="button-upload-renovation-photo"
                      onClick={() => handleUploadClick('renovation_buyer')}
                      disabled={uploadPhotoMutation.isPending}
                      className="h-11 md:h-auto tap-target"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      <span className="hidden sm:inline">{uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload Photo'}</span>
                      <span className="sm:hidden">{uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload'}</span>
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {renovationPhotosLoading ? (
                      <PhotoGridSkeleton count={6} />
                    ) : renovationPhotos.length === 0 ? (
                      <EmptyState
                        icon={ImageIcon}
                        title="No renovation/buyer photos uploaded yet"
                        description="Upload photos showing renovation work or buyer-specific views. These photos are separate from marketing photos."
                        primaryAction={{
                          label: uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload Photo',
                          onClick: () => handleUploadClick('renovation_buyer'),
                          icon: Upload
                        }}
                      />
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {renovationPhotos.map((photo) => (
                          <PhotoCard 
                            key={photo.id} 
                            photo={photo} 
                            photos={renovationPhotos}
                            jobId={jobId}
                            navigate={navigate}
                            setPreviewPhoto={setPreviewPhoto}
                            setShowDeletePhotoConfirm={setShowDeletePhotoConfirm}
                            deletePhotoMutation={deletePhotoMutation}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              /* Standard Photos Section (Trades) */
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Camera className="w-5 h-5" />
                    Photos ({photos.length})
                  </CardTitle>
                  <Button 
                    size="sm" 
                    data-testid="button-upload-photo"
                    onClick={() => handleUploadClick('marketing')}
                    disabled={uploadPhotoMutation.isPending}
                    className="h-11 md:h-auto tap-target"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">{uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload Photo'}</span>
                    <span className="sm:hidden">{uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload'}</span>
                  </Button>
                </CardHeader>
                <CardContent>
                  {photosLoading ? (
                    <PhotoGridSkeleton count={6} />
                  ) : photos.length === 0 ? (
                    <EmptyState
                      icon={ImageIcon}
                      title="No photos uploaded yet"
                      description="Upload photos to get started with canvas editing and measurements. You can apply materials, create masks, and generate accurate measurements."
                      primaryAction={{
                        label: uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload Photo',
                        onClick: () => handleUploadClick('marketing'),
                        icon: Upload
                      }}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {photos.map((photo) => (
                      <div 
                        key={photo.id}
                        className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-video bg-slate-100 relative">
                          {photo.originalUrl ? (
                            <img 
                              src={photo.originalUrl} 
                              alt={`Photo ${photo.id.slice(-8)}`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera className="w-8 h-8 text-slate-400" />
                            </div>
                          )}
                          
                          {/* Image Hover Overlay - Preview Only */}
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center group">
                            <Button
                              size="sm"
                              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                              onClick={async () => {
                                try {
                                  // Try to get composite/edited version for preview display
                                  const composite = await apiClient.getComposite(photo.id);
                                  if (composite?.afterUrl) {
                                    setPreviewPhoto({
                                      ...photo,
                                      // Keep originalUrl as the original photo URL (for editing)
                                      // Store composite URL separately for preview display
                                      compositeUrl: composite.afterUrl,
                                      photoIndex: photos.indexOf(photo) // Store original index
                                    });
                                  } else {
                                    // No composite available, use original
                                    setPreviewPhoto({
                                      ...photo,
                                      photoIndex: photos.indexOf(photo) // Store original index
                                    });
                                  }
                                } catch (error) {
                                  console.warn('Failed to get composite, using original:', error);
                                  setPreviewPhoto({
                                    ...photo,
                                    photoIndex: photos.indexOf(photo) // Store original index
                                  });
                                }
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              Preview
                            </Button>
                          </div>
                        </div>
                        
                        <div className="p-3">
                          <h4 className="font-medium text-slate-900 truncate">
                            Pool Photo {photos.indexOf(photo) + 1}
                          </h4>
                          <p className="text-sm text-slate-500">
                            {formatDistanceToNow(new Date(photo.createdAt), { addSuffix: true })}
                          </p>
                          
                          {/* Photo Status Indicators */}
                          <div className="flex items-center gap-2 mt-2">
                            {photo.canvasState && (
                              <Badge variant="secondary" className="text-xs">
                                Has Canvas Work
                              </Badge>
                            )}
                          </div>
                          
                          {/* Photo Actions */}
                          <div className="flex items-center gap-2 mt-3">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const { dispatch } = useEditorStore.getState();
                                
                                // Store job and photo context for the editor FIRST
                                if (jobId) {
                                  dispatch({
                                    type: 'SET_JOB_CONTEXT',
                                    payload: {
                                      jobId: jobId,
                                      photoId: photo.id
                                    }
                                  });
                                }
                                
                                // Clear previous state to prevent contamination (but preserve job context)
                                dispatch({ type: 'RESET' });
                                
                                // Load image to get actual dimensions
                                const img = new Image();
                                img.onload = () => {
                                  dispatch({
                                    type: 'SET_IMAGE',
                                    payload: {
                                      url: photo.originalUrl,
                                      width: img.naturalWidth,
                                      height: img.naturalHeight
                                    }
                                  });
                                  
                                  // Navigate to editor
                                  navigate('/new-editor');
                                };
                                img.onerror = () => {
                                  // Fallback with default dimensions
                                  dispatch({
                                    type: 'SET_IMAGE',
                                    payload: {
                                      url: photo.originalUrl,
                                      width: 1920,
                                      height: 1080
                                    }
                                  });
                                  navigate('/new-editor');
                                };
                                img.src = photo.originalUrl;
                              }}
                              className="flex-1"
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setShowDeletePhotoConfirm(photo.id)}
                              disabled={deletePhotoMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Quotes Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Quotes ({quotes.length})
                </CardTitle>
                <Button 
                  size="sm" 
                  onClick={handleCreateQuote}
                  disabled={createQuoteMutation.isPending}
                  data-testid="button-create-new-quote"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New Quote
                </Button>
              </CardHeader>
              <CardContent>
                {quotesLoading ? (
                  <div className="text-center p-8">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-500">Loading quotes...</p>
                  </div>
                ) : quotes.length === 0 ? (
                  <div className="text-center p-8">
                    <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No quotes created yet</h3>
                    <p className="text-slate-500 mb-4" data-testid="text-no-quotes">
                      Create quotes after uploading photos and marking areas for renovation
                    </p>
                    <Button 
                      onClick={handleCreateQuote}
                      disabled={createQuoteMutation.isPending}
                      data-testid="button-create-first-quote"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Your First Quote
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {quotes.map((quote) => (
                      <div 
                        key={quote.id}
                        className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/quotes/${quote.id}`)}
                        data-testid={`quote-item-${quote.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <h4 className="font-medium text-slate-900" data-testid={`text-quote-id-${quote.id}`}>
                              Quote #{quotes.indexOf(quote) + 1}
                            </h4>
                            <p className="text-sm text-slate-600">
                              Created {formatDistanceToNow(new Date(quote.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                          <Badge className={getQuoteStatusColor(quote.status)} data-testid={`badge-quote-status-${quote.id}`}>
                            {quote.status}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="font-medium text-slate-900" data-testid={`text-quote-total-${quote.id}`}>
                              {formatCurrency(parseFloat(quote.total || '0'))}
                            </p>
                            <p className="text-sm text-slate-600">
                              {quote.items?.length || 0} items
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/quotes/${quote.id}`);
                              }}
                              data-testid={`button-view-quote-${quote.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingQuoteId(quote.id);
                                setShowQuoteEditor(true);
                              }}
                              title="Edit Quote Items"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            
                            {quote.status === 'draft' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  sendQuoteMutation.mutate({ 
                                    quoteId: quote.id, 
                                    clientEmail: job?.clientEmail 
                                  });
                                }}
                                disabled={sendQuoteMutation.isPending}
                                data-testid={`button-send-quote-${quote.id}`}
                              >
                                <Send className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Property Details (Real Estate Only) */}
            {isRealEstate && job && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Property Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <PropertyDetailsForm
                    initialData={{
                      bedrooms: job.bedrooms,
                      bathrooms: job.bathrooms ? parseFloat(job.bathrooms.toString()) : null,
                      garageSpaces: job.garageSpaces,
                      estimatedPrice: job.estimatedPrice ? parseFloat(job.estimatedPrice.toString()) : null,
                      propertyType: job.propertyType as any,
                      landSizeM2: job.landSizeM2 ? parseFloat(job.landSizeM2.toString()) : null,
                      interiorSizeM2: job.interiorSizeM2 ? parseFloat(job.interiorSizeM2.toString()) : null,
                      yearBuilt: job.yearBuilt,
                      yearRenovated: job.yearRenovated,
                      propertyStatus: job.propertyStatus as any,
                      listingDate: job.listingDate ? new Date(job.listingDate).toISOString().split('T')[0] : null,
                      mlsNumber: job.mlsNumber,
                      propertyDescription: job.propertyDescription,
                      propertyFeatures: job.propertyFeatures as string[] || [],
                      propertyCondition: job.propertyCondition as any,
                      hoaFees: job.hoaFees ? parseFloat(job.hoaFees.toString()) : null,
                      propertyTaxes: job.propertyTaxes ? parseFloat(job.propertyTaxes.toString()) : null,
                      schoolDistrict: job.schoolDistrict,
                    }}
                    onSubmit={async (data) => {
                      await updatePropertyDetailsMutation.mutateAsync(data);
                    }}
                    isLoading={updatePropertyDetailsMutation.isPending}
                  />
                </CardContent>
              </Card>
            )}

            {/* Property Notes (Real Estate Only) */}
            {isRealEstate && jobId && (
              <>
                <PropertyNotes jobId={jobId} />
                
                {/* Linked Opportunities */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Linked Opportunities ({linkedOpportunities.length})</span>
                      <Button 
                        size="sm" 
                        onClick={() => navigate('/opportunities')}
                        variant="outline"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        New Opportunity
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {opportunitiesLoading ? (
                      <div className="text-center p-8">
                        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-slate-500">Loading opportunities...</p>
                      </div>
                    ) : linkedOpportunities.length === 0 ? (
                      <div className="text-center p-8">
                        <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-slate-900 mb-2">No linked opportunities</h3>
                        <p className="text-slate-500 mb-4">
                          Link opportunities to this property to track sales pipeline
                        </p>
                        <Button 
                          onClick={() => navigate('/opportunities')}
                          variant="outline"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Opportunity
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {linkedOpportunities.map((opp: any) => (
                          <div 
                            key={opp.id}
                            className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                            onClick={() => navigate(`/opportunities`)}
                          >
                            <div className="flex-1">
                              <h4 className="font-medium text-slate-900">{opp.title || 'Untitled Opportunity'}</h4>
                              <div className="flex items-center gap-4 mt-1 text-sm text-slate-600">
                                {opp.stageName && (
                                  <Badge variant="secondary" className="text-xs">
                                    {opp.stageName}
                                  </Badge>
                                )}
                                {opp.value && (
                                  <span className="flex items-center gap-1">
                                    <DollarSign className="w-3 h-3" />
                                    {formatCurrency(typeof opp.value === 'string' ? parseFloat(opp.value) : opp.value)}
                                  </span>
                                )}
                                <span className="text-slate-500">
                                  {formatDistanceToNow(new Date(opp.createdAt), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/opportunities');
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}

            {/* Client Information - Only for Trades */}
            {!isRealEstate && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Client Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-slate-900" data-testid="text-client-details-name">
                      {job.clientName}
                    </h4>
                  </div>
                  
                  {job.clientPhone && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Phone className="w-4 h-4" />
                      <span data-testid="text-client-phone">{job.clientPhone}</span>
                    </div>
                  )}
                  
                  {job.clientEmail && (
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <Mail className="w-4 h-4" />
                      <span data-testid="text-client-email">{job.clientEmail}</span>
                    </div>
                  )}
                  
                  {job.address && (
                    <div className="flex items-start gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span data-testid="text-client-address">{job.address}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar className="w-4 h-4" />
                    <span>Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Job Actions - Only for Trades */}
            {!isRealEstate && (
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handleEditClientInfo}
                    data-testid="button-edit-client-info"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Client Info
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={handleDuplicateJob}
                    disabled={duplicateJobMutation.isPending}
                    data-testid="button-duplicate-job"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Duplicate Job
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={handleDeleteJob}
                    data-testid="button-delete-job"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Job
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Status Timeline - Only for Trades */}
            {!isRealEstate && (
              <Card>
                <CardHeader>
                  <CardTitle>Project Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-primary rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium">Job Created</p>
                        <p className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    
                    <div className={`flex items-center gap-3 ${photos.length > 0 ? '' : 'opacity-50'}`}>
                      <div className={`w-3 h-3 rounded-full ${photos.length > 0 ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                      <div>
                        <p className="text-sm font-medium">Photos Uploaded</p>
                        <p className="text-xs text-slate-500">
                          {photos.length > 0 ? `${photos.length} photo${photos.length === 1 ? '' : 's'}` : 'Pending'}
                        </p>
                      </div>
                    </div>
                    
                    <div className={`flex items-center gap-3 ${quotes.length > 0 ? '' : 'opacity-50'}`}>
                      <div className={`w-3 h-3 rounded-full ${quotes.length > 0 ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                      <div>
                        <p className="text-sm font-medium">Quote Created</p>
                        <p className="text-xs text-slate-500">
                          {quotes.length > 0 ? `${quotes.length} quote${quotes.length === 1 ? '' : 's'}` : 'Pending'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 opacity-50">
                      <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
                      <div>
                        <p className="text-sm font-medium">Quote Sent</p>
                        <p className="text-xs text-slate-500">Pending</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      
      {/* Photo Preview Modal */}
      {previewPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">
                Preview: Pool Photo {(previewPhoto as any).photoIndex !== undefined ? (previewPhoto as any).photoIndex + 1 : photos.indexOf(previewPhoto) + 1}
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setPreviewPhoto(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="p-4">
              <img
                src={(previewPhoto as any).compositeUrl || previewPhoto.originalUrl}
                alt={`Pool Photo ${photos.indexOf(previewPhoto) + 1}`}
                className="max-w-full max-h-[70vh] object-contain mx-auto"
              />
            </div>
            <div className="p-4 border-t bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  <p>Dimensions: {previewPhoto.width} × {previewPhoto.height}</p>
                  <p>Uploaded: {formatDistanceToNow(new Date(previewPhoto.createdAt), { addSuffix: true })}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setPreviewPhoto(null);
                      
                      // Set job and photo context in editor store FIRST (like the other edit button)
                      const { dispatch } = useEditorStore.getState();
                      
                      if (jobId && previewPhoto.id) {
                        dispatch({
                          type: 'SET_JOB_CONTEXT',
                          payload: {
                            jobId: jobId,
                            photoId: previewPhoto.id
                          }
                        });
                      }
                      
                      // Clear previous state to prevent contamination (but preserve job context)
                      dispatch({ type: 'RESET' });
                      
                      // CRITICAL: Always use the ORIGINAL photo URL for editing, never the composite
                      // Find the original photo from the photos array to ensure we use the real originalUrl
                      const originalPhoto = photos.find(p => p.id === previewPhoto.id);
                      const imageUrlToLoad = originalPhoto?.originalUrl || previewPhoto.originalUrl;
                      
                      // Load image to get actual dimensions
                      const img = new Image();
                      img.onload = () => {
                        // CRITICAL FIX: Use database dimensions from photo object (source of truth)
                        // The originalPhoto object has width/height from database
                        const dbWidth = originalPhoto?.width || previewPhoto.width;
                        const dbHeight = originalPhoto?.height || previewPhoto.height;
                        
                        // Validate dimensions match (log warning if mismatch)
                        const widthDiff = Math.abs(img.naturalWidth - dbWidth);
                        const heightDiff = Math.abs(img.naturalHeight - dbHeight);
                        if (widthDiff > 1 || heightDiff > 1) {
                          console.warn(`[JobDetail] Dimension mismatch when loading photo for editing:`, {
                            photoId: previewPhoto.id,
                            database: `${dbWidth}x${dbHeight}`,
                            natural: `${img.naturalWidth}x${img.naturalHeight}`,
                            using: 'database dimensions'
                          });
                        }
                        
                        dispatch({
                          type: 'SET_IMAGE',
                          payload: {
                            url: imageUrlToLoad, // Always use original, never composite
                            width: dbWidth,   // Use database dimensions
                            height: dbHeight // Use database dimensions
                          }
                        });
                        
                        // Navigate to /new-editor (same as the other edit button)
                        navigate('/new-editor');
                      };
                      img.onerror = () => {
                        // Fallback with default dimensions (same as the other edit button)
                        dispatch({
                          type: 'SET_IMAGE',
                          payload: {
                            url: imageUrlToLoad, // Always use original, never composite
                            width: 1920,
                            height: 1080
                          }
                        });
                        navigate('/new-editor');
                      };
                      img.src = imageUrlToLoad;
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Hidden file inputs for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handlePhotoUpload(e, 'marketing')}
        className="hidden"
      />
      {isRealEstate && (
        <input
          ref={renovationFileInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => handlePhotoUpload(e, 'renovation_buyer')}
          className="hidden"
        />
      )}

      {/* Edit Client Info Modal */}
      <Modal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        title="Edit Client Information"
        variant="form"
        size="sm"
        loading={updateJobMutation.isPending}
        primaryAction={{
          label: 'Save Changes',
          onClick: editForm.handleSubmit(handleSaveClientInfo),
        }}
        secondaryAction={{
          label: 'Cancel',
          onClick: () => setShowEditModal(false),
        }}
      >
        <Form {...editForm}>
          <form className="space-y-4">
            <FormField
              name="clientName"
              label="Client Name"
              type="text"
              required
            />
            <FormField
              name="clientPhone"
              label="Phone"
              type="tel"
              placeholder="(555) 123-4567"
            />
            <FormField
              name="clientEmail"
              label="Email"
              type="email"
              placeholder="client@example.com"
            />
            <FormField
              name="address"
              label="Address"
              type="text"
              placeholder="123 Main St, City, State ZIP"
            />
          </form>
        </Form>
      </Modal>

      {/* Delete Photo Confirmation */}
      <ConfirmDialog
        open={showDeletePhotoConfirm !== null}
        onOpenChange={(open) => !open && setShowDeletePhotoConfirm(null)}
        title="Delete Photo?"
        description="This action cannot be undone. The photo and all associated masks will be permanently deleted."
        variant="danger"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (showDeletePhotoConfirm) {
            deletePhotoMutation.mutate(showDeletePhotoConfirm);
            setShowDeletePhotoConfirm(null);
          }
        }}
        loading={deletePhotoMutation.isPending}
      />

      {/* Quote Editor Modal */}
      {showQuoteEditor && editingQuoteId && (
        <QuoteEditorModal
          quoteId={editingQuoteId}
          isOpen={showQuoteEditor}
          onClose={() => {
            setShowQuoteEditor(false);
            setEditingQuoteId(null);
          }}
          onAddItem={(item) => addQuoteItemMutation.mutate({ quoteId: editingQuoteId, item })}
          onUpdateItem={(itemId, updates) => updateQuoteItemMutation.mutate({ quoteId: editingQuoteId, itemId, updates })}
          onRemoveItem={(itemId) => deleteQuoteItemMutation.mutate({ quoteId: editingQuoteId, itemId })}
          onSyncFromCanvas={(itemId, measurementData) => syncFromCanvasMutation.mutate({ quoteId: editingQuoteId, itemId, measurementData })}
        />
      )}
    </div>
  );
}
