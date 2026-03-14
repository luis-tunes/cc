#!/usr/bin/env node
/**
 * TIM MCP Server
 * Exposes the entire TIM codebase as AI tools for GitHub Copilot.
 * Transport: stdio (VS Code connects via .vscode/mcp.json)
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { glob } from "glob";

const ROOT = path.resolve(import.meta.dirname, "..");

function abs(p: string): string {
  return path.isAbsolute(p) ? p : path.join(ROOT, p);
}

function safeRead(p: string): string {
  try {
    return fs.readFileSync(abs(p), "utf8");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Cannot read ${p}: ${msg}`);
  }
}

function safeWrite(p: string, content: string): void {
  const full = abs(p);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

function shell(cmd: string, cwd: string = ROOT): string {
  try {
    return execSync(cmd, {
      cwd,
      encoding: "utf8",
      env: { ...process.env, PATH: `/home/lft/code/cc/.venv/bin:${process.env.PATH}` },
      timeout: 120_000,
    });
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    return [err.stdout, err.stderr, err.message].filter(Boolean).join("\n");
  }
}

async function globFiles(pattern: string): Promise<string[]> {
  const results = await glob(pattern, { cwd: ROOT });
  return results.sort();
}

const server = new McpServer({
  name: "tim-mcp",
  version: "1.0.0",
});

// ── READ TOOLS ──────────────────────────────────────────────────────────────

server.tool(
  "get_file",
  "Read any file in the TIM workspace. Path relative to repo root or absolute.",
  { path: z.string().describe("File path, relative to repo root or absolute") },
  async ({ path: p }) => ({
    content: [{ type: "text", text: safeRead(p) }],
  })
);

server.tool(
  "list_files",
  "List files in the workspace matching a glob pattern (relative to repo root).",
  { pattern: z.string().describe("Glob pattern, e.g. 'frontend/src/**/*.tsx'") },
  async ({ pattern }) => {
    const files = await globFiles(pattern);
    return { content: [{ type: "text", text: files.join("\n") }] };
  }
);

server.tool(
  "get_component",
  "Read a frontend component TSX file by name (fuzzy — just provide the filename without path or extension).",
  { name: z.string().describe("Component name, e.g. 'KpiCard' or 'DocumentList'") },
  async ({ name }) => {
    const files = await globFiles(`frontend/src/**/${name}.tsx`);
    if (files.length === 0) throw new Error(`Component '${name}' not found`);
    const chosen = files[0];
    return { content: [{ type: "text", text: `// ${chosen}\n${safeRead(chosen)}` }] };
  }
);

server.tool(
  "get_page",
  "Read a frontend page TSX file by name (fuzzy — just provide the filename without path or extension).",
  { name: z.string().describe("Page name, e.g. 'Dashboard' or 'Inventory'") },
  async ({ name }) => {
    const files = await globFiles(`frontend/src/pages/${name}.tsx`);
    if (files.length === 0) throw new Error(`Page '${name}' not found`);
    return { content: [{ type: "text", text: safeRead(files[0]) }] };
  }
);

server.tool(
  "get_api_routes",
  "Return all FastAPI route signatures from app/routes.py and app/billing.py.",
  {},
  async () => {
    const routes = safeRead("app/routes.py");
    const billing = safeRead("app/billing.py");
    // Extract @router lines + function signatures
    const extract = (src: string, label: string): string => {
      const lines = src.split("\n");
      const out: string[] = [`\n=== ${label} ===`];
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (l.match(/^@router\.(get|post|put|patch|delete)/)) {
          out.push(l.trim());
          if (lines[i + 1]?.startsWith("async def") || lines[i + 1]?.startsWith("def")) {
            out.push("  " + lines[i + 1].trim());
          }
        }
      }
      return out.join("\n");
    };
    return {
      content: [{ type: "text", text: extract(routes, "routes.py") + extract(billing, "billing.py") }],
    };
  }
);

server.tool(
  "get_design_tokens",
  "Return all CSS custom properties (design tokens) from frontend/src/index.css.",
  {},
  async () => {
    const css = safeRead("frontend/src/index.css");
    const vars = css
      .split("\n")
      .filter((l) => l.trim().startsWith("--"))
      .map((l) => l.trim())
      .join("\n");
    return { content: [{ type: "text", text: vars }] };
  }
);

server.tool(
  "get_db_schema",
  "Return the full PostgreSQL schema from app/db.py.",
  {},
  async () => ({
    content: [{ type: "text", text: safeRead("app/db.py") }],
  })
);

