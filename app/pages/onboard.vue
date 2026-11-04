<template>
  <div class="onboard-page">
    <div class="onboard-container">
      <h1>Create your household</h1>
      <p class="subtitle">Enter your partner's email to share household expenses</p>

      <form class="onboard-form" @submit.prevent="handleSubmit">
        <div class="field-group">
          <label for="household-name">Household name</label>
          <input
            id="household-name"
            v-model="householdName"
            type="text"
            placeholder="e.g. Home"
            :disabled="isSubmitting"
          >
        </div>

        <div class="field-group">
          <label for="partner-email">Partner's email</label>
          <input
            id="partner-email"
            v-model="partnerEmail"
            type="email"
            placeholder="partner@example.com"
            :disabled="isSubmitting"
          >
        </div>

        <button type="submit" :disabled="isSubmitting || !canSubmit">
          {{ isSubmitting ? 'Creating...' : 'Create & Send Invite' }}
        </button>

        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

const householdName = ref("");
const partnerEmail = ref("");
const isSubmitting = ref(false);
const errorMessage = ref("");

const { createOrg, invitePartner } = useOrgs();

const canSubmit = computed(() => {
  return householdName.value.trim().length > 0 &&
    partnerEmail.value.includes("@");
});

async function handleSubmit() {
  if (!canSubmit.value) return;

  isSubmitting.value = true;
  errorMessage.value = "";

  try {
    const { orgId } = await createOrg({ name: householdName.value.trim() });
    await invitePartner({
      email: partnerEmail.value.trim(),
      orgId,
      orgName: householdName.value.trim(),
    });

    window.location.href = "/?invited=true";
  } catch (e: unknown) {
    errorMessage.value =
      (e as Error)?.message || "Failed to create household";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.onboard-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.onboard-container {
  max-width: 400px;
  width: 100%;
}

.onboard-container h1 {
  font-size: 1.5rem;
  color: #0f172a;
}

.subtitle {
  color: #64748b;
  margin-bottom: 1.5rem;
}

.field-group {
  margin-bottom: 1rem;
}

.field-group label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #334159;
  margin-bottom: 0.25rem;
}

.field-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 0.875rem;
}

.field-group input:disabled {
  background: #f1f5f9;
}

button {
  width: 100%;
  padding: 0.75rem;
  background: #10b981;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  color: #ef4444;
  font-size: 0.75rem;
  margin-top: 0.5rem;
  text-align: center;
}
</style>