import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootPackage = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
  version: string;
  private?: boolean;
};

if (rootPackage.private !== true) {
  throw new Error("The root package must stay private.");
}

const serverDist = join(repoRoot, "apps/server/dist/index.js");
const webIndex = join(repoRoot, "apps/web/dist/index.html");
if (!existsSync(serverDist) || !existsSync(webIndex)) {
  throw new Error("Build the server and web packages before packing the CLI.");
}

const stage = join(repoRoot, "dist-pack");
rmSync(stage, { recursive: true, force: true });
const serverDir = join(stage, "apps", "server");
mkdirSync(join(stage, "apps"), { recursive: true });
execFileSync("pnpm", ["--filter", "@dynamo-studio/server", "deploy", "--prod", serverDir], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (!existsSync(join(serverDir, "dist", "index.js"))) {
  cpSync(join(repoRoot, "apps/server/dist"), join(serverDir, "dist"), {
    recursive: true,
    dereference: true,
  });
}

const sharedLink = join(serverDir, "node_modules", "@dynamo-studio", "shared");
if (!existsSync(join(sharedLink, "dist", "index.js"))) {
  mkdirSync(sharedLink, { recursive: true });
  cpSync(join(repoRoot, "packages/shared/dist"), join(sharedLink, "dist"), {
    recursive: true,
    dereference: true,
  });
}

const moduleNames = materializeModules(
  join(serverDir, "node_modules"),
  join(stage, "node_modules"),
);
rmSync(join(serverDir, "node_modules"), { recursive: true, force: true });
cpSync(join(repoRoot, "apps/web/dist"), join(stage, "apps/web/dist"), {
  recursive: true,
  dereference: true,
});
mkdirSync(join(stage, "bin"), { recursive: true });
cpSync(join(repoRoot, "apps/server/bin/dynamo-studio.js"), join(stage, "bin/dynamo-studio.js"));

const dependencies: Record<string, string> = {};
for (const name of moduleNames) {
  const manifest = JSON.parse(
    readFileSync(join(stage, "node_modules", name, "package.json"), "utf8"),
  ) as { version?: string; private?: boolean };
  if (typeof manifest.version !== "string") {
    throw new Error(`Bundled package ${name} has no version.`);
  }
  dependencies[name] = manifest.version;
  if (manifest.private === true) {
    delete manifest.private;
    writeFileSync(
      join(stage, "node_modules", name, "package.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }
}

const packed = {
  name: "dynamo-studio",
  version: rootPackage.version,
  private: true,
  type: "module",
  bin: { "dynamo-studio": "./bin/dynamo-studio.js" },
  engines: { node: ">=22" },
  dependencies,
  bundleDependencies: moduleNames,
};
writeFileSync(join(stage, "package.json"), `${JSON.stringify(packed, null, 2)}\n`);

const archive = join(stage, "dynamo-studio.tgz");
execFileSync("tar", ["-czf", archive, "-C", stage, "--exclude", "dynamo-studio.tgz", "."], {
  cwd: repoRoot,
  env: { ...process.env, COPYFILE_DISABLE: "1" },
});
process.stdout.write(`${archive}\n`);

function materializeModules(source: string, target: string): string[] {
  mkdirSync(target, { recursive: true });
  const pnpmDir = join(source, ".pnpm");
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      const modules = join(pnpmDir, entry, "node_modules");
      if (existsSync(modules)) {
        copyPackages(modules, target);
      }
    }
  }
  copyPackages(source, target);
  return listPackages(target);
}

function copyPackages(source: string, target: string): void {
  for (const entry of readdirSync(source)) {
    if (entry === ".pnpm" || entry === ".bin" || entry.startsWith(".")) {
      continue;
    }
    if (entry.startsWith("@")) {
      for (const child of readdirSync(join(source, entry))) {
        copyPackage(join(source, entry, child), join(target, entry, child));
      }
      continue;
    }
    copyPackage(join(source, entry), join(target, entry));
  }
}

function copyPackage(from: string, to: string): void {
  if (existsSync(join(to, "package.json"))) {
    return;
  }
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, dereference: true });
}

function listPackages(target: string): string[] {
  const names: string[] = [];
  for (const entry of readdirSync(target)) {
    if (entry.startsWith(".")) {
      continue;
    }
    if (entry.startsWith("@")) {
      for (const child of readdirSync(join(target, entry))) {
        names.push(`${entry}/${child}`);
      }
      continue;
    }
    names.push(entry);
  }
  names.sort();
  return names;
}
