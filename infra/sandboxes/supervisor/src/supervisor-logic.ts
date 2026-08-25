import { timingSafeEqual } from "node:crypto";
import path from "node:path";
import { canReleaseScreenLease, canTakeScreenLease } from "@rakazo/core";
import { z } from "zod";
import {
  type SandboxInput,
  screenPorts,
  TEAM_SCREEN_LIMIT,
  xdotoolCommand,
} from "./computer-spec.js";

export const computerActionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("key"), key: z.string(), modifiers: z.array(z.string()).optional() }),
  z.object({
    kind: z.literal("pointer"),
    x: z.number(),
    y: z.number(),
    button: z.enum(["left", "right"]).optional(),
    type: z.enum(["move", "down", "up", "click"]),
  }),
  z.object({ kind: z.literal("clipboard"), text: z.string() }),
  z.object({
    kind: z.literal("scroll"),
    direction: z.enum(["up", "down"]),
    amount: z.number().optional(),
  }),
  z.object({ kind: z.literal("wait"), ms: z.number() }),
  z.object({ kind: z.literal("open"), path: z.string() }),
  z.object({ kind: z.literal("launch"), application: z.string(), uri: z.string().optional() }),
]);

export function assertRequestIdentity(
  botId: string | undefined,
  workspaceId: string | undefined,
  expected: { botId: string; workspaceId: string },
) {
  if (botId !== expected.botId || workspaceId !== expected.workspaceId) {
    throw new Error("computer identity mismatch");
  }
}

export function hasValidBearerToken(authorization: string | undefined, expectedToken: string) {
  const supplied = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
  const actual = Buffer.from(expectedToken);
  const candidate = Buffer.from(supplied);
  return actual.length === candidate.length && timingSafeEqual(actual, candidate);
}

export function toSandboxInput(input: {
  kind: "key" | "pointer" | "clipboard";
  key?: string;
  modifiers?: string[];
  x?: number;
  y?: number;
  button?: "left" | "right";
  type?: "move" | "down" | "up" | "click";
  text?: string;
}): SandboxInput {
  if (input.kind === "key") {
    return { kind: "key", key: input.key ?? "", modifiers: input.modifiers };
  }
  if (input.kind === "clipboard") return { kind: "clipboard", text: input.text ?? "" };
  return {
    kind: "pointer",
    x: input.x ?? 0,
    y: input.y ?? 0,
    button: input.button,
    type: input.type ?? "click",
  };
}

export function nextScreenIndex(
  assigned: Map<string, ScreenAssignment>,
  screenId: string,
  leaseId?: string,
  limit = TEAM_SCREEN_LIMIT,
): number {
  const existing = assigned.get(screenId);
  if (existing) {
    if (existing.releasing) {
      throw new Error("This Team Computer screen is still being released.");
    }
    if (leaseId) {
      if (
        existing.leaseId &&
        existing.leaseId !== leaseId &&
        !canTakeScreenLease(existing.leaseId, leaseId)
      ) {
        throw new Error("This Team Computer screen is owned by a newer execution.");
      }
      if (canTakeScreenLease(existing.leaseId, leaseId)) existing.leaseId = leaseId;
    }
    return existing.index;
  }
  const used = new Set([...assigned.values()].map((slot) => slot.index));
  for (let index = 0; index < limit; index += 1) {
    if (!used.has(index)) {
      assigned.set(screenId, { index, leaseId });
      return index;
    }
  }
  throw new Error(`This Team Computer cannot allocate another screen (limit ${limit}).`);
}

export function releaseAssignedScreen(
  assigned: Map<string, ScreenAssignment>,
  screenId: string,
  leaseId?: string,
): number | undefined {
  const slot = assigned.get(screenId);
  if (!slot || slot.releasing || (leaseId && !canReleaseScreenLease(slot.leaseId, leaseId))) {
    return undefined;
  }
  slot.releasing = true;
  return slot.index;
}

export function completeReleasedScreen(
  assigned: Map<string, ScreenAssignment>,
  screenId: string,
  index: number,
): void {
  const slot = assigned.get(screenId);
  if (slot?.releasing && slot.index === index) assigned.delete(screenId);
}

export interface ScreenAssignment {
  index: number;
  leaseId?: string;
  releasing?: boolean;
}

export function clearComputerScreenRegistry(
  registry: Map<string, Map<string, ScreenAssignment>>,
  containerId: string,
) {
  registry.delete(containerId);
}

