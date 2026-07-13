import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("keeps the KOELOG app shell source intact", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

  assert.match(page, /<strong>KOELOG<\/strong>/);
  assert.match(page, /VOICE LIFE ASSISTANT/);
  assert.match(page, /話すだけで、/);
  assert.match(page, /今日のことを話してください/);
  assert.match(page, /記録する/);
  assert.match(page, /今日のまとめ/);
  assert.match(page, /今日の記録/);
  assert.match(page, /期限・支払い/);
});

test("keeps the browser input shell and DB-backed record behavior explicit", async () => {
  const [page, layout, manifest] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(page, /localStorage\.getItem\("koelog-records"\)/);
  assert.doesNotMatch(page, /localStorage\.setItem\("koelog-records"\)/);
  assert.match(page, /SpeechRecognition/);
  assert.match(page, /webkitSpeechRecognition/);
  assert.match(page, /function parseVoice/);
  assert.match(page, /ログイン中のアカウントに保存されます/);
  assert.match(page, /fetch\("\/api\/records"/);
  assert.doesNotMatch(page, /電気代の支払い/);
  assert.doesNotMatch(page, /旅行代金の振込/);
  assert.match(layout, /title:\s*"KOELOG — 声で整う生活ログ"/);
  assert.match(manifest, /short_name:\s*"KOELOG"/);
});
