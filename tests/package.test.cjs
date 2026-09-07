"use strict";

const assert = require("node:assert/strict");
const { readFileSync, statSync } = require("node:fs");
const { resolve, relative, isAbsolute } = require("node:path");
const { test } = require("node:test");
const root = resolve(__dirname, "..");
const theme = JSON.parse(readFileSync(resolve(root, "theme.json"), "utf8"));

test("Sine metadata identifies the public Zen package and update source", () => {
  for (const field of ["id", "name", "description", "author", "version", "homepage", "readme"]) {
    assert.equal(typeof theme[field], "string", field);
    assert.ok(theme[field].trim(), `${field} must not be empty`);
  }
  assert.equal(theme.id, "floating-domain-bar", "keep the installed mod identity stable");
  assert.equal(theme.homepage, "https://github.com/Efeblk/floating-domain-bar");
  assert.match(theme.version, /^\d+\.\d+\.\d+$/);
  assert.deepEqual(theme.fork, ["zen"]);
  for (const field of ["createdAt", "updatedAt"]) {
    assert.match(theme[field], /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Date(theme[field]).toISOString().slice(0, 10), theme[field]);
  }
  assert.ok(theme.updatedAt >= theme.createdAt);
});

test("Sine can resolve all registered package files from the repository root", () => {
  assert.equal(theme.style.chrome, "userChrome.css");
  assert.ok(theme.scripts["floating-domain-bar.uc.js"]);
  const paths = [theme.readme, ...Object.values(theme.style).filter(Boolean), ...Object.keys(theme.scripts)];
  for (const path of paths) {
    assert.equal(typeof path, "string");
    assert.ok(!isAbsolute(path));
    const file = resolve(root, path);
    assert.ok(!relative(root, file).startsWith(".."), `${path} must stay within package`);
    assert.ok(statSync(file).isFile(), `${path} must be shipped`);
    assert.ok(statSync(file).size > 0, `${path} must not be empty`);
  }
  for (const script of Object.values(theme.scripts)) {
    assert.deepEqual(script.include, ["chrome://browser/content/browser.xhtml"]);
  }
});
