import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

describe("SSR list page authorization", () => {
  it.each([
    ["src/app/app/post-entry/protests/page.tsx", "protest.read"],
    ["src/app/app/post-entry/psc/page.tsx", "psc.read"],
  ])("%s checks the same read permission as its API before querying", (path, permission) => {
    const source = read(path);
    const permissionCheck = `if (!(await hasPermission("${permission}")))`;
    expect(source).toContain(permissionCheck);
    expect(source.indexOf(permissionCheck)).toBeLessThan(source.indexOf(".findMany("));
  });
});

describe("unattached document list projections", () => {
  it.each([
    "src/app/app/documents/page.tsx",
    "src/app/api/documents/unattached/route.ts",
  ])("%s does not load heavy extraction payloads", (path) => {
    const source = read(path);
    expect(source).toContain("db.shipmentDocument.findMany");
    expect(source).toContain("select:");
    expect(source).not.toMatch(/\brawContent:\s*true/);
    expect(source).not.toMatch(/\bextractedJson:\s*true/);
  });
});
