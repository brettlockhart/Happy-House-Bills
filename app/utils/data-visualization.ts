export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const formatDate = (date: string): string => {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const groupByCategory = (
  expenses: Array<{ amount: number; category: string }>,
): Array<{ category: string; amount: number; count: number }> => {
  const map = new Map<string, { amount: number; count: number }>();
  for (const e of expenses) {
    const entry = map.get(e.category) || { amount: 0, count: 0 };
    entry.amount += e.amount;
    entry.count += 1;
    map.set(e.category, entry);
  }
  return Array.from(map.entries())
    .map(([category, data]) => ({
      category,
      amount: data.amount,
      count: data.count,
    }))
    .sort((a, b) => b.amount - a.amount);
};

export const generateDailySeries = (
  expenses: Array<{ amount: number; date: string; createdAt: number }>,
  days: number,
): Array<{ date: string; amount: number }> => {
  const result: Array<{ date: string; amount: number }> = [];
  const now = Date.now();

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now - i * 24 * 60 * 60 * 1000);
    const key = day.toISOString().split("T")[0] ?? "";
    const amount = expenses
      .filter((e) => new Date(e.date).toISOString().split("T")[0] === key)
      .reduce((s, e) => s + e.amount, 0);
    result.push({ date: key, amount: Math.round(amount * 100) / 100 });
  }

  return result;
};
