import React, { Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { apiClient } from "./lib/api-client";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/auth-store";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/layout/AppShell";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Materials from "@/pages/materials";
// Code splitting for better performance - lazy load heavy pages

// Simple loading component for Suspense fallback
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-sm text-gray-600">Loading...</p>
      </div>
    </div>
  );
}
const Jobs = React.lazy(() => import("@/pages/jobs"));
const Properties = React.lazy(() => import("@/pages/properties"));
const JobDetail = React.lazy(() => 
  import("@/pages/job-detail").catch((error) => {
    console.error('[App] Failed to load JobDetail module:', error);
    // Retry once after a short delay
    return new Promise((resolve) => {
      setTimeout(() => {
        import("@/pages/job-detail").then(resolve).catch((retryError) => {
          console.error('[App] Retry also failed:', retryError);
          // Return a fallback component that shows an error
          resolve({
            default: () => (
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">Failed to load page</h2>
                  <p className="text-slate-600 mb-4">Please refresh the page to try again.</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            ),
          });
        });
      }, 1000);
    });
  })
);
const PropertyDetail = React.lazy(() => 
  import("@/pages/property-detail").catch((error) => {
    console.error('[App] Failed to load PropertyDetail module:', error);
    // Retry once after a short delay
    return new Promise((resolve) => {
      setTimeout(() => {
        import("@/pages/property-detail").then(resolve).catch((retryError) => {
          console.error('[App] Retry also failed:', retryError);
          // Return a fallback component that shows an error
          resolve({
            default: () => (
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">Failed to load page</h2>
                  <p className="text-slate-600 mb-4">Please refresh the page to try again.</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            ),
          });
        });
      }, 1000);
    });
  })
);
const SellerReportBuilder = React.lazy(() => import("@/pages/seller-report-builder"));
const CanvasEditorPage = React.lazy(() => import("@/pages/CanvasEditorPage"));
const CanvasEditorV2Page = React.lazy(() => import("@/pages/CanvasEditorV2Page"));
const NewEditor = React.lazy(() => import("@/new_editor/NewEditor").then(m => ({ default: m.NewEditor })));
const JobsNew = React.lazy(() => import("@/pages/jobs-new"));
const Quotes = React.lazy(() => import("@/pages/quotes"));
const Actions = React.lazy(() => import("@/pages/actions"));
const Opportunities = React.lazy(() => 
  import("@/pages/opportunities").catch((error) => {
    console.error('[App] Failed to load Opportunities module:', error);
    // Retry once after a short delay
    return new Promise((resolve) => {
      setTimeout(() => {
        import("@/pages/opportunities").then(resolve).catch((retryError) => {
          console.error('[App] Retry also failed:', retryError);
          // Return a fallback component that shows an error
          resolve({
            default: () => (
              <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                  <h2 className="text-xl font-semibold mb-2">Failed to load page</h2>
                  <p className="text-slate-600 mb-4">Please refresh the page to try again.</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            ),
          });
        });
      }, 1000);
    });
  })
);
const ShareQuote = React.lazy(() => import("@/pages/share-quote"));
const PublicBuyerForm = React.lazy(() => import("@/pages/public-buyer-form"));
const Settings = React.lazy(() => import("@/pages/settings"));
const MaterialsNew = React.lazy(() => import("@/pages/MaterialsNew"));
const Library = React.lazy(() => import("@/pages/Library"));
const ForgotPassword = React.lazy(() => import("@/pages/forgot-password"));
const ResetPassword = React.lazy(() => import("@/pages/reset-password"));
const AdminDashboard = React.lazy(() => import("@/pages/admin/AdminDashboard"));
const Onboarding = React.lazy(() => import("@/pages/Onboarding"));
const Subscribe = React.lazy(() => import("@/pages/subscribe"));
const SubscribeSuccess = React.lazy(() => import("@/pages/subscribe-success"));
const Billing = React.lazy(() => import("@/pages/billing"));
import { initMaterialsOnce, attachMaterialsFocusRefresh } from "@/app/initMaterials";
// CORRECTED: Import the hook instead of using duplicate query
import { IndustrySelectionModal } from '@/components/IndustrySelectionModal';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const currentPath = window.location.pathname;
  
  // Check onboarding completion status (with localStorage cache as failsafe)
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = React.useState(() => {
    // Check localStorage for cached status
    return localStorage.getItem('onboarding_completed') === 'true';
  });
  
  const { data: onboardingStatus } = useQuery({
    queryKey: ['onboarding-status'],
    queryFn: async () => {
      try {
        const status = await apiClient.getOnboardingStatus();
        // Update localStorage cache
        if (status.completed) {
          localStorage.setItem('onboarding_completed', 'true');
          setHasCompletedOnboarding(true);
        } else {
          localStorage.removeItem('onboarding_completed');
          setHasCompletedOnboarding(false);
        }
        return status;
      } catch (error) {
        // If API fails, fall back to localStorage cache
        console.warn('[ProtectedRoute] Failed to fetch onboarding status, using cache:', error);
        return { completed: hasCompletedOnboarding, step: 'welcome', responses: {} };
      }
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
  
  // Dev bypass for canvas-editor-v2 and new-editor
  if (process.env.NODE_ENV === 'development' && (currentPath === '/canvas-editor-v2' || currentPath === '/new-editor')) {
    return <>{children}</>;
  }
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  // CRITICAL: Block access if onboarding is not completed (except onboarding page)
  // Check both API status and localStorage cache as failsafe
  const onboardingCompleted = onboardingStatus?.completed || hasCompletedOnboarding;
  const hasIndustryType = !!user?.industryType;
  
  // Show onboarding if not completed OR if industryType is missing (for backward compatibility)
  if (!onboardingCompleted && currentPath !== '/onboarding') {
    return <Redirect to="/onboarding" />;
  }
  
  // Also check industryType for backward compatibility (users who completed onboarding before this change)
  if (!hasIndustryType && currentPath !== '/onboarding' && !onboardingCompleted) {
    return <Redirect to="/onboarding" />;
  }

  // CRITICAL FIX: Completely decouple IndustrySelectionModal from Onboarding
  // - Only render modal on non-onboarding routes
  // - Modal has its own mount delay to prevent render conflicts
  // - Modal processes all updates in effects, never during render
  // - Modal will check onboarding status internally and only show if needed
  const isOnboardingRoute = currentPath === '/onboarding';
  
  // Only render modal if:
  // 1. Not on onboarding route
  // 2. Onboarding is not completed OR industry is missing (for backward compatibility)
  // The modal itself will do the final check, but we can optimize by not rendering at all if onboarding is complete
  const shouldRenderModal = !isOnboardingRoute && (!onboardingCompleted || !hasIndustryType);
  
  return (
    <>
      {shouldRenderModal && <IndustrySelectionModal />}
      {children}
    </>
  );
}

function ProtectedRouter() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Switch>
      {/* Public routes that should render without AppShell */}
      <Route path="/public/buyer-form/:token">
        <Suspense fallback={<PageLoader />}>
          <PublicBuyerForm />
        </Suspense>
      </Route>
      <Route path="/share/q/:token" component={ShareQuote} />
      
      {/* Protected routes within app shell */}
      <Route>
        <AppShell>
          <div className="page-scroll">
            <Switch>
              <Route path="/">
                {isAuthenticated ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
              </Route>
              
              <Route path="/dashboard">
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              </Route>
              
              <Route path="/materials-old">
                <ProtectedRoute>
                  <Materials />
                </ProtectedRoute>
              </Route>
              
              <Route path="/materials">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Library />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/library">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Library />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/jobs">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Jobs />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/properties">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Properties />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/properties/new">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <JobsNew />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/jobs/new">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <JobsNew />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/jobs/:jobId/photo/:photoId/edit">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <NewEditor />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/jobs/:jobId/photo/:photoId/edit-canvas">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <NewEditor />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/jobs/:jobId/photo/:photoId/view">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <CanvasEditorPage />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/jobs/:id">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <JobDetail />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/properties/:id">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <PropertyDetail />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/seller-report-builder/:propertyId">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <SellerReportBuilder />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/canvas-editor">
                <ProtectedRoute>
                  <Redirect to="/new-editor" />
                </ProtectedRoute>
              </Route>
              
              <Route path="/canvas-editor-v2">
                <ProtectedRoute>
                  <Redirect to="/new-editor" />
                </ProtectedRoute>
              </Route>
              
              <Route path="/new-editor">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <NewEditor />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/quotes">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Quotes />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/quotes/:id">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Quotes />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/opportunities">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Opportunities />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/opportunities/:id">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Opportunities />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/actions">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Actions />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/settings">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Settings />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/subscribe/success">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <SubscribeSuccess />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/subscribe">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Subscribe />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              {/* HIDDEN: Billing page route is disabled for now */}
              {/*
              <Route path="/billing">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Billing />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              */}
              
              <Route path="/onboarding">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <Onboarding />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              <Route path="/admin">
                <ProtectedRoute>
                  <Suspense fallback={<PageLoader />}>
                    <AdminDashboard />
                  </Suspense>
                </ProtectedRoute>
              </Route>
              
              {/* Fallback to 404 */}
              <Route component={NotFound} />
            </Switch>
            
            {/* Mobile bottom navigation spacer */}
            <div className="bottom-nav-spacer md:hidden" />
          </div>
        </AppShell>
      </Route>
    </Switch>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password">
        <Suspense fallback={<PageLoader />}>
          <ForgotPassword />
        </Suspense>
      </Route>
      <Route path="/reset-password">
        <Suspense fallback={<PageLoader />}>
          <ResetPassword />
        </Suspense>
      </Route>
      <Route path="/share/q/:token" component={ShareQuote} />
      <Route path="/public/buyer-form/:token">
        <Suspense fallback={<PageLoader />}>
          <PublicBuyerForm />
        </Suspense>
      </Route>
      
      {/* Redirect everything else to login for non-authenticated users */}
      <Route>
        <Redirect to="/login" />
      </Route>
    </Switch>
  );
}


function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  // Initialize materials store once
  React.useEffect(() => {
    if (isAuthenticated) {
      initMaterialsOnce();
      const cleanup = attachMaterialsFocusRefresh();
      return cleanup;
    }
  }, [isAuthenticated]);

  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster position="top-right" richColors closeButton />
          
          {isAuthenticated ? <ProtectedRouter /> : <PublicRouter />}
          
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
