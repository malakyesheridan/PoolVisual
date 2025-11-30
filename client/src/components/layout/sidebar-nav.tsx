import { Link, useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Briefcase, 
  Package, 
  FileText, 
  Settings,
  Edit3,
  BarChart3
} from "lucide-react";
import { useIndustryTerm } from "@/hooks/useIndustryTerm";

interface SidebarNavProps {
  className?: string;
}

export function SidebarNav({ className }: SidebarNavProps) {
  const [location] = useLocation();
  const { jobs, quotes } = useIndustryTerm();
  
  const navigation = [
    {
      name: 'Dashboard',
      href: '/dashboard',
      icon: Home,
    },
    {
      name: jobs,
      href: '/jobs',
      icon: Briefcase,
    },
    {
      name: 'Canvas Editor',
      href: '/new-editor',
      icon: Edit3,
    },
    {
      name: 'Library',
      href: '/library',
      icon: Package,
    },
    {
      name: quotes,
      href: '/quotes',
      icon: FileText,
    },
    {
      name: 'Analytics',
      href: '/analytics',
      icon: BarChart3,
    },
    {
      name: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <nav className={cn("flex flex-col space-y-1 p-4", className)} data-testid="sidebar-navigation">
      {navigation.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href || location.startsWith(item.href + '/');
        
        return (
          <Link key={item.name} href={item.href}>
            <Button
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                isActive && "bg-primary/10 text-primary hover:bg-primary/20"
              )}
              data-testid={`nav-link-${item.name.toLowerCase().replace(' ', '-')}`}
            >
              <Icon className="mr-3 h-4 w-4" />
              {item.name}
            </Button>
          </Link>
        );
      })}
    </nav>
  );
}
