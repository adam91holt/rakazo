import { describe, expect, it } from "vitest";
import { builtinAgentTools } from "./builtin-tools.js";

describe("read_file paging", () => {
  it("offers the offset and limit its own error message promises", () => {
    // The too-large error told the model to read part of the file; without
    // these parameters that was advice it could not act on.
    const readFile = builtinAgentTools.find((tool) => tool.name === "read_file");
    const properties = (readFile?.inputSchema as { properties?: Record<string, unknown> })
      ?.properties;
    expect(Object.keys(properties ?? {})).toEqual(
      expect.arrayContaining(["path", "offset", "limit"]),
    );
  });
});
