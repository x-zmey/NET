document.addEventListener("DOMContentLoaded", function () {
  const apiUrlInput = document.getElementById("apiUrl");
  const apiKeyInput = document.getElementById("apiKey");
  const saveBtn = document.getElementById("save");
  const statusEl = document.getElementById("status");

  // Load saved settings
  browser.storage.local.get(["apiUrl", "apiKey"]).then(function (result) {
    if (result.apiUrl) apiUrlInput.value = result.apiUrl;
    if (result.apiKey) apiKeyInput.value = result.apiKey;
  });

  saveBtn.addEventListener("click", function () {
    const apiUrl = apiUrlInput.value.trim();
    const apiKey = apiKeyInput.value.trim();

    if (!apiUrl || !apiKey) {
      statusEl.textContent = "Both fields are required.";
      statusEl.style.color = "#ef4444";
      return;
    }

    browser.storage.local.set({ apiUrl, apiKey }).then(function () {
      statusEl.textContent = "Settings saved!";
      statusEl.style.color = "#22c55e";
      setTimeout(function () {
        statusEl.textContent = "";
      }, 2000);
    });
  });
});
