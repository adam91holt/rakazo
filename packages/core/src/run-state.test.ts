import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, describeRunStatus, isBotWorking } from "./run-state.js";

describe("run state machine", () => {
  it("allows takeover resume onto a lease", () => {
    expect(canTransition("waiting_takeover", "leased")).toBe(true);
    expect(canTransition("waiting_takeover", "running")).toBe(false);
  });

  it("rejects rewriting a completed run", () => {
    expect(() => assertTransition("completed", "running")).toThrow(/illegal/i);
  });

  it("never leaves a terminal state except failed retry", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("completed" as const, "cancelled" as const),
        fc.constantFrom(
          "queued" as const,
          "leased" as const,
          "running" as const,
          "waiting_input" as const,
          "completed" as const,
        ),
        (from, to) => {
          expect(canTransition(from, to)).toBe(false);
        },
      ),
    );
  });
});

describe("what the person is shown", () => {
  it("does not draw a bot waiting on the person as working", () => {
    // Both statuses are "active", but the bot is stalled on an unanswered
    // question — spinning it like one burning tokens hides that.
    expect(isBotWorking("running")).toBe(true);
    expect(isBotWorking("waiting_input")).toBe(false);
    expect(isBotWorking("waiting_takeover")).toBe(false);
    expect(isBotWorking("idle")).toBe(false);
    expect(isBotWorking(undefined)).toBe(false);
  });

  it("says what a status means instead of printing the database word", () => {
    expect(describeRunStatus("waiting_input")).toBe("Waiting for you");
    expect(describeRunStatus("running")).toBe("Working");
    // Lease bookkeeping is not news to anyone.
    expect(describeRunStatus("leased")).toBe("");
    expect(describeRunStatus("queued")).toBe("");
    expect(describeRunStatus("idle")).toBe("");
  });
});
