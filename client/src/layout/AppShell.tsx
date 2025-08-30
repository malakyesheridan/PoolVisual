import { PropsWithChildren } from 'react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { 
  Home, 
  Briefcase, 
  Image, 
  Package, 
  FileText, 
  Settings,
  User,
  LogOut,
  Palette
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function AppShell({ children }: PropsWithChildren) {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/jobs', label: 'Jobs', icon: Briefcase },
    { to: '/canvas-editor', label: 'Canvas Editor', icon: Palette },
    { to: '/materials', label: 'Materials', icon: Package },
    { to: '/quotes', label: 'Quotes', icon: FileText },
  ];

  return (
    <div className="app-shell">
      <header className="app-header bg-white/80 border-b z-header">
        <div className="mx-auto max-w-7xl h-full flex items-center px-3 gap-3">
          <Link href="/" className="font-semibold text-lg text-blue-600 hover:text-blue-700">
            PoolVisual Quotes
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 text-sm ml-6">
            {navItems.map((item) => (
              <NavItem 
                key={item.to} 
                to={item.to} 
                label={item.label} 
                icon={item.icon}
                isActive={location.startsWith(item.to)}
              />
            ))}
          </nav>
          
          {/* User Menu */}
          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user.username?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{user.username}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm">
                  Sign in
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>
    </div>
  );
}

interface NavItemProps {
  to: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
}

function NavItem({ to, label, icon: Icon, isActive }: NavItemProps) {
  return (
    <Link href={to}>
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
          'hover:bg-slate-100 hover:text-slate-900',
          isActive 
            ? 'bg-blue-100 text-blue-700' 
            : 'text-slate-600'
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </div>
    </Link>
  );
}