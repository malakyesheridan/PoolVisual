import { useState, useEffect } from 'react';
import { SettingsSidebar, type SettingsSection } from "@/components/settings/SettingsSidebar";
import { AccountSettings } from "@/components/settings/AccountSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { UserPreferencesSettings } from "@/components/settings/UserPreferencesSettings";
import { OrganizationSettings } from "@/components/settings/OrganizationSettings";
import { NotificationsSettings } from "@/components/settings/NotificationsSettings";
import { useOrgs } from "@/hooks/useOrgs";
import { Settings as SettingsIcon } from "lucide-react";

export default function Settings() {
  const [activeSection, setActiveSection] = useState<SettingsSection>('account');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
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
    <div className="bg-slate-50 min-h-screen">
      <div className="flex">
        {/* Sidebar Navigation */}
        <SettingsSidebar 
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        
        {/* Main Content */}
        <div className="flex-1">
          <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-8">
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
    </div>
  );
}
