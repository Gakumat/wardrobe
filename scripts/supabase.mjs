// Runs the Supabase CLI with credentials from .env.local, so nothing secret is typed on the command line.
// Usage: node scripts/supabase.mjs <supabase args...>   (e.g. "link", "db push", "config push")
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const env = { ...process.env };
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
for (const k of ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "SUPABASE_PROJECT_REF"]) {
  if (!env[k]) {
    console.error(`Missing ${k} in .env.local`);
    process.exit(1);
  }
}

let args = process.argv.slice(2);
// The CLI reads SUPABASE_DB_PASSWORD / SUPABASE_ACCESS_TOKEN from the environment, which avoids
// shell-quoting problems with special characters in the password.
if (args[0] === "link") args = ["link", "--project-ref", env.SUPABASE_PROJECT_REF];
else if (args[0] === "config" && args[1] === "push") args = [...args, "--project-ref", env.SUPABASE_PROJECT_REF];

const r = spawnSync("npx", ["supabase", ...args], { stdio: "inherit", env, shell: true });
process.exit(r.status ?? 1);
