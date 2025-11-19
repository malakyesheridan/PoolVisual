// client/src/lib/i18n.ts
/**
 * Internationalization (i18n) structure
 * Currently a placeholder for future i18n implementation
 * All user-facing strings should be extracted here
 */

type TranslationKey = 
  | 'jobs.title'
  | 'jobs.loading'
  | 'jobs.noJobs'
  | 'jobs.noJobsFiltered'
  | 'jobs.clearFilters'
  | 'jobs.createFirst'
  | 'jobs.selectMode'
  | 'jobs.bulkActions'
  | 'jobs.refresh'
  | 'jobs.autoRefresh'
  | 'jobs.connectionStatus'
  | 'jobs.analytics'
  | 'jobs.statistics'
  | 'jobs.filters'
  | 'jobs.groupBy'
  | 'jobs.sortBy'
  | 'jobs.status'
  | 'jobs.type'
  | 'jobs.date'
  | 'jobs.search'
  | 'job.status.queued'
  | 'job.status.processing'
  | 'job.status.completed'
  | 'job.status.failed'
  | 'job.status.canceled'
  | 'job.actions.cancel'
  | 'job.actions.retry'
  | 'job.actions.duplicate'
  | 'job.actions.delete'
  | 'job.actions.download'
  | 'job.actions.view'
  | 'job.actions.compare'
  | 'job.details.expand'
  | 'job.details.collapse'
  | 'job.details.jobId'
  | 'job.details.copy'
  | 'job.details.copied'
  | 'job.error.copy'
  | 'job.error.showMore'
  | 'job.error.showLess'
  | 'variant.comparison.title'
  | 'variant.comparison.description'
  | 'variant.comparison.downloadAll'
  | 'variant.viewer.close'
  | 'variant.viewer.zoomIn'
  | 'variant.viewer.zoomOut'
  | 'variant.viewer.reset'
  | 'bulk.selected'
  | 'bulk.clearSelection'
  | 'bulk.delete'
  | 'bulk.cancel'
  | 'bulk.retry'
  | 'analytics.title'
  | 'analytics.successRate'
  | 'analytics.processingTime'
  | 'analytics.timeline'
  | 'analytics.materialUsage'
  | 'analytics.errorAnalysis'
  | 'group.none'
  | 'group.date'
  | 'group.status'
  | 'group.type'
  | 'group.today'
  | 'group.yesterday'
  | 'group.thisWeek'
  | 'group.thisMonth'
  | 'group.older'
  | 'sort.newest'
  | 'sort.oldest'
  | 'sort.status'
  | 'sort.progress';

const translations: Record<string, Record<TranslationKey, string>> = {
  en: {
    'jobs.title': 'AI Enhancements',
    'jobs.loading': 'Loading jobs...',
    'jobs.noJobs': 'No enhancements yet',
    'jobs.noJobsFiltered': 'No jobs found',
    'jobs.clearFilters': 'Clear all filters',
    'jobs.createFirst': 'Create your first one above!',
    'jobs.selectMode': 'Select mode',
    'jobs.bulkActions': 'Bulk actions',
    'jobs.refresh': 'Refresh jobs',
    'jobs.autoRefresh': 'Auto-refresh interval',
    'jobs.connectionStatus': 'Connection status',
    'jobs.analytics': 'Analytics',
    'jobs.statistics': 'Statistics',
    'jobs.filters': 'Filters',
    'jobs.groupBy': 'Group By',
    'jobs.sortBy': 'Sort By',
    'jobs.status': 'Status',
    'jobs.type': 'Type',
    'jobs.date': 'Date',
    'jobs.search': 'Search by job ID or date...',
    'job.status.queued': 'Queued',
    'job.status.processing': 'Processing',
    'job.status.completed': 'Completed',
    'job.status.failed': 'Failed',
    'job.status.canceled': 'Canceled',
    'job.actions.cancel': 'Cancel job',
    'job.actions.retry': 'Retry',
    'job.actions.duplicate': 'Duplicate job',
    'job.actions.delete': 'Delete job',
    'job.actions.download': 'Download',
    'job.actions.view': 'View full size',
    'job.actions.compare': 'Compare variants',
    'job.details.expand': 'Expand details',
    'job.details.collapse': 'Collapse details',
    'job.details.jobId': 'Job ID',
    'job.details.copy': 'Copy',
    'job.details.copied': 'Copied!',
    'job.error.copy': 'Copy error',
    'job.error.showMore': 'Show more',
    'job.error.showLess': 'Show less',
    'variant.comparison.title': 'Compare Variants',
    'variant.comparison.description': 'Compare enhancement variants side-by-side or with an interactive slider',
    'variant.comparison.downloadAll': 'Download All',
    'variant.viewer.close': 'Close viewer',
    'variant.viewer.zoomIn': 'Zoom in',
    'variant.viewer.zoomOut': 'Zoom out',
    'variant.viewer.reset': 'Reset zoom',
    'bulk.selected': 'selected',
    'bulk.clearSelection': 'Clear selection',
    'bulk.delete': 'Delete',
    'bulk.cancel': 'Cancel',
    'bulk.retry': 'Retry',
    'analytics.title': 'Analytics Dashboard',
    'analytics.successRate': 'Success Rate',
    'analytics.processingTime': 'Processing Time',
    'analytics.timeline': 'Job Timeline',
    'analytics.materialUsage': 'Material Usage',
    'analytics.errorAnalysis': 'Error Analysis',
    'group.none': 'None',
    'group.date': 'Date',
    'group.status': 'Status',
    'group.type': 'Type',
    'group.today': 'Today',
    'group.yesterday': 'Yesterday',
    'group.thisWeek': 'This Week',
    'group.thisMonth': 'This Month',
    'group.older': 'Older',
    'sort.newest': 'Newest First',
    'sort.oldest': 'Oldest First',
    'sort.status': 'By Status',
    'sort.progress': 'By Progress',
  },
};

let currentLocale = 'en';

/**
 * Get translation for a key
 * @param key Translation key
 * @param params Optional parameters for string interpolation
 * @returns Translated string
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const translation = translations[currentLocale]?.[key] || key;
  
  if (params) {
    return Object.entries(params).reduce(
      (str, [param, value]) => str.replace(`{${param}}`, String(value)),
      translation
    );
  }
  
  return translation;
}

/**
 * Set current locale
 * @param locale Locale code (e.g., 'en', 'es', 'fr')
 */
export function setLocale(locale: string): void {
  currentLocale = locale;
}

/**
 * Get current locale
 * @returns Current locale code
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Check if a locale is available
 * @param locale Locale code
 * @returns True if locale is available
 */
export function isLocaleAvailable(locale: string): boolean {
  return locale in translations;
}

/**
 * Get available locales
 * @returns Array of available locale codes
 */
export function getAvailableLocales(): string[] {
  return Object.keys(translations);
}

