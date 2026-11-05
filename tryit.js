/* ============================================================================
 * tryit.js — standalone "Try it" reproducibility panel for the CleanURL popup.
 * ----------------------------------------------------------------------------
 * Purpose: give a reviewer instant, deterministic, offline proof that the core
 * CleanURL function works, without navigating to a tracked URL and without the
 * dev-only chrome.declarativeNetRequest.onRuleMatchedDebug event.
 *
 * It computes the cleaning locally, in plain JS, using the EXACT same parameter
 * set that ships in rules/core.json (the 12 declarativeNetRequest rules Chrome
 * applies to real navigations). The lists below are a 1:1 mirror of that file:
 *   - EXACT_PARAMS  <-  every "removeParams" entry, rules 1-10
 *   - REGEX_PARAMS  <-  every "regexRemoveParams" entry, rules 11-12
 *
 * No imports, no modules, no eval, no network. CSP-safe (script-src 'self').
 * This file only APPENDS to the popup; it never mutates existing React state.
 * ========================================================================== */
(function () {
  "use strict";

  // --- Mirror of dist/rules/core.json -------------------------------------
  // Exact parameter names removed by rules 1-10 (queryTransform.removeParams).
  var EXACT_PARAMS = [
    "fbclid",                                             // rule 1
    "gclid",                                              // rule 2
    "dclid",                                              // rule 3
    "msclkid",                                            // rule 4
    "mc_eid", "mkt_tok",                                  // rule 5
    "igshid", "ytclid", "srsltid",                        // rule 6
    "_hsenc", "_hsmi", "__hssc", "__hstc", "__hsfp", "hsCtaTracking", // rule 7
    "ref_src", "_branch_match_id", "twclid", "yclid", "gbraid", "wbraid", // rule 8
    "_ga", "_gl",                                         // rule 9
    "spm", "scm", "pgrid", "pcrid", "campaign_id", "ad_group", "ad_set" // rule 10
  ];
  // Prefix families removed by rules 11-12 (queryTransform.regexRemoveParams).
  var REGEX_PARAMS = ["^utm_", "^pk_", "^sc_"];

  var EXACT_SET = new Set(EXACT_PARAMS.map(function (p) { return p.toLowerCase(); }));
  var REGEXES = REGEX_PARAMS.map(function (p) {
    try { return new RegExp(p, "i"); } catch (e) { return null; }
  }).filter(Boolean);

  var SAMPLE = "https://example.com/article?utm_source=newsletter&utm_medium=email&fbclid=IwAR123&gclid=abc#top";

  function isTracker(name) {
    var lower = String(name).toLowerCase();
    if (EXACT_SET.has(lower)) return true;
    for (var i = 0; i < REGEXES.length; i++) {
      if (REGEXES[i].test(name)) return true;
    }
    return false;
  }

  // Returns { clean, removed: [names], error }
  function clean(raw) {
    var input = String(raw || "").trim();
    if (!input) return { clean: "", removed: [], error: null };
    var url;
    try {
      url = new URL(input);
    } catch (e) {
      return { clean: "", removed: [], error: "noturl" };
    }
    var removed = [];
    // Collect keys first (mutating during iteration is unsafe).
    var keys = [];
    url.searchParams.forEach(function (_v, k) { keys.push(k); });
    keys.forEach(function (k) {
      if (isTracker(k)) {
        removed.push(k);
        url.searchParams.delete(k);
      }
    });
    // Rebuild without a trailing "?" when the query is now empty.
    var out = url.origin + url.pathname;
    var qs = url.searchParams.toString();
    if (qs) out += "?" + qs;
    if (url.hash) out += url.hash;
    return { clean: out, removed: removed, error: null };
  }

  // --- DOM construction ---------------------------------------------------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function build(mountPoint) {
    if (document.getElementById("clean9992-tryit")) return; // idempotent

    var wrap = el("div", "clean9992-stack");
    wrap.id = "clean9992-tryit";
    wrap.style.paddingTop = "0";

    var card = el("div", "clean9992-card");
    card.style.display = "flex";
    card.style.flexDirection = "column";
    card.style.gap = "10px";

    var eyebrow = el("p", "clean9992-eyebrow", "Try it — live preview");
    eyebrow.style.margin = "0";

    // Input (editable)
    var inLabel = el("label", "clean9992-label", "Paste a link with tracking");
    inLabel.setAttribute("for", "clean9992-tryit-in");
    var inField = el("textarea", "clean9992-input clean9992-mono");
    inField.id = "clean9992-tryit-in";
    inField.setAttribute("rows", "2");
    inField.setAttribute("spellcheck", "false");
    inField.setAttribute("aria-label", "Link with tracking parameters");
    inField.style.resize = "none";
    inField.style.lineHeight = "1.5";
    inField.style.wordBreak = "break-all";
    inField.value = SAMPLE;

    // Output (read-only)
    var outLabel = el("label", "clean9992-label", "Cleaned link");
    outLabel.setAttribute("for", "clean9992-tryit-out");
    var outField = el("div", "clean9992-input clean9992-mono");
    outField.id = "clean9992-tryit-out";
    outField.setAttribute("role", "textbox");
    outField.setAttribute("aria-readonly", "true");
    outField.setAttribute("aria-live", "polite");
    outField.style.minHeight = "38px";
    outField.style.wordBreak = "break-all";
    outField.style.whiteSpace = "normal";

    // Result summary line
    var summary = el("div");
    summary.style.display = "flex";
    summary.style.flexWrap = "wrap";
    summary.style.alignItems = "center";
    summary.style.gap = "8px";

    var badge = el("span", "clean9992-badge");
    badge.style.background = "var(--clean9992-primary)";
    badge.style.color = "#fff";

    var summaryText = el("span", "clean9992-muted");
    summaryText.style.fontSize = "12px";

    var removedList = el("div", "clean9992-mono clean9992-muted");
    removedList.style.fontSize = "11px";
    removedList.style.wordBreak = "break-all";

    function render() {
      var r = clean(inField.value);
      if (r.error === "noturl") {
        outField.textContent = "";
        badge.textContent = "—";
        summaryText.textContent = "Enter a full URL (including https://)";
        removedList.textContent = "";
        return;
      }
      outField.textContent = r.clean;
      var n = r.removed.length;
      badge.textContent = n === 1 ? "1 removed" : n + " removed";
      summaryText.textContent = n === 1
        ? "tracking parameter removed"
        : "tracking parameters removed";
      removedList.textContent = n ? r.removed.join("  ·  ") : "";
    }

    inField.addEventListener("input", render);

    summary.appendChild(badge);
    summary.appendChild(summaryText);

    card.appendChild(eyebrow);
    card.appendChild(inLabel);
    card.appendChild(inField);
    card.appendChild(outLabel);
    card.appendChild(outField);
    card.appendChild(summary);
    card.appendChild(removedList);
    wrap.appendChild(card);

    // Insert just before the footer if present, else append to the popup.
    var footer = mountPoint.querySelector(".clean9992-footer");
    if (footer && footer.parentNode === mountPoint) {
      mountPoint.insertBefore(wrap, footer);
    } else {
      mountPoint.appendChild(wrap);
    }

    render();
  }

  // --- Wait for the React popup to render, then mount ---------------------
  function tryMount() {
    var mount = document.querySelector(".clean9992-popup");
    if (mount) { build(mount); return true; }
    return false;
  }

  function start() {
    if (tryMount()) return;
    var attempts = 0;
    var obs = new MutationObserver(function () {
      if (tryMount() || attempts++ > 120) { obs.disconnect(); }
    });
    var root = document.getElementById("root") || document.body;
    obs.observe(root, { childList: true, subtree: true });
    // Fallback poll in case the observer misses (defensive).
    var poll = setInterval(function () {
      if (tryMount() || attempts++ > 120) { clearInterval(poll); }
    }, 50);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
