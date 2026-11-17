// Wires doorway.js to the page. All text goes in with textContent, never innerHTML.
// Every decision is made by planPage (tested in Node); this file only applies it.
import { planPage } from "./doorway.js";

const show = (id) => document.getElementById(id).removeAttribute("hidden");

function setUp() {
  const plan = planPage(window.location.hash, navigator.userAgent, navigator.maxTouchPoints);

  if (plan.trouble) {
    document.getElementById("trouble").textContent = plan.trouble;
    show("trouble");
    return;
  }

  if (plan.phone) show("phone");
  document.getElementById("open").setAttribute("href", plan.href);
  document.getElementById("prompt").textContent = plan.prompt;
  show("door");

  const status = document.getElementById("copy-status");
  document.getElementById("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(plan.prompt);
      status.textContent = "Copied! Now paste it into Monsieur Claude.";
    } catch {
      // No clipboard access: select the words so a Ctrl+C / Cmd+C does it.
      const range = document.createRange();
      range.selectNodeContents(document.getElementById("prompt"));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = "I’ve picked out the words for you. Press Ctrl+C (or ⌘C) to copy them.";
    }
  });

  // On a desk computer, try the door once straight away. The button stays for a second try.
  if (plan.autoForward) window.location.href = plan.href;
}

setUp();
