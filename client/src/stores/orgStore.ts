import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Org {
  id: string;
  name: string;
  industry?: string | null;
  logoUrl?: string | null;
  abn?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  brandColors?: any;
  createdAt: string;
}

interface OrgState {
  selectedOrgId: string | null;
  setSelectedOrgId: (orgId: string | null) => void;
  currentOrg: Org | null;
  setCurrentOrg: (org: Org | null) => void;
  clearOrg: () => void;
}

export const useOrgStore = create<OrgState>()(
  persist(
    (set) => ({
      selectedOrgId: null,
      setSelectedOrgId: (orgId) => set({ selectedOrgId: orgId }),
      currentOrg: null,
      setCurrentOrg: (org) => set({ currentOrg: org, selectedOrgId: org?.id || null }),
      clearOrg: () => set({ selectedOrgId: null, currentOrg: null }),
    }),
    {
      name: 'org-storage',
    }
  )
);

