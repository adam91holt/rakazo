/** One remembered fact, as it is written into a memory document. */
export interface RememberedFact {
  text: string;
  /** ISO date, so a reader can tell a stale fact from a current one. */
  on: string;
}

export const MAX_FACT_LENGTH = 500;

/** Comparison key for "is this the same fact": case and punctuation insensitive. */
export function factKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function clampFact(text: string): string {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length <= MAX_FACT_LENGTH
    ? single
    : `${single.slice(0, MAX_FACT_LENGTH - 1).trimEnd()}…`;
}

const FACT_LINE = /^- \((\d{4}-\d{2}-\d{2})\)\s+(.*)$/;

export function parseFacts(document: string): RememberedFact[] {
  const facts: RememberedFact[] = [];
  for (const line of document.split("\n")) {
    const match = FACT_LINE.exec(line.trim());
    if (match?.[1] && match[2]?.trim()) facts.push({ on: match[1], text: match[2].trim() });
  }
  return facts;
}

/**
 * Adds a fact to a memory document, keeping everything already there.
 *
 * The tool that calls this is described to the model as storing "a durable
 * fact", and it wrote the document with whatever string it was handed — so a
 * bot recording one preference silently discarded everything it had ever
 * learned. Facts are appended as dated lines and matched on a normalised key,
 * so repeating one refreshes its date instead of duplicating it.
 */
export function rememberFact(
  document: string,
  text: string,
  today: string,
): { content: string; added: boolean } {
  const fact = clampFact(text);
  if (!fact) return { content: document, added: false };

  const existing = parseFacts(document);
  const key = factKey(fact);
  const duplicate = existing.some((entry) => factKey(entry.text) === key);
  if (duplicate) return { content: document, added: false };

  const line = `- (${today}) ${fact}`;
  const body = document.replace(/\s+$/, "");
  return { content: body ? `${body}\n${line}\n` : `${line}\n`, added: true };
}

/** Removes a fact by its normalised key. Returns null when nothing matched. */
export function forgetFact(document: string, text: string): string | null {
  const key = factKey(clampFact(text));
  if (!key) return null;
  const lines = document.split("\n");
  const kept = lines.filter((line) => {
    const match = FACT_LINE.exec(line.trim());
    return !match?.[2] || factKey(match[2].trim()) !== key;
  });
  return kept.length === lines.length ? null : kept.join("\n");
}
