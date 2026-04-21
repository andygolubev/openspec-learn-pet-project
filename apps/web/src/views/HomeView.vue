<script setup lang="ts">
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
</script>

<template>
  <section aria-labelledby="home-title">
    <h1 id="home-title">Welcome</h1>
    <p v-if="auth.loading">Loading session…</p>
    <p v-else-if="auth.authenticated && auth.user">
      Signed in as <strong>{{ auth.user.email }}</strong>
      <span v-if="auth.user.companyId"> — company access active.</span>
      <span v-else> — complete an invitation to join a company.</span>
    </p>
    <p v-else>Use Sign in to continue.</p>
  </section>
</template>
