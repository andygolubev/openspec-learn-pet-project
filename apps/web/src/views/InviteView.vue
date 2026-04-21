<script setup lang="ts">
import { onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

onMounted(() => {
  const token = route.params.token as string;
  sessionStorage.setItem("pending_invite_token", token);
  void router.replace({ name: "login" });
});
</script>

<template>
  <p role="status">Preparing your invitation…</p>
</template>
