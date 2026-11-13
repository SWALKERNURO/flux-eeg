# Flux EEG desktop

The desktop build packages the existing V0.8 React application in a secured Electron shell. It loads only bundled local files through the privileged `flux-eeg://app` protocol; renderer Node.js integration is disabled, context isolation and sandboxing remain enabled, and non-serial permissions are denied.

## Run locally

```text
npm run desktop
```

## Build the Windows installer

```text
npm run desktop:build
```

The installer is written to `installer-output/Flux-EEG-0.8.0-Setup.exe`. It creates Start menu and optional desktop shortcuts and keeps user data when uninstalled.

## OpenBCI serial access

The Electron session grants Web Serial only to the packaged Flux origin. If multiple serial devices are available, a native chooser asks which device to use. Flux still requires the researcher to select and connect the correct OpenBCI Cyton-compatible device.

## Signing limitation

Local builds are unsigned. Windows SmartScreen may warn users until releases are signed with a trusted Windows code-signing certificate. Do not describe an unsigned build as production-distribution ready.
