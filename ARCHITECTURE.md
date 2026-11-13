# Flux EEG V0.8 architecture

## Runtime

Flux EEG is a local-first React application. Import, hashing, preprocessing, quality screening, interval handling, experiment timing and recording, spectral estimation, fitting, moving-window dynamics, study aggregation, live packet decoding, interpretation, serialization, figures, and reports run in the browser. EEG samples are not uploaded to a server.

## Analysis pipeline

1. `import.js` parses delimited OpenBCI text, sampling-rate hints, channel labels, and marker transitions.
2. `preprocess.js` preserves raw arrays and creates derived arrays with optional detrending, notch, bandpass, and referencing. It also screens channels and proposes reviewable artifact intervals.
3. `analysis.js` computes Welch PSD, robust fixed-mode aperiodic fits, Gaussian peaks, exponent, offset, R², RMSE, alpha parameters, and confidence inputs.
4. `dynamics.js` quality-gates moving-window summaries and change points.
5. `study.js` stores participant/session/condition observations, reduces repeats to participant means, and calculates paired descriptive summaries and Cohen's dz.
6. `live.js` decodes Cyton packets, manages Web Serial or simulation, buffers live samples, and periodically reuses the analysis core.
7. `experiment.js` normalizes protocol phases, builds deterministic phase timelines and markers, owns experiment-run state, converts captured CH7/CH8 samples into O1/O2 recordings, and generates raw CSV exports.
8. `interpretation.js` transforms quality-gated results into Observed, Bounded neuroscience, and Conceptual prompt layers.
9. `validation.js` exposes pinned reference evidence and runs a deterministic analytic self-check.
10. `project.js` serializes the V0.8 project state, including study and completed Experiment state, and reads V0.3/V0.4/V0.7 legacy projects.
11. `export.js` generates result CSV, manifest, methods, HTML report, and high-resolution PNG outputs; mode modules add study CSV/JSON, Experiment raw/session exports, and interpretation-note exports.

## State and UI

`App.jsx` owns the recording, preprocessing configuration, conditions, analysis results, experiment protocol/run, study, live session, and selected interpretation lens. `modes.jsx` contains the V0.5–V0.8 workspaces and inspector panels. Canvas plots remain dependency-light and deterministic. The left rail is a grouped mode switcher: four analysis modes and four independent research modes share one visual language and trust surface.

## Experiment data path

Editable protocol → normalized phase timeline → simulator or Cyton stream → shared live packet decoder → uncapped CH7/CH8 experiment buffer → automatic phase markers → local O1/O2 recording → selected analysis-phase intervals → trusted offline Welch/fitting pass → reviewed condition results → explicit Study observation. The rolling Live display may be used during acquisition, but only the offline pass creates a study-ready record.

The experiment clock is synchronized from elapsed wall time rather than chained per-phase timers. Early stop clips the recording and marker list to the actual endpoint. A completed run retains raw arrays in memory and in V0.8 project/session JSON; CSV export writes time, O1, O2, phase, and marker fields without sending data to a server.

## Live data path

`navigator.serial.requestPort()` → Cyton byte stream → packet parser → signed 24-bit channel samples → rolling sample buffer → periodic Welch/fitting pass → quality-gated metrics and event-marked plot. Disconnect and stop commands release the reader and port. The simulator follows the same downstream path.

## Study data path

OpenBCI files → common preprocessing/interval settings → one analysis result per requested condition → observation records → session averaging within participant → complete paired participants → delta, Cohen's dz, and approximate t-based 95% interval. Raw recordings remain separate from the compact study summary.

## Interpretation boundary

Interpretation receives numerical results and reliability flags, never raw samples. It can describe observed changes, state bounded spectral interpretations, and generate conceptual questions. It cannot promote a low-quality fit, label a concept as a neural variable, or convert association into causation.

## Reference validation

The executable harness in `reference/` pins NumPy 2.1.3, SciPy 1.14.1, and specparam 2.0.0rc7. Three deterministic fixtures compare normalized Welch PSD and spectral parameters using declared tolerances. The claim is limited to the Welch and fitting core, included fixtures, pinned versions, and documented tolerances.

## Production path

Long recordings should move preprocessing, Welch, study batch work, and live fitting into Web Workers. Hardware coverage can expand through BrainFlow adapters. A publication workflow can add hierarchical/mixed-effects models and an optional local MNE/specparam companion while preserving the same versioned trust manifest.
