#!/usr/bin/env node
/**
 * TIM MCP Server — domain-specific tools only.
 * Generic file/shell/git operations are handled by Copilot built-ins.
 * Transport: stdio (VS Code connects via .vscode/mcp.json)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

const ROOT = path.resolve(import.meta.dirname, "../..");

function safeRead(p: string): string {
  const full = path.isAbsolute(p) ? p : path.join(ROOT, p);
  try {
    return fs.readFileSync(full, "utf8");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Cannot read ${p}: ${msg}`);
  }
}

async function globFiles(pattern: string): Promise<string[]> {
  return (await glob(pattern, { cwd: ROOT })).sort();
}

const server = new McpServer({ name: "tim-mcp", version: "2.0.0" });

// ── DOMAIN TOOLS ────────────────────────────────────────────────────────────

server.tool(
  "get_component",
  "Read a React component by name. Fuzzy — just the name, no path or extension.",
  { name: z.string().describe("Component name, e.g. 'KpiCard' or 'DocumentList'") },
  async ({ name }) => {
    const files = await globFiles(`frontend/src/**/${name}.tsx`);
    if (files.length === 0) throw new Error(`Component '${name}' not found`);
    return { content: [{ type: "text", text: `// ${files[0]}\n${safeRead(files[0])}` }] };
  }
);

server.tool(
  "get_page",
  "Read a frontend page by name. Fuzzy — just the name.",
  { name: z.string().describe("Page name, e.g. 'Dashboard' or 'Inventory'") },
  async ({ name }) => {
    const files = await globFiles(`frontend/src/pages/${name}.tsx`);
    if (files.length === 0) throw new Error(`Page '${name}' not found`);
    return { content: [{ type: "text", text: safeRead(files[0]) }] };
  }
);

server.tool(
  "get_hook",
  "Read a frontend hook by name. Fuzzy — tries with and without 'use-' prefix.",
  { name: z.string().describe("Hook name, e.g. 'use-inventory' or 'documents'") },
  async ({ name }) => {
    for (const c of [
      `frontend/src/hooks/${name}.ts`,
      `frontend/src/hooks/${name}.tsx`,
      `frontend/src/hooks/use-${name}.ts`,
      `frontend/src/hooks/use-${name}.tsx`,
    ]) {
      try {
        return { content: [{ type: "text", text: `// ${c}\n${safeRead(c)}` }] };
      } catch { /* try next */ }
    }
    throw new Error(`Hook '${name}' not found`);
  }
);

server.tool(
  "get_api_routes",
  "Extract all FastAPI route decorators + function signatures from routes.py and billing.py.",
  {},
  async () => {
    const extract = (src: string, label: string): string => {
      const lines = src.split("\n");
      const out: string[] = [`\n=== ${label} ===`];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].match(/^@router\.(get|post|put|patch|delete)/)) {
          out.push(lines[i].trim());
          if (lines[i + 1]?.match(/^(async )?def /)) out.push("  " + lines[i + 1].trim());
        }
      }
      return out.join("\n");
    };
    return {
      content: [{
        type: "text",
        text: extract(safeRead("app/routes.py"), "routes.py") +
              extract(safeRead("app/billing.py"), "billing.py"),
      }],
    };
  }
);

server.tool(
  "get_db_schema",
  "Return the full PostgreSQL schema and DB helpers from app/db.py.",
  {},
  async () => ({ content: [{ type: "text", text: safeRead("app/db.py") }] })
);

server.tool(
  "get_design_tokens",
  "Extract all CSS custom properties from frontend/src/index.css.",
  {},
  async () => {
    const vars = safeRead("frontend/src/index.css")
      .split("\n")
      .filter((l) => l.trim().startsWith("--"))
      .map((l) => l.trim())
      .join("\n");
    return { content: [{ type: "text", text: vars }] };
  }
);

server.tool(
  "get_api_client",
  "Return the frontend API client (frontend/src/lib/api.ts).",
  {},
  async () => ({ content: [{ type: "text", text: safeRead("frontend/src/lib/api.ts") }] })
);

// ── START ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
