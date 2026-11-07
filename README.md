# 🎬 ReelStream — Minimalist Smooth Reel Video Player

A sleek, responsive, zero-flicker vertical video player for streaming random reels with native dual-slot transitions and finger-drag physics.

**100% Pure Static Web Application** — No Python, no backend server, and no Render process needed. Host anywhere with zero configuration!

---

## ✨ Features

- **Dual-Slot Smooth Transition Engine**:
  - Zero black-screen flash or decoder lag when switching reels.
  - Active video glides out while the incoming video slides smoothly in with native spring physics (`cubic-bezier(0.2, 0.95, 0.25, 1)`).
  - Background preloading of the next random reel for instant playback.
- **Finger Swipe & Drag-to-Follow Gestures**:
  - Drag up or down on touch devices with real-time responsive tracking.
  - Momentum flick detection and rubber-band springback.
- **Micro-Interactions**:
  - Double-tap animated heart pop burst.
- **Native Share & Clipboard**:
  - One-tap "Share" button supporting the Web Share API and automatic clipboard copy.
- **100% Pure Static Architecture**:
  - Pure HTML5, CSS3, ES Modules JavaScript, and text-based link catalog (`reels.txt`).
  - Zero server or backend dependencies. No login or external account required.

---

## 🚀 Static Hosting Options

You can host this project directly on any static web host or CDN:

### 1. GitHub Pages
1. Go to repository **Settings** > **Pages**.
2. Select branch `main` and root folder `/`.
3. Click **Save** — live instantly!

### 2. Cloudflare Pages / Vercel / Netlify
1. Connect your repository.
2. Build command: *(leave empty)*
3. Publish directory: *(leave root `/` or `.`)
4. Deploy!

### 3. Local Preview
Run any local static file server:
```bash
# Using python built-in http server (optional, for local viewing only):
python -m http.server 3000

# Or using npx serve:
npx serve .
```

---

## ⌨️ Controls & Keyboard Shortcuts

| Control | Action |
| --- | --- |
| <kbd>↓</kbd> or <kbd>J</kbd> | Next Random Reel (Smooth Transition) |
| <kbd>↑</kbd> or <kbd>K</kbd> | Previous Reel (Session History) |
| <kbd>Space</kbd> or Tap | Play / Pause |
| Double Tap on Screen | Love React (Heart burst) |
| <kbd>L</kbd> | Love React Toggle |
| <kbd>M</kbd> | Audio Mute / Unmute |
