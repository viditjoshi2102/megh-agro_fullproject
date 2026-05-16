import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user:         null,
      accessToken:  null,
      refreshToken: null,
      permissions:  [],
      setAuth:      (user, accessToken, refreshToken, permissions = []) =>
                      set({ user, accessToken, refreshToken, permissions }),
      setToken:     (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      clearAuth:    () => set({ user: null, accessToken: null, refreshToken: null, permissions: [] }),
      hasPermission: (module, action) => {
        const perms = get().permissions || [];
        return perms.includes(`${module}:${action}`);
      },
    }),
    { name: 'megh-agro-auth' }
  )
);

