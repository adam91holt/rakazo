import type { RunStatus } from "@rakazo/contracts";

export const ACTIVE_RUN_STATUSES = [
  "queued",
  "leased",
  "running",
  "waiting_input",
  "waiting_takeover",
] as const satisfies readonly RunStatus[];
/** Runs that are stalled on the person, not on the model. */
export const BLOCKED_RUN_STATUSES = [
  "waiting_input",
  "waiting_takeover",
] as const satisfies readonly RunStatus[];

/** True while the bot is actually working, rather than waiting on the person. */
export function isBotWorking(status: string | undefined): boolean {
  return (
    ACTIVE_RUN_STATUSES.some((active) => active === status) &&
    !BLOCKED_RUN_STATUSES.some((blocked) => blocked === status)
  );
}

/** What to call a run status in front of someone. Lease states are not news. */
export function describeRunStatus(status: string | undefined): string {
  if (!status || status === "idle" || status === "leased" || status === "queued") return "";
  if (status === "waiting_input") return "Waiting for you";
  if (status === "waiting_takeover") return "Needs you at the computer";
  if (status === "running") return "Working";
  if (status === "failed") return "Stopped";
  return "";
}

const TERMINAL: RunStatus[] = ["completed", "failed", "cancelled"];

const allowed: Record<RunStatus, RunStatus[]> = {
  queued: ["leased", "cancelled"],
  leased: ["running", "queued", "cancelled"],
  running: ["waiting_input", "waiting_takeover", "completed", "failed", "cancelled", "leased"],
  waiting_input: ["queued", "leased", "cancelled"],
  waiting_takeover: ["queued", "leased", "cancelled"],
  completed: [],
  failed: ["queued"],
  cancelled: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return allowed[from]?.includes(to) ?? false;
}

export function assertTransition(from: RunStatus, to: RunStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal run transition ${from} -> ${to}`);
  }
}

export function isActive(status: RunStatus): boolean {
  return (ACTIVE_RUN_STATUSES as readonly RunStatus[]).includes(status);
}

export function isTerminal(status: RunStatus): boolean {
  return TERMINAL.includes(status);
}

export function nextFence(current: number): number {
  return current + 1;
}
