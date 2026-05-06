const path = require("node:path");
const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const { TypingEngine } = require("./typing/typingEngine");
const {
  listPresets,
  savePreset,
  loadPreset,
  deletePreset
} = require("./services/presetStore");

let mainWindow = null;
const typingEngine = new TypingEngine();
let currentHotkey = "CommandOrControl+Shift+S";

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 760,
    minWidth: 980,
    minHeight: 620,
    backgroundColor: "#0f1115",
    title: "Clean Auto Typer",
    webPreferences: {
      preload: path.join(__dirname, "../preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
}

function registerHotkey(accelerator) {
  const previousHotkey = currentHotkey;
  try {
    globalShortcut.unregisterAll();
    const success = globalShortcut.register(accelerator, () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }
      mainWindow.webContents.send("hotkey-triggered");
    });

    if (!success) {
      if (previousHotkey && previousHotkey !== accelerator) {
        globalShortcut.register(previousHotkey, () => {
          if (!mainWindow || mainWindow.isDestroyed()) {
            return;
          }
          mainWindow.webContents.send("hotkey-triggered");
        });
      }
      return {
        ok: false,
        message:
          "Hotkey could not be registered. It may be invalid or already in use by another app."
      };
    }

    currentHotkey = accelerator;
    return { ok: true, message: "Hotkey registered.", value: currentHotkey };
  } catch (error) {
    if (previousHotkey && previousHotkey !== accelerator) {
      globalShortcut.register(previousHotkey, () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          return;
        }
        mainWindow.webContents.send("hotkey-triggered");
      });
    }
    return {
      ok: false,
      message: `Invalid hotkey format: ${error.message || "unknown error"}`
    };
  }
}

function notifyRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function stopTyping(source = "manual") {
  typingEngine.stop();
  notifyRenderer("typing-state", {
    running: false,
    source
  });
}

app.whenReady().then(() => {
  createWindow();
  registerHotkey(currentHotkey);

  ipcMain.handle("register-hotkey", (_event, accelerator) => {
    return registerHotkey(accelerator);
  });

  ipcMain.handle("typing-start", async (_event, payload) => {
    const { script, settings } = payload || {};
    if (!script || !script.trim()) {
      return { ok: false, message: "Text/script cannot be empty." };
    }

    if (typingEngine.isRunning()) {
      return { ok: false, message: "Typing is already running." };
    }

    notifyRenderer("typing-state", {
      running: true,
      source: "start"
    });

    try {
      if (settings?.mode !== "test" && mainWindow && !mainWindow.isDestroyed() && mainWindow.isFocused()) {
        // If user clicked Start in the app, get the app out of the way so they can focus target input.
        mainWindow.minimize();
      }

      await typingEngine.start(script, settings, {
        onCountdown: (secondsLeft) => {
          notifyRenderer("typing-countdown", { secondsLeft });
        },
        onState: (state) => {
          notifyRenderer("typing-state", state);
        },
        onTestOutput: (event) => {
          notifyRenderer("test-output-event", event);
        }
      });

      return { ok: true, message: "Typing finished." };
    } catch (error) {
      notifyRenderer("typing-state", {
        running: false,
        source: "error",
        error: error.message || "Unknown typing error."
      });
      return {
        ok: false,
        message: error.message || "Typing failed."
      };
    }
  });

  ipcMain.handle("typing-stop", () => {
    stopTyping("manual");
    return { ok: true };
  });

  ipcMain.handle("presets-list", () => listPresets(app));
  ipcMain.handle("presets-save", (_event, payload) => savePreset(app, payload));
  ipcMain.handle("presets-load", (_event, name) => loadPreset(app, name));
  ipcMain.handle("presets-delete", (_event, name) => deletePreset(app, name));
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("will-quit", () => {
  typingEngine.stop();
  globalShortcut.unregisterAll();
});
