# Flux EEG

Flux EEG is a local-first research application for inspecting EEG recordings, decomposing power spectra, and making 1/f dynamics easier to understand without a Brainstorm-to-FOOOF toolchain.

It supports OpenBCI-style imports, raw signal review, channel and interval selection, Welch power spectra, fixed-mode aperiodic fitting, alpha peak metrics, moving-window dynamics, event markers, guided experiments, participant-level study summaries, live OpenBCI acquisition, and deliberately bounded conceptual interpretation.

## Product promise

**Drag it in. Understand it fast. Trust the analysis.**

Flux keeps opinionated defaults visible, preserves raw data, warns when model fits are weak, and separates empirical observations from interpretive prompts. It is a research prototype, not a medical device or diagnostic system.

## Run the web app

```text
npm install
npm run dev
```

## Run or package the Windows app

```text
npm run desktop
npm run desktop:build
```

The installer is created at `installer-output/Flux-EEG-0.8.0-Setup.exe`. See [DESKTOP.md](DESKTOP.md) for serial-device and signing details.

## Verify the project

```text
npm test
npm run test:sites
npm run desktop:test
```

The analysis implementation and trust boundaries are documented in [ARCHITECTURE.md](ARCHITECTURE.md), while the product scope is recorded in [PRODUCT-SPEC.md](PRODUCT-SPEC.md).