export function stopExtraScreenCommand(index: number) {
  if (index <= 0) return "";
  const layout = screenPorts(index);
  const profile = `/home/rakazo/.browser-profiles/chromium-screen-${layout.displayNumber}`;
  const tokenFile = `/tmp/rakazo/control-token-${layout.displayNumber}`;
  return [
    `pkill -f 'Xvfb ${layout.display} -screen' || true`,
    // The desktop takes its display from the environment, so it cannot be
    // matched by argument: kill by the environment of each candidate instead.
    // Missing this left a released screen's desktop running for the container's
    // lifetime, and every release leaked another set.
    `for p in $(pgrep -x xfwm4; pgrep -x xfdesktop; pgrep -x xfce4-panel; pgrep -x xfsettingsd); do grep -qz "DISPLAY=${layout.display}" /proc/$p/environ 2>/dev/null && kill "$p" 2>/dev/null; done || true`,
    `rm -f ${tokenFile}.owner`,
    `pkill -f -- '--user-data-dir=${profile}' || true`,
    `pkill -f '^x11vnc .* -rfbport ${layout.viewVncPort}' || true`,
    `pkill -f '^x11vnc .* -rfbport ${layout.controlVncPort}' || true`,
    `pkill -f '^/usr/bin/python3 .*websockify.*${layout.viewPort}' || true`,
    `pkill -f '^/usr/bin/python3 .*websockify.*${layout.controlPort}' || true`,
    `rm -f /tmp/.X${layout.displayNumber}-lock /tmp/.X11-unix/X${layout.displayNumber} ${tokenFile}`,
  ].join("; ");
}

/** Where a screen records who it belongs to, so the assignment outlives the supervisor. */
export function screenOwnerFile(displayNumber: number) {
  return `/tmp/rakazo/screen-${displayNumber}.owner`;
}

/** Lists `<index> <screenId>` for every screen the container currently owns. */
export function screenOwnersCommand() {
  return [
    "for f in /tmp/rakazo/screen-*.owner; do",
    '  [ -e "$f" ] || continue',
    // sed rather than shell parameter expansion: the ${...} form reads as a
    // template placeholder to the linter.
    `  n=$(basename "$f" .owner | sed 's/^screen-//')`,
    '  printf "%s %s\n" "$((n - 1))" "$(cat "$f" 2>/dev/null)"',
    "done",
  ].join("\n");
}

/** Rebuilds the assignment map from what the container reports. */
export function parseScreenOwners(stdout: string): Map<string, ScreenAssignment> {
  const assigned = new Map<string, ScreenAssignment>();
  for (const line of stdout.split("\n")) {
    const [rawIndex, ...rest] = line.trim().split(/\s+/);
    const index = Number(rawIndex);
    const screenId = rest.join(" ").trim();
    if (!screenId || !Number.isInteger(index) || index < 0 || index >= TEAM_SCREEN_LIMIT) continue;
    if ([...assigned.values()].some((slot) => slot.index === index)) continue;
    assigned.set(screenId, { index });
  }
  return assigned;
}

