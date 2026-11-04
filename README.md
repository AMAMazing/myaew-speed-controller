# 🤼‍♂️ MyAEW Plus — Player UI, Speed Controller & Auto Break Skipper

**MyAEW Plus** is an all-in-one browser extension that transforms the MyAEW streaming player into a modern, Netflix/YouTube-grade cinema experience. 

Designed from the ground up as a **standard Chrome/Chromium desktop extension** while also being **purpose-built and heavily optimized for Vivaldi on Android**, allowing you to enjoy the exact same desktop-class features—including automatic commercial break skipping and smart playback speeds—right on your phone or tablet.

---

## ✨ Key Features

### 1. ⏭️ Automatic "Screensaver" Break Skipper
Anyone who watches replays on MyAEW knows the pain of hitting those long, repetitive "Stay Tuned" screensaver breaks and having to manually scrub around trying to guess when the match comes back without spoiling the finish.
* **Zero-Spoiler Instant Teleport:** Uses background trickplay sprite analysis to detect when the broadcast enters the repeating MyAEW break loop, scans ahead in milliseconds to find the exact frame the show returns, and teleports playback to **2 seconds before the action resumes**.
* **Fully Automatic & Manual Modes:** Runs automatically in the background (`Auto-Skip Breaks: ON` by default) with a sleek on-screen toast notification (*e.g., `⚡ Skipped 2m 28s Screensaver Break!`*), or can be triggered on-demand via the **`⏭️` Skip Break** button in the player bar.
* **DRM-Safe:** Works seamlessly on Widevine DRM-encrypted `.m4s` streams with near-zero CPU overhead.

### 2. ⚡ Advanced Playback Speed Controller & Buffer Booster
Take complete control over how fast you watch shows, with built-in protection against buffering stalls:
* **Granular Speed Control:** Adjust playback speed from **`0.25x` to `4.0x`** in `0.05x` increments using a YouTube-style slider, `+`/`-` buttons, or one-tap presets (`1.0x`, `1.25x`, `1.5x`, `2.0x`, `3.0x`, `4.0x`).
* **Smart Auto-Speed (Proportional Buffer Stabilizer):** Want to watch at `2.0x` or `3.0x` on a slow connection? Turn on **Smart Auto-Speed**. It monitors your live video buffer and smoothly scales playback speed up or down in real time so your stream never freezes or stutters.
* **"Finish By" Time Target Mode:** Have to leave the house or go to bed at a specific time? Switch Smart Auto-Speed to **Time Mode** and enter your target finish time (e.g., `23:30`). The extension dynamically calculates and adjusts the exact playback speed needed to finish the remaining broadcast right on schedule.
* **120-Second Bitmovin Buffer Booster:** Automatically reconfigures the underlying Bitmovin player to pre-buffer up to **2 minutes** of video and audio ahead (up from the default short buffer), making high-speed playback rock-solid.

### 3. 🎬 Cinematic Theater UI Overhaul
Replaces the cramped default MyAEW page layout with an edge-to-edge, full-window cinema experience:
* **True Full-Viewport Theater Mode:** Automatically expands the video player to fill `100%` of your browser window when on `/video/*` routes while hiding distracting sidebars, padding, and redundant headers.
* **Integrated Top Player Bar:** Consolidates the Back button, AEW logo, live **Show/Event Title**, Multiview/Stream Selector, and Help button into a sleek, translucent top overlay bar.
* **Coordinated Auto-Hide:** Both the top header overlay and bottom player controls smoothly fade out together after 3.5 seconds of inactivity (along with the mouse cursor) and reappear instantly on movement or pause.

### 4. 📱 Built for Desktop Chrome — Perfected for Vivaldi on Android
Most people don't realize you can run desktop Chrome extensions on your phone. **Vivaldi on Android** supports standard Chrome extensions out of the box, and **MyAEW Plus** has been specially engineered so mobile users get a first-class, native-app experience:
* **Dynamic Viewport (`100dvh`) Toolbar Fix:** Standard extensions use `100vh`, which causes Vivaldi's bottom address/tab bar to cover up the player controls. MyAEW Plus automatically detects touch devices and uses `100dvh` + safe-area insets so controls are never cut off.
* **Native Touch "Tap-to-Toggle" Controls:** Tap anywhere on the video to instantly show or hide the player overlays—just like the native YouTube app.
* **Auto-Landscape Fullscreen:** Tapping Fullscreen on Android automatically locks your screen into **Landscape orientation** and unlocks it when you exit.
* **Mobile-Centered Speed Modal:** On smaller phone screens, the Speed & Break Skipper popup automatically centers itself as a touch-friendly modal so it never clips off the edge of the screen.

