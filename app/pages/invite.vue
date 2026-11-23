<template>
  <div class="invite-page">
    <div class="invite-container">
      <div v-if="!token" class="invite-error">
        <h1 class="invite-title">Invalid invitation</h1>
        <p class="invite-subtitle">No invitation token was provided.</p>
        <a href="/" class="invite-link">Go to home</a>
      </div>

      <div v-else-if="loading" class="invite-loading">
        <h1 class="invite-title">Accepting invitation&hellip;</h1>
        <p class="invite-subtitle">Please wait while we add you to your household.</p>
      </div>

      <div v-else-if="errorMessage" class="invite-error">
        <h1 class="invite-title">Invitation could not be accepted</h1>
        <p class="invite-subtitle">{{ errorMessage }}</p>
        <a href="/" class="invite-link">Go to home</a>
      </div>

      <div v-else-if="accepted" class="invite-success">
        <h1 class="invite-title">Joined {{ orgName }}!</h1>
        <p class="invite-subtitle">
          You've been added as {{ role }} to your household. You can now start tracking expenses.
        </p>
        <button class="invite-btn" @click="goToDashboard">Go to dashboard</button>
      </div>

      <div v-else class="invite-error">
        <h1 class="invite-title">Invitation expired</h1>
        <p class="invite-subtitle">This invitation link is no longer valid.</p>
        <a href="/" class="invite-link">Go to home</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useOrgs } from "~/composables/useOrgs";

const route = useRoute();
const token = computed(() => {
  const raw = route.query.token;
  return typeof raw === "string" ? raw : "";
});
const { acceptInvite } = useOrgs();

const loading = ref(false);
const errorMessage = ref("");
const accepted = ref(false);
const orgName = ref("");
const role = ref("member");

async function handleAccept() {
  if (!token.value) return;
  loading.value = true;
  errorMessage.value = "";

  try {
    const result = await acceptInvite({ token: token.value });
    accepted.value = true;
    orgName.value = result.orgName ?? "your household";
    role.value = result.role ?? "member";
  } catch (e: unknown) {
    errorMessage.value =
      (e as Error)?.message ?? "Unable to accept invitation. Please try again.";
  } finally {
    loading.value = false;
  }
}

function goToDashboard() {
  navigateTo("/");
}

// Auto-accept when page loads
handleAccept();
</script>

<style scoped>
.invite-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: var(--hhb-color-background);
}

.invite-container {
  max-width: 400px;
  width: 100%;
}

.invite-title {
  font-size: 1.5rem;
  color: #0f172a;
  margin-bottom: 0.5rem;
}

.invite-subtitle {
  color: #64748b;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.invite-loading {
  text-align: center;
}

.invite-error,
.invite-success {
  text-align: center;
}

.invite-link {
  display: inline-block;
  margin-top: 1rem;
  color: #10b981;
  text-decoration: none;
  font-size: 0.875rem;
}

.invite-link:hover {
  text-decoration: underline;
}

.invite-btn {
  width: 100%;
  padding: 0.75rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  margin-top: 0.5rem;
}

.invite-btn:hover {
  background: #059669;
}
</style>
