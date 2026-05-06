const { keyboard, Key } = require("@nut-tree-fork/nut-js");
const { clipboard } = require("electron");
const { parseScript } = require("./tokenParser");

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

const SPECIAL_KEY_MAP = {
  ENTER: Key.Enter,
  TAB: Key.Tab,
  BACKSPACE: Key.Backspace,
  ESC: Key.Escape
};

const COMBO_KEY_MAP = {
  CTRL: Key.LeftControl,
  CONTROL: Key.LeftControl,
  ALT: Key.LeftAlt,
  SHIFT: Key.LeftShift,
  WIN: Key.LeftSuper,
  CMD: Key.LeftSuper,
  ENTER: Key.Enter,
  TAB: Key.Tab,
  ESC: Key.Escape,
  BACKSPACE: Key.Backspace,
  SPACE: Key.Space,
  A: Key.A,
  B: Key.B,
  C: Key.C,
  D: Key.D,
  E: Key.E,
  F: Key.F,
  G: Key.G,
  H: Key.H,
  I: Key.I,
  J: Key.J,
  K: Key.K,
  L: Key.L,
  M: Key.M,
  N: Key.N,
  O: Key.O,
  P: Key.P,
  Q: Key.Q,
  R: Key.R,
  S: Key.S,
  T: Key.T,
  U: Key.U,
  V: Key.V,
  W: Key.W,
  X: Key.X,
  Y: Key.Y,
  Z: Key.Z,
  "0": Key.Num0,
  "1": Key.Num1,
  "2": Key.Num2,
  "3": Key.Num3,
  "4": Key.Num4,
  "5": Key.Num5,
  "6": Key.Num6,
  "7": Key.Num7,
  "8": Key.Num8,
  "9": Key.Num9
};

class TypingEngine {
  constructor() {
    this.running = false;
    this.stopRequested = false;
  }

  isRunning() {
    return this.running;
  }

  stop() {
    this.stopRequested = true;
  }

  async start(script, settings, hooks) {
    this.running = true;
    this.stopRequested = false;

    const normalizedSettings = normalizeSettings(settings);
    const tokens = parseScript(script || "");
    const adapter = createAdapter(normalizedSettings, hooks);

    if (adapter.modeLabel) {
      hooks.onState?.({
        running: true,
        source: "input-mode",
        modeLabel: adapter.modeLabel
      });
    }

    try {
      if (adapter.prepare) {
        await adapter.prepare();
      }

      await this.runCountdown(normalizedSettings.safetyCountdown, hooks);
      this.throwIfStopped();

      for (const token of tokens) {
        this.throwIfStopped();

        if (token.type === "text") {
          await this.typeTextToken(token.value, normalizedSettings, adapter);
          continue;
        }

        if (token.type === "special") {
          await adapter.special(token.key);
          await this.delayAfterToken(token.key, normalizedSettings);
          continue;
        }

        if (token.type === "combo") {
          await adapter.combo(token.keys);
          await this.delayAfterToken("COMBO", normalizedSettings);
        }
      }

      hooks.onState?.({
        running: false,
        source: this.stopRequested ? "stopped" : "completed"
      });
    } catch (error) {
      if (error && error.message === "Typing stopped.") {
        hooks.onState?.({
          running: false,
          source: "stopped"
        });
        return;
      }
      throw error;
    } finally {
      if (adapter.cleanup) {
        await adapter.cleanup();
      }
      this.running = false;
      this.stopRequested = false;
    }
  }

  async runCountdown(seconds, hooks) {
    if (seconds <= 0) {
      return;
    }

    for (let i = seconds; i > 0; i -= 1) {
      this.throwIfStopped();
      hooks.onCountdown?.(i);
      await sleep(1000);
    }
    hooks.onCountdown?.(0);
  }

  async typeTextToken(text, settings, adapter) {
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      this.throwIfStopped();

      if (char === "\r") {
        continue;
      }
      if (char === "\n") {
        await adapter.special("ENTER");
        await this.delayAfterChar("\n", settings);
        continue;
      }

      const shouldTyposBeAttempted = settings.accuracy < 100 && isTypoCandidate(char);
      const typoHappened = shouldTyposBeAttempted && Math.random() > settings.accuracy / 100;

      if (typoHappened) {
        const typoChar = generateTypoChar(char);
        await adapter.char(typoChar);
        await this.delayAfterChar(typoChar, settings);

        if (settings.autoCorrection) {
          const remaining = text.length - (i + 1);
          const canDoDelayedCorrection = remaining > 0 && Math.random() < 0.6;

          if (canDoDelayedCorrection) {
            // Type a few additional characters before noticing and fixing the typo.
            const extraCount = randomBetween(1, Math.min(3, remaining));
            const buffered = [];

            for (let j = 0; j < extraCount; j += 1) {
              const nextChar = text[i + 1 + j];
              if (nextChar === "\r" || nextChar === "\n") {
                break;
              }
              buffered.push(nextChar);
              await adapter.char(nextChar);
              await this.delayAfterChar(nextChar, settings);
            }

            await sleep(randomBetween(180, 420));
            for (let j = 0; j < buffered.length + 1; j += 1) {
              await adapter.special("BACKSPACE");
              await sleep(randomBetween(30, 90));
            }

            await adapter.char(char);
            await this.delayAfterChar(char, settings);
            for (const replayChar of buffered) {
              await adapter.char(replayChar);
              await this.delayAfterChar(replayChar, settings);
            }

            i += buffered.length;
          } else {
            await sleep(randomBetween(140, 360));
            await adapter.special("BACKSPACE");
            await sleep(randomBetween(40, 120));
            await adapter.char(char);
          }
        }
      } else {
        await adapter.char(char);
      }

      await this.delayAfterChar(char, settings);
    }
  }

  async delayAfterChar(char, settings) {
    await sleep(randomBetween(settings.minTypingDelayMs, settings.maxTypingDelayMs));

    if (shouldApplyIntervalPause(char, settings.pauseChancePercent)) {
      await sleep(randomBetween(settings.minPauseTimeMs, settings.maxPauseTimeMs));
    }
  }

  async delayAfterToken(tokenKey, settings) {
    const min = settings.minTypingDelayMs;
    const max = settings.maxTypingDelayMs;
    const tokenDelay =
      tokenKey === "ENTER"
        ? randomBetween(min + 50, max + 260)
        : randomBetween(min, max + Math.round((max - min) * 0.45));
    await sleep(tokenDelay);
  }

  throwIfStopped() {
    if (this.stopRequested) {
      throw new Error("Typing stopped.");
    }
  }
}

