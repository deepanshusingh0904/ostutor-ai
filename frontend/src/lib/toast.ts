import { create } from "zustand";

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: "default" | "success" | "error";
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { ...toast, id }].slice(-4) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  show: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: "default" }),
  success: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: "success" }),
  error: (title: string, description?: string) => useToastStore.getState().push({ title, description, variant: "error" }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}