export function ensureScreenCommand(index: number, screenId?: string) {
  const layout = screenPorts(index);
  const recordOwner = screenId
    ? `mkdir -p /tmp/rakazo; printf %s ${shellQuote(screenId)} > ${screenOwnerFile(layout.displayNumber)}`
    : undefined;
  if (index === 0) {
    const wait = `for i in $(seq 1 100); do xdpyinfo -display ${layout.display} >/dev/null 2>&1 && exit 0; sleep 0.1; done; exit 1`;
    return recordOwner ? `${recordOwner}\n${wait}` : wait;
  }
  const log = `/tmp/rakazo/screen-${layout.displayNumber}`;
  const profile = `/home/rakazo/.browser-profiles/chromium-screen-${layout.displayNumber}`;
  // Every piece is started only if its own process is missing, and the command
  // succeeds only once the whole chain is up. Exiting early because the display
  // answers leaves a screen with no window manager, no browser, or a websockify
  // left over from a failed attempt bound to the port with nothing behind it —
  // all of which the viewer shows as an unexplained black screen, and which the
  // next attempt would then treat as ready.
  return [
    `mkdir -p /tmp/rakazo ${profile}`,
    ...(recordOwner ? [recordOwner] : []),
    // X server
    `if ! xdpyinfo -display ${layout.display} >/dev/null 2>&1; then`,
    `  rm -f /tmp/.X${layout.displayNumber}-lock /tmp/.X11-unix/X${layout.displayNumber}`,
    `  Xvfb ${layout.display} -screen 0 1280x800x24 -ac +extension RANDR +render -noreset >${log}-xvfb.log 2>&1 &`,
    `  for i in $(seq 1 100); do xdpyinfo -display ${layout.display} >/dev/null 2>&1 && break; sleep 0.1; done`,
    `fi`,
    `xdpyinfo -display ${layout.display} >/dev/null 2>&1 || exit 1`,
    // Window manager. xprop exits 0 whether or not the property exists — it
    // prints "not found." and succeeds — so its output has to be inspected.
    // Matching on the process is no good either: the display is in xfwm4's
    // environment, not its arguments.
    `if ! DISPLAY=${layout.display} xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -q "window id"; then`,
    `  DISPLAY=${layout.display} rakazo-desktop >${log}-desktop.log 2>&1 &`,
    `  for i in $(seq 1 60); do DISPLAY=${layout.display} xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null | grep -q "window id" && break; sleep 0.25; done`,
    `fi`,
    // Browser, on its own profile so it cannot signal the primary screen's instance
    `if ! DISPLAY=${layout.display} xdotool search --onlyvisible --class chromium >/dev/null 2>&1; then`,
    `  if [ -d /home/rakazo/.browser-profiles/chromium ] && [ ! -f ${profile}/Local\\ State ]; then cp -a /home/rakazo/.browser-profiles/chromium/. ${profile}/ 2>/dev/null || true; fi`,
    `  rm -f ${profile}/SingletonLock ${profile}/SingletonCookie ${profile}/SingletonSocket`,
    `  DISPLAY=${layout.display} HOME=/home/rakazo rakazo-browser --user-data-dir=${profile} >${log}-browser.log 2>&1 &`,
    `  for i in $(seq 1 80); do DISPLAY=${layout.display} xdotool search --onlyvisible --class chromium >/dev/null 2>&1 && break; sleep 0.25; done`,
    `fi`,
    // VNC server for this display
    `if ! pgrep -f "x11vnc -display ${layout.display} " >/dev/null 2>&1; then`,
    `  x11vnc -display ${layout.display} -forever -shared -viewonly -nopw -listen 127.0.0.1 -rfbport ${layout.viewVncPort} -xkb -ncache 0 >${log}-x11vnc.log 2>&1 &`,
    `  sleep 0.5`,
    `fi`,
    // Web bridge. A leftover websockify on this port is killed rather than
    // reused: it may be pointed at a VNC server that no longer exists.
    `if ! pgrep -f "websockify.*${layout.viewPort} " >/dev/null 2>&1; then`,
    `  pkill -f "websockify.*:${layout.viewPort} " >/dev/null 2>&1 || true`,
    `  websockify --web=/usr/share/novnc 0.0.0.0:${layout.viewPort} 127.0.0.1:${layout.viewVncPort} >${log}-novnc.log 2>&1 &`,
    `fi`,
    // Only now is the screen actually usable.
    `for i in $(seq 1 50); do (echo >/dev/tcp/127.0.0.1/${layout.viewPort}) >/dev/null 2>&1 && break; sleep 0.1; done`,
    `(echo >/dev/tcp/127.0.0.1/${layout.viewPort}) >/dev/null 2>&1 || exit 1`,
    `pgrep -f "x11vnc -display ${layout.display} " >/dev/null 2>&1 || exit 1`,
    `DISPLAY=${layout.display} xdotool search --onlyvisible --class chromium >/dev/null 2>&1 || exit 1`,
    `exit 0`,
  ].join("\n");
}

export function containerActionStep(
  action: z.infer<typeof computerActionSchema>,
  display = ":1",
): { argv: string[] } | { waitMs: number } {
  if (action.kind === "wait") {
    return { waitMs: Math.min(Math.max(action.ms, 0), 5_000) };
  }
  let argv: string[];
  if (action.kind === "key" || action.kind === "pointer" || action.kind === "clipboard") {
    argv = ["env", `DISPLAY=${display}`, ...xdotoolCommand(toSandboxInput(action))];
  } else if (action.kind === "scroll") {
    argv = [
      "env",
      `DISPLAY=${display}`,
      "xdotool",
      "click",
      "--repeat",
      String(Math.min(Math.max(Math.round(action.amount ?? 3), 1), 20)),
      action.direction === "up" ? "4" : "5",
    ];
  } else if (action.kind === "open") {
    const target = /^https?:\/\//i.test(action.path)
      ? action.path
      : workspaceTarget(normalizeWorkspaceRelative(action.path));
    argv = ["env", `DISPLAY=${display}`, "xdg-open", target];
  } else {
    argv = ["env", `DISPLAY=${display}`, action.application, ...(action.uri ? [action.uri] : [])];
  }
  return { argv };
}

