import { defineStore } from "pinia";

export type SessionUser = {
  id: string;
  email: string;
  companyId: string | null;
  roles: string[];
  mfaSatisfied?: boolean;
};

export const useAuthStore = defineStore("auth", {
  state: () => ({
    authenticated: false as boolean,
    user: null as SessionUser | null,
    loading: false as boolean,
  }),
  actions: {
    async ensureSession() {
      this.loading = true;
      try {
        const res = await fetch("/api/v1/auth/session", { credentials: "include" });
        const data = (await res.json()) as {
          authenticated: boolean;
          user?: SessionUser;
        };
        this.authenticated = !!data.authenticated;
        this.user = data.user ?? null;
      } finally {
        this.loading = false;
      }
    },
    async logout() {
      await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" });
      this.authenticated = false;
      this.user = null;
    },
    isCustomerAdmin(): boolean {
      return !!this.user?.roles.includes("customer_admin");
    },
    isInternal(): boolean {
      return !!this.user?.roles.some((r) => r.startsWith("internal_"));
    },
  },
});
