#!/usr/bin/env node

/**
 * stdio -> streamable-HTTP MCP proxy for the OpenViking DSH bundle.
 *
 * DSH's MCP bridge starts this process as a local stdio MCP server. The proxy
 * resolves its connection and diagnostics through the same `resolveConfig()`
 * as the in-process runtime, from the child environment built in `mcp-env.mjs`: DSH
 * scrubs credential-shaped names out of what it inherits, and values that came
 * from the Cordis patch are invisible to a subprocess otherwise.
 */

import { realpathSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveConfig } from "../config.mjs";
import { createLogger } from "../shared/debug-log.mjs";
import { toMcpProxyConfig } from "../shared/mcp-proxy-config.mjs";
import { createOpenVikingMcpProxy } from "../shared/mcp-proxy-core.mjs";

/**
 * Tools the DSH surface never exposes. Account ACLs and watch subscriptions are
 * console tasks — an agent session pays for their schemas in every request and
 * has no legitimate use for them; the OpenViking console keeps them.
 */
export const DSH_HIDDEN_TOOLS = [
  "list_users",
  "list_groups",
  "get_acl",
  "set_acl",
  "list_watches",
  "cancel_watch",
];

export function readProxyConfig(env = process.env, cwd = process.cwd()) {
  const cfg = resolveConfig({}, env, cwd);
  return toMcpProxyConfig(cfg, {
    env,
    // The child env carries the runtime's resolved peer, but the shared mapper
    // still decides whether the proxy may send it. In broad recall mode the
    // actor header must stay unset; otherwise a process launched in workspace A
    // narrows MCP searches for a session whose runtime is serving workspace B.
    debug: env.OV_DEBUG_LOG ? true : cfg.debug,
    debugLogPath: env.OV_DEBUG_LOG || cfg.debugLogPath,
  });
}

function isDirectRun() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return resolvePath(process.argv[1]) === fileURLToPath(import.meta.url);
  }
}

if (isDirectRun()) {
  createOpenVikingMcpProxy({
    readConfig: readProxyConfig,
    loggerFactory: createLogger,
    hiddenTools: DSH_HIDDEN_TOOLS,
  }).start();
}
