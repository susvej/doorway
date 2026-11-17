// The doorway's logic, kept free of the page (no window, no document) so it
// can be tested with plain `node --test`. page.js does the DOM wiring.

/**
 * Read a location hash like "#v=1&folder=<enc>&q=<enc>".
 *
 * Returns {ok: true, folder, prompt} or {ok: false, reason}, where reason is
 * "empty" (no fragment), "version" (missing or unknown v; `newer` says whether
 * a non-empty v was given) or "malformed" (anything else wrong). Never throws.
 */
export function parseFragment(hash) {
  const text = typeof hash === "string" ? hash.replace(/^#/, "") : "";
  if (text === "") return { ok: false, reason: "empty" };

  const fields = new Map();
  for (const part of text.split("&")) {
    if (part === "") continue; // a stray "&&" or trailing "&"
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? "" : part.slice(eq + 1);
    let key, value;
    try {
      key = decodeURIComponent(rawKey);
      value = decodeURIComponent(rawValue);
    } catch {
      return { ok: false, reason: "malformed" }; // broken %-escapes
    }
    if (fields.has(key)) return { ok: false, reason: "malformed" };
    fields.set(key, value);
  }

  if (fields.get("v") !== "1") {
    return { ok: false, reason: "version", newer: Boolean(fields.get("v")) };
  }
  const folder = fields.get("folder");
  const prompt = fields.get("q");
  if (!folder || !prompt) return { ok: false, reason: "malformed" };
  return { ok: true, folder, prompt };
}

/** The link that opens a new Claude Code chat in `folder` with `prompt` typed in. */
export function claudeLink(folder, prompt) {
  return `claude://code/new?folder=${encodeURIComponent(folder)}&q=${encodeURIComponent(prompt)}`;
}

/** What the page says when there is no usable door. */
export const MESSAGES = {
  empty: "There’s no door here, darling. Copy the words printed in my letter and paste them into my friend Monsieur Claude instead.",
  newer: "This door is newer than my doorway, I’m afraid. Copy the words from my letter instead.",
  malformed: "The ink on this door has smudged. Copy the words printed in my letter instead, there’s a dear.",
};

/**
 * Decide everything the page shows, without touching the page:
 * {trouble, phone, door, href, prompt, autoForward}. `trouble` is a message
 * (or null); `door` says whether the Open button, prompt and note appear.
 */
export function planPage(hash, userAgent, maxTouchPoints) {
  const parsed = parseFragment(hash);
  if (!parsed.ok) {
    let key = parsed.reason;
    if (key === "version") key = parsed.newer ? "newer" : "empty"; // no v at all reads as "no door"
    return { trouble: MESSAGES[key] || MESSAGES.malformed, phone: false, door: false,
             href: null, prompt: null, autoForward: false };
  }
  const phone = isPhone(userAgent, maxTouchPoints);
  return { trouble: null, phone, door: true, href: claudeLink(parsed.folder, parsed.prompt),
           prompt: parsed.prompt, autoForward: !phone };
}

/**
 * True on a phone or tablet. iPads ask for the desktop site and call
 * themselves "Macintosh", so a Mac with a touch screen counts as a tablet.
 */
export function isPhone(userAgent, maxTouchPoints) {
  const ua = typeof userAgent === "string" ? userAgent : "";
  if (/iPhone|iPad|iPod|Android|Mobile/i.test(ua)) return true;
  return /Macintosh/.test(ua) && Number(maxTouchPoints) > 1;
}
