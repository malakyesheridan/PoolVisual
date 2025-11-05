/**
 * Quote Store
 * 
 * Zustand store for managing quote state and operations
 * Integrates with the existing quote API endpoints
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { apiClient } from '../lib/api-client';

export interface QuoteItem {
  id: string;
  kind: 'material' | 'labor' | 'adjustment';
  description: string;
  unit?: string;
  qty?: number;
  unitPrice?: number;
  lineTotal?: number;
  materialId?: string;
  laborRuleId?: string;
  calcMetaJson?: any;
}

export interface Quote {
  id: string;
  jobId: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  subtotal: string;
  gst: string;
  total: string;
  depositPct: string;
  pdfUrl?: string;
  publicToken?: string;
  stripePaymentIntentId?: string;
  validityDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface QuoteTotals {
  subtotal: number;
  gst: number;
  total: number;
  depositAmount: number;
}

interface QuoteStore {
  // State
  currentQuote: Quote | null;
  quoteItems: QuoteItem[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  loadQuote: (quoteId: string) => Promise<void>;
  loadQuoteItems: (quoteId: string) => Promise<void>;
  addItem: (item: Omit<QuoteItem, 'id'>) => Promise<void>;
  updateItem: (itemId: string, updates: Partial<QuoteItem>) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  recalculateTotals: () => Promise<void>;
  generateQuoteFromJob: (jobId: string) => Promise<Quote>;
  sendQuote: (clientEmail?: string) => Promise<void>;
  acceptQuote: () => Promise<{ clientSecret: string; depositAmount: number }>;
  
  // Computed values
  getTotals: () => QuoteTotals;
  getDepositAmount: () => number;
  
  // Utilities
  clearError: () => void;
  reset: () => void;
}

export const useQuoteStore = create<QuoteStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      currentQuote: null,
      quoteItems: [],
      isLoading: false,
      error: null,

      // Load quote by ID
      loadQuote: async (quoteId: string) => {
        set({ isLoading: true, error: null });
        try {
          const quote = await apiClient.getQuote(quoteId);
          set({ currentQuote: quote, isLoading: false });
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to load quote', 
            isLoading: false 
          });
        }
      },

      // Load quote items
      loadQuoteItems: async (quoteId: string) => {
        set({ isLoading: true, error: null });
        try {
          const items = await apiClient.getQuoteItems(quoteId);
          set({ quoteItems: items, isLoading: false });
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to load quote items', 
            isLoading: false 
          });
        }
      },

      // Add new quote item
      addItem: async (itemData: Omit<QuoteItem, 'id'>) => {
        const { currentQuote } = get();
        if (!currentQuote) {
          set({ error: 'No quote selected' });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const newItem = await apiClient.addQuoteItem(currentQuote.id, itemData);
          set(state => ({ 
            quoteItems: [...state.quoteItems, newItem],
            isLoading: false 
          }));
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to add quote item', 
            isLoading: false 
          });
        }
      },

      // Update existing quote item
      updateItem: async (itemId: string, updates: Partial<QuoteItem>) => {
        const { currentQuote } = get();
        if (!currentQuote) {
          set({ error: 'No quote selected' });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          await apiClient.updateQuoteItem(currentQuote.id, itemId, updates);
          set(state => ({
            quoteItems: state.quoteItems.map(item =>
              item.id === itemId ? { ...item, ...updates } : item
            ),
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to update quote item', 
            isLoading: false 
          });
        }
      },

      // Remove quote item
      removeItem: async (itemId: string) => {
        const { currentQuote } = get();
        if (!currentQuote) {
          set({ error: 'No quote selected' });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          await apiClient.removeQuoteItem(currentQuote.id, itemId);
          set(state => ({
            quoteItems: state.quoteItems.filter(item => item.id !== itemId),
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to remove quote item', 
            isLoading: false 
          });
        }
      },

      // Recalculate quote totals
      recalculateTotals: async () => {
        const { currentQuote } = get();
        if (!currentQuote) {
          set({ error: 'No quote selected' });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          const result = await apiClient.recalculateQuote(currentQuote.id);
          set({ 
            currentQuote: result.quote,
            isLoading: false 
          });
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to recalculate quote', 
            isLoading: false 
          });
        }
      },

      // Generate quote from job data
      generateQuoteFromJob: async (jobId: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await apiClient.generateQuoteFromJob(jobId);
          set({ 
            currentQuote: result.quote,
            quoteItems: result.items,
            isLoading: false 
          });
          return result.quote;
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to generate quote from job', 
            isLoading: false 
          });
          throw error;
        }
      },

      // Send quote to client
      sendQuote: async (clientEmail?: string) => {
        const { currentQuote } = get();
        if (!currentQuote) {
          set({ error: 'No quote selected' });
          return;
        }

        set({ isLoading: true, error: null });
        try {
          await apiClient.sendQuote(currentQuote.id, clientEmail);
          set(state => ({
            currentQuote: state.currentQuote ? {
              ...state.currentQuote,
              status: 'sent'
            } : null,
            isLoading: false
          }));
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to send quote', 
            isLoading: false 
          });
        }
      },

      // Accept quote (for payment processing)
      acceptQuote: async () => {
        const { currentQuote } = get();
        if (!currentQuote) {
          set({ error: 'No quote selected' });
          return { clientSecret: '', depositAmount: 0 };
        }

        set({ isLoading: true, error: null });
        try {
          const result = await apiClient.acceptQuote(currentQuote.id);
          set(state => ({
            currentQuote: state.currentQuote ? {
              ...state.currentQuote,
              status: 'accepted'
            } : null,
            isLoading: false
          }));
          return result;
        } catch (error: any) {
          set({ 
            error: error.message || 'Failed to accept quote', 
            isLoading: false 
          });
          throw error;
        }
      },

      // Get calculated totals
      getTotals: () => {
        const { currentQuote } = get();
        if (!currentQuote) {
          return { subtotal: 0, gst: 0, total: 0, depositAmount: 0 };
        }

        const subtotal = parseFloat(currentQuote.subtotal);
        const gst = parseFloat(currentQuote.gst);
        const total = parseFloat(currentQuote.total);
        const depositPct = parseFloat(currentQuote.depositPct);
        const depositAmount = total * depositPct;

        return { subtotal, gst, total, depositAmount };
      },

      // Get deposit amount
      getDepositAmount: () => {
        const totals = get().getTotals();
        return totals.depositAmount;
      },

      // Clear error
      clearError: () => set({ error: null }),

      // Reset store
      reset: () => set({
        currentQuote: null,
        quoteItems: [],
        isLoading: false,
        error: null
      })
    }),
    {
      name: 'quote-store',
    }
  )
);
