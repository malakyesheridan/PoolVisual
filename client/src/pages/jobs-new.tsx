import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/lib/toast";
import { ArrowLeft, User, MapPin, Phone, Mail } from "lucide-react";
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { jobSchema, type JobFormData } from '@/lib/form-validation';
import { Form } from '@/components/ui/form';
import { FormField } from '@/components/common/FormField';
import { FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function JobsNew() {
  const [, navigate] = useLocation();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      address: '',
      orgId: ''
    }
  });

  const { data: orgs = [] } = useQuery({
    queryKey: ['/api/me/orgs'],
    queryFn: () => apiClient.getMyOrgs(),
  });

  console.log('Fetched orgs:', orgs);

  // Redirect to organization creation if no organizations exist
  React.useEffect(() => {
    if (orgs.length === 0) {
      navigate('/orgs/new');
    }
  }, [orgs, navigate]);

  // Auto-select first org if only one exists
  React.useEffect(() => {
    if (orgs.length === 1 && !form.getValues('orgId')) {
      const orgId = orgs[0].id;
      setSelectedOrgId(orgId);
      form.setValue('orgId', orgId);
    }
  }, [orgs, form]);


  const createJobMutation = useMutation({
    mutationFn: (data: any) => apiClient.createJob(data),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast.success("Job created successfully", {
        description: `Job for ${job.clientName} has been created.`
      });
      navigate(`/jobs/${job.id}`);
    },
    onError: (error: any) => {
      console.error('Job creation error:', error);
      console.error('Error details:', error.message);
      toast.error(error.message || 'An unexpected error occurred. Please try again.');
    },
  });

  const handleSubmit = (data: JobFormData) => {
    setIsSubmitting(true);
    
    const jobData = {
      clientName: data.clientName,
      clientPhone: data.clientPhone?.trim() || null,
      clientEmail: data.clientEmail?.trim() || null,
      address: data.address?.trim() || null,
      orgId: data.orgId,
      status: 'new' as const,
    };

    createJobMutation.mutate(jobData, {
      onSettled: () => {
        setIsSubmitting(false);
      }
    });
  };

  return (
    <div className="bg-slate-50">
      
      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/jobs')}
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField
                  name="clientName"
                  label="Client Name"
                  placeholder="Mrs. Johnson"
                  required
                  disabled={isSubmitting || createJobMutation.isPending}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    name="clientPhone"
                    label="Phone Number"
                    type="tel"
                    placeholder="+61 400 123 456"
                    icon={<Phone className="w-4 h-4" />}
                    disabled={isSubmitting || createJobMutation.isPending}
                  />

                  <FormField
                    name="clientEmail"
                    label="Email Address"
                    type="email"
                    placeholder="client@example.com"
                    icon={<Mail className="w-4 h-4" />}
                    disabled={isSubmitting || createJobMutation.isPending}
                  />
                </div>

                <FormField
                  name="address"
                  label="Property Address"
                  type="textarea"
                  placeholder="123 Ocean View Drive, Bondi Beach NSW 2026"
                  icon={<MapPin className="w-4 h-4" />}
                  rows={3}
                  disabled={isSubmitting || createJobMutation.isPending}
                />

                {orgs.length > 1 && (
                  <FormItem>
                    <FormLabel>
                      Organization <span className="text-red-500 ml-1">*</span>
                    </FormLabel>
                    <FormControl>
                      <Controller
                        name="orgId"
                        control={form.control}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                              setSelectedOrgId(value);
                            }}
                            disabled={isSubmitting || createJobMutation.isPending}
                          >
                            <SelectTrigger data-testid="select-organization">
                              <SelectValue placeholder="Select an organization" />
                            </SelectTrigger>
                            <SelectContent>
                              {orgs.map((org) => (
                                <SelectItem key={org.id} value={org.id}>
                                  {org.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-4 pt-6 border-t border-slate-200">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/jobs')}
                    className="flex-1"
                    disabled={isSubmitting || createJobMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  
                  <Button 
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting || createJobMutation.isPending}
                    data-testid="button-create-job"
                  >
                    {isSubmitting || createJobMutation.isPending ? 'Creating...' : 'Create Job'}
                  </Button>
                </div>
              </form>
            </Form>
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
