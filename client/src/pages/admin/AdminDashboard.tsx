import { useState, useEffect } from 'react';
import { AdminSidebar, type AdminSection } from '@/components/admin/AdminSidebar';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminOrganizations } from '@/components/admin/AdminOrganizations';
import { AdminAuditLogs } from '@/components/admin/AdminAuditLogs';
import { Shield, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useLocation } from 'wouter';

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState<AdminSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuthStore();
  const [, navigate] = useLocation();

  // Redirect if not admin
  useEffect(() => {
    if (user && !user.isAdmin) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Don't render if not admin
  if (!user?.isAdmin) {
    return null;
  }

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'overview':
        return <AdminOverview />;
      case 'users':
        return <AdminUsers />;
      case 'organizations':
        return <AdminOrganizations />;
      case 'audit-logs':
        return <AdminAuditLogs />;
      default:
        return <AdminOverview />;
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Sidebar Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        <Menu className="w-5 h-5" />
      </Button>

      {/* Sidebar Navigation */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out",
          "md:static md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <AdminSidebar 
          activeSection={activeSection}
          onSectionChange={(section) => {
            setActiveSection(section);
            if (window.innerWidth < 768) {
              setSidebarOpen(false);
            }
          }}
          className="h-full overflow-y-auto"
        />
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Main Content */}
      <div className="flex-1 p-6 md:ml-0">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-8 h-8 text-slate-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Admin Dashboard
              </h1>
              <p className="text-slate-600 mt-1">
                System administration and management
              </p>
            </div>
          </div>

          {/* Active Section Content */}
          {renderActiveSection()}
        </div>
      </div>
    </div>
  );
}

