import { create } from 'zustand';
import type { AuthSessionView } from '../../preload/api';

type AuthState = {
  session: AuthSessionView | null;
  loading: boolean;
  refreshSession(): Promise<void>;
  logout(): Promise<{ ok: boolean }>;
  clearSession(): void;
};

const DEV_PREVIEW_AUTH_SESSION: AuthSessionView = {
  loggedIn: true,
  email: 'vividrop@studio.example',
  accountLabel: 'vividrop@studio.example',
};

function getDevPreviewAuthSession(): AuthSessionView | null {
  return import.meta.env.DEV && import.meta.env.MODE !== 'test' ? DEV_PREVIEW_AUTH_SESSION : null;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: false,

  refreshSession: async () => {
    const auth = window.electronAPI?.auth;
    if (!auth?.getAuthSession) {
      set({ session: getDevPreviewAuthSession(), loading: false });
      return;
    }

    set({ loading: true });
    try {
      const session = await auth.getAuthSession();
      set({ session: session ?? getDevPreviewAuthSession(), loading: false });
    } catch (error) {
      console.error('Failed to get auth session:', error);
      set({ session: getDevPreviewAuthSession(), loading: false });
    }
  },

  logout: async () => {
    const auth = window.electronAPI?.auth;
    if (!auth?.logout) {
      return { ok: false };
    }

    const result = await auth.logout();
    if (result.ok) {
      set({ session: null });
    }
    return result;
  },

  clearSession: () => set({ session: null, loading: false }),
}));
