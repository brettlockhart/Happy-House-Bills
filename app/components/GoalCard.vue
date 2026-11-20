<script setup lang="ts">
import type { Doc } from "~~/convex/_generated/dataModel";

type Goal = Doc<"goals">;

interface Props {
  goal: Goal;
  onEdit?: () => void;
  onDelete?: () => void;
}

const props = defineProps<Props>();

const statusColorClass = (status: string): string => {
  switch (status) {
    case "active":
      return "hhb-badge--success";
    case "at_risk":
      return "hhb-badge--warning";
    case "over_budget":
      return "hhb-badge--error";
    case "achieved":
      return "hhb-badge--info";
    case "paused":
      return "hhb-badge--warning";
    default:
      return "hhb-badge--subtle";
  }
};

const typeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    savings_target: "Savings Target",
    monthly_spending_limit: "Monthly Spending Limit",
    category_budget: "Category Budget",
    debt_payoff: "Debt Payoff",
  };
  return labels[type] ?? type;
};

const statusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    active: "On track",
    achieved: "Achieved",
    at_risk: "At risk",
    over_budget: "Over budget",
    paused: "Paused",
  };
  return labels[status] ?? status;
};

const typeIcon = (type: string): string => {
  const icons: Record<string, string> = {
    savings_target: "shield",
    monthly_spending_limit: "wallet",
    category_budget: "tag",
    debt_payoff: "credit-card",
  };
  return icons[type] ?? "target";
};

const progressClass = (percent: number): string => {
  if (percent >= 100) return "budget-bar-fill--over";
  if (percent >= 80) return "budget-bar-fill--warn";
  return "budget-bar-fill--ok";
};
</script>

<template>
  <div class="goal-card">
    <div class="goal-card__header">
      <div class="goal-card__icon">
        <span class="hhb-icon hhb-icon-sm" aria-hidden="true">
          {{ typeIcon(props.goal.type) }}
        </span>
      </div>
      <div class="goal-card__meta">
        <h3 class="goal-card__name">{{ props.goal.name }}</h3>
        <p class="goal-card__type">{{ typeLabel(props.goal.type) }}</p>
      </div>
      <div class="goal-card__status">
        <span class="hhb-badge" :class="statusColorClass(props.goal.status)">
          {{ statusLabel(props.goal.status) }}
        </span>
      </div>
    </div>

    <div class="goal-card__body">
      <div class="goal-card__progress">
        <div class="goal-card__progress-info">
          <span class="goal-card__progress-value">{{ Math.round(props.goal.progressPercent) }}%</span>
          <span class="goal-card__target">${{ Math.round(props.goal.targetAmount).toLocaleString() }}</span>
        </div>
        <div class="goal-card__bar">
          <div class="hhb-progress">
            <div
              class="hhb-progress-fill"
              :class="progressClass(props.goal.progressPercent)"
              :style="{ width: `${Math.min(props.goal.progressPercent, 100)}%` }"
            />
          </div>
        </div>
      </div>

      <div class="goal-card__metrics">
        <div class="goal-card__metric">
          <span class="goal-card__label">Current</span>
          <span class="goal-card__value">${{ Math.round(props.goal.currentAmount).toLocaleString() }}</span>
        </div>
        <div class="goal-card__metric">
          <span class="goal-card__label">Variance</span>
          <span class="goal-card__value" :class="props.goal.varianceAmount >= 0 ? 'is-positive' : 'is-negative'">
            {{ props.goal.varianceAmount >= 0 ? '+' : '' }}${{ Math.abs(props.goal.varianceAmount).toFixed(2) }}
          </span>
        </div>
        <div class="goal-card__metric">
          <span class="goal-card__label">Alert</span>
          <span class="goal-card__value">{{ props.goal.alertAtPercent }}%</span>
        </div>
      </div>
    </div>

    <div class="goal-card__actions">
      <button class="hhb-btn hhb-btn--sm hhb-btn--secondary" @click="props.onEdit">
        Edit
      </button>
      <button class="hhb-btn hhb-btn--sm hhb-btn--danger" @click="props.onDelete">
        Delete
      </button>
    </div>
  </div>
</template>

<style scoped>
.goal-card {
  background: var(--hhb-color-bg-alt);
  border: 1px solid var(--hhb-color-border);
  border-radius: var(--hhb-radius-lg);
  padding: var(--hhb-space-4);
  transition: all var(--hhb-transition-base);
}

.goal-card:hover {
  border-color: var(--hhb-color-primary-light);
  box-shadow: var(--hhb-shadow-sm);
}

.goal-card__header {
  display: flex;
  align-items: flex-start;
  gap: var(--hhb-space-3);
  margin-bottom: var(--hhb-space-4);
}

.goal-card__icon {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--hhb-color-primary-subtle);
  border-radius: var(--hhb-radius-full);
  flex-shrink: 0;
}

.goal-card__name {
  font-size: var(--hhb-text-base);
  font-weight: var(--hhb-font-semibold);
  margin: 0;
  line-height: 1.3;
}

.goal-card__type {
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text-secondary);
  margin: var(--hhb-space-1) 0 0 0;
}

.goal-card__status {
  margin-left: auto;
  flex-shrink: 0;
}

.goal-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-4);
}

.goal-card__progress {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-2);
}

.goal-card__progress-info {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.goal-card__progress-value {
  font-size: var(--hhb-text-xl);
  font-weight: var(--hhb-font-bold);
  color: var(--hhb-color-primary-dark);
}

.goal-card__target {
  font-size: var(--hhb-text-sm);
  color: var(--hhb-color-text-secondary);
}

.goal-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--hhb-space-4);
}

.goal-card__metric {
  display: flex;
  flex-direction: column;
  gap: var(--hhb-space-1);
}

.goal-card__label {
  font-size: var(--hhb-text-xs);
  color: var(--hhb-color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.goal-card__value {
  font-size: var(--hhb-text-sm);
  font-weight: var(--hhb-font-medium);
}

.goal-card__value.is-positive { color: var(--hhb-color-success); }
.goal-card__value.is-negative { color: var(--hhb-color-error); }

.goal-card__actions {
  display: flex;
  gap: var(--hhb-space-2);
  margin-top: var(--hhb-space-4);
  padding-top: var(--hhb-space-4);
  border-top: 1px solid var(--hhb-color-border);
}
</style>

<!-- Custom styles for goal card progress bar -->
<style>
.goal-card .hhb-progress-bar {
  height: 0.5rem;
  background: var(--hhb-color-muted);
  border-radius: var(--hhb-radius-full);
  overflow: hidden;
}

.goal-card .hhb-progress-fill {
  height: 100%;
  border-radius: var(--hhb-radius-full);
  transition: width var(--hhb-transition-base);
}

.goal-card .budget-bar-fill--ok { background: var(--hhb-color-success); }
.goal-card .budget-bar-fill--warn { background: var(--hhb-color-warning); }
.goal-card .budget-bar-fill--over { background: var(--hhb-color-error); }

.goal-card .budget-bar-fill--primary { background: var(--hhb-color-primary); }
.goal-card .budget-bar-fill--secondary { background: var(--hhb-color-secondary); }
.goal-card .budget-bar-fill--subtle { background: var(--hhb-color-muted); }
</style>