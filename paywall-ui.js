/* ============================================================================
 * paywall-ui.js — CSP-safe button wiring for paywall.html.
 * ----------------------------------------------------------------------------
 * paywall.js exposes the real controller on window.__CLEAN9992_PAYWALL__
 * ({ init, startTrial, submitKey, refresh }). It renders tier state but does
 * not attach click handlers, so this file wires the trial / verify buttons.
 * No inline handlers (script-src 'self'); no imports; no network of its own.
 * ========================================================================== */
(function () {
  "use strict";

  function api() {
    return (typeof window !== "undefined" && window.__CLEAN9992_PAYWALL__) || null;
  }

  // Wait for the controller to be present before wiring.
  function whenReady(cb, tries) {
    tries = tries || 0;
    if (api()) { cb(api()); return; }
    if (tries > 100) return;
    setTimeout(function () { whenReady(cb, tries + 1); }, 50);
  }

  function setStatus(kind, msg) {
    var el = document.getElementById("clean9992-paywall-status");
    if (!el) return;
    el.setAttribute("data-kind", kind);
    el.textContent = msg || "";
  }

  function disable(btn, on, busyText) {
    if (!btn) return;
    if (on) {
      btn.dataset.label = btn.dataset.label || btn.textContent;
      btn.textContent = busyText || btn.textContent;
      btn.setAttribute("disabled", "disabled");
    } else {
      if (btn.dataset.label) btn.textContent = btn.dataset.label;
      btn.removeAttribute("disabled");
    }
  }

  function wire(ctrl) {
    var trialBtn = document.getElementById("clean9992-start-trial");
    var verifyBtn = document.getElementById("clean9992-verify-key");
    var keyInput = document.getElementById("clean9992-license-key");

    if (trialBtn) {
      trialBtn.addEventListener("click", function () {
        setStatus("info", "Starting your trial…");
        disable(trialBtn, true, "Starting…");
        Promise.resolve()
          .then(function () { return ctrl.startTrial(); })
          .then(function (res) {
            if (res && res.ok) {
              setStatus("ok", "7-day trial started. Pro features are unlocked.");
            } else if (res && res.reason === "already-used") {
              setStatus("err", "You have already used the 7-day trial.");
            } else {
              setStatus("err", "Could not start the trial. Please try again.");
            }
          })
          .catch(function () { setStatus("err", "Could not start the trial. Please try again."); })
          .then(function () { disable(trialBtn, false); });
      });
    }

    function doVerify() {
      var key = keyInput ? String(keyInput.value || "").trim() : "";
      if (key.length < 8) {
        setStatus("err", "License keys are at least 8 characters.");
        return;
      }
      setStatus("info", "Verifying…");
      disable(verifyBtn, true, "Verifying…");
      Promise.resolve()
        .then(function () { return ctrl.submitKey(key); })
        .then(function (res) {
          if (res && res.ok) {
            setStatus("ok", "License verified. Pro features unlocked.");
          } else {
            var r = (res && res.reason) || "unknown";
            if (r === "rate-limited") setStatus("err", "Too many attempts. Wait a minute.");
            else if (r === "timeout") setStatus("err", "Verification timed out. Try again.");
            else if (r === "network") setStatus("err", "Network error. Try again.");
            else if (String(r).indexOf("http-") === 0) setStatus("err", "Server error (" + r + ").");
            else setStatus("err", "License key not recognized.");
          }
        })
        .catch(function () { setStatus("err", "Network error. Try again."); })
        .then(function () { disable(verifyBtn, false); });
    }

    if (verifyBtn) verifyBtn.addEventListener("click", doVerify);
    if (keyInput) {
      keyInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); doVerify(); }
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { whenReady(wire); });
  } else {
    whenReady(wire);
  }
})();
