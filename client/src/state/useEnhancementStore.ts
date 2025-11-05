// client/src/state/useEnhancementStore.ts
import { create } from 'zustand';
import type { Job } from '../services/aiEnhancement';

type State = {
  jobs: Record<string, Job>;
  order: string[];
};

type Actions = {
  upsertJob: (partial: Partial<Job> & { id: string }) => void;
  setInitial: (jobs: Job[]) => void;
};

export const useEnhancementStore = create<State & Actions>((set, get) => ({
  jobs: {},
  order: [],
  setInitial: (jobs) => set({
    jobs: Object.fromEntries(jobs.map(j => [j.id, j])),
    order: jobs.map(j => j.id),
  }),
  upsertJob: (partial) => {
    const { jobs, order } = get();
    const existing = jobs[partial.id] || { id: partial.id } as Job;
    const merged: Job = { ...existing, ...partial };
    set({
      jobs: { ...jobs, [partial.id]: merged },
      order: order.includes(partial.id) ? order : [partial.id, ...order],
    });
  },
}));

