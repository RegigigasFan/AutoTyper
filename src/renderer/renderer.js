const els = {
  scriptInput: document.getElementById("scriptInput"),
  scriptPreview: document.getElementById("scriptPreview"),
  testOutput: document.getElementById("testOutput"),
  modeSelect: document.getElementById("modeSelect"),
  minTypingDelayInput: document.getElementById("minTypingDelayInput"),
  maxTypingDelayInput: document.getElementById("maxTypingDelayInput"),
  pauseChanceSlider: document.getElementById("pauseChanceSlider"),
  pauseChanceValue: document.getElementById("pauseChanceValue"),
  minPauseTimeInput: document.getElementById("minPauseTimeInput"),
  maxPauseTimeInput: document.getElementById("maxPauseTimeInput"),
  accuracySlider: document.getElementById("accuracySlider"),
  accuracyValue: document.getElementById("accuracyValue"),
  countdownSelect: document.getElementById("countdownSelect"),
  autoCorrectionCheckbox: document.getElementById("autoCorrectionCheckbox"),
  compatibilityModeCheckbox: document.getElementById("compatibilityModeCheckbox"),
  hotkeyInput: document.getElementById("hotkeyInput"),
  applyHotkeyButton: document.getElementById("applyHotkeyButton"),
  presetNameInput: document.getElementById("presetNameInput"),
  presetSelect: document.getElementById("presetSelect"),
  statusCard: document.getElementById("statusCard"),
  startButton: document.getElementById("startButton"),
  stopButton: document.getElementById("stopButton"),
  savePresetButton: document.getElementById("savePresetButton"),
  loadPresetButton: document.getElementById("loadPresetButton"),
  deletePresetButton: document.getElementById("deletePresetButton")
};

let typingRunning = false;

init();

function init() {
  bindEvents();
  refreshSliderLabels();
  refreshScriptPreview();
  refreshPresetList();
  updateButtons();
  setStatus("Idle");
}

function bindEvents() {
  els.scriptInput.addEventListener("input", refreshScriptPreview);

  els.pauseChanceSlider.addEventListener("input", () => {
    refreshSliderLabels();
  });
  els.accuracySlider.addEventListener("input", () => {
    refreshSliderLabels();
  });

  els.startButton.addEventListener("click", () => runStartTyping());
  els.stopButton.addEventListener("click", () => runStopTyping());
  els.savePresetButton.addEventListener("click", () => runSavePreset());
  els.loadPresetButton.addEventListener("click", () => runLoadPreset());
  els.deletePresetButton.addEventListener("click", () => runDeletePreset());
  els.applyHotkeyButton.addEventListener("click", () => runApplyHotkey());

  window.autoTyperApi.onHotkeyTriggered(() => {
    if (typingRunning) {
      runStopTyping();
    } else {
      runStartTyping();
    }
  });

  window.autoTyperApi.onCountdown(({ secondsLeft }) => {
    if (secondsLeft > 0) {
      setStatus(`Starting in ${secondsLeft}...`);
    } else {
      setStatus("Typing...");
    }
  });

  window.autoTyperApi.onTypingState((state) => {
    typingRunning = Boolean(state?.running);
    updateButtons();

    if (typingRunning && state?.source === "input-mode" && state?.modeLabel) {
      setStatus(`Input mode: ${state.modeLabel}`);
      return;
    }

    if (!typingRunning) {
      if (state?.source === "completed") {
        setStatus("Typing finished.");
      } else if (state?.source === "stopped") {
        setStatus("Typing stopped.");
      } else if (state?.source === "error") {
        setStatus(`Error: ${state.error || "unknown error"}`);
      } else {
        setStatus("Idle");
      }
    }
  });

  window.autoTyperApi.onTestOutputEvent((event) => {
    applyTestOutputEvent(event);
  });
}

async function runStartTyping() {
  const script = els.scriptInput.value || "";
  if (!script.trim()) {
    setStatus("Cannot start: script is empty.");
    return;
  }

  if (getSettings().mode === "test") {
    els.testOutput.textContent = "";
  }

  const response = await window.autoTyperApi.startTyping({
    script,
    settings: getSettings()
  });

  if (!response?.ok) {
    setStatus(`Start failed: ${response?.message || "unknown error"}`);
  }
}

async function runStopTyping() {
  await window.autoTyperApi.stopTyping();
}

async function runApplyHotkey() {
  const hotkey = (els.hotkeyInput.value || "").trim();
  if (!hotkey) {
    setStatus("Hotkey cannot be empty.");
    return;
  }

  const result = await window.autoTyperApi.registerHotkey(hotkey);
  if (result.ok) {
    setStatus(`Hotkey set: ${result.value}`);
  } else {
    setStatus(`Hotkey error: ${result.message}`);
  }
}

async function runSavePreset() {
  const name = (els.presetNameInput.value || "").trim();
  if (!name) {
    setStatus("Preset name is required.");
    return;
  }

  const response = await window.autoTyperApi.savePreset({
    name,
    script: els.scriptInput.value,
    settings: getSettings()
  });

  if (!response?.ok) {
    setStatus(`Save failed: ${response?.message || "unknown error"}`);
    return;
  }

  await refreshPresetList(response.name);
  setStatus(`Preset saved: ${response.name}`);
}

