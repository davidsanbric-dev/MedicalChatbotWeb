import { create } from 'zustand';
import type { HandoffTicket } from '@/lib/api';

/** Toasts shown outside the chat, one per handoff request the agent saved. Not persisted. */
interface ToastState {
  toasts: HandoffTicket[];
  push: (ticket: HandoffTicket) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  push: (ticket) => set((s) => ({ toasts: [...s.toasts.filter((t) => t.id !== ticket.id), ticket] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
