import { PropsWithChildren } from 'react';
import React from 'react';
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
  Palette,
  Bell
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
import { Badge } from '@/components/ui/badge';
import { useStatusSyncStore } from '@/stores/statusSyncStore';
import { NotificationPanel } from '@/components/notifications/NotificationPanel';
import { Logo } from '@/components/brand/Logo';

// Notifications Bell Component
function NotificationsBell() {
  const { 
    notifications, 
    smartNotifications, 
    notificationGroups,
    getNotificationStats 
  } = useStatusSyncStore();
  const [isOpen, setIsOpen] = React.useState(false);
  
  const stats = getNotificationStats();
  const unreadCount = notifications.filter(n => !n.read).length;
  const smartUnreadCount = smartNotifications.filter(n => !n.read).length;
  const totalUnreadCount = unreadCount + smartUnreadCount;
  
  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="relative h-8 w-8 p-0"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-4 w-4" />
        {totalUnreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
          >
            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
          </Badge>
        )}
      </Button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 z-50">
          <div className="bg-white rounded-lg shadow-lg border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-500">{totalUnreadCount} unread</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => setIsOpen(false)}
                  >
                    ×
                  </Button>
                </div>
              </div>
            </div>
            
            <div className="max-h-96 overflow-y-auto">
              {/* Smart Notifications Summary */}
              {smartNotifications.length > 0 && (
                <div className="p-3 border-b border-slate-100">
                  <div className="text-xs font-medium text-slate-700 mb-2">Smart Notifications</div>
                  <div className="space-y-2">
                    {smartNotifications.slice(0, 3).map((notification) => (
                      <div key={notification.id} className="text-xs text-slate-600 p-2 bg-slate-50 rounded">
                        <div className="font-medium">{notification.title}</div>
                        <div className="text-slate-500">{notification.message}</div>
                      </div>
                    ))}
                    {smartNotifications.length > 3 && (
                      <div className="text-xs text-primary text-center py-1">
                        +{smartNotifications.length - 3} more smart notifications
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Regular Notifications */}
              <div className="p-3">
                <div className="text-xs font-medium text-slate-700 mb-2">Recent Notifications</div>
                {notifications.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-4">
                    No notifications
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifications.slice(0, 5).map((notification) => (
                      <div key={notification.id} className="text-xs text-slate-600 p-2 bg-slate-50 rounded">
                        <div className="font-medium">{notification.message}</div>
                        <div className="text-slate-500">
                          {new Date(notification.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-3 border-t border-slate-200 bg-slate-50">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setIsOpen(false);
                  // Navigate to dashboard notifications tab
                  window.location.href = '/dashboard#notifications';
                }}
              >
                View All Notifications
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();

  const navItems = [
    { to: '/dashboard', label: 'Dashboard', icon: Home },
    { to: '/jobs', label: 'Jobs', icon: Briefcase },
    { to: '/new-editor', label: 'Canvas Editor', icon: Palette },
    { to: '/library', label: 'Library', icon: Package },
    { to: '/quotes', label: 'Quotes', icon: FileText },
  ];

  // Precise route detection for canvas editor pages
  const isCanvasEditorPage = 
    (location.startsWith('/jobs/') && location.includes('/photo/') && location.includes('/edit'));

  return (
    <div className="app-shell">
      {/* Conditionally render header ONLY - children always render */}
      {!isCanvasEditorPage && (
        <header className="app-header bg-white/80 border-b z-header">
          <div className="mx-auto max-w-7xl h-full flex items-center px-3 gap-3">
            <Link href="/" className="flex items-center">
              <Logo variant="full" size="md" />
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
              {/* Notifications Bell */}
              <NotificationsBell />
              
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
      )}

      {/* Main content ALWAYS renders - this prevents blank content issue */}
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
            ? 'bg-primary/10 text-primary' 
            : 'text-slate-600'
        )}
      >
        <Icon className="h-4 w-4" />
        {label}
      </div>
    </Link>
  );
}