const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("autoTyperApi", {
  startTyping: (payload) => ipcRenderer.invoke("typing-start", payload),
  stopTyping: () => ipcRenderer.invoke("typing-stop"),
  registerHotkey: (accelerator) => ipcRenderer.invoke("register-hotkey", accelerator),
  listPresets: () => ipcRenderer.invoke("presets-list"),
  savePreset: (payload) => ipcRenderer.invoke("presets-save", payload),
  loadPreset: (name) => ipcRenderer.invoke("presets-load", name),
  deletePreset: (name) => ipcRenderer.invoke("presets-delete", name),
  onTypingState: (callback) => {
    ipcRenderer.on("typing-state", (_event, payload) => callback(payload));
  },
  onCountdown: (callback) => {
    ipcRenderer.on("typing-countdown", (_event, payload) => callback(payload));
  },
  onHotkeyTriggered: (callback) => {
    ipcRenderer.on("hotkey-triggered", () => callback());
  },
  onTestOutputEvent: (callback) => {
    ipcRenderer.on("test-output-event", (_event, payload) => callback(payload));
  }
});
