<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { apiJson } from "../lib/api";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const members = ref<
  {
    userId: string;
    email: string;
    createdAt: number;
    roles: string[];
  }[]
>([]);
const invitations = ref<
  { id: string; email: string; expiresAt: number; createdAt: number }[]
>([]);
const inviteEmail = ref("");
const inviteMessage = ref<string | null>(null);
const err = ref<string | null>(null);

const companyId = computed(() => auth.user?.companyId);

onMounted(async () => {
  await auth.ensureSession();
  await loadMembers();
});

async function loadInvitations() {
  if (!companyId.value || !auth.isCustomerAdmin()) return;
  const res = await apiJson<{ invitations: typeof invitations.value }>(
    `/api/v1/companies/${companyId.value}/invitations`,
  );
  if (res.ok) {
    invitations.value = res.data.invitations ?? [];
  }
}

async function loadMembers() {
  err.value = null;
  if (!companyId.value) {
    err.value = "No company on your account yet. Accept an invitation first.";
    return;
  }
  if (!auth.isCustomerAdmin()) {
    err.value = "Customer admin role required to manage team members.";
    return;
  }
  const res = await apiJson<{ members: typeof members.value }>(
    `/api/v1/companies/${companyId.value}/users`,
  );
  if (!res.ok) {
    err.value = (res.data as { error?: { message?: string } }).error?.message ?? "Failed to load.";
    return;
  }
  members.value = res.data.members ?? [];
  await loadInvitations();
}

async function sendInvite() {
  inviteMessage.value = null;
  err.value = null;
  if (!companyId.value) return;
  const res = await apiJson<{ inviteUrl?: string }>(
    `/api/v1/companies/${companyId.value}/invitations`,
    {
      method: "POST",
      body: JSON.stringify({ email: inviteEmail.value }),
    },
  );
  if (!res.ok) {
    err.value =
      (res.data as { error?: { message?: string } }).error?.message ?? "Invite failed.";
    return;
  }
  inviteMessage.value = `Invitation created. Share: ${(res.data as { inviteUrl?: string }).inviteUrl ?? "link"}`;
  inviteEmail.value = "";
  await loadMembers();
  await loadInvitations();
}

async function revokeInvite(id: string) {
  if (!companyId.value) return;
  err.value = null;
  const res = await fetch(
    `/api/v1/companies/${companyId.value}/invitations/${id}`,
    { method: "DELETE", credentials: "include" },
  );
  if (!res.ok) {
    err.value = "Could not revoke invitation.";
    return;
  }
  await loadMembers();
  await loadInvitations();
}

async function changeRole(userId: string, roles: string[]) {
  if (!companyId.value) return;
  err.value = null;
  const res = await apiJson(`/api/v1/companies/${companyId.value}/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ roles }),
  });
  if (!res.ok) {
    err.value = (res.data as { error?: { message?: string } }).error?.message ?? "Update failed.";
    return;
  }
  await loadMembers();
}
</script>

<template>
  <section aria-labelledby="admin-title">
    <h1 id="admin-title">Team</h1>
    <p v-if="err" class="err" role="alert">{{ err }}</p>
    <div v-if="companyId && auth.isCustomerAdmin()" class="panel">
      <h2>Invite colleague</h2>
      <form class="form" @submit.prevent="sendInvite">
        <label class="label" for="invite-email">Email</label>
        <input
          id="invite-email"
          v-model="inviteEmail"
          type="email"
          required
          autocomplete="email"
          class="input"
        />
        <button type="submit" class="btn">Send invitation</button>
      </form>
      <p v-if="inviteMessage" role="status">{{ inviteMessage }}</p>
    </div>
    <div v-if="invitations.length && auth.isCustomerAdmin()" class="panel">
      <h2>Pending invitations</h2>
      <ul>
        <li v-for="inv in invitations" :key="inv.id">
          {{ inv.email }} (expires {{ new Date(inv.expiresAt).toLocaleString() }})
          <button type="button" class="linkish" @click="revokeInvite(inv.id)">
            Revoke
          </button>
        </li>
      </ul>
    </div>
    <div v-if="members.length" class="panel">
      <h2>Members</h2>
      <table class="table" aria-label="Company members">
        <thead>
          <tr>
            <th scope="col">Email</th>
            <th scope="col">Roles</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="m in members" :key="m.userId">
            <td>{{ m.email }}</td>
            <td>{{ m.roles.join(", ") }}</td>
            <td>
              <button
                v-if="m.userId !== auth.user?.id"
                type="button"
                class="linkish"
                @click="
                  changeRole(m.userId, ['customer_admin'])
                "
              >
                Make admin
              </button>
              <button
                v-if="m.userId !== auth.user?.id"
                type="button"
                class="linkish"
                @click="
                  changeRole(m.userId, ['customer_user'])
                "
              >
                Make user
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.err {
  color: #b00020;
}
.panel {
  background: #fff;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
}
.form {
  display: grid;
  gap: 0.5rem;
  max-width: 420px;
}
.label {
  font-weight: 600;
}
.input {
  padding: 0.5rem;
  border-radius: 6px;
  border: 1px solid #ccc;
  font: inherit;
}
.btn {
  justify-self: start;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid #0b5fff;
  background: #0b5fff;
  color: #fff;
  font: inherit;
  cursor: pointer;
}
.table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  text-align: left;
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}
.linkish {
  background: none;
  border: none;
  color: #0b5fff;
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
  margin-right: 0.5rem;
}
</style>
