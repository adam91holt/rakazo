import { describe, expect, it } from "vitest";
import {
  clampFact,
  forgetFact,
  MAX_FACT_LENGTH,
  parseFacts,
  rememberFact,
} from "./memory-facts.js";

const TODAY = "2026-08-25";

describe("remembering a fact", () => {
  it("keeps what the bot already knew", () => {
    // The tool is described as storing "a durable fact"; writing the document
    // with just that fact threw away everything learned before it.
    const before = "# Bot memory\n\n- (2026-08-01) user is in New Zealand\n";
    const after = rememberFact(before, "user prefers tea", TODAY);
    expect(after.added).toBe(true);
    expect(after.content).toContain("user is in New Zealand");
    expect(after.content).toContain(`- (${TODAY}) user prefers tea`);
    expect(parseFacts(after.content)).toHaveLength(2);
  });

  it("starts a document that has no facts yet", () => {
    expect(rememberFact("", "user prefers tea", TODAY).content).toBe(
      `- (${TODAY}) user prefers tea\n`,
    );
  });

  it("does not record the same fact twice", () => {
    const once = rememberFact("", "User prefers tea.", TODAY);
    const twice = rememberFact(once.content, "user prefers TEA", TODAY);
    expect(twice.added).toBe(false);
    expect(parseFacts(twice.content)).toHaveLength(1);
  });

  it("ignores an empty fact rather than writing a blank line", () => {
    const result = rememberFact("- (2026-08-01) a\n", "   ", TODAY);
    expect(result.added).toBe(false);
    expect(result.content).toBe("- (2026-08-01) a\n");
  });

  it("clamps a fact long enough to be a document", () => {
    const long = "x".repeat(MAX_FACT_LENGTH + 200);
    expect(clampFact(long)).toHaveLength(MAX_FACT_LENGTH);
    expect(parseFacts(rememberFact("", long, TODAY).content)).toHaveLength(1);
  });

  it("preserves prose around the facts", () => {
    const before = "# Bot memory\n\nAccount-wide preferences live here.\n";
    expect(rememberFact(before, "user prefers tea", TODAY).content).toContain(
      "Account-wide preferences live here.",
    );
  });
});

describe("forgetting a fact", () => {
  it("removes a fact by what it says", () => {
    const doc = rememberFact(rememberFact("", "a fact", TODAY).content, "another", TODAY).content;
    const after = forgetFact(doc, "A Fact");
    expect(after).not.toBeNull();
    expect(parseFacts(after ?? "").map((f) => f.text)).toEqual(["another"]);
  });

  it("reports when nothing matched instead of rewriting the document", () => {
    expect(forgetFact("- (2026-08-01) a fact\n", "something else")).toBeNull();
    expect(forgetFact("- (2026-08-01) a fact\n", "  ")).toBeNull();
  });
});
