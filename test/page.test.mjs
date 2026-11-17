// Runs the real page.js against a stand-in page built from index.html's ids.
// No browser or packages: document, window and navigator are small fakes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { claudeLink, MESSAGES } from "../doorway.js";

const HTML = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const PAGE_JS = readFileSync(new URL("../page.js", import.meta.url), "utf8");
const DESK = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const PHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const START = "https://example.org/doorway/";

/** One fake element per id in index.html, hidden if the tag says `hidden`. */
function fakeElements() {
  const elements = {};
  for (const [, tag, id] of HTML.matchAll(/(<[^>]*\sid="([^"]+)"[^>]*>)/g)) {
    elements[id] = {
      hidden: /\shidden[\s>]/.test(tag),
      textContent: "",
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { if (name === "hidden") this.hidden = false; },
      addEventListener() {},
      set innerHTML(_) { throw new Error("page.js must not use innerHTML"); },
    };
  }
  return elements;
}

let run = 0;
async function load(hash, userAgent, maxTouchPoints = 0) {
  const elements = fakeElements();
  const location = { hash, href: START + hash };
  globalThis.document = {
    getElementById(id) {
      if (!(id in elements)) throw new Error(`index.html has no #${id}`);
      return elements[id];
    },
  };
  globalThis.window = { location };
  Object.defineProperty(globalThis, "navigator", {
    value: { userAgent, maxTouchPoints }, configurable: true, writable: true,
  });
  await import(`../page.js?case=${run++}`); // a fresh copy each time, so setUp runs again
  return { elements, location };
}

const FOLDER = "/home/someone/a fairy";
const PROMPT = "Door 1: hello & good day";
const GOOD = `#v=1&folder=${encodeURIComponent(FOLDER)}&q=${encodeURIComponent(PROMPT)}`;

test("desk + good fragment: forwards, and shows the door", async () => {
  const { elements: e, location } = await load(GOOD, DESK);
  const link = claudeLink(FOLDER, PROMPT);
  assert.equal(location.href, link);
  assert.equal(e.open.attributes.href, link);
  assert.equal(e.door.hidden, false);
  assert.equal(e.prompt.textContent, PROMPT);
  assert.equal(e.phone.hidden, true);
  assert.equal(e.trouble.hidden, true);
});

test("phone + good fragment: no forward, desk note and door shown", async () => {
  const { elements: e, location } = await load(GOOD, PHONE, 5);
  assert.equal(location.href, START + GOOD);
  assert.equal(e.phone.hidden, false);
  assert.equal(e.door.hidden, false);
  assert.equal(e.open.attributes.href, claudeLink(FOLDER, PROMPT));
  assert.equal(e.prompt.textContent, PROMPT);
});

for (const [hash, message] of [
  ["", MESSAGES.empty],
  ["#v=2&folder=a&q=b", MESSAGES.newer],
  ["#v=1&folder=%E0%A4%A&q=x", MESSAGES.malformed],
]) {
  test(`bad fragment ${JSON.stringify(hash)}: only the trouble message`, async () => {
    const { elements: e, location } = await load(hash, DESK);
    assert.equal(e.trouble.hidden, false);
    assert.equal(e.trouble.textContent, message);
    assert.equal(e.door.hidden, true);
    assert.equal(e.phone.hidden, true);
    assert.equal(e.open.attributes.href, undefined);
    assert.equal(location.href, START + hash);
  });
}

test("every id page.js looks up exists in index.html", () => {
  const ids = new Set(Object.keys(fakeElements()));
  const used = [...PAGE_JS.matchAll(/(?:getElementById|show)\("([^"]+)"\)/g)].map((m) => m[1]);
  assert.ok(used.length >= 6);
  for (const id of used) assert.ok(ids.has(id), id);
});

test("index.html: strict CSP, noindex and a noscript note", () => {
  assert.ok(HTML.includes(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">`));
  assert.ok(HTML.includes('<meta name="robots" content="noindex">'));
  assert.match(HTML, /<noscript>(?:(?!<\/noscript>)[\s\S])*Monsieur Claude/);
  assert.doesNotMatch(HTML, /<script(?![^>]*src="page\.js")/); // the one script is our own
  assert.doesNotMatch(HTML, /https?:\/\//); // nothing loaded from elsewhere
});
