# doorway

A tiny static page, served by GitHub Pages, that turns an ordinary `https://`
link into a `claude://` link. Email programs strip `claude://` links, so the
letter links here instead and this page passes the visitor on.

It is plain HTML and JavaScript: no build step, no dependencies, no analytics,
no cookies, no external scripts or fonts. The fragment (the part after `#`)
never leaves the visitor's browser.

This page is kept live through at least January 2027.

## The fragment contract

```
https://<this page>/#v=1&folder=<enc>&q=<enc>
```

- `<enc>` is JavaScript's `encodeURIComponent` of the value.
- The fragment is split on `&`, each part at its first `=`, and keys and
  values are decoded with `decodeURIComponent`.
- `v` must be `1`. `folder` and `q` must be present and non-empty.
- A repeated key makes the fragment malformed. Unknown extra keys are ignored.

With a good fragment the page shows an **Open** button linking to

```
claude://code/new?folder=<encodeURIComponent(folder)>&q=<encodeURIComponent(q)>
```

plus the prompt with a **Copy** button. On a desk computer it also tries that
link once on load. On a phone or tablet it doesn't, and explains that the door
only opens at a desk. A missing, unknown or malformed fragment gets a friendly
message instead, never an error.

## Files

- `doorway.js` - the logic: `parseFragment(hash)`, `claudeLink(folder, prompt)`, `planPage(...)`,
  `isPhone(userAgent, maxTouchPoints)`. No DOM, so it can be tested in Node.
- `page.js` - applies `planPage` to `index.html` (text goes in via `textContent`).
- `test/` - tests and generic encoding vectors.

## Testing

Needs Node 18 or newer, nothing else:

```
node --test
```
