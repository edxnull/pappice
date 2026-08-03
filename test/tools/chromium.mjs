import { accessSync, constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function findChromium(override) {
  const configured = override || process.env.PAPPICE_E2E_CHROMIUM || process.env.CHROMIUM;
  if (configured) {
    const resolved = resolveExecutable(configured);
    if (!resolved) {
      throw new Error(`Configured Chromium executable was not found: ${configured}`);
    }
    return resolved;
  }

  const candidates = ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"];
  if (process.platform === "darwin") {
    candidates.push(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium"
    );
    if (process.env.HOME) {
      candidates.push(
        path.join(process.env.HOME, "Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
        path.join(process.env.HOME, "Applications/Chromium.app/Contents/MacOS/Chromium")
      );
    }
  } else if (process.platform === "win32") {
    candidates.push("chrome", "msedge");
    for (const root of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA]) {
      if (!root) continue;
      candidates.push(
        path.join(root, "Google/Chrome/Application/chrome.exe"),
        path.join(root, "Microsoft/Edge/Application/msedge.exe")
      );
    }
  }
  for (const candidate of candidates) {
    const resolved = resolveExecutable(candidate);
    if (resolved) return resolved;
  }
  return "";
}

function resolveExecutable(command) {
  const hasPath = path.isAbsolute(command) || command.includes("/") || command.includes("\\");
  const directories = hasPath ? [""] : (process.env.PATH || "").split(path.delimiter).filter(Boolean);
  const extensions = process.platform === "win32"
    ? (process.env.PATHEXT || ".EXE;.CMD;.BAT").split(";")
    : [""];

  for (const directory of directories) {
    const base = directory ? path.join(directory, command) : command;
    const executablePaths = process.platform === "win32" && !path.extname(base)
      ? extensions.map((extension) => base + extension)
      : [base];
    for (const candidate of executablePaths) {
      try {
        accessSync(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Try the next executable candidate.
      }
    }
  }
  return "";
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  try {
    const executable = findChromium();
    if (executable) {
      process.stdout.write(executable + "\n");
    } else {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}

export { findChromium };
