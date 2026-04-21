<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <section aria-labelledby="mfa-title">
    <h1 id="mfa-title">Additional verification required</h1>
    <p>
      Internal tools require multi-factor authentication. Complete MFA with your identity provider,
      then sign in again.
    </p>
    <p>
      <RouterLink to="/account/recovery">Account recovery</RouterLink>
      ·
      <RouterLink to="/login">Sign in</RouterLink>
    </p>
  </section>
</template>
