<script setup lang="ts">
import { onMounted } from "vue";
import { RouterLink, RouterView } from "vue-router";
import { useAuthStore } from "./stores/auth";

const auth = useAuthStore();
onMounted(() => {
  void auth.ensureSession();
});
</script>

<template>
  <div class="layout">
    <header class="header">
      <RouterLink class="brand" to="/">MRO Portal</RouterLink>
      <nav class="nav" aria-label="Primary">
        <RouterLink to="/">Home</RouterLink>
        <RouterLink v-if="auth.authenticated" to="/admin">Team</RouterLink>
        <RouterLink v-if="auth.authenticated" to="/internal">Internal</RouterLink>
        <RouterLink to="/account/recovery">Account recovery</RouterLink>
        <button
          v-if="auth.authenticated"
          type="button"
          class="linkish"
          @click="auth.logout()"
        >
          Sign out
        </button>
        <RouterLink v-else to="/login">Sign in</RouterLink>
      </nav>
    </header>
    <main id="main" class="main" tabindex="-1">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: system-ui, sans-serif;
  color: #1a1a1a;
  background: #fafafa;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.25rem;
  background: #fff;
  border-bottom: 1px solid #e5e5e5;
}
.brand {
  font-weight: 600;
  text-decoration: none;
  color: inherit;
}
.nav {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  align-items: center;
}
.nav a {
  color: #0b5fff;
  text-decoration: underline;
}
.main {
  flex: 1;
  padding: 1.5rem;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
}
.linkish {
  background: none;
  border: none;
  color: #0b5fff;
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
  padding: 0;
}
</style>