### 5. 🖼️ Full Picture-in-Picture (PiP) Support (Native & Chrome Extension)
* **Dedicated PiP Button:** Adds a native Picture-in-Picture button right next to the Speed Controller in the bottom-right control bar.
* **Chrome PiP Extension Compatible:** Strips Bitmovin's `disablePictureInPicture` locks so it works both with and without Google's official Picture-in-Picture extension.
* **MediaSession API Integration:** Displays the current AEW show title in your Android notification shade / desktop media flyout with working **Play, Pause, 10s Rewind, and 10s Fast-Forward** hardware/PiP controls.
* **Background Speed & Skip Support:** Both Smart Auto-Speed and the Automatic Break Skipper continue running even while the video is popped out in a floating PiP window!

---

## 🚀 Installation

### 💻 On Desktop (Chrome, Vivaldi, Brave, Edge)
1. Download or clone this repository to a folder on your computer.
2. Open your browser and navigate to `chrome://extensions` (or `vivaldi://extensions`).
3. Enable **Developer mode** using the toggle in the top-right corner.
4. Click **Load unpacked** in the top-left corner and select the extension folder.
5. Head over to [MyAEW.com](https://www.myaew.com/) and play any video!

### 📱 On Mobile (Recommended: Vivaldi for Android)
> **Why Vivaldi on Android?** Unlike standard mobile Chrome, [Vivaldi for Android](https://play.google.com/store/apps/details?id=com.vivaldi.browser) is a full Chromium browser that supports installing desktop Chrome extensions. MyAEW Plus is specifically tuned for Vivaldi Android's UI, touch gestures, and fullscreen/PiP behavior.

1. Install **Vivaldi Browser** from the Google Play Store on your Android phone or tablet.
2. Download this extension as a `.zip` file (or folder) onto your device.
3. Open Vivaldi and type `vivaldi://extensions` into the address bar.
4. Turn on **Developer mode** at the top.
5. Tap **Load unpacked** (or drag/select the extension `.zip` / folder).
6. Open [MyAEW.com](https://www.myaew.com/) in Vivaldi, start a show, and enjoy full Theater Mode, Auto Break Skipping, Picture-in-Picture, and Speed Controls on mobile!

---

## 🎮 Quick Controls Guide

| Icon / Control | Location | What It Does |
| :--- | :--- | :--- |
| **`⏭️` (Fast-Forward Icon)** | Bottom-right player bar | **Instant Break Skip:** Immediately scans thumbnails ahead and skips the current screensaver break. |
| **`⏱️` (Speedometer Icon)** | Bottom-right player bar | Opens the **Speed Controller, Smart Auto-Speed & Auto-Skip Breaks** menu. |
| **`🖼️` (PiP Icon)** | Bottom-right player bar | Pops the video into a floating **Picture-in-Picture** window. |
| **`Auto-Skip Breaks: ON`** | Inside Speed Popup | Automatically detects and teleports past MyAEW screensaver breaks while you watch. |
| **`Smart Auto-Speed: ON`** | Inside Speed Popup | Dynamically throttles playback speed based on your live buffer (`15s–90s`) or target finish time. |

---

## 📁 Project Structure

```text
├── manifest.json          # Manifest V3 configuration (runs in MAIN world)
├── player.css             # Desktop Cinema Mode, Top Overlay & Vivaldi Android 100dvh styles
├── player.js              # Header adoption, Show Title detector, Touch/Inactivity & MediaSession
├── speed-controller.css   # Speed popup, PiP button, Break Skipper & Toast notification styles
├── speed-controller.js    # Buffer Booster, Speed Controller, PiP manager & Trickplay Break Skipper
└── icons/                 # Extension icons (16x16, 48x48, 128x128)
```