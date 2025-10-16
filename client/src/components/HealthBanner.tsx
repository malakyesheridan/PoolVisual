import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Database, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface HealthStatus {
  ok: boolean;
  mode: 'db' | 'no-db';
  port?: number;
  nodeEnv?: string;
}

export function HealthBanner() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('/api/health');
        const data = await response.json();
        setHealthStatus(data);
        
        // Show banner if in no-db mode and not dismissed
        if (data.mode === 'no-db' && !isDismissed) {
          setIsVisible(true);
        }
      } catch (error) {
        console.warn('Health check failed:', error);
        // Don't show banner on network errors to avoid confusion
      }
    };

    checkHealth();
    
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [isDismissed]);

  const dismissBanner = () => {
    setIsVisible(false);
    setIsDismissed(true);
    // Remember dismissal for this session
    sessionStorage.setItem('health-banner-dismissed', 'true');
  };

  // Check if banner was dismissed in this session
  useEffect(() => {
    const dismissed = sessionStorage.getItem('health-banner-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  if (!isVisible || !healthStatus || healthStatus.mode === 'db') {
    return null;
  }

  return (
    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-800 dark:text-amber-200">
            Running in offline mode - using local materials and assets
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={dismissBanner}
          className="h-6 w-6 p-0 text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
        >
          <X className="h-3 w-3" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}
