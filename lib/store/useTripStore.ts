import { create } from "zustand";

export interface TripSection {
  id: string;
  day: number;
  location: string;
  activity: string;
  time: string;
  notes?: string;
  isCompleted?: boolean;
}

interface TripState {
  sections: TripSection[];
  isEditing: boolean;
  activeSectionId: string | null;
  budgetTotal: number;
  budgetUsed: number;

  // Actions
  addSection: (section: Omit<TripSection, "id">) => void;
  removeSection: (id: string) => void;
  updateSection: (id: string, updates: Partial<TripSection>) => void;
  setEditing: (editing: boolean) => void;
  setActiveSection: (id: string | null) => void;
  toggleSectionCompletion: (id: string) => void;
  updateBudget: (used: number, total?: number) => void;
  setSections: (sections: TripSection[]) => void;
}

export const useTripStore = create<TripState>((set) => ({
  sections: [],
  isEditing: false,
  activeSectionId: null,
  budgetTotal: 5000,
  budgetUsed: 0,

  addSection: (section) =>
    set((state) => ({
      sections: [...state.sections, { ...section, id: crypto.randomUUID() }],
    })),

  removeSection: (id) =>
    set((state) => ({
      sections: state.sections.filter((s) => s.id !== id),
    })),

  updateSection: (id, updates) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  setSections: (sections) => set({ sections }),

  setEditing: (editing) => set({ isEditing: editing }),

  setActiveSection: (id) => set({ activeSectionId: id }),

  toggleSectionCompletion: (id) =>
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, isCompleted: !s.isCompleted } : s
      ),
    })),

  updateBudget: (used, total) =>
    set((state) => ({
      budgetUsed: used,
      budgetTotal: total !== undefined ? total : state.budgetTotal,
    })),
}));
