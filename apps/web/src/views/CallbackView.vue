<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();
const message = ref("Completing sign-in…");
const isError = ref(false);

onMounted(async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const savedState = sessionStorage.getItem("oauth_state");
  const verifier = sessionStorage.getItem("oauth_code_verifier");
  const inviteToken = sessionStorage.getItem("oauth_invite_token");
  const next = sessionStorage.getItem("oauth_next") ?? "/";

  if (!code || !verifier || !state || state !== savedState) {
    isError.value = true;
    message.value = "Invalid OAuth callback. Try signing in again.";
    return;
  }

  sessionStorage.removeItem("oauth_state");
  sessionStorage.removeItem("oauth_code_verifier");
  sessionStorage.removeItem("oauth_invite_token");
  sessionStorage.removeItem("pending_invite_token");

  const body: Record<string, string> = {
    code,
    code_verifier: verifier,
  };
  if (inviteToken) body.invite_token = inviteToken;

  const res = await fetch("/api/v1/auth/oidc/callback", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    };
    isError.value = true;
    message.value = err?.error?.message ?? "Sign-in failed.";
    return;
  }

  message.value = "Signed in. Redirecting…";
  await router.replace(next);
});
</script>

<template>
  <section :aria-busy="!isError">
    <p :class="{ err: isError }" role="status">{{ message }}</p>
  </section>
</template>

<style scoped>
.err {
  color: #b00020;
}
</style>
