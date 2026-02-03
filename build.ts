#!/usr/bin/env bun
/**
 * Build script for creating standalone executables
 * 
 * Usage:
 *   bun run build.ts           # Build for current platform
 *   bun run build.ts --all     # Build for all platforms
 *   bun run build.ts --target darwin-arm64  # Build for specific target
 */
import { $ } from "bun";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const VERSION = process.env.VERSION || "0.1.0-dev";
const COMMIT = process.env.COMMIT || await getGitCommit();
const BUILD_DATE = new Date().toISOString();

// Supported build targets
const TARGETS = {
  "darwin-arm64": "bun-darwin-arm64",
  "darwin-x64": "bun-darwin-x64",
  "linux-arm64": "bun-linux-arm64",
  "linux-x64": "bun-linux-x64",
} as const;

type TargetKey = keyof typeof TARGETS;

const DIST_DIR = "dist";
const ENTRY_POINT = "src/index.ts";

async function getGitCommit(): Promise<string> {
  try {
    const result = await $`git rev-parse --short HEAD`.quiet();
    return result.text().trim();
  } catch {
    return "unknown";
  }
}

async function build(target?: TargetKey): Promise<void> {
  // Ensure dist directory exists
  if (!existsSync(DIST_DIR)) {
    mkdirSync(DIST_DIR, { recursive: true });
  }

  const defines = {
    "process.env.BUILD_VERSION": JSON.stringify(VERSION),
    "process.env.BUILD_COMMIT": JSON.stringify(COMMIT),
    "process.env.BUILD_DATE": JSON.stringify(BUILD_DATE),
  };

  const defineArgs = Object.entries(defines)
    .map(([key, value]) => `--define=${key}=${value}`)
    .join(" ");

  if (target) {
    // Build for specific target
    const bunTarget = TARGETS[target];
    const outputName = target.startsWith("darwin") || target.startsWith("linux") 
      ? `asc-${target}` 
      : `asc-${target}.exe`;
    const outputPath = join(DIST_DIR, outputName);

    console.log(`Building for ${target}...`);
    
    await $`bun build ${ENTRY_POINT} --compile --target=${bunTarget} --outfile=${outputPath} ${defineArgs.split(" ")}`;
    
    console.log(`  → ${outputPath}`);
  } else {
    // Build for current platform
    const outputPath = join(DIST_DIR, "asc");
    
    console.log(`Building for current platform...`);
    
    await $`bun build ${ENTRY_POINT} --compile --outfile=${outputPath} ${defineArgs.split(" ")}`;
    
    console.log(`  → ${outputPath}`);
  }
}

async function buildAll(): Promise<void> {
  console.log("Building for all platforms...\n");
  
  for (const target of Object.keys(TARGETS) as TargetKey[]) {
    await build(target);
  }
  
  console.log("\nAll builds complete!");
}

async function clean(): Promise<void> {
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true, force: true });
    console.log(`Cleaned ${DIST_DIR}/`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Build script for asc CLI

Usage:
  bun run build.ts                    Build for current platform
  bun run build.ts --all              Build for all platforms
  bun run build.ts --target <target>  Build for specific target
  bun run build.ts --clean            Clean dist directory
  bun run build.ts --list             List available targets

Available targets:
  ${Object.keys(TARGETS).join("\n  ")}

Environment variables:
  VERSION    Set version string (default: 0.1.0-dev)
  COMMIT     Set commit hash (default: auto-detected from git)
`);
    return;
  }

  if (args.includes("--clean")) {
    await clean();
    return;
  }

  if (args.includes("--list")) {
    console.log("Available targets:");
    for (const target of Object.keys(TARGETS)) {
      console.log(`  ${target}`);
    }
    return;
  }

  if (args.includes("--all")) {
    await buildAll();
    return;
  }

  const targetIdx = args.indexOf("--target");
  if (targetIdx !== -1 && args[targetIdx + 1]) {
    const target = args[targetIdx + 1] as TargetKey;
    if (!(target in TARGETS)) {
      console.error(`Unknown target: ${target}`);
      console.error(`Available targets: ${Object.keys(TARGETS).join(", ")}`);
      process.exit(1);
    }
    await build(target);
    return;
  }

  // Default: build for current platform
  await build();
}

main().catch((error) => {
  console.error("Build failed:", error.message);
  process.exit(1);
});
