import { BarChart3, Users, Building2, Shield, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AdminSection = 
  | 'overview' 
  | 'users' 
  | 'organizations' 
  | 'audit-logs';

interface AdminSidebarProps {
  activeSection: AdminSection;
  onSectionChange: (section: AdminSection) => void;
  className?: string;
}

const sections: Array<{
  id: AdminSection;
  label: string;
  icon: typeof BarChart3;
}> = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'audit-logs', label: 'Audit Logs', icon: Activity },
];

export function AdminSidebar({ 
  activeSection, 
  onSectionChange,
  className 
}: AdminSidebarProps) {
  return (
    <div className={cn("w-64 border-r border-slate-200 bg-white", className)}>
      <div className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-slate-900">Admin</h2>
        </div>
        <p className="text-sm text-slate-500">System administration</p>
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

