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
  async getJobsCanvasStatus(jobIds?: string[]) {
    const params = new URLSearchParams();
    if (jobIds && jobIds.length > 0) {
      params.append('jobIds', jobIds.join(','));
    }
    return this.request<any[]>(`/jobs/canvas-status?${params.toString()}`);
  }

  async getJobs(filters?: { status?: string; q?: string }) {
    const params = new URLSearchParams();
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

  async uploadPhoto(file: File, jobId: string, category: 'marketing' | 'renovation_buyer' = 'marketing', additionalData?: any) {
    const formData = new FormData();
    formData.append('photo', file);
    formData.append('jobId', jobId);
    formData.append('photoCategory', category);
    
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

  async getJobPhotos(jobId: string, category?: 'marketing' | 'renovation_buyer') {
    const url = category 
      ? `/jobs/${jobId}/photos?category=${category}`
      : `/jobs/${jobId}/photos`;
    return this.request<any[]>(url);
  }

  async updatePhotoCategory(photoId: string, category: 'marketing' | 'renovation_buyer') {
    return this.request(`/photos/${photoId}/category`, {
      method: 'PUT',
      body: JSON.stringify({ category }),
    });
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
  async getMaterials(category?: string, search?: string, industry?: string) {
    const params = new URLSearchParams();
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

  async getQuotes(filters?: { status?: string; jobId?: string }) {
    const params = new URLSearchParams();
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

  // Credit methods
  async getCreditBalance() {
    return this.request<{ ok: boolean; balance: { total: number; subscriptionCredits: number; topUpCredits: number; usedThisMonth: number } }>('/credits/balance', {
      method: 'GET',
    });
  }

  async createTopUpCheckout(priceId: string) {
    return this.request<{ ok: boolean; url: string; sessionId: string; credits: number }>('/credits/topup/checkout', {
      method: 'POST',
      body: JSON.stringify({ priceId }),
    });
  }

  async calculateCredits(enhancementType: string, hasMask: boolean) {
    const params = new URLSearchParams();
    params.append('enhancementType', enhancementType);
    params.append('hasMask', hasMask.toString());
    return this.request<{ ok: boolean; enhancementType: string; hasMask: boolean; credits: number }>(`/credits/calculate?${params.toString()}`, {
      method: 'GET',
    });
  }

  // Feature access methods
  async getFeatureAccess() {
    return this.request<{ ok: boolean; features: { brushTool: boolean; maskedPrompts: boolean; presetLibrary: boolean; beforeAfterExport: boolean; whiteLabel: boolean; priorityQueue: boolean } }>('/features/access', {
      method: 'GET',
    });
  }

  async checkFeatureAccess(feature: string) {
    return this.request<{ ok: boolean; hasAccess: boolean; feature: string }>(`/features/${feature}`, {
      method: 'GET',
    });
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
        // New actionable metrics
        activeSubscriptions: number;
        trialSubscriptions: number;
        pastDueSubscriptions: number;
        canceledSubscriptions: number;
        trialExpiringSoon: number;
        stuckInOnboarding: number;
        inactiveUsers: number;
        jobsStuck: number;
        quotesPending: number;
        mrr: number;
        churnedThisMonth: number;
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
    return this.request<{ 
      ok: boolean; 
      user: any; 
      organizations: any[];
      jobs: any[];
      quotes: any[];
      photos: any[];
      onboarding: any;
      sessions: any[];
      securityEvents: any[];
      loginAttempts: any[];
      usageStats: {
        totalJobs: number;
        totalQuotes: number;
        totalPhotos: number;
        jobsThisMonth: number;
        quotesThisMonth: number;
        photosThisMonth: number;
      };
    }>(`/admin/users/${userId}`);
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

  async getAdminOrganization(orgId: string) {
    return this.request<{
      ok: boolean;
      organization: any;
      subscriptionPlan: any;
      subscriptionHistory: any[];
      members: any[];
      jobs: any[];
      quotes: any[];
      photos: any[];
      materials: any[];
      settings: any;
      usageStats: {
        totalJobs: number;
        totalQuotes: number;
        totalPhotos: number;
        totalMaterials: number;
        jobsThisMonth: number;
        quotesThisMonth: number;
        photosThisMonth: number;
        totalQuoteValue: number;
        avgQuoteValue: number;
      };
      financialSummary: {
        totalQuoteValue: number;
        avgQuoteValue: number;
        quotesThisMonth: number;
        quoteValueThisMonth: number;
      };
    }>(`/admin/organizations/${orgId}`);
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

  async getAdminMaterials(options?: { page?: number; limit?: number; search?: string; category?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.search) params.append('search', options.search);
    if (options?.category) params.append('category', options.category);
    return this.request<{ ok: boolean; materials: any[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>(`/admin/materials?${params.toString()}`);
  }

  async getAdminAuditLogs(options?: { page?: number; limit?: number; adminUserId?: string; actionType?: string }) {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.adminUserId) params.append('adminUserId', options.adminUserId);
    if (options?.actionType) params.append('actionType', options.actionType);
    return this.request<{ ok: boolean; logs: any[]; pagination: { page: number; limit: number } }>(`/admin/audit-logs?${params.toString()}`);
  }

  // Property Notes (for real estate)
  async getPropertyNotes(jobId: string) {
    return this.request<any[]>(`/jobs/${jobId}/notes`);
  }

  async createPropertyNote(jobId: string, noteText: string, tags?: string[]) {
    return this.request(`/jobs/${jobId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ noteText, tags }),
    });
  }

  async updatePropertyNote(noteId: string, noteText: string, tags?: string[]) {
    return this.request(`/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ noteText, tags }),
    });
  }

  async deletePropertyNote(noteId: string) {
    return this.request(`/notes/${noteId}`, { method: 'DELETE' });
  }

  // Opportunities (for real estate)
  async getOpportunities(filters?: { status?: string; pipelineStage?: string; propertyJobId?: string }) {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.pipelineStage) params.append('pipelineStage', filters.pipelineStage);
    if (filters?.propertyJobId) params.append('propertyJobId', filters.propertyJobId);
    const query = params.toString();
    return this.request<any[]>(`/opportunities${query ? `?${query}` : ''}`);
  }

  async getOpportunity(id: string) {
    return this.request<any>(`/opportunities/${id}`);
  }

  async createOpportunity(data: any) {
    return this.request(`/opportunities`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOpportunity(id: string, data: any) {
    return this.request(`/opportunities/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOpportunity(id: string) {
    return this.request(`/opportunities/${id}`, { method: 'DELETE' });
  }

  async getOpportunityPipeline() {
    return this.request<Record<string, any[]>>(`/opportunities/pipeline`);
  }

  // Opportunity Tasks (new name for follow-ups)
  async getOpportunityTasks(opportunityId: string) {
    return this.request<any[]>(`/opportunities/${opportunityId}/tasks`).then(tasks => 
      tasks.map((task: any) => ({
        ...task,
        title: task.title || task.taskText,
        status: task.status || (task.completed ? 'completed' : 'pending'),
      }))
    );
  }

  async createOpportunityTask(opportunityId: string, data: { title: string; description?: string; dueDate?: string }) {
    return this.request(`/opportunities/${opportunityId}/tasks`, {
      method: 'POST',
      body: JSON.stringify({
        title: data.title,
        description: data.description,
        dueDate: data.dueDate,
      }),
    }).then((task: any) => ({
      ...task,
      title: task.title || task.taskText,
      status: task.status || (task.completed ? 'completed' : 'pending'),
    }));
  }

  async updateOpportunityTask(id: string, data: any) {
    // The backend route expects status as a string, not completed boolean
    const updates: any = { ...data };
    
    // Keep status as-is (backend handles it)
    // Map title to taskText only if title exists and taskText doesn't
    if (data.title && !data.taskText) {
      updates.taskText = data.title;
      delete updates.title;
    }
    
    return this.request(`/opportunity-tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }).then((task: any) => ({
      ...task,
      title: task.title || task.taskText,
      status: task.status || (task.completed ? 'completed' : 'pending'),
    }));
  }

  async deleteOpportunityTask(id: string) {
    return this.request(`/opportunity-tasks/${id}`, { method: 'DELETE' });
  }

  // Opportunity Follow-ups (legacy - aliases for tasks)
  async getOpportunityFollowups(opportunityId: string) {
    return this.getOpportunityTasks(opportunityId);
  }

  async createOpportunityFollowup(opportunityId: string, data: any) {
    return this.createOpportunityTask(opportunityId, {
      title: data.taskText || data.title,
      description: data.description,
      dueDate: data.dueDate,
    });
  }

  async updateOpportunityFollowup(id: string, data: any) {
    return this.updateOpportunityTask(id, {
      title: data.taskText || data.title,
      description: data.description,
      status: data.completed ? 'completed' : 'pending',
      dueDate: data.dueDate,
    });
  }

  async completeOpportunityFollowup(id: string) {
    return this.updateOpportunityTask(id, { status: 'completed' });
  }

  async deleteOpportunityFollowup(id: string) {
    return this.deleteOpportunityTask(id);
  }

  // Opportunity Notes
  async getOpportunityNotes(opportunityId: string) {
    return this.request<any[]>(`/opportunities/${opportunityId}/notes`);
  }

  async createOpportunityNote(opportunityId: string, noteText: string, noteType?: string) {
    return this.request(`/opportunities/${opportunityId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ noteText, noteType: noteType || 'general' }),
    });
  }

  async updateOpportunityNote(noteId: string, noteText: string, noteType?: string) {
    return this.request(`/opportunity-notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify({ noteText, noteType }),
    });
  }

  async deleteOpportunityNote(noteId: string) {
    return this.request(`/opportunity-notes/${noteId}`, { method: 'DELETE' });
  }

  // Contacts
  async getContacts() {
    return this.request<any[]>('/contacts');
  }

  async createContact(data: any) {
    return this.request('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContact(id: string, data: any) {
    return this.request(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContact(id: string) {
    return this.request(`/contacts/${id}`, { method: 'DELETE' });
  }

  // Pipelines
  async getPipelines() {
    return this.request<any[]>('/pipelines');
  }

  async createPipeline(data: any) {
    return this.request('/pipelines', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePipeline(id: string, data: any) {
    return this.request(`/pipelines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Pipeline Stages
  async getPipelineStages(pipelineId: string) {
    return this.request<any[]>(`/pipelines/${pipelineId}/stages`);
  }

  async createPipelineStage(pipelineId: string, data: any) {
    return this.request(`/pipelines/${pipelineId}/stages`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updatePipelineStage(id: string, data: any) {
    return this.request(`/pipeline-stages/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updatePipelineStageName(id: string, name: string) {
    return this.request(`/pipeline-stages/${id}/name`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
  }

  async resetPipelineStageName(id: string) {
    return this.request(`/pipeline-stages/${id}/name`, {
      method: 'DELETE',
    });
  }

  async deletePipelineStage(id: string) {
    return this.request(`/pipeline-stages/${id}`, {
      method: 'DELETE',
    });
  }

  // Opportunity Activities
  async getOpportunityActivities(opportunityId: string) {
    return this.request<any[]>(`/opportunities/${opportunityId}/activities`);
  }

  async createOpportunityActivity(opportunityId: string, data: any) {
    return this.request(`/opportunities/${opportunityId}/activities`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Opportunity Documents
  async getOpportunityDocuments(opportunityId: string) {
    return this.request<any[]>(`/opportunities/${opportunityId}/documents`);
  }

  async createOpportunityDocument(opportunityId: string, data: any) {
    return this.request(`/opportunities/${opportunityId}/documents`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteOpportunityDocument(documentId: string) {
    return this.request(`/opportunity-documents/${documentId}`, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
