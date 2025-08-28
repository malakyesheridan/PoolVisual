import { useLocation } from 'wouter';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { 
  Briefcase, 
  Edit, 
  Package, 
  FileText,
  Home
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Jobs',
    icon: Briefcase
  },
  {
    href: '/canvas-editor',
    label: 'Editor',
    icon: Edit
  },
  {
    href: '/materials',
    label: 'Materials',
    icon: Package
  },
  {
    href: '/quotes',
    label: 'Quotes',
    icon: FileText
  }
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 safe-bottom z-50">
      <div className="flex">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href || location.startsWith(item.href + '/');
          
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div 
                className={cn(
                  "flex flex-col items-center justify-center py-2 px-3 tap-target transition-smooth",
                  isActive 
                    ? "text-primary" 
                    : "text-gray-500 active:text-primary active:scale-[0.98]"
                )}
                data-testid={`bottom-nav-${item.label.toLowerCase()}`}
              >
                <Icon className="w-5 h-5 mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}