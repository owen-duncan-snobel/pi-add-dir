import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { completeDirectoryPaths } from "../extensions/pi-add-dir/path-completions.js";

let cwd: string;

beforeEach(() => {
  cwd = fs.mkdtempSync(path.join(os.tmpdir(), "pi-add-dir-completion-"));
  fs.mkdirSync(path.join(cwd, "frontend"));
  fs.mkdirSync(path.join(cwd, "fraud-service"));
  fs.mkdirSync(path.join(cwd, "frontend", "packages"));
  fs.mkdirSync(path.join(cwd, ".hidden"));
  fs.writeFileSync(path.join(cwd, "file.txt"), "not a directory");
});

afterEach(() => {
  fs.rmSync(cwd, { recursive: true, force: true });
});

describe("completeDirectoryPaths", () => {
  it("completes directories relative to cwd and excludes files", () => {
    expect(completeDirectoryPaths("fr", cwd)).toEqual([
      {
        value: "fraud-service/",
        label: "fraud-service/",
        description: path.join(cwd, "fraud-service"),
      },
      {
        value: "frontend/",
        label: "frontend/",
        description: path.join(cwd, "frontend"),
      },
    ]);
  });

  it("preserves the typed relative parent while completing nested paths", () => {
    expect(completeDirectoryPaths("./frontend/pa", cwd)).toEqual([
      {
        value: "./frontend/packages/",
        label: "packages/",
        description: path.join(cwd, "frontend", "packages"),
      },
    ]);
  });

  it("completes absolute directory paths", () => {
    const prefix = `${cwd}/front`;
    expect(completeDirectoryPaths(prefix, cwd)).toEqual([
      {
        value: `${cwd}/frontend/`,
        label: "frontend/",
        description: path.join(cwd, "frontend"),
      },
    ]);
  });

  it("only includes hidden directories when the segment starts with a dot", () => {
    expect((completeDirectoryPaths("", cwd) ?? []).map((item) => item.label)).not.toContain(".hidden/");
    expect((completeDirectoryPaths(".", cwd) ?? []).map((item) => item.label)).toContain(".hidden/");
  });

  it("returns null when the parent directory cannot be read", () => {
    expect(completeDirectoryPaths("missing/path", cwd)).toBeNull();
  });

  it("matches directory names case-insensitively", () => {
    fs.mkdirSync(path.join(cwd, "Frameworks"));
    expect((completeDirectoryPaths("fra", cwd) ?? []).map((item) => item.value)).toEqual([
      "Frameworks/",
      "fraud-service/",
    ]);
  });

  it("includes symlinks that point to directories, but not to files", () => {
    fs.symlinkSync(path.join(cwd, "frontend"), path.join(cwd, "linked"));
    fs.symlinkSync(path.join(cwd, "file.txt"), path.join(cwd, "linked-file"));
    expect(completeDirectoryPaths("li", cwd)).toEqual([
      {
        value: "linked/",
        label: "linked/",
        description: path.join(cwd, "linked"),
      },
    ]);
  });

  it("offers ./ and ../ so dot prefixes open the dropdown", () => {
    expect((completeDirectoryPaths(".", cwd) ?? []).map((item) => item.value)).toEqual([
      "./",
      "../",
      ".hidden/",
    ]);
    expect((completeDirectoryPaths("..", cwd) ?? []).map((item) => item.value)).toEqual(["../"]);
  });

  it("lists the parent directory for a bare ../ prefix", () => {
    const child = path.join(cwd, "frontend");
    expect((completeDirectoryPaths("../", child) ?? []).map((item) => item.value)).toEqual([
      "../fraud-service/",
      "../frontend/",
    ]);
  });

  it("only offers ./ and ../ where they lead somewhere new", () => {
    expect((completeDirectoryPaths("frontend/.", cwd) ?? []).map((item) => item.value)).toEqual([]);
    expect((completeDirectoryPaths("./.", cwd) ?? []).map((item) => item.value)).toEqual(["./.hidden/"]);
    const child = path.join(cwd, "frontend");
    expect((completeDirectoryPaths("../.", child) ?? []).map((item) => item.value)).toEqual([
      "../../",
      "../.hidden/",
    ]);
  });

  it("completes directories in the parent directory", () => {
    const child = path.join(cwd, "frontend");
    expect(completeDirectoryPaths("../fr", child)).toEqual([
      {
        value: "../fraud-service/",
        label: "fraud-service/",
        description: path.join(cwd, "fraud-service"),
      },
      {
        value: "../frontend/",
        label: "frontend/",
        description: path.join(cwd, "frontend"),
      },
    ]);
  });

  describe("home directory paths", () => {
    let home: string;

    beforeEach(() => {
      home = fs.mkdtempSync(path.join(os.tmpdir(), "pi-add-dir-home-"));
      fs.mkdirSync(path.join(home, "projects"));
      vi.stubEnv("HOME", home);
      vi.stubEnv("USERPROFILE", home);
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      fs.rmSync(home, { recursive: true, force: true });
    });

    it("expands ~/ while preserving the typed prefix", () => {
      expect(completeDirectoryPaths("~/pro", cwd)).toEqual([
        {
          value: "~/projects/",
          label: "projects/",
          description: path.join(home, "projects"),
        },
      ]);
    });

    it("completes a bare ~ to ~/", () => {
      expect(completeDirectoryPaths("~", cwd)).toEqual([
        { value: "~/", label: "~/", description: home },
      ]);
    });

    it("does not expand named-user ~user paths", () => {
      expect(completeDirectoryPaths("~someone/pro", cwd)).toBeNull();
    });
  });
});
