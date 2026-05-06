# AutoTyper

Desktop auto-typing utility for Windows.

Repository: [https://github.com/RegigigasFan/AutoTyper](https://github.com/RegigigasFan/AutoTyper)

## Install

```powershell
npm.cmd install
```

## Run

```powershell
npm.cmd start
```

## Build

```powershell
npm.cmd run build -- --dir
```

Output:

`dist\win-unpacked\Clean Auto Typer.exe`

## HUD Overview

### Left Panel

- `Script Editor`: write or paste text/script
- `Preview`: exact script preview
- `Test Mode Output`: safe internal output view

### Right Panel

- `Mode`: `Active Window Typing` or `Test Mode`
- `Minimum Typing Delay (ms)`
- `Maximum Typing Delay (ms)`
- `Pause Interval Chance (%)`
- `Minimum Pause Time (ms)`
- `Maximum Pause Time (ms)`
- `Accuracy`
- `Safety Countdown`
- `Auto-correction`
- `Compatibility Mode`
- `Global Start/Stop Hotkey`
- Preset controls

### Bottom Bar

- `Start`
- `Stop`
- `Save Preset`
- `Load Preset`
- `Delete Preset`

## Default Settings

- Mode: `Active Window Typing`
- Minimum Typing Delay: `25 ms`
- Maximum Typing Delay: `75 ms`
- Pause Interval Chance: `4%`
- Minimum Pause Time: `200 ms`
- Maximum Pause Time: `800 ms`
- Accuracy: `100%`
- Safety Countdown: `3 seconds`
- Auto-correction: `OFF`
- Compatibility Mode: `ON`
- Hotkey: `CommandOrControl+Shift+S`

## Supported Tokens

- `{ENTER}`
- `{TAB}`
- `{BACKSPACE}`
- `{ESC}`
- `{CTRL+C}`
- `{CTRL+V}`

## Stack

- Electron
- `@nut-tree-fork/nut-js`
- Electron Builder
