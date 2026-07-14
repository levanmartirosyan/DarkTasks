const API_URL = "http://127.0.0.1:8787/api/health";
const CAPABILITIES_URL = "http://127.0.0.1:8787/api/capabilities";

const children = [];

async function apiIsRunning() {
  try {
    const response = await fetch(API_URL, { signal: AbortSignal.timeout(1_000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function apiIsCurrent() {
  try {
    const response = await fetch(CAPABILITIES_URL, { signal: AbortSignal.timeout(1_000) });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.comments === true;
  } catch {
    return false;
  }
}

async function stopApiOnPort() {
  if (process.platform !== "win32") return false;

  const script = [
    "$connections = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 8787 -ErrorAction SilentlyContinue",
    "$ids = $connections | Select-Object -ExpandProperty OwningProcess -Unique",
    "foreach ($id in $ids) { Stop-Process -Id $id -Force -ErrorAction SilentlyContinue }",
  ].join("; ");

  const child = Bun.spawn(["powershell.exe", "-NoProfile", "-Command", script], {
    stdout: "inherit",
    stderr: "inherit",
  });

  const code = await child.exited;
  await Bun.sleep(500);
  return code === 0;
}

async function waitForApi() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if ((await apiIsRunning()) && (await apiIsCurrent())) return true;
    await Bun.sleep(250);
  }

  return false;
}

function spawn(name, command) {
  const child = Bun.spawn(command, {
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
    env: process.env,
  });

  children.push(child);

  child.exited.then((code) => {
    if (code !== 0) {
      console.error(`${name} exited with code ${code}`);
      stopAll();
      process.exit(code ?? 1);
    }
  });

  return child;
}

function stopAll() {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      // Process may already be gone.
    }
  }
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAll();
  process.exit(0);
});

if ((await apiIsRunning()) && (await apiIsCurrent())) {
  console.log("DarkTasks API already running on 127.0.0.1:8787");
} else {
  if (await apiIsRunning()) {
    console.log("DarkTasks API on 127.0.0.1:8787 is stale. Restarting it...");
    await stopApiOnPort();
  }

  spawn("DarkTasks API", ["bun", "--watch", "src/api/server.ts"]);
  const ready = await waitForApi();

  if (!ready) {
    console.error("DarkTasks API did not start on 127.0.0.1:8787.");
    stopAll();
    process.exit(1);
  }
}

spawn("DarkTasks web", ["bun", "run", "web:dev"]);

await new Promise(() => {});
