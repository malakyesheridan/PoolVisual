import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryClient } from "@/lib/queryClient";
import { toast } from "@/lib/toast";
import { ArrowLeft, Building2 } from "lucide-react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { orgSchema, type OrgFormData } from '@/lib/form-validation';
import { Form } from '@/components/ui/form';
import { FormField } from '@/components/common/FormField';

export default function OrgsNew() {
  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
    defaultValues: {
      name: '',
      contactEmail: '',
      contactPhone: '',
      address: ''
    }
  });


  const createOrgMutation = useMutation({
    mutationFn: (data: any) => apiClient.createOrg(data),
    onSuccess: (org) => {
      queryClient.invalidateQueries({ queryKey: ['/api/me/orgs'] });
      toast.success("Organization created successfully", {
        description: `${org.name} has been created.`
      });
      navigate('/jobs/new');
    },
    onError: (error: any) => {
      console.error('Organization creation error:', error);
      toast.error(error.message || 'An unexpected error occurred. Please try again.');
    },
  });

  const handleSubmit = (data: OrgFormData) => {
    setIsSubmitting(true);
    
    createOrgMutation.mutate(data, {
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
              Create Organization
            </h1>
            <p className="text-slate-600 mt-1">
              Set up your organization to start creating jobs
            </p>
          </div>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Organization Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField
                  name="name"
                  label="Organization Name"
                  placeholder="Pool Renovation Co."
                  required
                  disabled={isSubmitting || createOrgMutation.isPending}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    name="contactEmail"
                    label="Contact Email"
                    type="email"
                    placeholder="contact@example.com"
                    disabled={isSubmitting || createOrgMutation.isPending}
                  />

                  <FormField
                    name="contactPhone"
                    label="Contact Phone"
                    type="tel"
                    placeholder="+61 400 123 456"
                    disabled={isSubmitting || createOrgMutation.isPending}
                  />
                </div>

                <FormField
                  name="address"
                  label="Business Address"
                  placeholder="123 Business Street, City NSW 2000"
                  disabled={isSubmitting || createOrgMutation.isPending}
                />

                {/* Action Buttons */}
                <div className="flex space-x-4 pt-6 border-t border-slate-200">
                  <Button 
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/jobs')}
                    className="flex-1"
                    disabled={isSubmitting || createOrgMutation.isPending}
                    data-testid="button-cancel"
                  >
                    Cancel
                  </Button>
                  
                  <Button 
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting || createOrgMutation.isPending}
                    data-testid="button-create-org"
                  >
                    {isSubmitting || createOrgMutation.isPending ? 'Creating...' : 'Create Organization'}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="mt-6 bg-primary/5 border-primary/20">
          <CardContent className="p-6">
            <h3 className="font-medium text-primary mb-2">Getting Started</h3>
            <ul className="text-sm text-primary space-y-1">
              <li>• You need an organization to create jobs and manage projects</li>
              <li>• You can invite team members to your organization later</li>
              <li>• Organization settings can be updated from the settings page</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
