# Flux EEG V0.1 architecture

## Current prototype
The V0.1 is a local-first React application. Files remain on the user's device. Import, signal selection, spectral estimation, fitting, and visualization all run in the browser. There is no server-side EEG upload or account system.

## Analysis pipeline
1. Parse delimited text, comments, header names, and sampling-rate hints.
2. Normalize numeric channel arrays and identify O1/O2 labels where present.
3. Slice the selected interval and average selected channels sample-by-sample.
4. Estimate PSD segments with detrending, Hann tapering, and overlapping windows.
5. Run a specparam-compatible fixed-mode spectral fit: robust initial aperiodic fit, iterative Gaussian peak extraction using the configured standard-deviation threshold and bandwidth limits, then a final aperiodic refit after subtracting modeled periodic activity.
6. Derive exponent, offset, full-model R²/RMSE, and the strongest modeled alpha peak.
7. Repeat the fit in moving windows for the temporal exponent view.

## Production path
Move analysis into a Web Worker to keep interaction smooth. For publication workflows, add an optional Python reference service using SciPy and the pinned specparam release. Define a versioned analysis manifest containing source hash, parameters, exclusions, library versions, and outputs. Add MNE-backed EDF/BDF parsing, formal artifact annotations, deterministic fixtures against scipy/specparam, and exportable CSV/JSON reports. Desktop packaging can use Tauri while retaining the same React UI and local-first privacy model.

## Validation plan
Golden fixtures should compare PSD values, exponent/offset, peak parameters, and window timing against scipy.signal.welch plus the current specparam release. Tolerances must be declared per parameter. Every saved result should include fit plots and warnings for insufficient duration, poor R², boundary peaks, and excessive artifacts.

The executable reference harness lives in `reference/`. It pins NumPy, SciPy, and specparam, exports deterministic Flux fixtures, runs the same signals through SciPy/specparam, and emits a parameter-by-parameter JSON validation report. Flux must not claim Python parity unless that report has top-level status `passed`.
