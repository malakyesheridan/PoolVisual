import { useState, useEffect } from 'react';
import { SettingsSidebar, type SettingsSection } from "@/components/settings/SettingsSidebar";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { UserPreferencesSettings } from "@/components/settings/UserPreferencesSettings";
import { OrganizationSettings } from "@/components/settings/OrganizationSettings";
import { NotificationsSettings } from "@/components/settings/NotificationsSettings";
import { useOrgs } from "@/hooks/useOrgs";
import { useOrgStore } from "@/stores/orgStore";
import { Settings as SettingsIcon, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  // Use centralized org store
  const { selectedOrgId, setSelectedOrgId, setCurrentOrg } = useOrgStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { data: orgs = [] } = useOrgs();

  // Auto-select first org if available and update store
  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
      setCurrentOrg(orgs[0]);
    } else if (orgs.length > 0 && selectedOrgId && !orgs.find(o => o.id === selectedOrgId)) {
      // If selected org no longer exists, select first available
      setSelectedOrgId(orgs[0].id);
      setCurrentOrg(orgs[0]);
    } else if (orgs.length > 0 && selectedOrgId) {
      // Update current org if it exists
      const current = orgs.find(o => o.id === selectedOrgId);
      if (current) setCurrentOrg(current);
    }
  }, [orgs, selectedOrgId, setSelectedOrgId, setCurrentOrg]);

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSettings />;
      case 'security':
        return <SecuritySettings />;
      case 'preferences':
        return <UserPreferencesSettings />;
      case 'organization':
        return <OrganizationSettings orgId={selectedOrgId} />;
      case 'notifications':
        return <NotificationsSettings />;
      default:
        return <AccountSettings />;
    }
  };

  return (
    <div className="h-full flex bg-slate-50">
      {/* Sidebar Navigation - Always visible on desktop, toggleable on mobile */}
      <div
        className={cn(
          "transition-transform duration-300 ease-in-out",
          "md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          "fixed md:static inset-y-0 left-0 z-40 md:z-auto"
        )}
      >
        <SettingsSidebar 
          activeSection={activeSection}
          onSectionChange={(section) => {
            setActiveSection(section);
            // Close sidebar on mobile after selection
            if (window.innerWidth < 768) {
              setSidebarOpen(false);
            }
          }}
          className="h-full overflow-y-auto"
        />
      </div>

      {/* Overlay for mobile when sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Main Content */}
      <div className="flex-1 min-w-0 overflow-y-auto pb-20 md:pb-0">
        {/* Mobile Header */}
        <div className="md:hidden safe-top bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="tap-target"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <h1 className="font-semibold mobile-text-lg" data-testid="text-page-title-mobile">
              Settings
            </h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-8">
          {/* Desktop Header */}
          <div className="hidden md:flex items-center gap-3 mb-8">
            <SettingsIcon className="w-8 h-8 text-slate-600" />
            <div>
              <h1 className="text-2xl font-bold text-slate-900" data-testid="text-page-title">
                Settings
              </h1>
              <p className="text-slate-600 mt-1">
                Manage your account, preferences, and organization settings
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
