import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from 'wouter';
import { useAuthStore } from '@/stores/auth-store';
import { apiClient } from '@/lib/api-client';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, registerSchema, type LoginFormData, type RegisterFormData } from '@/lib/form-validation';
import { Form } from '@/components/ui/form';
import { FormField } from '@/components/common/FormField';

export default function Login() {
  const [, navigate] = useLocation();
  const login = useAuthStore((state) => state.login);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: ''
    }
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      username: '',
      password: '',
      confirmPassword: ''
    }
  });

  const handleLogin = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.login(data.email, data.password);
      if (response.ok) {
        login(response.user);
        navigate('/dashboard');
      } else {
        setError('Login failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.register(
        data.email, 
        data.username, 
        data.password
      );
      if (response.ok) {
        login(response.user);
        navigate('/dashboard');
      } else {
        setError('Registration failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">PoolVisual Quotes</h1>
          <p className="text-slate-600 mt-2">Professional pool renovation quoting</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-center">Welcome</CardTitle>
            <CardDescription className="text-center">
              Sign in to your account or create a new one
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" data-testid="tab-login">Sign In</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">Sign Up</TabsTrigger>
              </TabsList>

              {error && (
                <Alert variant="destructive" className="mb-6">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription data-testid="text-error-message">{error}</AlertDescription>
                </Alert>
              )}

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form 
                    onSubmit={loginForm.handleSubmit(handleLogin)} 
                    className="space-y-4"
                  >
                    <FormField
                      name="email"
                      label="Email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      disabled={isLoading}
                      testId="input-login-email"
                    />
                    
                    <FormField
                      name="password"
                      label="Password"
                      type="password"
                      required
                      disabled={isLoading}
                      testId="input-login-password"
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading || loginForm.formState.isSubmitting}
                      data-testid="button-sign-in"
                    >
                      {isLoading || loginForm.formState.isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing In...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register">
                <Form {...registerForm}>
                  <form 
                    onSubmit={registerForm.handleSubmit(handleRegister)} 
                    className="space-y-4"
                  >
                    <FormField
                      name="email"
                      label="Email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      disabled={isLoading}
                      testId="input-register-email"
                    />
                    
                    <FormField
                      name="username"
                      label="Username"
                      type="text"
                      placeholder="johndoe"
                      required
                      disabled={isLoading}
                      testId="input-register-username"
                    />
                    
                    <FormField
                      name="password"
                      label="Password"
                      type="password"
                      required
                      disabled={isLoading}
                      description="Must be at least 8 characters with uppercase, lowercase, and number"
                      testId="input-register-password"
                    />
                    
                    <FormField
                      name="confirmPassword"
                      label="Confirm Password"
                      type="password"
                      required
                      disabled={isLoading}
                      testId="input-confirm-password"
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={isLoading || registerForm.formState.isSubmitting}
                      data-testid="button-sign-up"
                    >
                      {isLoading || registerForm.formState.isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating Account...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
