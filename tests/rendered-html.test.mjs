import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the complete seven-day calendar", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  for (const day of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    assert.match(html, new RegExp(`<b>${day}<\\/b>`));
  }
  assert.match(html, />My Events</);
  assert.match(html, />＋ Create event</);
  assert.doesNotMatch(html, /<small>Publish<\/small>/);
});

test("includes interactive filters, friends, interests, and profile settings", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /type="range"/);
  assert.match(page, /availabilityOnly/);
  assert.match(page, /onPointerMove=\{drag\}/);
  assert.match(page, /Add as Friend/);
  assert.match(page, /Remove friend/);
  assert.match(page, /interest-editor/);
  assert.match(page, /SettingsModal/);
});