export function normalizeWorkspaceRelative(value: string) {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  const segments = normalized.split("/").filter(Boolean);
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new Error("path escapes the computer workspace");
  }
  return segments.join("/");
}

export function workspaceTarget(relative: string) {
  return relative ? path.posix.join("/home/rakazo", relative) : "/home/rakazo";
}

export function sandboxTimeoutCommand(argv: string[], timeoutMs: number, completionMarker: string) {
  return [
    "timeout",
    "--kill-after=1s",
    `${timeoutMs / 1_000}s`,
    "sh",
    "-c",
    '"$@"; status=$?; if [ "$status" -eq 124 ]; then : > "$0"; fi; exit "$status"',
    completionMarker,
    ...argv,
  ];
}

export function sandboxCommandTimedOut(exitCode: number, completedWithExit124: boolean) {
  return exitCode === 124 && !completedWithExit124;
}

export function interactiveScreenCommand(
  interactive: boolean,
  controlToken?: string,
  layout = screenPorts(0),
) {
  const tokenFile =
    layout.displayNumber === 1
      ? "/tmp/rakazo/control-token"
      : `/tmp/rakazo/control-token-${layout.displayNumber}`;
  const stopProcesses =
    `pkill -f '^x11vnc .* -rfbport ${layout.controlVncPort}' || true; ` +
    `pkill -f '^/usr/bin/python3 .*websockify.*${layout.controlPort}' || true; ` +
    `rm -f ${tokenFile}`;
  const stop = controlToken
    ? `[ -f ${tokenFile} ] && [ "$(cat ${tokenFile})" != ${shellQuote(controlToken)} ] || { ${stopProcesses}; }`
    : stopProcesses;
  if (!interactive) return stop;
  if (!controlToken) throw new Error("interactive screen requires a control token");
  return [
    `[ -f ${tokenFile} ] && [ "$(cat ${tokenFile})" = ${shellQuote(controlToken)} ] && pgrep -f '^x11vnc .* -rfbport ${layout.controlVncPort}' >/dev/null && pgrep -f '^/usr/bin/python3 .*websockify.*${layout.controlPort}' >/dev/null && exit 0 || true`,
    stopProcesses,
    `printf %s ${shellQuote(controlToken)} > ${tokenFile}`,
    `export DISPLAY=${layout.display}`,
    `(x11vnc -display ${layout.display} -forever -shared -nopw -listen 127.0.0.1 -rfbport ${layout.controlVncPort} -xkb -ncache 0 >/tmp/rakazo/x11vnc-control-${layout.displayNumber}.log 2>&1 &)`,
    `(websockify --web=/usr/share/novnc 0.0.0.0:${layout.controlPort} 127.0.0.1:${layout.controlVncPort} >/tmp/rakazo/novnc-control-${layout.displayNumber}.log 2>&1 &)`,
    `for i in $(seq 1 50); do (echo >/dev/tcp/127.0.0.1/${layout.controlPort}) >/dev/null 2>&1 && exit 0; sleep 0.1; done`,
    "exit 1",
  ].join("; ");
}

function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function parseObservation(output: string) {
  const geometry = output.match(/^GEOM\s+(\d+)\s+(\d+)$/m);
  const cursorLine = output.match(/^CURSOR\s+(.+)$/m)?.[1] ?? "";
  const cursorX = Number(cursorLine.match(/X=(\d+)/)?.[1]);
  const cursorY = Number(cursorLine.match(/Y=(\d+)/)?.[1]);
  const windowId = output.match(/^WINDOW\s*(.*)$/m)?.[1]?.trim();
  const title = output.match(/^TITLE\s*(.*)$/m)?.[1]?.trim();
  const image = output.match(/^IMAGE\s+([A-Za-z0-9+/=]+)$/m)?.[1];
  if (!image) throw new Error("screen capture returned no image");
  return {
    image,
    mimeType: "image/png" as const,
    width: Number(geometry?.[1] ?? 1280),
    height: Number(geometry?.[2] ?? 800),
    ...(Number.isFinite(cursorX) && Number.isFinite(cursorY)
      ? { cursor: { x: cursorX, y: cursorY } }
      : {}),
    ...(windowId ? { activeWindow: { id: windowId, ...(title ? { title } : {}) } } : {}),
  };
}
