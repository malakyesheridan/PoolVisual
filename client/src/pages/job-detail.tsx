import { useState, useRef } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Send
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { formatCurrency } from "@/lib/measurement-utils";

export default function JobDetail() {
  const [, params] = useRoute('/jobs/:id');
  const [, navigate] = useLocation();
  const jobId = params?.id;
  const { toast } = useToast();

  const { data: job, isLoading } = useQuery({
    queryKey: ['/api/jobs', jobId],
    queryFn: () => jobId ? apiClient.getJob(jobId) : Promise.resolve(null),
    enabled: !!jobId,
  });

  const { data: quotes = [], isLoading: quotesLoading } = useQuery({
    queryKey: ['/api/quotes', jobId],
    queryFn: () => jobId ? apiClient.getQuotes(job?.orgId || '', { jobId }) : Promise.resolve([]),
    enabled: !!jobId && !!job?.orgId,
  });

  const { data: photos = [], isLoading: photosLoading } = useQuery({
    queryKey: ['/api/jobs', jobId, 'photos'],
    queryFn: () => jobId ? apiClient.getJobPhotos(jobId) : Promise.resolve([]),
    enabled: !!jobId,
  });

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
    mutationFn: ({ file, jobId }: { file: File; jobId: string }) => 
      apiClient.uploadPhoto(file, jobId),
    onSuccess: (photo) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs', jobId, 'photos'] });
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && jobId) {
      uploadPhotoMutation.mutate({ file, jobId });
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
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
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Job not found</h1>
          <Button onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-100 text-blue-800';
      case 'estimating': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-purple-100 text-purple-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'declined': return 'bg-red-100 text-red-800';
      case 'scheduled': return 'bg-indigo-100 text-indigo-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getQuoteStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
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

  return (
    <div className="bg-slate-50">      
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
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
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-slate-900" data-testid="text-client-name">
                  {job.clientName}
                </h1>
                <Badge className={getStatusColor(job.status)} data-testid="badge-job-status">
                  {job.status}
                </Badge>
              </div>
              <p className="text-slate-600">
                Created {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" data-testid="button-edit-job">
              <Edit className="w-4 h-4 mr-2" />
              Edit Job
            </Button>
            <Button 
              onClick={handleCreateQuote}
              disabled={createQuoteMutation.isPending}
              data-testid="button-create-quote"
            >
              <FileText className="w-4 h-4 mr-2" />
              {createQuoteMutation.isPending ? 'Creating...' : 'Create Quote'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Photos Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Photos ({photos.length})
                </CardTitle>
                <Button 
                  size="sm" 
                  data-testid="button-upload-photo"
                  onClick={handleUploadClick}
                  disabled={uploadPhotoMutation.isPending}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload Photo'}
                </Button>
              </CardHeader>
              <CardContent>
                {photosLoading ? (
                  <div className="text-center p-8">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-slate-500">Loading photos...</p>
                  </div>
                ) : photos.length === 0 ? (
                  <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                    <Camera className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-900 mb-2">No photos uploaded yet</h3>
                    <p className="text-slate-500 mb-4" data-testid="text-no-photos">
                      Upload site photos to start creating estimates and visual mock-ups
                    </p>
                    <Button 
                      data-testid="button-upload-first-photo"
                      onClick={handleUploadClick}
                      disabled={uploadPhotoMutation.isPending}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload Your First Photo'}
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {photos.map((photo) => (
                      <div 
                        key={photo.id}
                        className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                      >
                        <div className="aspect-video bg-slate-100 relative">
                          {photo.thumbnailUrl ? (
                            <img 
                              src={photo.thumbnailUrl} 
                              alt={photo.name || 'Photo'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Camera className="w-8 h-8 text-slate-400" />
                            </div>
                          )}
                          
                          {/* Edit Button Overlay */}
                          <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                            <Button
                              size="sm"
                              className="opacity-0 hover:opacity-100 transition-opacity duration-200"
                              onClick={() => navigate(`/jobs/${jobId}/photo/${photo.id}/edit`)}
                            >
                              <Edit className="w-4 h-4 mr-2" />
                              Edit
                            </Button>
                          </div>
                        </div>
                        
                        <div className="p-3">
                          <h4 className="font-medium text-slate-900 truncate">
                            {photo.name || `Photo ${photo.id.slice(-8)}`}
                          </h4>
                          <p className="text-sm text-slate-500">
                            {formatDistanceToNow(new Date(photo.uploadedAt || photo.createdAt), { addSuffix: true })}
                          </p>
                          
                          {/* Photo Status Indicators */}
                          <div className="flex items-center gap-2 mt-2">
                            {photo.canvasState && (
                              <Badge variant="secondary" className="text-xs">
                                Has Canvas Work
                              </Badge>
                            )}
                            {photo.lastModified && photo.lastModified !== photo.uploadedAt && (
                              <Badge variant="outline" className="text-xs">
                                Modified
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

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
                              Quote #{quote.id.slice(-8).toUpperCase()}
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
                            
                            {quote.status === 'draft' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Implement send quote functionality
                                }}
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
            
            {/* Client Information */}
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

            {/* Job Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-edit-client-info"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Client Info
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  data-testid="button-duplicate-job"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Duplicate Job
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                  data-testid="button-delete-job"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Job
                </Button>
              </CardContent>
            </Card>

            {/* Status Timeline */}
            <Card>
              <CardHeader>
                <CardTitle>Project Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">Job Created</p>
                      <p className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 opacity-50">
                    <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">Photos Uploaded</p>
                      <p className="text-xs text-slate-500">Pending</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 opacity-50">
                    <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
                    <div>
                      <p className="text-sm font-medium">Quote Created</p>
                      <p className="text-xs text-slate-500">Pending</p>
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
          </div>
        </div>
      </div>
      
      {/* Hidden file input for photo upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />
    </div>
  );
}
