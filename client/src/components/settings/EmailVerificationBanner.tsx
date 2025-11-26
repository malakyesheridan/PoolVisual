import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, Mail, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useToast } from '@/hooks/use-toast';
import { useAuthStore } from '@/stores/auth-store';

export function EmailVerificationBanner() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSending, setIsSending] = useState(false);

  const isVerified = user?.emailVerified || false;

  const sendVerificationMutation = useMutation({
    mutationFn: () => apiClient.sendVerificationEmail(),
    onSuccess: () => {
      toast({
        title: "Verification email sent",
        description: "Please check your inbox and click the verification link.",
      });
      setIsSending(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error sending verification email",
        description: error.message || "Failed to send verification email. Please try again.",
        variant: "destructive",
      });
      setIsSending(false);
    },
  });

  const handleResend = () => {
    setIsSending(true);
    sendVerificationMutation.mutate();
  };

  if (isVerified) {
    return null; // Don't show banner if email is verified
  }

  return (
    <Card className="border-amber-200 bg-amber-50 mb-6">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-amber-900 mb-1">Verify Your Email Address</h3>
            <p className="text-sm text-amber-800 mb-3">
              Please verify your email address to access all features and ensure account security.
            </p>
            <Button
              onClick={handleResend}
              disabled={isSending}
              size="sm"
              variant="outline"
              className="border-amber-300 text-amber-900 hover:bg-amber-100"
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

