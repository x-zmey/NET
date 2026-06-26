(function () {
  "use strict";

  const BUTTON_CLASS = "air3-inline-action";
  let currentBtn = null;
  let savedRange = null;

  document.addEventListener("mouseup", handleSelection);
  document.addEventListener("keyup", handleSelection);

  function handleSelection() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      removeButton();
      return;
    }

    const anchor = sel.anchorNode;
    const composer = findComposer(anchor);
    if (!composer) {
      removeButton();
      return;
    }

    savedRange = sel.getRangeAt(0).cloneRange();
    showButton();
  }

  function findComposer(node) {
    let el = node;
    while (el) {
      if (el.nodeType === 1) {
        if (
          el.classList &&
          el.classList.contains("ProseMirror") &&
          el.getAttribute("contenteditable") === "true"
        ) {
          return el;
        }
      }
      el = el.parentNode;
    }
    return null;
  }

  function removeButton() {
    if (currentBtn) {
      currentBtn.remove();
      currentBtn = null;
    }
  }

  function showButton() {
    removeButton();

    if (!savedRange) return;
    const rect = savedRange.getBoundingClientRect();
    if (!rect.width && !rect.height) return;

    const btn = document.createElement("button");
    btn.className = BUTTON_CLASS;
    btn.title = "Refine text";

    Object.assign(btn.style, {
      position: "fixed",
      left: rect.right + 4 + "px",
      top: rect.top + rect.height / 2 - 12 + "px",
      zIndex: "2147483647",
      width: "24px",
      height: "24px",
      borderRadius: "4px",
      border: "none",
      background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
      color: "white",
      fontSize: "9px",
      fontWeight: "700",
      fontFamily: "inherit",
      cursor: "pointer",
      boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
      lineHeight: "1",
      padding: "0",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    });
    btn.textContent = "EN";

    btn.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();
    });

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      onTranslateClick();
    });

    document.body.appendChild(btn);
    currentBtn = btn;
  }

  async function onTranslateClick() {
    if (!savedRange) return;

    const selectedText = savedRange.toString().trim();
    if (!selectedText) return;

    const composer = findComposer(savedRange.startContainer);
    if (!composer) return;

    const settings = await getSettings();
    if (!settings.apiUrl || !settings.apiKey) {
      alert("Please configure the extension settings first.");
      return;
    }

    if (currentBtn) {
      currentBtn.textContent = "...";
      currentBtn.style.opacity = "0.6";
      currentBtn.style.pointerEvents = "none";
    }

    // Only send the user's own text — never scrape other people's messages.
    // Collect only visible context from the composer itself (what the user typed).
    // Chat history from OTHER participants is NOT collected or transmitted.
    const context = collectOwnContext(composer);

    try {
      const response = await fetch(settings.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": settings.apiKey,
        },
        body: JSON.stringify({
          text: selectedText,
          ...(context ? { history: context } : {}),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(function () { return {}; });
        throw new Error(err.error || "Request failed");
      }

      const data = await response.json();

      if (data.translated) {
        replaceSelectedText(composer, data.translated);
      }
    } catch (err) {
      alert("Translation failed: " + err.message);
    } finally {
      savedRange = null;
      removeButton();
    }
  }

  function replaceSelectedText(composer, newText) {
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);

    composer.focus();
    document.execCommand("insertText", false, newText);
  }

  function collectOwnContext(composer) {
    // Only read the full text from the composer (the user's own draft).
    // This is the same content the user is actively editing — no external data.
    const fullText = composer.textContent || "";
    const selectedText = savedRange ? savedRange.toString() : "";

    // If the composer has more text than what's selected, send the full draft as context
    if (fullText.trim().length > selectedText.trim().length) {
      return fullText.trim();
    }

    return "";
  }

  function getSettings() {
    return new Promise(function (resolve) {
      if (typeof browser !== "undefined" && browser.storage) {
        browser.storage.local.get(["apiUrl", "apiKey"]).then(function (result) {
          resolve({
            apiUrl: result.apiUrl || "",
            apiKey: result.apiKey || "",
          });
        });
      } else {
        resolve({ apiUrl: "", apiKey: "" });
      }
    });
  }
})();
