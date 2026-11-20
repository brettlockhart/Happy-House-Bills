import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "goal-variance-check",
  { hourUTC: 3, minuteUTC: 0 },
  internal.functions.goals.checkVariance,
);

export default crons;