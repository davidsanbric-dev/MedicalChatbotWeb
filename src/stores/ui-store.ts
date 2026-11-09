import { create } from 'zustand';
import type { LayerId } from '@/data/layers';

/** Hover/focus link between the 3D slabs and the layer cards on the home page. */
interface UiState {
  activeLayer: LayerId | null;
  setActiveLayer: (id: LayerId | null) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  activeLayer: null,
  setActiveLayer: (activeLayer) => set({ activeLayer }),
}));