function normalizeSettings(raw = {}) {
  const minTypingDelayMs = clampNumber(raw.minTypingDelayMs, 1, 1000, 25);
  const maxTypingDelayMs = clampNumber(raw.maxTypingDelayMs, 1, 1000, 75);
  const pauseChancePercent = clampNumber(raw.pauseChancePercent, 0, 100, 4);
  const minPauseTimeMs = clampNumber(raw.minPauseTimeMs, 0, 5000, 200);
  const maxPauseTimeMs = clampNumber(raw.maxPauseTimeMs, 0, 5000, 800);

  return {
    minTypingDelayMs: Math.min(minTypingDelayMs, maxTypingDelayMs),
    maxTypingDelayMs: Math.max(minTypingDelayMs, maxTypingDelayMs),
    pauseChancePercent,
    minPauseTimeMs: Math.min(minPauseTimeMs, maxPauseTimeMs),
    maxPauseTimeMs: Math.max(minPauseTimeMs, maxPauseTimeMs),
    accuracy: clampNumber(raw.accuracy, 70, 100, 100),
    autoCorrection: Boolean(raw.autoCorrection),
    autoCorrectionChance: clampNumber(raw.autoCorrectionChance, 0, 1, 0.82),
    safetyCountdown: clampNumber(raw.safetyCountdown, 0, 10, 3),
    mode: raw.mode === "test" ? "test" : "active",
    compatibilityMode: raw.compatibilityMode !== false
  };
}

function isTypoCandidate(char) {
  return /[a-zA-Z]/.test(char);
}

function shouldApplyIntervalPause(char, pauseChancePercent) {
  if (pauseChancePercent <= 0) {
    return false;
  }

  if (!isPauseBoundary(char)) {
    return false;
  }

  return Math.random() < pauseChancePercent / 100;
}

function isPauseBoundary(char) {
  return char === " " || char === "\n" || /[,.!?;:]/.test(char);
}

function generateTypoChar(originalChar) {
  const isUpper = originalChar === originalChar.toUpperCase();
  const lowerOriginal = originalChar.toLowerCase();

  const index = LETTERS.indexOf(lowerOriginal);
  let next = lowerOriginal;
  if (index >= 0) {
    const offset = Math.random() < 0.5 ? -1 : 1;
    const target = (index + offset + LETTERS.length) % LETTERS.length;
    next = LETTERS[target];
  } else {
    next = LETTERS[randomBetween(0, LETTERS.length - 1)];
  }

  return isUpper ? next.toUpperCase() : next;
}

function createAdapter(settings, hooks) {
  if (settings.mode === "test") {
    return createTestAdapter(hooks);
  }
  return createActiveWindowAdapter(settings);
}

function createTestAdapter(hooks) {
  return {
    async char(character) {
      hooks.onTestOutput?.({ type: "char", character });
    },
    async special(key) {
      hooks.onTestOutput?.({ type: "special", key });
    },
    async combo(keys) {
      hooks.onTestOutput?.({ type: "combo", keys });
    }
  };
}

function createActiveWindowAdapter(settings) {
  keyboard.config.autoDelayMs = 0;
  const useClipboardPath = settings.compatibilityMode;
  let clipboardBackup = null;

  return {
    modeLabel: useClipboardPath ? "Compatibility paste mode" : "Keystroke mode",
    async prepare() {
      if (!useClipboardPath) {
        return;
      }
      try {
        clipboardBackup = clipboard.readText();
      } catch {
        clipboardBackup = null;
      }
    },
    async char(character) {
      if (!useClipboardPath) {
        await keyboard.type(character);
        return;
      }
      clipboard.writeText(character);
      await keyboard.type(Key.LeftControl, Key.V);
    },
    async special(key) {
      const mapped = SPECIAL_KEY_MAP[key];
      if (!mapped) {
        return;
      }
      await keyboard.type(mapped);
    },
    async combo(keys) {
      const mapped = keys.map((name) => COMBO_KEY_MAP[name]).filter(Boolean);
      if (mapped.length !== keys.length) {
        throw new Error(
          `Unsupported combo token: {${keys.join("+")}}. Supported examples include {CTRL+C} and {CTRL+V}.`
        );
      }
      await keyboard.type(...mapped);
    },
    async cleanup() {
      if (!useClipboardPath) {
        return;
      }
      try {
        clipboard.writeText(clipboardBackup || "");
      } catch {
        // Clipboard restore best-effort only.
      }
    }
  };
}

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, numeric));
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  TypingEngine
};
