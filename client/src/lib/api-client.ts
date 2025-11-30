// CORRECTED: Import types
import { OnboardingData } from '@/types/onboarding';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = '/api';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit & { responseType?: 'blob' | 'json' } = {}
  ): Promise<T> {
    const { responseType, ...fetchOptions } = options;
    const isBlobRequest = responseType === 'blob';
    
    const config: RequestInit = {
      headers: {
        // Only set Content-Type for JSON requests (not for blob downloads)
        ...(isBlobRequest ? {} : { 'Content-Type': 'application/json' }),
        ...fetchOptions.headers,
      },
      credentials: 'include', // Important for session cookies
      ...fetchOptions,
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);

    if (!response.ok) {
      const ct = response.headers.get("content-type") || "";
      let body: any;
      try {
        body = ct.includes("application/json") ? await response.json() : await response.text();
      } catch (parseError) {
        body = await response.text();
      }
      
      // Handle validation errors with detailed messages
      if (response.status === 400 && typeof body === "object" && body.errors) {
        const errorMessages = body.errors.map((err: any) => `${err.path?.join('.')}: ${err.message}`).join(', ');
        const error = new Error(`Validation error: ${errorMessages}`);
        (error as any).status = response.status;
        (error as any).statusCode = response.status;
        (error as any).response = { data: body };
        throw error;
      }
      
      // Extract error message from response body
      let errorMessage = "Request failed";
      if (typeof body === "string") {
        errorMessage = body;
      } else if (body && typeof body === "object") {
        errorMessage = body.error || body.message || body.details || JSON.stringify(body);
      }
      
      const error = new Error(errorMessage);
      // Preserve status code and response data for proper error handling
      (error as any).status = response.status;
      (error as any).statusCode = response.status;
      (error as any).response = { data: body };
      throw error;
    }

    // Handle no-content responses
    if (response.status === 204) {
      return {} as T;
    }

    // Handle blob responses
    if (isBlobRequest) {
      return response.blob() as Promise<T>;
    }

    return response.json();
  }

  // Auth
  async login(email: string, password: string) {
    return this.request<{ ok: boolean; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async register(email: string, username: string, password: string, orgName?: string) {
    return this.request<{ ok: boolean; user: any; org?: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password, orgName }),
    });
  }

  // Subscription methods
  async getSubscriptionPlans(industry: 'trades' | 'real_estate') {
    return this.request<{ ok: boolean; plans: any[] }>(`/subscription/plans/${industry}`, {
      method: 'GET',
    });
  }

  async getSubscriptionStatus() {
    return this.request<{ 
      ok: boolean; 
      subscription: {
        plan: any | null;
        status: string;
        tier: string;
        expiresAt: string | null;
      } 
    }>('/subscription/status', {
      method: 'GET',
    });
  }

  async createCheckoutSession(data: { 
    planKey: string; 
    billingPeriod: 'monthly' | 'yearly' 
  }) {
    return this.request<{ 
      ok: boolean; 
      url: string; 
      sessionId: string;
      isPlaceholder?: boolean;
      error?: string;
    }>('/subscription/checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async checkFeatureAccess(feature: string) {
    return this.request<{ ok: boolean; hasAccess: boolean }>(`/subscription/features/${feature}`, {
      method: 'GET',
    });
  }

  // Admin methods
  async getAdminIndustryView() {
    return this.request<{ ok: boolean; industry: string | null }>('/admin/industry-view', {
      method: 'GET',
    });
  }

  async adminSwitchIndustryView(industry: string) {
    return this.request<{ ok: boolean; industry: string; error?: string }>('/admin/switch-industry-view', {
      method: 'POST',
      body: JSON.stringify({ industry }),
    });
  }

  async requestPasswordReset(email: string) {
    return this.request<{ ok: boolean; message: string }>('/auth/password-reset/initiate', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, newPassword: string) {
    return this.request<{ ok: boolean; message: string }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    });
  }

  // Organizations
  async getMyOrgs() {
    return this.request<any[]>('/me/orgs');
  }

  async getOrgMember(userId: string, orgId: string) {
    return this.request<any>(`/orgs/${orgId}/members/${userId}`);
  }

  async joinOrg(orgId: string, role?: string) {
    return this.request<any>(`/orgs/${orgId}/join`, {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
  }

  async createOrg(data: any) {
    return this.request<any>('/orgs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOrg(orgId: string, data: any) {
    return this.request<any>(`/orgs/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Onboarding methods
  // CORRECTED: Properly typed onboarding methods
  async getOnboardingStatus(): Promise<OnboardingData> {
    return this.request<OnboardingData>('/onboarding/status');
  }

  async updateOnboarding(data: { step: string; responses?: any }): Promise<OnboardingData> {
    return this.request<OnboardingData>('/onboarding/update', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async completeOnboarding(): Promise<{ ok: boolean }> {
    return this.request<{ ok: boolean }>('/onboarding/complete', {
      method: 'POST',
    });
  }

  // Trade category methods
  async getTradeCategories(industry: string) {
    return this.request<any[]>(`/trade-categories/${industry}`);
  }

  async getCategoryLabel(industry: string, categoryKey: string) {
    return this.request<{ industry: string; categoryKey: string; label: string }>(`/trade-categories/${industry}/${categoryKey}/label`);
  }

  async getOrg(orgId?: string) {
    // If no orgId provided, get current user's org
    if (!orgId) {
      return this.request<{ ok: boolean; org: any }>('/orgs/me', {
        method: 'GET',
      });
    }
    return this.request<any>(`/orgs/${orgId}`);
  }

  async inviteToOrg(orgId: string, email: string, role: string) {
    return this.request<any>(`/orgs/${orgId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  // Jobs
  async getJobsCanvasStatus(orgId: string, jobIds?: string[]) {
    const params = new URLSearchParams({ orgId });
    if (jobIds && jobIds.length > 0) {
      params.append('jobIds', jobIds.join(','));
    }
    return this.request<any[]>(`/jobs/canvas-status?${params.toString()}`);
  }

  async getJobs(orgId: string, filters?: { status?: string; q?: string }) {
    const params = new URLSearchParams({ orgId });
    if (filters?.status) params.append('status', filters.status);
    if (filters?.q) params.append('q', filters.q);
    
    return this.request<any[]>(`/jobs?${params}`);
  }

  async getJob(id: string) {
    return this.request<any>(`/jobs/${id}`);
  }

  async createJob(data: any) {
    return this.request<any>('/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateJob(id: string, data: Partial<any>) {
    return this.request<any>(`/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Photos
  async createPhoto(data: any) {
    return this.request<any>('/photos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadPhoto(file: File, jobId: string, additionalData?: any) {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('jobId', jobId);
    
    if (additionalData?.width) formData.append('width', additionalData.width.toString());
    if (additionalData?.height) formData.append('height', additionalData.height.toString());
    if (additionalData?.exifData) formData.append('exifData', JSON.stringify(additionalData.exifData));

    const response = await fetch(`${this.baseURL}/photos`, {
      method: 'POST',
      credentials: 'include', // Important for session cookies
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || 'Upload failed');
    }

    return response.json();
  }

  async getPhoto(id: string) {
    return this.request<any>(`/photos/${id}`);
  }

  async updatePhoto(id: string, data: { originalUrl: string; width: number; height: number }) {
    return this.request<any>(`/photos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deletePhoto(id: string) {
    return this.request(`/photos/${id}`, {
      method: 'DELETE',
    });
  }

  async getJobPhotos(jobId: string) {
    return this.request<any[]>(`/jobs/${jobId}/photos`);
  }

  async updatePhotoCalibration(id: string, pixelsPerMeter: number, meta: any) {
    return this.request<any>(`/photos/${id}/calibration`, {
      method: 'POST',
      body: JSON.stringify({ pixelsPerMeter, meta }),
    });
  }

  async generateComposite(photoId: string) {
    return this.request<any>(`/photos/${photoId}/composite`, {
      method: 'POST',
    });
  }

  async getComposite(photoId: string) {
    return this.request<any>(`/photos/${photoId}/composite`);
  }

  // Materials
  async getMaterials(orgId: string, category?: string, search?: string, industry?: string) {
    const params = new URLSearchParams({ orgId });
    if (category) params.append('category', category);
    if (search) params.append('q', search);
    if (industry) params.append('industry', industry);
    return this.request<any[]>(`/materials?${params}`);
  }

  async createMaterial(data: any) {
    return this.request<any>('/materials', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMaterial(id: string, data: Partial<any>) {
    return this.request<any>(`/materials/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteMaterial(id: string) {
    return this.request(`/materials/${id}`, {
      method: 'DELETE',
    });
  }

  // Masks
  async createMask(data: any) {
    return this.request<any>('/masks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMasks(photoId: string) {
    return this.request<any[]>(`/masks?photoId=${photoId}`);
  }

  async deleteMask(id: string) {
    return this.request(`/masks/${id}`, {
      method: 'DELETE',
    });
  }

  // Quotes
  async createQuote(data: any) {
    return this.request<any>('/quotes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateQuoteFromJob(jobId: string) {
    return this.request<any>(`/quotes/generate-from-job/${jobId}`, {
      method: 'POST',
    });
  }

  async getQuote(id: string) {
    return this.request<any>(`/quotes/${id}`);
  }

  async getQuoteItems(quoteId: string) {
    return this.request<any[]>(`/quotes/${quoteId}/items`);
  }

  async getQuotes(orgId: string, filters?: { status?: string; jobId?: string }) {
    const params = new URLSearchParams({ orgId });
    if (filters?.status) params.append('status', filters.status);
    if (filters?.jobId) params.append('jobId', filters.jobId);
    
    return this.request<any[]>(`/quotes?${params}`);
  }

  async addQuoteItem(quoteId: string, data: any) {
    return this.request<any>(`/quotes/${quoteId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateQuoteItem(quoteId: string, itemId: string, data: any) {
    return this.request<any>(`/quotes/${quoteId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async removeQuoteItem(quoteId: string, itemId: string) {
    return this.request(`/quotes/${quoteId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async updateQuote(id: string, data: any) {
    return this.request<any>(`/quotes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteQuote(id: string) {
    return this.request(`/quotes/${id}`, {
      method: 'DELETE',
    });
  }

  async recalculateQuote(id: string) {
    return this.request<any>(`/quotes/${id}/recalculate`, {
      method: 'POST',
    });
  }

  async sendQuote(id: string, clientEmail?: string) {
    return this.request<any>(`/quotes/${id}/send`, {
      method: 'POST',
      body: JSON.stringify({ clientEmail }),
    });
  }

  async acceptQuote(id: string, clientEmail?: string) {
    return this.request<{ clientSecret: string; amount: number; currency: string }>(`/quotes/${id}/accept`, {
      method: 'POST',
      body: JSON.stringify({ clientEmail }),
    });
  }

  async generateQuotePDF(id: string, options?: { watermark?: boolean; terms?: boolean; message?: string; preview?: boolean }) {
    const params = new URLSearchParams();
    if (options?.watermark) params.append('watermark', 'true');
    if (options?.terms) params.append('terms', 'true');
    if (options?.message) params.append('message', options.message);
    if (options?.preview) params.append('preview', 'true');
    
    const queryString = params.toString();
    const url = `/quotes/${id}/pdf${queryString ? `?${queryString}` : ''}`;
    
    return this.request<Blob>(url, {
      method: 'GET',
      responseType: 'blob'
    });
  }

  async previewQuotePDF(id: string) {
    return this.request<{ pdf: string; filename: string }>(`/quotes/${id}/pdf-preview`, {
      method: 'GET',
    });
  }

  // Canvas-Quote Integration
  async addMeasurementsToQuote(jobId: string, measurements: any[], quoteId?: string) {
    return this.request<any>(`/quotes/add-measurements/${jobId}`, {
      method: 'POST',
      body: JSON.stringify({ measurements, quoteId }),
    });
  }

  async getQuoteItemsWithMeasurements(quoteId: string) {
    return this.request<any[]>(`/quotes/${quoteId}/items-with-measurements`);
  }

  async updateQuoteItemFromCanvas(quoteId: string, itemId: string, measurementData: any) {
    return this.request<any>(`/quotes/${quoteId}/items/${itemId}/update-from-canvas`, {
      method: 'PUT',
      body: JSON.stringify({ measurementData }),
    });
  }

  async getQuoteItemsWithSources(quoteId: string) {
    return this.request<any>(`/quotes/${quoteId}/items-with-sources`);
  }

  // Public endpoints
  async getSharedQuote(token: string) {
    return this.request<any>(`/share/q/${token}`);
  }

  // Payments
  async createPaymentIntent(amount: number, currency = 'AUD') {
    return this.request<{ clientSecret: string }>('/create-payment-intent', {
      method: 'POST',
      body: JSON.stringify({ amount, currency }),
    });
  }

  // Settings
  async getSettings(orgId: string) {
    return this.request<any>(`/settings/${orgId}`);
  }

  async updateSettings(orgId: string, data: any) {
    return this.request<any>(`/settings/${orgId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // User Profile
  async getUserProfile() {
    return this.request<any>('/user/profile', {
      method: 'GET',
    });
  }

  async updateUserProfile(data: any) {
    return this.request<any>('/user/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ message: string }>('/user/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  // User Preferences
  async getUserPreferences() {
    return this.request<any>('/user/preferences', {
      method: 'GET',
    });
  }

  async updateUserPreferences(data: any) {
    return this.request<any>('/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Email Verification
  async sendVerificationEmail() {
    return this.request<{ message: string }>('/user/verify-email/send', {
      method: 'POST',
    });
  }

  async verifyEmail(token: string) {
    return this.request<{ message: string }>('/user/verify-email/confirm', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // User Sessions
  async getUserSessions() {
    return this.request<any[]>('/user/sessions', {
      method: 'GET',
    });
  }

  async revokeSession(sessionId: string) {
    return this.request<{ message: string }>(`/user/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async revokeAllOtherSessions() {
    return this.request<{ message: string }>('/user/sessions', {
      method: 'DELETE',
    });
  }

  // Security Log
  async getSecurityLog(options?: { limit?: number; offset?: number; eventType?: string }) {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.eventType) params.append('eventType', options.eventType);
    
    const query = params.toString();
    return this.request<any[]>(`/user/security-log${query ? `?${query}` : ''}`, {
      method: 'GET',
    });
  }

  // Notifications
  async getNotifications() {
    return this.request<any[]>('/notifications');
  }

  async markNotificationsRead(notificationIds: string[]) {
    return this.request('/notifications/mark-read', {
      method: 'POST',
      body: JSON.stringify({ notificationIds }),
    });
  }

  // Health check
  async checkHealth() {
    return this.request<{
      status: string;
      timestamp: string;
      db: boolean;
      storage: boolean;
      queue: boolean;
      version?: string;
    }>('/health');
  }

  // AI endpoints (stubs for future features)
  async segmentImage(photoId: string, maskType: string) {
    return this.request<any>('/ai/segment', {
      method: 'POST',
      body: JSON.stringify({ photoId, maskType }),
    });
  }

  async inpaintImage(photoId: string, maskId: string, materialId: string) {
    return this.request<any>('/ai/inpaint', {
      method: 'POST',
      body: JSON.stringify({ photoId, maskId, materialId }),
    });
  }

  // Admin endpoints
  async getAdminOverview() {
    return this.request<{ 
      ok: boolean; 
      stats: { 
        totalUsers: number; 
        totalOrgs: number; 
        totalJobs: number; 
        totalQuotes: number; 
        totalPhotos: number;
        totalMaterials: number;
        activeUsers: number; 
        recentSignups: number;
        onboardingCompleted: number;
        totalQuoteValue: number;
        avgJobsPerUser: string;
        avgQuotesPerJob: string;
        avgPhotosPerJob: string;
        onboardingCompletionRate: string;
        avgQuoteValue: string;
      } 
    }>('/admin/overview');
  }

  async getAdminAnalyticsTimeSeries(days?: number) {
    const params = new URLSearchParams();
    if (days) params.append('days', days.toString());
    return this.request<{ 
      ok: boolean; 
      data: Array<{ date: string; users: number; jobs: number; quotes: number; activeUsers: number }> 
    }>(`/admin/analytics/time-series?${params.toString()}`);
  }

  async getAdminAnalyticsGrowth() {
    return this.request<{ 
      ok: boolean; 
      growth: { 
        users: { 
          weekOverWeek: string; 
          monthOverMonth: string; 
          yearOverYear: string; 
        } 
      } 
    }>('/admin/analytics/growth');
  }

  async getAdminAnalyticsIndustryBreakdown() {
    return this.request<{ 
      ok: boolean; 
      breakdown: { 
        users: Array<{ industry: string; count: number }>; 
        jobs: Array<{ industry: string; count: number }>; 
        quotes: Array<{ industry: string; count: number; totalValue: number }>; 
      } 
    }>('/admin/analytics/industry-breakdown');
  }

  async getAdminAnalyticsActivity(limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    return this.request<{ 
      ok: boolean; 
      activities: Array<any> 
    }>(`/admin/analytics/activity?${params.toString()}`);
  }

  async getAdminUsers(options?: { page?: number; limit?: number; search?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    return this.request<{ ok: boolean; users: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/users?${params.toString()}`);
  }

  async getAdminUser(userId: string) {
    return this.request<{ ok: boolean; user: any; organizations: any[] }>(`/admin/users/${userId}`);
  }

  async updateAdminUser(userId: string, updates: any) {
    return this.request<{ ok: boolean; user: any }>(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async resetAdminUserPassword(userId: string, newPassword: string) {
    return this.request<{ ok: boolean; message: string }>(`/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    });
  }

  async activateAdminUser(userId: string, isActive: boolean) {
    return this.request<{ ok: boolean; message: string }>(`/admin/users/${userId}/activate`, {
      method: 'POST',
      body: JSON.stringify({ isActive }),
    });
  }

  async getAdminOrganizations(options?: { page?: number; limit?: number; search?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    return this.request<{ ok: boolean; organizations: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/organizations?${params.toString()}`);
  }

  async getAdminJobs(options?: { page?: number; limit?: number; search?: string; status?: string; industry?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    if (options?.status) params.append('status', options.status);
    if (options?.industry) params.append('industry', options.industry);
    return this.request<{ ok: boolean; jobs: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/jobs?${params.toString()}`);
  }

  async getAdminQuotes(options?: { page?: number; limit?: number; search?: string; status?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    if (options?.status) params.append('status', options.status);
    return this.request<{ ok: boolean; quotes: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/quotes?${params.toString()}`);
  }

  async getAdminAuditLogs(options?: { page?: number; limit?: number; adminUserId?: string; actionType?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.adminUserId) params.append('adminUserId', options.adminUserId);
    if (options?.actionType) params.append('actionType', options.actionType);
    return this.request<{ ok: boolean; logs: any[]; pagination: { page: number; limit: number } }>(`/admin/audit-logs?${params.toString()}`);
  }
}

export const apiClient = new ApiClient();
