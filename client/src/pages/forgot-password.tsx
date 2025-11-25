import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useLocation } from 'wouter';
import { apiClient } from '@/lib/api-client';
import { AlertCircle, Loader2, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form } from '@/components/ui/form';
import { FormField } from '@/components/common/FormField';

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: ''
    }
  });

  const handleSubmit = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await apiClient.requestPasswordReset(data.email);
      if (response.ok) {
        setSuccess(true);
      } else {
        setError(response.message || 'Failed to send reset email');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to send reset email';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/login')}
                className="mr-2"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              Forgot Password
            </CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    If an account with this email exists, a password reset link has been sent. Please check your email.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => navigate('/login')}
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form 
                  onSubmit={form.handleSubmit(handleSubmit)} 
                  className="space-y-4"
                >
                  {error && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <FormField
                    name="email"
                    label="Email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    disabled={isLoading}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || form.formState.isSubmitting}
                  >
                    {isLoading || form.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send Reset Link'
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate('/login')}
                    className="w-full"
                  >
                    Back to Login
                  </Button>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

