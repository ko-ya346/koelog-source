import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the KOELOG app shell source intact", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /<strong>KOELOG<\/strong>/);
  assert.match(page, /VOICE LIFE ASSISTANT/);
  assert.match(page, /話すだけで、/);
  assert.match(page, /今日のことを話してください/);
  assert.match(page, /AIで整理して記録/);
  assert.match(page, /今日のまとめ/);
  assert.match(page, /今日の記録/);
  assert.match(page, /期限・支払い/);
});

test("keeps the current browser-only prototype behavior explicit", async () => {
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
