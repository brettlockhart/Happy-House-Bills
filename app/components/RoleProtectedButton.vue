<script setup lang="ts">
import { useFeatureGate } from "~/composables/useFeatureGate";

defineProps<{
  feature: "expense" | "ocr";
}>();

const { getRole, getUsageLimits } = useFeatureGate();

const role = ref<string>("free");
const limits = ref<{
  expenseCount: number;
  ocrCount: number;
  expenseCap: number;
  ocrCap: number;
} | null>(null);

onMounted(async () => {
  role.value = await getRole();
  if (role.value === "free") {
    limits.value = await getUsageLimits();
  }
});
</script>

<template>
  <div class="role-protected-display">
    <h3 class="hhb-text-lg hhb-font-semibold hhb-mb-2">
      Role: {{ role }} ({{ feature }})
    </h3>
<p v-if="role === 'free' && limits" class="hhb-text-sm hhb-text-gray-600">
        Free-member limits: {{ limits.expenseCount }} expenses/month, {{ limits.ocrCount }} OCR calls/month.
        <br>
        Cap: {{ limits.expenseCap }} expenses, {{ limits.ocrCap }} OCR/month.
      </p>
    <p v-if="role === 'paying'" class="hhb-text-sm hhb-text-green-700">
      Paying member — unlimited usage.
    </p>
    <p v-if="role === 'admin'" class="hhb-text-sm hhb-text-purple-700">
      Admin — full access.
    </p>
  </div>
</template>