<script setup lang="ts">
import { onMounted, ref } from "vue";

const url = ref<string | null>(null);
const message = ref<string | null>(null);
const err = ref<string | null>(null);

onMounted(async () => {
  const res = await fetch("/api/v1/auth/recovery", { credentials: "include" });
  const data = (await res.json()) as {
    url?: string;
    message?: string;
    error?: { message?: string };
  };
  if (!res.ok) {
    err.value =
      data.error?.message ?? "Could not load recovery information.";
    return;
  }
  url.value = data.url ?? null;
  message.value = data.message ?? null;
});
</script>

<template>
  <section aria-labelledby="recovery-title">
    <h1 id="recovery-title">Account recovery</h1>
    <p v-if="err" class="err" role="alert">{{ err }}</p>
    <template v-else>
      <p>{{ message }}</p>
      <p v-if="url">
        <a :href="url">Open your identity provider recovery page</a>
      </p>
    </template>
  </section>
</template>

<style scoped>
.err {
  color: #b00020;
}
</style>
