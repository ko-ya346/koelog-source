import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the KOELOG landing app shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ja">/);
  assert.match(html, /<title>KOELOG — 声で整う生活ログ<\/title>/);
  assert.match(html, /<strong>KOELOG<\/strong>/);
  assert.match(html, /VOICE LIFE ASSISTANT/);
  assert.match(html, /話すだけで、/);
  assert.match(html, /今日のことを話してください/);
  assert.match(html, /AIで整理して記録/);
  assert.match(html, /今日のまとめ/);
  assert.match(html, /今日の記録/);
  assert.match(html, /期限・支払い/);
  assert.doesNotMatch(html, /Your site is taking shape/);
  assert.doesNotMatch(html, /Codex is working/);
});

test("keeps the current prototype behavior explicit in source", async () => {
  const [page, layout, manifest] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /localStorage\.getItem\("koelog-records"\)/);
  assert.match(page, /SpeechRecognition/);
  assert.match(page, /webkitSpeechRecognition/);
  assert.match(page, /function parseVoice/);
  assert.match(page, /この端末内だけに保存されます/);
  assert.match(layout, /title:\s*"KOELOG — 声で整う生活ログ"/);
  assert.match(manifest, /short_name:\s*"KOELOG"/);
});
