import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/auth-store";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Materials from "@/pages/materials";
import MaterialsNew from "@/pages/MaterialsNew";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import { CanvasEditorPage } from "@/pages/CanvasEditorPage";
import Quotes from "@/pages/quotes";
import ShareQuote from "@/pages/share-quote";
import Settings from "@/pages/settings";
import { BottomNav } from "@/components/nav/BottomNav";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <>{children}</>;
}

function Router() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/share/q/:token" component={ShareQuote} />
      
      {/* Redirect root to appropriate page */}
      <Route path="/">
        {isAuthenticated ? <Redirect to="/dashboard" /> : <Redirect to="/login" />}
      </Route>
      
      {/* Protected routes */}
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
          <MaterialsNew />
        </ProtectedRoute>
      </Route>
      
      <Route path="/jobs">
        <ProtectedRoute>
          <Jobs />
        </ProtectedRoute>
      </Route>
      
      <Route path="/jobs/new">
        <ProtectedRoute>
          <Jobs />
        </ProtectedRoute>
      </Route>
      
      <Route path="/jobs/:id">
        <ProtectedRoute>
          <JobDetail />
        </ProtectedRoute>
      </Route>
      
      <Route path="/jobs/:jobId/photo/:photoId">
        <ProtectedRoute>
          <CanvasEditorPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/canvas-editor">
        <ProtectedRoute>
          <CanvasEditorPage />
        </ProtectedRoute>
      </Route>
      
      <Route path="/quotes">
        <ProtectedRoute>
          <Quotes />
        </ProtectedRoute>
      </Route>
      
      <Route path="/quotes/:id">
        <ProtectedRoute>
          <Quotes />
        </ProtectedRoute>
      </Route>
      
      <Route path="/settings">
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      </Route>
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster position="top-right" richColors closeButton />
          <Router />
          
          {/* Mobile bottom navigation */}
          <BottomNav />
        </TooltipProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}

export default App;
