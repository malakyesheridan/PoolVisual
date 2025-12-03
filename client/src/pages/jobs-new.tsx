import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/lib/toast";
import { ArrowLeft, User, MapPin, Phone, Mail, Info, Building2 } from "lucide-react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { jobSchema, type JobFormData } from '@/lib/form-validation';
import { Form } from '@/components/ui/form';
import { FormField } from '@/components/common/FormField';
import { useIsRealEstate } from '@/hooks/useIsRealEstate';
import { useJobsRoute } from '@/lib/route-utils';

export default function JobsNew() {
  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRealEstate = useIsRealEstate();
  const jobsRoute = useJobsRoute();

  const form = useForm<JobFormData>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      address: ''
    }
  });

  const createJobMutation = useMutation({
    mutationFn: (data: any) => apiClient.createJob(data),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast.success("Job created successfully", {
        description: `Job for ${job.clientName} has been created.`
      });
      const route = isRealEstate ? `/properties/${job.id}` : `/jobs/${job.id}`;
      navigate(route);
    },
    onError: (error: any) => {
      console.error('Job creation error:', error);
      console.error('Error details:', error.message);
      toast.error(error.message || 'An unexpected error occurred. Please try again.');
    },
  });

  const handleSubmit = (data: JobFormData) => {
    setIsSubmitting(true);
    
    // orgId is automatically set by the server from user's org
    const jobData = {
      clientName: data.clientName,
      clientPhone: data.clientPhone?.trim() || null,
      clientEmail: data.clientEmail?.trim() || null,
      address: data.address?.trim() || null,
      status: 'new' as const,
    };

    createJobMutation.mutate(jobData, {
      onSettled: () => {
        setIsSubmitting(false);
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-4 md:py-8">
        {/* Mobile Header */}
        <div className="md:hidden safe-top bg-white border-b border-gray-200 px-4 py-3 -mx-4 md:mx-0 mb-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate(jobsRoute)}
              data-testid="button-back-mobile"
              className="hover:bg-slate-100 tap-target"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="font-semibold mobile-text-lg" data-testid="text-page-title-mobile">
              Create New Job
            </h1>
          </div>
        </div>

        {/* Desktop Header */}
        <div className="hidden md:flex items-center gap-4 mb-8">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/jobs')}
            data-testid="button-back"
            className="hover:bg-slate-100"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          
          <div>
            <h1 className="text-3xl font-bold text-slate-900" data-testid="text-page-title">
              Create New Job
            </h1>
            <p className="text-slate-600 mt-1.5 text-sm">
              Enter comprehensive client details to start a new pool renovation project
            </p>
          </div>
        </div>

        {/* Form Card - Enhanced Design */}
        <Card className="border-slate-200 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl text-slate-900">Client Information</CardTitle>
                <CardDescription className="text-sm text-slate-500 mt-0.5">
                  All fields marked with * are required
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Client Name - Primary Field */}
                <div className="space-y-2">
                  <FormField
                    name="clientName"
                    label="Client Name"
                    placeholder="e.g., Mrs. Johnson, John Smith"
                    required
                    disabled={isSubmitting || createJobMutation.isPending}
                  />
                  <p className="text-xs text-slate-500 ml-1">
                    Full name of the client or primary contact person
                  </p>
                </div>

                {/* Contact Information Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <FormField
                      name="clientPhone"
                      label="Phone Number"
                      type="tel"
                      placeholder="+61 400 123 456"
                      icon={<Phone className="w-4 h-4" />}
                      disabled={isSubmitting || createJobMutation.isPending}
                    />
                    <p className="text-xs text-slate-500 ml-1">
                      Include country code for international numbers
                    </p>
                  </div>

                  <div className="space-y-2">
                    <FormField
                      name="clientEmail"
                      label="Email Address"
                      type="email"
                      placeholder="client@example.com"
                      icon={<Mail className="w-4 h-4" />}
                      disabled={isSubmitting || createJobMutation.isPending}
                    />
                    <p className="text-xs text-slate-500 ml-1">
                      Used for quote delivery and communications
                    </p>
                  </div>
                </div>

                {/* Property Address */}
                <div className="space-y-2">
                  <FormField
                    name="address"
                    label="Property Address"
                    type="textarea"
                    placeholder="123 Ocean View Drive, Bondi Beach NSW 2026, Australia"
                    icon={<MapPin className="w-4 h-4" />}
                    rows={3}
                    disabled={isSubmitting || createJobMutation.isPending}
                  />
                  <p className="text-xs text-slate-500 ml-1">
                    Full address including street, suburb, state, and postcode. Used for material delivery calculations and site visits.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 pt-6 border-t border-slate-200">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => navigate(jobsRoute)}
                    disabled={isSubmitting || createJobMutation.isPending}
                    data-testid="button-cancel"
                    className="min-w-[100px] h-11 md:h-auto tap-target"
                  >
                    Cancel
                  </Button>
                  
                  <Button 
                    type="submit"
                    disabled={isSubmitting || createJobMutation.isPending}
                    data-testid="button-create-job"
                    className="min-w-[140px] h-11 md:h-auto bg-primary hover:bg-primary/90 text-white tap-target"
                  >
                    {isSubmitting || createJobMutation.isPending ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Creating...
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4 mr-2" />
                        Create Job
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Tips Card - Enhanced Design */}
        <Card className="mt-6 border-primary/20 bg-gradient-to-br from-blue-50 to-blue-50/50 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-primary mb-3 text-sm">Getting Started Tips</h3>
                <ul className="text-sm text-primary space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>Ensure all client contact details are accurate for quote delivery and follow-up communications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>The property address will be used for material delivery calculations and scheduling site visits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>You can upload photos and start creating estimates once the job is created</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
