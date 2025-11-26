/**
 * Device Parser
 * 
 * Parses user agent strings to extract device information
 */

export interface DeviceInfo {
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  browser: string;
  os: string;
  isMobile: boolean;
}

export function parseUserAgent(userAgent?: string): DeviceInfo {
  if (!userAgent) {
    return {
      deviceType: 'unknown',
      browser: 'Unknown',
      os: 'Unknown',
      isMobile: false,
    };
  }

  const ua = userAgent.toLowerCase();
  
  // Detect device type
  let deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown' = 'desktop';
  let isMobile = false;
  
  if (ua.includes('mobile') || ua.includes('android')) {
    if (ua.includes('tablet') || ua.includes('ipad')) {
      deviceType = 'tablet';
    } else {
      deviceType = 'mobile';
      isMobile = true;
    }
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }

  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) {
    browser = 'Chrome';
  } else if (ua.includes('firefox')) {
    browser = 'Firefox';
  } else if (ua.includes('safari') && !ua.includes('chrome')) {
    browser = 'Safari';
  } else if (ua.includes('edg')) {
    browser = 'Edge';
  } else if (ua.includes('opera') || ua.includes('opr')) {
    browser = 'Opera';
  }

  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) {
    os = 'Windows';
  } else if (ua.includes('mac os') || ua.includes('macos')) {
    os = 'macOS';
  } else if (ua.includes('linux')) {
    os = 'Linux';
  } else if (ua.includes('android')) {
    os = 'Android';
  } else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) {
    os = 'iOS';
  }

  return {
    deviceType,
    browser,
    os,
    isMobile,
  };
}

