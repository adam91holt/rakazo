import type { AgentToolExecutionResult } from "@rakazo/adapter-kit";

export type ApprovalPausedToolResult = AgentToolExecutionResult & { terminate: true };

export function approvalPausedToolResult(): ApprovalPausedToolResult {
  return {
    kind: "agent_tool_result",
    content: [{ type: "text", text: "Waiting for approval." }],
    details: { approval: "paused" },
    terminate: true,
  };
}

export function isApprovalPausedResult(result: unknown): result is ApprovalPausedToolResult {
  if (!result || typeof result !== "object") return false;
  const record = result as ApprovalPausedToolResult;
  if (record.kind !== "agent_tool_result") return false;
  const details = record.details;
  return (
    Boolean(details) &&
    typeof details === "object" &&
    (details as { approval?: unknown }).approval === "paused"
  );
}

export type DuplicateEffectGate =
  | { action: "execute" }
  | { action: "return"; result: unknown }
  | { action: "paused" }
  | { action: "uncertain"; toolName: string };

export type ExternalEffectStore = {
  externalEffect: {
    updateMany: (args: {
      where: { id: string; status: string };
      data: { status: string };
    }) => Promise<{ count: number }>;
  };
};

export function resolveDuplicateEffectGate(
  effect: { status: string; result?: unknown },
  toolName: string,
): DuplicateEffectGate {
  if (effect.status === "completed") {
    return { action: "return", result: effect.result ?? { duplicate: true } };
  }
  if (effect.status === "denied") {
    // Saying only that it was denied read as a transient failure, so the model
    // reissued the same call until the repeated-tool guard ended the turn — the
    // person who declined then saw a stuck bot rather than an acknowledgement.
    return {
      action: "return",
      result: {
        error:
          "The user declined this action. Do not retry it — only they can approve it, and nothing you do will change that within this turn. Do something else, or tell them it was declined and ask what they would prefer.",
      },
    };
  }
  if (effect.status === "executing") {
    return { action: "uncertain", toolName };
  }
  if (effect.status === "uncertain") {
    return { action: "return", result: effect.result ?? uncertainEffectResult(toolName) };
  }
  if (effect.status === "approved") {
    return { action: "execute" };
  }
  if (effect.status === "intended") {
    return { action: "paused" };
  }
  return { action: "uncertain", toolName };
}

export type UncertainEffectResult = { error: string; uncertain: true };

export function uncertainEffectResult(toolName: string): UncertainEffectResult {
  return {
    error: `The earlier ${toolName} execution was interrupted, so its outcome is unknown. It was not replayed to avoid a duplicate side effect. Verify the destination before proposing another action.`,
    uncertain: true,
  };
}

export async function settleUncertainEffect(
  store: {
    externalEffect: {
      updateMany: (args: {
        where: { id: string; status: string };
        data: { status: string; result: UncertainEffectResult };
      }) => Promise<{ count: number }>;
      findUnique: (args: {
        where: { id: string };
      }) => Promise<{ status: string; result?: unknown } | null>;
    };
  },
  effectId: string,
  toolName: string,
): Promise<unknown> {
  const result = uncertainEffectResult(toolName);
  const settled = await store.externalEffect.updateMany({
    where: { id: effectId, status: "executing" },
    data: { status: "uncertain", result },
  });
  if (settled.count === 1) return result;

  const current = await store.externalEffect.findUnique({ where: { id: effectId } });
  if (!current) return result;
  const gate = resolveDuplicateEffectGate(current, toolName);
  return gate.action === "return" ? gate.result : result;
}

export async function claimApprovedEffect(
  store: ExternalEffectStore,
  effectId: string,
): Promise<boolean> {
  const claimed = await store.externalEffect.updateMany({
    where: { id: effectId, status: "approved" },
    data: { status: "executing" },
  });
  return claimed.count === 1;
}

export async function claimIntendedEffect(
  store: ExternalEffectStore,
  effectId: string,
): Promise<boolean> {
  const claimed = await store.externalEffect.updateMany({
    where: { id: effectId, status: "intended" },
    data: { status: "executing" },
  });
  return claimed.count === 1;
}

export async function completeExternalEffect(
  store: {
    externalEffect: {
      updateMany: (args: {
        where: { id: string; status: string };
        data: { status: string; result: never };
      }) => Promise<{ count: number }>;
    };
  },
  effectId: string,
  expectedStatus: "intended" | "executing",
  result: unknown,
): Promise<boolean> {
  const completed = await store.externalEffect.updateMany({
    where: { id: effectId, status: expectedStatus },
    data: { status: "completed", result: result as never },
  });
  return completed.count === 1;
}
