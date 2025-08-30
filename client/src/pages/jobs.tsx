import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, MapPin, Phone, Mail } from "lucide-react";

export default function Jobs() {
  const [, navigate] = useLocation();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    address: '',
  });

  const { toast } = useToast();

  const createJobMutation = useMutation({
    mutationFn: (data: any) => apiClient.createJob(data),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Job created",
        description: "The job has been created successfully.",
      });
      navigate(`/jobs/${job.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error creating job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedOrgId) {
      toast({
        title: "Organization required",
        description: "Please select an organization for this job.",
        variant: "destructive",
      });
      return;
    }

    const jobData = {
      ...formData,
      orgId: selectedOrgId,
      createdBy: selectedOrgId, // This should be the org member ID, but for now use orgId
    };

    createJobMutation.mutate(jobData);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-slate-50">
      
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/dashboard')}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <div>
            <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">
              Create New Job
            </h1>
            <p className="text-slate-600 mt-1">
              Enter client details to start a new pool renovation project
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Client Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Client Name */}
              <div>
                <Label htmlFor="clientName" className="text-sm font-medium">
                  Client Name *
                </Label>
                <Input
                  id="clientName"
                  value={formData.clientName}
                  onChange={(e) => handleInputChange('clientName', e.target.value)}
                  placeholder="Mrs. Johnson"
                  required
                  className="mt-1"
                  data-testid="input-client-name"
                />
              </div>

              {/* Contact Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientPhone" className="text-sm font-medium">
                    Phone Number
                  </Label>
                  <div className="relative mt-1">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="clientPhone"
                      type="tel"
                      value={formData.clientPhone}
                      onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                      placeholder="+61 400 123 456"
                      className="pl-10"
                      data-testid="input-client-phone"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="clientEmail" className="text-sm font-medium">
                    Email Address
                  </Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      id="clientEmail"
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                      placeholder="client@example.com"
                      className="pl-10"
                      data-testid="input-client-email"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <Label htmlFor="address" className="text-sm font-medium">
                  Property Address
                </Label>
                <div className="relative mt-1">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="123 Ocean View Drive, Bondi Beach NSW 2026"
                    rows={3}
                    className="pl-10"
                    data-testid="textarea-address"
                  />
                </div>
              </div>

              {/* Organization Selection (if multiple) */}
              {/* This would be populated from the user's organizations */}

              {/* Action Buttons */}
              <div className="flex space-x-4 pt-6 border-t border-slate-200">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/dashboard')}
                  className="flex-1"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                
                <Button 
                  type="submit"
                  className="flex-1"
                  disabled={createJobMutation.isPending}
                  data-testid="button-create-job"
                >
                  {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <h3 className="font-medium text-blue-900 mb-2">Getting Started Tips</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Ensure all client contact details are accurate for quote delivery</li>
              <li>• The property address will be used for material delivery calculations</li>
              <li>• You can upload photos and start creating estimates once the job is created</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
