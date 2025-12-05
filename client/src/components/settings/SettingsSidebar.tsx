import { Settings, User, Lock, Palette, Building, Bell, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SettingsSection = 
  | 'account' 
  | 'security' 
  | 'preferences' 
  | 'organization' 
  | 'notifications'
  | 'referrals';

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  className?: string;
}

const sections: Array<{
  id: SettingsSection;
  label: string;
  icon: typeof Settings;
}> = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'security', label: 'Security', icon: Lock },
  { id: 'preferences', label: 'Preferences', icon: Settings },
  { id: 'organization', label: 'Organization', icon: Building },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'referrals', label: 'Referrals', icon: Users },
];

export function SettingsSidebar({ 
  activeSection, 
  onSectionChange,
  className 
}: SettingsSidebarProps) {
  return (
    <div className={cn("w-64 border-r border-slate-200 bg-white", className)}>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-1">Settings</h2>
        <p className="text-sm text-slate-500">Manage your account and preferences</p>
      </div>
      
      <nav className="px-3 pb-6">
        <div className="space-y-1">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            
            return (
              <button
                key={section.id}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-white"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <Icon className="w-4 h-4" />
                {section.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

