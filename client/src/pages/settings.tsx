import { useState, useEffect } from 'react';
import { SettingsSidebar, type SettingsSection } from "@/components/settings/SettingsSidebar";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { UserPreferencesSettings } from "@/components/settings/UserPreferencesSettings";
import { OrganizationSettings } from "@/components/settings/OrganizationSettings";
import { NotificationsSettings } from "@/components/settings/NotificationsSettings";
import { useOrgs } from "@/hooks/useOrgs";
import { Settings as SettingsIcon, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { data: orgs = [] } = useOrgs();

  // Auto-select first org if available
  useEffect(() => {
    if (!selectedOrgId && orgs.length > 0) {
      setSelectedOrgId(orgs[0].id);
    }
  }, [selectedOrgId, orgs.length]);

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
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
            <SettingsIcon className="w-8 h-8 text-slate-600 hidden md:block" />
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
