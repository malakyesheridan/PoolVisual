import { useAuthStore } from '@/stores/auth-store';

class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = '/api';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include', // Important for session cookies
      ...options,
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, config);

    if (!response.ok) {
      const ct = response.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await response.json() : await response.text();
      throw new Error(typeof body === "string" ? body : body?.error || "Request failed");
    }

    // Handle no-content responses
    if (response.status === 204) {
      return {} as T;
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

  async register(email: string, username: string, password: string) {
    return this.request<{ ok: boolean; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, username, password }),
    });
  }

  // Organizations
  async getMyOrgs() {
    return this.request<any[]>('/me/orgs');
  }

  async createOrg(data: any) {
    return this.request<any>('/orgs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async inviteToOrg(orgId: string, email: string, role: string) {
    return this.request<any>(`/orgs/${orgId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    });
  }

  // Jobs
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
  async getMaterials(orgId: string, category?: string, search?: string) {
    const params = new URLSearchParams({ orgId });
    if (category) params.append('category', category);
    if (search) params.append('q', search);
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

  async getQuote(id: string) {
    return this.request<any>(`/quotes/${id}`);
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
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async removeQuoteItem(quoteId: string, itemId: string) {
    return this.request(`/quotes/${quoteId}/items/${itemId}`, {
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

  async acceptQuote(id: string) {
    return this.request<{ clientSecret: string; depositAmount: number }>(`/quotes/${id}/accept`, {
      method: 'POST',
    });
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
}

export const apiClient = new ApiClient();
