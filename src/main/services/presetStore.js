const fs = require("node:fs");
const path = require("node:path");

const PRESETS_FILE = "presets.json";

function getPresetsPath(app) {
  const userDataDir = app.getPath("userData");
  return path.join(userDataDir, PRESETS_FILE);
}

function ensurePresetsFile(app) {
  const filePath = getPresetsPath(app);
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ presets: [] }, null, 2), "utf8");
  }
  return filePath;
}

function readAll(app) {
  const filePath = ensurePresetsFile(app);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.presets)) {
      return { presets: [] };
    }
    return data;
  } catch {
    return { presets: [] };
  }
}

function writeAll(app, data) {
  const filePath = ensurePresetsFile(app);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function listPresets(app) {
  const data = readAll(app);
  return {
    ok: true,
    presets: data.presets.map((preset) => preset.name)
  };
}

function savePreset(app, payload) {
  const name = String(payload?.name || "").trim();
  if (!name) {
    return { ok: false, message: "Preset name is required." };
  }
  const script = String(payload?.script || "");
  if (!script.trim()) {
    return { ok: false, message: "Cannot save an empty script preset." };
  }

  const settings = payload?.settings || {};
  const data = readAll(app);
  const now = new Date().toISOString();

  const existing = data.presets.find((preset) => preset.name === name);
  if (existing) {
    existing.script = script;
    existing.settings = settings;
    existing.updatedAt = now;
  } else {
    data.presets.push({
      name,
      script,
      settings,
      createdAt: now,
      updatedAt: now
    });
  }

  writeAll(app, data);
  return { ok: true, message: "Preset saved.", name };
}

function loadPreset(app, name) {
  const desired = String(name || "").trim();
  if (!desired) {
    return { ok: false, message: "Preset name is required." };
  }

  const data = readAll(app);
  const preset = data.presets.find((item) => item.name === desired);
  if (!preset) {
    return { ok: false, message: `Preset "${desired}" not found.` };
  }

  return { ok: true, preset };
}

function deletePreset(app, name) {
  const desired = String(name || "").trim();
  if (!desired) {
    return { ok: false, message: "Preset name is required." };
  }

  const data = readAll(app);
  const before = data.presets.length;
  data.presets = data.presets.filter((preset) => preset.name !== desired);
  if (data.presets.length === before) {
    return { ok: false, message: `Preset "${desired}" not found.` };
  }

  writeAll(app, data);
  return { ok: true, message: "Preset deleted." };
}

module.exports = {
  listPresets,
  savePreset,
  loadPreset,
  deletePreset
};
