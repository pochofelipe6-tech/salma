import { spawn } from "node:child_process";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--port", "3002"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_TEST_DIST_DIR: ".next-cloud-test",
      NEXT_PUBLIC_AUTH_MODE: "supabase",
      NEXT_PUBLIC_SUPABASE_URL: "https://velo-test.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-public-key",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    },
  },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
