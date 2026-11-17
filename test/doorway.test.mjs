// Run with `node --test` in the repo root. No packages needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseFragment, claudeLink, isPhone, planPage, MESSAGES } from "../doorway.js";

const VECTORS = JSON.parse(readFileSync(new URL("./vectors.json", import.meta.url), "utf8"));

test("the vector file covers the tricky characters", () => {
  const prompts = VECTORS.map((v) => v.prompt).join("");
  for (const ch of ["å", "ä", "ö", "½", "&", "#", "🍸", "'", "(", "*", "!", "~", "/", "?", "=", "+", "%"]) {
    assert.ok(prompts.includes(ch), ch);
  }
  assert.ok(VECTORS.some((v) => v.folder.includes(" ")));
  assert.ok(VECTORS.some((v) => v.prompt.length === 2000));
});

for (const v of VECTORS) {
  test(`vector: ${v.name}`, () => {
    // The fragment really is what encodeURIComponent makes.
    assert.equal(v.fragment, `v=1&folder=${encodeURIComponent(v.folder)}&q=${encodeURIComponent(v.prompt)}`);
    assert.deepEqual(parseFragment("#" + v.fragment), { ok: true, folder: v.folder, prompt: v.prompt });
    assert.deepEqual(parseFragment(v.fragment), { ok: true, folder: v.folder, prompt: v.prompt });

    // claudeLink round-trip: the link carries exactly the folder and prompt.
    const link = claudeLink(v.folder, v.prompt);
    assert.equal(link, `claude://code/new?folder=${encodeURIComponent(v.folder)}&q=${encodeURIComponent(v.prompt)}`);
    const url = new URL(link);
    assert.equal(url.protocol, "claude:");
    assert.equal(url.searchParams.get("folder"), v.folder);
    assert.equal(url.searchParams.get("q"), v.prompt);
  });
}

test("no fragment", () => {
  assert.deepEqual(parseFragment(""), { ok: false, reason: "empty" });
  assert.deepEqual(parseFragment("#"), { ok: false, reason: "empty" });
  assert.deepEqual(parseFragment(undefined), { ok: false, reason: "empty" });
});

test("unknown or missing version", () => {
  assert.deepEqual(parseFragment("#v=2&folder=a&q=b"), { ok: false, reason: "version", newer: true });
  assert.deepEqual(parseFragment("#v=&folder=a&q=b"), { ok: false, reason: "version", newer: false });
  assert.deepEqual(parseFragment("#folder=a&q=b"), { ok: false, reason: "version", newer: false });
  assert.deepEqual(parseFragment("#hello"), { ok: false, reason: "version", newer: false });
});

test("malformed", () => {
  for (const hash of [
    "#v=1&folder=%E0%A4%A&q=x", // broken %-escape
    "#v=1&folder=a&q=%",
    "#v=1&folder=a", // missing q
    "#v=1&q=b", // missing folder
    "#v=1&folder=a&q=", // empty q
    "#v=1&folder=&q=b", // empty folder
    "#v=1&folder=a&q", // q without =
    "#v=1&q=a&q=b", // repeated key
    "#v=1&v=1&folder=a&q=b",
  ]) {
    assert.deepEqual(parseFragment(hash), { ok: false, reason: "malformed" }, hash);
  }
});

test("unknown extra keys are ignored, and only the first = splits", () => {
  assert.deepEqual(parseFragment("#v=1&folder=a&q=b=c&extra=1&&"), { ok: true, folder: "a", prompt: "b=c" });
});

test("a plus stays a plus (encodeURIComponent writes spaces as %20)", () => {
  assert.deepEqual(parseFragment("#v=1&folder=a+b&q=x%20y"), { ok: true, folder: "a+b", prompt: "x y" });
});

test("never throws on odd input", () => {
  for (const hash of ["#%", "#=", "#&", "#=&=", "#v=1&%ZZ=1", "##v=1", null, 42, {}, "#" + "%".repeat(1000)]) {
    assert.doesNotThrow(() => parseFragment(hash), String(hash));
    assert.equal(parseFragment(hash).ok, false, String(hash));
  }
});

test("isPhone", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36";
  const androidTablet = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
  const mac = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
  const windows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
  assert.equal(isPhone(iphone, 5), true);
  assert.equal(isPhone(android, 5), true);
  assert.equal(isPhone(androidTablet, 5), true);
  assert.equal(isPhone(mac, 5), true); // an iPad asking for the desktop site
  assert.equal(isPhone(mac, 0), false);
  assert.equal(isPhone(windows, 10), false); // a touch-screen laptop is still a desk
  assert.equal(isPhone(windows, 0), false);
  assert.equal(isPhone(undefined, undefined), false);
});

// planPage: what the page shows for each row of the spec's matrix.
const DESK = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

test("page plan: good door on a desk computer", () => {
  const v = VECTORS[0];
  assert.deepEqual(planPage("#" + v.fragment, DESK, 0), {
    trouble: null, phone: false, door: true, href: claudeLink(v.folder, v.prompt),
    prompt: v.prompt, autoForward: true,
  });
});

test("page plan: good door on a phone shows the desk note, Open button and prompt, no forward", () => {
  const v = VECTORS[0];
  assert.deepEqual(planPage("#" + v.fragment, PHONE, 5), {
    trouble: null, phone: true, door: true, href: claudeLink(v.folder, v.prompt),
    prompt: v.prompt, autoForward: false,
  });
});

test("page plan: trouble gets a friendly message and no Open button", () => {
  const cases = [
    ["", MESSAGES.empty], ["#", MESSAGES.empty], ["#folder=a&q=b", MESSAGES.empty],
    ["#v=2&folder=a&q=b", MESSAGES.newer],
    ["#v=1&folder=%E0%A4%A&q=x", MESSAGES.malformed], ["#v=1&folder=a", MESSAGES.malformed],
    ["#v=1&folder=a&q=", MESSAGES.malformed], ["#v=1&q=a&q=b", MESSAGES.malformed],
  ];
  for (const [hash, message] of cases) {
    for (const [ua, touch] of [[DESK, 0], [PHONE, 5]]) {
      assert.deepEqual(planPage(hash, ua, touch), {
        trouble: message, phone: false, door: false, href: null, prompt: null, autoForward: false,
      }, hash);
    }
  }
});

test("messages stay in character: no error codes", () => {
  for (const m of Object.values(MESSAGES)) {
    assert.ok(!/error|undefined|null|exception/i.test(m), m);
  }
});
