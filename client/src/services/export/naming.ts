// client/src/services/export/naming.ts
export interface FileNamingOptions {
  projectName?: string;
  jobId?: string;
  photoId?: string;
  version?: string;
  format: string;
  scale?: number;
  timestamp?: boolean;
}

export function generateExportFilename(options: FileNamingOptions): string {
  const parts: string[] = [];
  
  if (options.projectName) {
    parts.push(sanitizeFilename(options.projectName));
  }
  
  if (options.jobId) {
    parts.push(options.jobId.slice(0, 8));
  }
  
  if (options.photoId) {
    parts.push(options.photoId.slice(0, 8));
  }
  
  if (options.version) {
    parts.push(`v${options.version}`);
  }
  
  if (options.scale && options.scale > 1) {
    parts.push(`${options.scale}x`);
  }
  
  if (options.timestamp) {
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    parts.push(ts);
  }
  
  const base = parts.length > 0 ? parts.join('-') : 'export';
  return `${base}.${options.format}`;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-z0-9]/gi, '-')
    .replace(/-+/g, '-')
    .toLowerCase()
    .slice(0, 50);
}