async function runLoadPreset() {
  const selected = els.presetSelect.value;
  if (!selected) {
    setStatus("Choose a preset first.");
    return;
  }

  const response = await window.autoTyperApi.loadPreset(selected);
  if (!response?.ok || !response.preset) {
    setStatus(`Load failed: ${response?.message || "unknown error"}`);
    return;
  }

  applyPreset(response.preset);
  setStatus(`Loaded preset: ${response.preset.name}`);
}

async function runDeletePreset() {
  const selected = els.presetSelect.value;
  if (!selected) {
    setStatus("Choose a preset to delete.");
    return;
  }

  const response = await window.autoTyperApi.deletePreset(selected);
  if (!response?.ok) {
    setStatus(`Delete failed: ${response?.message || "unknown error"}`);
    return;
  }

  await refreshPresetList();
  setStatus(`Deleted preset: ${selected}`);
}

function getSettings() {
  const minTypingDelayMs = normalizeNumber(els.minTypingDelayInput.value, 25, 1, 1000);
  const maxTypingDelayMs = normalizeNumber(els.maxTypingDelayInput.value, 75, 1, 1000);
  const minPauseTimeMs = normalizeNumber(els.minPauseTimeInput.value, 200, 0, 5000);
  const maxPauseTimeMs = normalizeNumber(els.maxPauseTimeInput.value, 800, 0, 5000);

  return {
    mode: els.modeSelect.value,
    minTypingDelayMs: Math.min(minTypingDelayMs, maxTypingDelayMs),
    maxTypingDelayMs: Math.max(minTypingDelayMs, maxTypingDelayMs),
    pauseChancePercent: normalizeNumber(els.pauseChanceSlider.value, 4, 0, 100),
    minPauseTimeMs: Math.min(minPauseTimeMs, maxPauseTimeMs),
    maxPauseTimeMs: Math.max(minPauseTimeMs, maxPauseTimeMs),
    accuracy: Number(els.accuracySlider.value),
    safetyCountdown: Number(els.countdownSelect.value),
    autoCorrection: els.autoCorrectionCheckbox.checked,
    compatibilityMode: els.compatibilityModeCheckbox.checked
  };
}

function applyPreset(preset) {
  els.presetNameInput.value = preset.name || "";
  els.scriptInput.value = preset.script || "";
  const s = preset.settings || {};
  if (s.mode === "test" || s.mode === "active") {
    els.modeSelect.value = s.mode;
  }
  if (typeof s.minTypingDelayMs === "number") {
    els.minTypingDelayInput.value = String(s.minTypingDelayMs);
  }
  if (typeof s.maxTypingDelayMs === "number") {
    els.maxTypingDelayInput.value = String(s.maxTypingDelayMs);
  }
  if (typeof s.pauseChancePercent === "number") {
    els.pauseChanceSlider.value = String(s.pauseChancePercent);
  }
  if (typeof s.minPauseTimeMs === "number") {
    els.minPauseTimeInput.value = String(s.minPauseTimeMs);
  }
  if (typeof s.maxPauseTimeMs === "number") {
    els.maxPauseTimeInput.value = String(s.maxPauseTimeMs);
  }
  if (typeof s.accuracy === "number") {
    els.accuracySlider.value = String(s.accuracy);
  }
  if (typeof s.safetyCountdown === "number") {
    els.countdownSelect.value = String(s.safetyCountdown);
  }
  if (typeof s.autoCorrection === "boolean") {
    els.autoCorrectionCheckbox.checked = s.autoCorrection;
  }
  if (typeof s.compatibilityMode === "boolean") {
    els.compatibilityModeCheckbox.checked = s.compatibilityMode;
  }
  refreshSliderLabels();
  refreshScriptPreview();
}

async function refreshPresetList(selectName) {
  const response = await window.autoTyperApi.listPresets();
  const names = response?.presets || [];
  els.presetSelect.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = names.length ? "Select a preset..." : "No presets saved";
  els.presetSelect.appendChild(empty);

  for (const name of names) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    els.presetSelect.appendChild(option);
  }

  if (selectName && names.includes(selectName)) {
    els.presetSelect.value = selectName;
  }
}

function refreshSliderLabels() {
  els.pauseChanceValue.textContent = `${els.pauseChanceSlider.value}%`;
  els.accuracyValue.textContent = `${els.accuracySlider.value}%`;
}

function refreshScriptPreview() {
  els.scriptPreview.textContent = els.scriptInput.value || "";
}

function updateButtons() {
  els.startButton.disabled = typingRunning;
  els.stopButton.disabled = !typingRunning;
}

function setStatus(message) {
  els.statusCard.textContent = message;
}

function applyTestOutputEvent(event) {
  if (!event || typeof event !== "object") {
    return;
  }

  let current = els.testOutput.textContent || "";
  if (event.type === "char") {
    current += event.character || "";
  } else if (event.type === "special") {
    if (event.key === "ENTER") {
      current += "\n";
    } else if (event.key === "TAB") {
      current += "\t";
    } else if (event.key === "BACKSPACE") {
      current = current.slice(0, -1);
    } else if (event.key === "ESC") {
      current += "[ESC]";
    }
  } else if (event.type === "combo") {
    current += `[${(event.keys || []).join("+")}]`;
  }

  els.testOutput.textContent = current;
}

function normalizeNumber(value, fallback, min, max) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}