server.tool(
  "get_hook",
  "Read a frontend hook file by name (fuzzy).",
  { name: z.string().describe("Hook name, e.g. 'use-inventory' or 'use-documents'") },
  async ({ name }) => {
    const candidates = [
      `frontend/src/hooks/${name}.ts`,
      `frontend/src/hooks/${name}.tsx`,
      `frontend/src/hooks/use-${name}.ts`,
      `frontend/src/hooks/use-${name}.tsx`,
    ];
    for (const c of candidates) {
      try {
        return { content: [{ type: "text", text: `// ${c}\n${safeRead(c)}` }] };
      } catch {
        // try next
      }
    }
    throw new Error(`Hook '${name}' not found`);
  }
);

server.tool(
  "get_api_client",
  "Return the full frontend API client (frontend/src/lib/api.ts).",
  {},
  async () => ({
    content: [{ type: "text", text: safeRead("frontend/src/lib/api.ts") }],
  })
);

// ── WRITE TOOLS ─────────────────────────────────────────────────────────────

server.tool(
  "edit_file",
  "Replace an exact string in a file. Include 3+ lines of context around the target. Fails if old_string not found or matches multiple times.",
  {
    path: z.string().describe("File path relative to repo root"),
    old_string: z.string().describe("Exact text to replace (include surrounding context)"),
    new_string: z.string().describe("Replacement text"),
  },
  async ({ path: p, old_string, new_string }) => {
    const content = safeRead(p);
    const count = content.split(old_string).length - 1;
    if (count === 0) throw new Error(`old_string not found in ${p}`);
    if (count > 1) throw new Error(`old_string matches ${count} times in ${p} — be more specific`);
    safeWrite(p, content.replace(old_string, new_string));
    return { content: [{ type: "text", text: `✓ Edited ${p}` }] };
  }
);

server.tool(
  "create_file",
  "Create a new file (or overwrite existing). Path relative to repo root.",
  {
    path: z.string().describe("File path relative to repo root"),
    content: z.string().describe("Full file content"),
  },
  async ({ path: p, content }) => {
    safeWrite(p, content);
    return { content: [{ type: "text", text: `✓ Created ${p}` }] };
  }
);

server.tool(
  "append_to_file",
  "Append text to the end of an existing file.",
  {
    path: z.string().describe("File path relative to repo root"),
    text: z.string().describe("Text to append"),
  },
  async ({ path: p, text }) => {
    const full = abs(p);
    fs.appendFileSync(full, text, "utf8");
    return { content: [{ type: "text", text: `✓ Appended to ${p}` }] };
  }
);

// ── RUN TOOLS ────────────────────────────────────────────────────────────────

server.tool(
  "run_typecheck",
  "Run TypeScript type-check on the frontend (tsc --noEmit). Returns compiler errors.",
  {},
  async () => ({
    content: [{ type: "text", text: shell("npx tsc --noEmit 2>&1", path.join(ROOT, "frontend")) }],
  })
);

server.tool(
  "run_frontend_tests",
  "Run vitest on the frontend. Returns test results.",
  { filter: z.string().optional().describe("Optional test name filter") },
  async ({ filter }) => {
    const cmd = filter ? `npx vitest run --reporter=verbose "${filter}" 2>&1` : "npx vitest run --reporter=verbose 2>&1";
    return { content: [{ type: "text", text: shell(cmd, path.join(ROOT, "frontend")) }] };
  }
);

server.tool(
  "run_backend_tests",
  "Run pytest on the backend. Returns test results.",
  { filter: z.string().optional().describe("Optional pytest -k filter expression") },
  async ({ filter }) => {
    const venv = path.join(ROOT, ".venv/bin/python");
    const cmd = filter
      ? `${venv} -m pytest app/tests/ -v -k "${filter}" 2>&1`
      : `${venv} -m pytest app/tests/ -v 2>&1`;
    return { content: [{ type: "text", text: shell(cmd) }] };
  }
);

server.tool(
  "run_shell",
  "Run an arbitrary shell command in the repo root. Use sparingly — prefer specific tools.",
  {
    command: z.string().describe("Shell command to run"),
    cwd: z.string().optional().describe("Working directory relative to repo root (default: repo root)"),
  },
  async ({ command, cwd }) => {
    const workdir = cwd ? path.join(ROOT, cwd) : ROOT;
    return { content: [{ type: "text", text: shell(command, workdir) }] };
  }
);

server.tool(
  "git_status",
  "Return current git status and recent log.",
  {},
  async () => ({
    content: [{
      type: "text",
      text: shell("git status --short && echo '---' && git log --oneline -10"),
    }],
  })
);

server.tool(
  "git_commit",
  "Stage all changes and create a git commit.",
  { message: z.string().describe("Commit message") },
  async ({ message }) => {
    shell(`git add -A && git commit -m ${JSON.stringify(message)}`);
    return { content: [{ type: "text", text: `✓ Committed: ${message}` }] };
  }
);

// ── START ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
