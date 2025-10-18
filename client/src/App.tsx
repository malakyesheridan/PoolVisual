import React from "react";
import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/stores/auth-store";
import { AppErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/layout/AppShell";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Materials from "@/pages/materials";
import MaterialsNew from "@/pages/MaterialsNew";
import Library from "@/pages/Library";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import CanvasEditorPage from "@/pages/CanvasEditorPage";
import CanvasEditorV2Page from "@/pages/CanvasEditorV2Page";
import NewEditorPage from "@/new_editor/NewEditorPage";
import JobsNew from "@/pages/jobs-new";
import Quotes from "@/pages/quotes";
import ShareQuote from "@/pages/share-quote";
import Settings from "@/pages/settings";
import ProjectCanvasEditorPage from "@/pages/ProjectCanvasEditorPage";
import { initMaterialsOnce, attachMaterialsFocusRefresh } from "@/app/initMaterials";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  
  // Dev bypass for canvas-editor-v2 and new-editor
  if (process.env.NODE_ENV === 'development' && (window.location.pathname === '/canvas-editor-v2' || window.location.pathname === '/new-editor')) {
    return <>{children}</>;
  }
  
  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }
  
  return <>{children}</>;
}

function ProtectedRouter() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <AppShell>
      <div className="page-scroll">
        <Switch>
          {/* Protected routes within app shell */}
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
              <Library />
            </ProtectedRoute>
          </Route>
          
          <Route path="/library">
            <ProtectedRoute>
              <Library />
            </ProtectedRoute>
          </Route>
          
          <Route path="/jobs">
            <ProtectedRoute>
              <Jobs />
            </ProtectedRoute>
          </Route>
          
          <Route path="/jobs/new">
            <ProtectedRoute>
              <JobsNew />
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
          
          <Route path="/jobs/:jobId/photo/:photoId/edit">
            <ProtectedRoute>
              <ProjectCanvasEditorPage />
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
              <NewEditorPage />
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
        
        {/* Mobile bottom navigation spacer */}
        <div className="bottom-nav-spacer md:hidden" />
      </div>
    </AppShell>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/share/q/:token" component={ShareQuote} />
      
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
