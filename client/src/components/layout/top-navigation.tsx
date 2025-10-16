import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronDown, Maximize2 } from "lucide-react";
import { Link } from "wouter";
import { useAuthStore } from "@/stores/auth-store";

interface TopNavigationProps {
  currentPage?: string;
  jobDetails?: {
    clientName: string;
    address: string;
  };
}

export function TopNavigation({ currentPage, jobDetails }: TopNavigationProps) {
  const { user, logout } = useAuthStore();

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between z-50" data-testid="header-main">
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
              />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-slate-900" data-testid="text-app-title">
            PoolVisual Quotes
          </h1>
        </div>
        
        <nav className="hidden md:flex space-x-1" data-testid="nav-main">
          <Link 
            href="/dashboard"
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              currentPage === 'dashboard' 
                ? 'text-primary bg-primary/10' 
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
            }`} 
            data-testid="link-dashboard"
          >
            Jobs
          </Link>
          <Link 
            href="/new-editor"
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              currentPage === 'new-editor' 
                ? 'text-primary bg-primary/10' 
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
            }`} 
            data-testid="link-canvas-editor"
          >
            Canvas Editor
          </Link>
          <Link 
            href="/materials"
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              currentPage === 'materials' 
                ? 'text-primary bg-primary/10' 
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
            }`} 
            data-testid="link-materials"
          >
            Materials
          </Link>
          <Link 
            href="/quotes"
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              currentPage === 'quotes' 
                ? 'text-primary bg-primary/10' 
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
            }`} 
            data-testid="link-quotes"
          >
            Quotes
          </Link>
        </nav>
      </div>
      
      <div className="flex items-center space-x-4">
        {jobDetails && (
          <div className="hidden md:flex items-center space-x-3 text-sm text-slate-600">
            <span data-testid="text-client-name">{jobDetails.clientName}</span>
            <span className="text-slate-400">•</span>
            <span data-testid="text-client-address">{jobDetails.address}</span>
          </div>
        )}
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="ghost" 
            size="icon"
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            data-testid="button-fullscreen"
          >
            <Maximize2 className="w-5 h-5 text-slate-600" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center space-x-2 p-2 hover:bg-slate-100 rounded-lg transition-colors"
                data-testid="button-user-menu"
              >
                <Avatar className="w-7 h-7">
                  <AvatarFallback className="bg-primary text-white text-xs font-medium">
                    {user ? getInitials(user.username) : 'U'}
                  </AvatarFallback>
                </Avatar>
                <ChevronDown className="w-4 h-4 text-slate-600" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="w-full" data-testid="link-settings">
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} data-testid="button-logout">
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
