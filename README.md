# ⚡ CendrosyncP2P

<p align="center">
  <img src="android-expo/assets/logo.png" width="100" height="100" alt="CendrosyncP2P Logo" style="border-radius: 20px;" />
</p>

<p align="center">
  <strong>Instant, encrypted local P2P clipboard synchronization across Windows, macOS, Linux, Android, and iOS.</strong>
</p>

<p align="center">
  <a href="https://github.com/CendroSync/Executables/actions"><img src="https://img.shields.io/github/actions/workflow/status/CendroSync/Executables/build-all.yml?branch=main&style=flat-square&logo=github&label=Build%20Status" alt="Build Status" /></a>
  <img src="https://img.shields.io/badge/Encryption-AES--256--GCM-blue?style=flat-square&logo=letsencrypt" alt="AES-256-GCM Encryption" />
  <img src="https://img.shields.io/badge/Platforms-Windows%20%7C%20macOS%20%7C%20Linux%20%7C%20Android%20%7C%20iOS-indigo?style=flat-square" alt="Platforms Supported" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="MIT License" />
</p>

---

## 🌟 Features

- 🔒 **End-to-End AES-256-GCM Encryption**: Payloads are encrypted locally before transmission—no plain text ever touches the network.
- 📡 **100% Private Local P2P Sync**: Operates strictly within your local Wi-Fi network with zero cloud dependencies or remote server tracking.
- 🖼️ **Branded Windows Setup Installer**: Includes a custom NSIS setup wizard (`CendrosyncP2P-Setup.exe`) that automatically configures Windows Defender Firewall rules during installation.
- 🔔 **Non-Intrusive Micro-Popups**: Bottom-right desktop notifications with a 4-second auto-dismiss timer, hover-pause logic, and zero focus stealing.
- 📱 **Native Android Experience**:
  - Crisp, un-cropped adaptive app launcher icon.
  - Single-tap **"Connect"** keyboard persistence.
  - Persistent notification shade quick action (**"⚡ Beam to PC"**).
  - Android **Share Sheet** integration ("Highlight text → Share → CendrosyncP2P").
- ⚙️ **System Tray Control Center**: Right-click tray menu with quick access to the Control Center and instant exit option.
- 🔍 **Resilient Auto-Discovery**: Smart 32-IP batch subnet scanner automatically locates paired devices even after router IP re-assignments.

---

## 📦 Download Installers

| Platform | Installer Binary | Description |
| :--- | :--- | :--- |
| **🪟 Windows** | `CendrosyncP2P-Setup.exe` | Custom NSIS Setup Wizard (Auto Firewall Configuration) |
| **🪟 Windows (Portable)** | `CendrosyncP2P-Portable.exe` | Standalone Portable Executable |
| **🍏 macOS** | `CendrosyncP2P.dmg` | macOS Installer Disk Image |
| **🐧 Linux** | `CendrosyncP2P.deb` / `.AppImage` | Debian package / Portable AppImage |
| **🤖 Android** | `CendrosyncP2P-Android.apk` | Android Application Package (~21.8 MB) |
| **📱 iOS** | `CendrosyncP2P-iOS.zip` | iOS App Archive |

👉 **[Download Latest Releases](https://github.com/CendroSync/Executables/releases)**

---

## 🚀 Quick Start & Pairing Guide

### 1. Connect to local Wi-Fi
Ensure your PC/laptop and mobile phone are connected to the same local Wi-Fi network.

### 2. Launch CendrosyncP2P
- **Windows / Desktop**: Run `CendrosyncP2P-Setup.exe`. The Control Center will open displaying your **6-character Pairing Code** (e.g. `F0NMDQ`).
- **Android**: Open the CendrosyncP2P app. Your phone's unique pairing code will be displayed at the top.

### 3. Pair Devices (One-Time)
- On Android, enter your PC's Pairing Code into the **"Pairing Code"** field and tap **Connect** (or tap your discovered PC from the scan list).
- Windows will automatically display a **"📱 Pairing Request"** notification.
- Click **✔️ Accept** in the Windows Control Center. Your devices are now paired for life!

---

## 🛠️ Tech Stack & Architecture

```
+------------------------------------+                    +------------------------------------+
|         Android / iOS App          |                    |       Windows / macOS / Linux      |
|    (React Native / Expo / Node)    |                    |           (Tauri / Rust)           |
+------------------------------------+                    +------------------------------------+
                   |                                                         |
                   +==== Direct Local TCP / HTTP (Port 52431) ===============+
                                AES-256-GCM Encrypted
```

- **Desktop Core**: Built with [Tauri v2](https://tauri.app/) (Rust backend for ultra-low memory usage + HTML5/CSS3 frontend).
- **Mobile Core**: Built with [React Native / Expo](https://expo.dev/) with native Android background services and Share Intent filters.
- **Port**: Listens on TCP port `52431` for local P2P sync & pairing handshakes.

---

## 💻 Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust Toolchain](https://www.rust-lang.org/) (for Desktop builds)
- [JDK 17+](https://adoptium.net/) & Android SDK (for Android APK builds)

### 1. Build Desktop App (Windows / macOS / Linux)
```bash
cd windows-tauri
npm install
npx tauri build
```
The output binary will be compiled into `windows-tauri/target/release/bundle/`.

### 2. Build Android App (APK)
```bash
cd android-expo
npm install
cd android
./gradlew assembleRelease
```
The output APK will be compiled into `android-expo/android/app/build/outputs/apk/release/app-release.apk`.

---

## ⚙️ CI/CD Workflow

This repository includes a multi-platform [GitHub Actions Workflow](.github/workflows/build-all.yml) that automatically compiles, signs, and publishes release binaries across 5 operating systems on every release push:

- `windows-latest` $\rightarrow$ `CendrosyncP2P-Setup.exe` & `CendrosyncP2P-Portable.exe`
- `macos-latest` $\rightarrow$ `CendrosyncP2P.dmg`
- `ubuntu-latest` $\rightarrow$ `CendrosyncP2P.deb` & `CendrosyncP2P.AppImage`
- `ubuntu-latest` $\rightarrow$ `CendrosyncP2P-Android.apk`
- `macos-latest` $\rightarrow$ `CendrosyncP2P-iOS.zip`

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

<p align="center">
  Made with ❤️ by <strong>Cendronyx</strong>
</p>
