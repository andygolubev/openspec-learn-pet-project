import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "home", component: () => import("../views/HomeView.vue") },
    { path: "/login", name: "login", component: () => import("../views/LoginView.vue") },
    {
      path: "/callback",
      name: "callback",
      component: () => import("../views/CallbackView.vue"),
    },
    {
      path: "/invite/:token",
      name: "invite",
      component: () => import("../views/InviteView.vue"),
    },
    {
      path: "/admin",
      name: "admin",
      component: () => import("../views/AdminView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/internal",
      name: "internal",
      component: () => import("../views/InternalView.vue"),
      meta: { requiresAuth: true },
    },
    {
      path: "/account/recovery",
      name: "recovery",
      component: () => import("../views/RecoveryView.vue"),
    },
    {
      path: "/mfa-required",
      name: "mfa",
      component: () => import("../views/MfaRequiredView.vue"),
    },
  ],
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true;
  const auth = useAuthStore();
  await auth.ensureSession();
  if (!auth.authenticated) {
    return { name: "login", query: { next: to.fullPath } };
  }
  return true;
});

export default router;
