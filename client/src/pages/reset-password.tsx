import { useState, useEffect } from 'react';
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

const resetPasswordSchema = z.object({
  password: z.string().min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

export default function ResetPassword() {
  const [, navigate] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenParam = params.get('token');
    if (!tokenParam) {
      setError('Invalid or missing reset token');
    } else {
      setToken(tokenParam);
    }
  }, []);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: ''
    }
  });

  const handleSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError('Invalid reset token');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await apiClient.resetPassword(token, data.password);
      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setError(response.message || 'Failed to reset password');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || err?.message || 'Failed to reset password';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!token && !error) {
    return null; // Loading
  }

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
              Reset Password
            </CardTitle>
            <CardDescription>
              Enter your new password below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    Your password has been reset successfully. Redirecting to login...
                  </AlertDescription>
                </Alert>
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
                    name="password"
                    label="New Password"
                    type="password"
                    placeholder="Enter new password (min 12 characters)"
                    required
                    disabled={isLoading}
                    description="Must be at least 12 characters with uppercase, lowercase, number, and special character"
                  />
                  
                  <FormField
                    name="confirmPassword"
                    label="Confirm Password"
                    type="password"
                    placeholder="Confirm new password"
                    required
                    disabled={isLoading}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || form.formState.isSubmitting || !token}
                  >
                    {isLoading || form.formState.isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      'Reset Password'
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

