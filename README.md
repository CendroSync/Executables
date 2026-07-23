# ⚡ CendrosyncP2P

> **Instant, encrypted local P2P clipboard synchronization between Desktop (Windows & macOS) and Mobile (Android & iOS).**

CendrosyncP2P allows you to seamlessly share clipboard content across your devices over local Wi-Fi with **zero latency**, **zero cloud dependencies**, and **end-to-end AES-256-GCM encryption**.

---

## ✨ Features

- 🔒 **End-to-End Encryption**: All clipboard payloads are encrypted locally using AES-256-GCM before transmission.
- 📡 **100% Private P2P Transfer**: Operates strictly within your local network—no remote servers or cloud accounts required.
- 🔍 **Automated Subnet Discovery**: Automatically scans and detects paired devices across local `/24` subnets even after IP changes.
- ⚡ **Instant Beaming**:
  - **Desktop (Windows/macOS)**: System tray icon with background clipboard watcher and bottom-right quick sync popups.
  - **Android**: Integrated into the Android **Share Sheet** ("Share → CendrosyncP2P") and persistent **Notification Bar** quick actions.
- 📋 **Clipboard History Log**: Local history management with quick copy and item removal.
- 🌐 **Multi-Platform CI/CD**: Automated builds for Windows (`.exe`), macOS (`.dmg`), Android (`.apk`), and iOS via GitHub Actions.

---

## 🛠️ System Architecture

```
+--------------------------+                      +--------------------------+
|    Android / iOS App     |                      |  Windows / macOS Desktop |
|  (React Native / Expo)   |                      |      (Tauri / Rust)      |
+--------------------------+                      +--------------------------+
             |                                                 |
             | === Direct Local TCP / HTTP (Port 52431) =====> |
             |               AES-256-GCM Encrypted             |
```

- **Desktop Core**: Built with [Tauri](https://tauri.app/) (Rust backend for low memory footprint + HTML5/CSS3 frontend).
- **Mobile Core**: Built with [React Native / Expo](https://expo.dev/) with native Android background services and Share Intent filters.
- **Port**: Listens on TCP port `52431` for local P2P sync & pairing handshakes.

---

## 🚀 Quick Start Guide

### 1. Download Releases
Download pre-compiled release binaries directly from the **[GitHub Actions Artifacts](https://github.com/CendroSync/Executables/actions)** or GitHub Releases tab:
- **Windows**: `cendrosyncP2P.exe` / `CendrosyncP2P_Setup.exe`
- **macOS**: `cendrosyncP2P.dmg`
- **Android**: `cendrosyncP2P.apk`

### 2. Device Pairing
1. Connect your PC and Mobile device to the **same Wi-Fi network**.
2. Open CendrosyncP2P on Desktop to view your **Pairing Code**.
3. Open CendrosyncP2P on Mobile, enter the pairing code (or select auto-discovered device), and tap **Connect**.
4. Accept the pairing prompt on Desktop. Your devices are now paired!

---

## 💻 Building from Source

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Rust](https://www.rust-lang.org/) (for Desktop builds)
- [JDK 17+](https://adoptium.net/) & Android SDK (for Android APK builds)

### Desktop App (Windows / macOS)
```bash
cd windows-tauri
npm install
npx tauri build
```
The compiled executable will be output to `windows-tauri/target/release/`.

### Android Mobile App
```bash
cd android-expo
npm install
cd android
./gradlew assembleRelease
```
The compiled APK will be output to `android-expo/android/app/build/outputs/apk/release/app-release.apk`.

---

## 🤖 CI/CD Workflow

This repository includes a multi-platform [GitHub Actions Workflow](.github/workflows/build-all.yml) that automatically compiles and publishes artifacts on every commit:
- 🪟 `windows-latest` $\rightarrow$ `cendrosyncP2P.exe`
- 🍏 `macos-latest` $\rightarrow$ `cendrosyncP2P.dmg`
- 🤖 `ubuntu-latest` $\rightarrow$ `cendrosyncP2P.apk`
- 📱 `macos-latest` $\rightarrow$ iOS Bundle

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Made with ❤️ by <strong>Cendronyx</strong>
</p>
