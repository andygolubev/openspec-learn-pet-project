<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { createPkcePair, randomState } from "../lib/pkce";

const router = useRouter();
const route = useRoute();
const error = ref<string | null>(null);
const configured = ref<boolean | null>(null);

const redirectUri = `${window.location.origin}/callback`;

onMounted(async () => {
  const res = await fetch("/api/v1/auth/oidc/config", { credentials: "include" });
  const data = (await res.json()) as { configured: boolean };
  configured.value = data.configured;
});

async function startLogin() {
  error.value = null;
  const res = await fetch("/api/v1/auth/oidc/config", { credentials: "include" });
  const cfg = (await res.json()) as {
    configured: boolean;
    authorization_endpoint?: string;
    client_id?: string;
  };
  if (!cfg.configured || !cfg.authorization_endpoint || !cfg.client_id) {
    error.value =
      "OIDC is not configured. Set OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, and OIDC_REDIRECT_URI on the API (see apps/api/.env.example).";
    return;
  }
  const { codeVerifier, codeChallenge } = await createPkcePair();
  const state = randomState();
  sessionStorage.setItem("oauth_code_verifier", codeVerifier);
  sessionStorage.setItem("oauth_state", state);
  const next = typeof route.query.next === "string" ? route.query.next : "/";
  sessionStorage.setItem("oauth_next", next);
  const invite = sessionStorage.getItem("pending_invite_token");
  if (invite) {
    sessionStorage.setItem("oauth_invite_token", invite);
  }
  const url = new URL(cfg.authorization_endpoint);
  url.searchParams.set("client_id", cfg.client_id);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  window.location.assign(url.toString());
}

function skipToHome() {
  void router.push("/");
}
</script>

<template>
  <section aria-labelledby="login-title">
    <h1 id="login-title">Sign in</h1>
    <p v-if="configured === false" role="status">
      OIDC is not configured on the API. For local development you can still use seeded data and
      <code>/api/v1/auth/test-login</code> (non-production only).
    </p>
    <p v-else-if="configured === null" role="status">Checking configuration…</p>
    <div class="actions">
      <button type="button" class="primary" @click="startLogin">Continue with your organization</button>
      <button type="button" class="secondary" @click="skipToHome">Back</button>
    </div>
    <p v-if="error" class="err" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}
.primary {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #0b5fff;
  background: #0b5fff;
  color: #fff;
  font: inherit;
  cursor: pointer;
}
.secondary {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  background: #fff;
  font: inherit;
  cursor: pointer;
}
.err {
  color: #b00020;
  margin-top: 1rem;
}
code {
  font-size: 0.9em;
}
</style>
