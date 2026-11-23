<script setup lang="ts">
import { useFeatureGate } from "~/composables/useFeatureGate";

const props = defineProps<{
  feature: "expense" | "ocr";
  priceId?: string;
}>();

const { getRole, getUsageLimits, incrementExpenseCount, incrementOcrCount } = useFeatureGate();

const showing = ref(false);
const limits = ref<{
  expenseCount: number;
  ocrCount: number;
  expenseCap: number;
  ocrCap: number;
  isExpenseAt80Percent?: boolean;
  isOcrAt80Percent?: boolean;
} | null>(null);

onMounted(async () => {
  const role = await getRole();
  if (role !== "free") return;

  const l = await getUsageLimits();
  const at80 = props.feature === "expense" ? l.isExpenseAt80Percent : l.isOcrAt80Percent;
  const isAtLimit =
    props.feature === "expense"
      ? l.expenseCount >= l.expenseCap
      : l.ocrCount >= l.ocrCap;

  if (at80 || isAtLimit) {
    showing.value = true;
    limits.value = l;
  }
});

async function trackUsage() {
  if (props.feature === "expense") {
    await incrementExpenseCount();
  } else {
    await incrementOcrCount();
  }

  const l = await getUsageLimits();
  const at80 = props.feature === "expense" ? l.isExpenseAt80Percent : l.isOcrAt80Percent;
  if (at80) showing.value = true;
}

function upgrade() {
  if (!props.priceId) return;
  window.location.href = `/upgrade?priceId=${props.priceId}`;
}
</script>

<template>
  <div v-if="showing" class="upgrade-banner">
    <p class="hhb-text-sm hhb-text-gray-700">
      You&rsquo;ve reached {{ limits?.expenseCap }} monthly {{ props.feature }}s. Upgrade to keep adding more.
    </p>
    <button
      v-if="props.priceId"
      class="hhb-btn hhb-btn-primary hhb-mt-2"
      @click="upgrade"
    >
      Upgrade to Paying
    </button>
    <button class="hhb-btn hhb-btn-outline hhb-mt-2 hhb-ml-2" @click="trackUsage">
      Track Usage
    </button>
  </div>
</template>