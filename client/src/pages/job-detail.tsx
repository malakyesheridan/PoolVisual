import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TopNavigation } from "@/components/layout/top-navigation";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
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
  Trash2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function JobDetail() {
  const [, params] = useRoute('/jobs/:id');
  const [, navigate] = useLocation();
  const jobId = params?.id;

  const { data: job, isLoading } = useQuery({
    queryKey: ['/api/jobs', jobId],
    queryFn: () => jobId ? apiClient.getJob(jobId) : Promise.resolve(null),
    enabled: !!jobId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <TopNavigation />
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
      <div className="min-h-screen bg-slate-50">
        <TopNavigation />
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

  return (
    <div className="min-h-screen bg-slate-50">
      <TopNavigation 
        currentPage="jobs" 
        jobDetails={{
          clientName: job.clientName,
          address: job.address || ''
        }}
      />
      
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
            <Button data-testid="button-create-quote">
              <FileText className="w-4 h-4 mr-2" />
              Create Quote
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
                  Photos
                </CardTitle>
                <Button size="sm" data-testid="button-upload-photo">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Photo
                </Button>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center">
                  <Camera className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No photos uploaded yet</h3>
                  <p className="text-slate-500 mb-4" data-testid="text-no-photos">
                    Upload site photos to start creating estimates and visual mock-ups
                  </p>
                  <Button data-testid="button-upload-first-photo">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Your First Photo
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quotes Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Quotes
                </CardTitle>
                <Button size="sm" data-testid="button-create-new-quote">
                  <FileText className="w-4 h-4 mr-2" />
                  New Quote
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-center p-8">
                  <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No quotes created yet</h3>
                  <p className="text-slate-500" data-testid="text-no-quotes">
                    Create quotes after uploading photos and marking areas for renovation
                  </p>
                </div>
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
    </div>
  );
}
