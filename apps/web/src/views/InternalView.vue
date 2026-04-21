<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const router = useRouter();
const auth = useAuthStore();
const status = ref<string>("Loading…");
const detail = ref<string | null>(null);

onMounted(async () => {
  await auth.ensureSession();
  if (!auth.isInternal()) {
    status.value = "Internal access only.";
    return;
  }
  const res = await fetch("/api/v1/internal/ping", { credentials: "include" });
  const body = await res.json().catch(() => ({}));
  if (res.status === 403) {
    const code = (body as { error?: { code?: string } }).error?.code;
    if (code === "MFA_REQUIRED") {
      await router.replace({ name: "mfa" });
      return;
    }
    status.value = "Access denied.";
    detail.value = JSON.stringify(body);
    return;
  }
  if (!res.ok) {
    status.value = "Request failed.";
    detail.value = JSON.stringify(body);
    return;
  }
  status.value = "Internal API reachable.";
  detail.value = JSON.stringify(body);
});
</script>

<template>
  <section aria-labelledby="internal-title">
    <h1 id="internal-title">Internal</h1>
    <p role="status">{{ status }}</p>
    <pre v-if="detail" class="pre">{{ detail }}</pre>
  </section>
</template>

<style scoped>
.pre {
  background: #fff;
  border: 1px solid #e5e5e5;
  padding: 1rem;
  overflow: auto;
}
</style>
