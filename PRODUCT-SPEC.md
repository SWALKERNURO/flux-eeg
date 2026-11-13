# Flux EEG V0.8 product specification

Flux EEG is a local-first, opinionated EEG research workspace for seeing, cleaning, comparing, and interpreting aperiodic 1/f dynamics without a Brainstorm-plus-manual-specparam workflow.

## Product promise

Drag it in. Understand it fast. Trust the analysis because the signal, cleaning decisions, model fit, provenance, validation limits, and interpretive boundaries remain visible.

## Core research loop

1. Import OpenBCI CSV, TSV, or TXT data, open a Flux project, or use the demonstration recording.
2. Confirm metadata, source identity, events, and automatic channel-quality screening.
3. Review raw versus cleaned signals and explicitly accept any suggested artifact intervals.
4. Select channels and intervals; create, rename, resize, or remove conditions.
5. Run Welch PSD plus a fixed-mode specparam-compatible decomposition.
6. Inspect exponent, offset, R², RMSE, alpha CF/PW/BW, confidence, warnings, condition comparisons, and moving-window dynamics.
7. Run a timed experiment, move observations into Study, monitor a Live session, or open Interpretation without leaving the same trusted workspace.

## Navigation model

The left rail is mode navigation, not a progress tracker. Analyze, Compare, Dynamics, and Trust form the core analysis workspace. Experiment, Study, Live, and Interpret are independent research modes. Researchers can switch directly between any mode; no numbered completion order is implied.

## V0.8 Experiment Mode

- Define participant and session identity plus an editable sequence of named, timed phases and participant instructions.
- Mark which phases should become analysis conditions; every phase boundary is written automatically as an event marker.
- Rehearse the complete protocol with a simulator or connect directly to an OpenBCI Cyton-compatible Web Serial stream.
- Record CH7 and CH8 continuously as local O1/O2 data while showing the active prompt, countdown, posterior traces, marker count, and sample count.
- Stop safely at any time or complete automatically at the planned endpoint; preserve the raw recording and clipped marker timeline.
- Export raw CSV with marker columns or a portable session JSON before analysis.
- Run the trusted offline Welch/fixed-mode fitting pipeline on analysis phases, review condition fit results, and explicitly add the participant record to Study Mode.
- Treat the simulator as protocol rehearsal and engineering verification, never as evidence that hardware acquisition or neuroscience validity has been established.

## V0.5 Study Mode

- Import multiple OpenBCI recordings into a study or add the current recording's condition results.
- Organize observations by participant, session, and condition while preserving source names and fit quality.
- Collapse repeat sessions to participant-level condition means before paired comparison.
- Report condition means, paired mean change, Cohen's dz, approximate 95% confidence interval, and participant-level plots.
- Keep unmatched participants visible in the study but exclude them from paired estimates.
- Export a tidy study CSV or a portable JSON study/project file.

## V0.6 Live Mode

- Connect to an OpenBCI Cyton-compatible stream through Web Serial at 115200 baud, or use the built-in simulator.
- Decode 33-byte, eight-channel Cyton packets and preserve CH7/CH8 traces for the live display.
- Update rolling Welch/specparam-compatible estimates without blocking the interface.
- Show the current exponent, fit R², alpha center frequency, reliable-window count, and the rolling exponent trajectory.
- Add experiment events while streaming and keep weak-fit windows visible without treating them as reliable evidence.
- Make it explicit that Live Mode is descriptive research feedback, not a neurofeedback or medical device.

## V0.7 Interpretation Mode

- Separate every output into three layers: observed pattern, bounded neuroscience statement, and philosophical prompt.
- Quality-gate interpretive language using fit reliability and require paired evidence before discussing condition change.
- Offer Flow, Fold, and Field as optional conceptual lenses for reflection, never as measured neural variables.
- Relate exponent shifts, alpha-peak changes, and reliable temporal transitions to carefully worded prompts rather than causal claims.
- Cite the conceptual framework in-product and export a methods-aware interpretation note with its guardrails intact.

## Trust contract

- Raw data are never overwritten; cleaning produces an inspectable derived signal.
- Automatic quality checks are screening aids, not clinical artifact classifiers.
- Nothing suggested by automation is excluded until the researcher applies it.
- A common-average reference is not applied to fewer than three available EEG channels.
- Short, poorly fitted, or questionable results remain visible with explicit confidence warnings.
- Dynamics transitions and interpretive summaries require adjacent windows with R² ≥ 0.90.
- Experiment markers and prompts improve protocol consistency but do not replace researcher supervision, consent, impedance/contact checks, or protocol-deviation notes.
- Live estimates remain provisional; Experiment observations must pass the offline analysis and review step before they can be added to Study Mode.
- Study statistics are descriptive and exploratory; V0.8 does not perform null-hypothesis tests or infer causation.
- Reference validation applies only to declared deterministic fixtures, pinned versions, and tolerances.
- Nail's concepts guide questions asked of the data; Flux does not claim that EEG directly measures flow, fold, or field.
- Results are research outputs—not diagnosis, treatment, neurofeedback, statistical proof, causation, or philosophical proof.

## Deliberate limits

- CSV/TSV/TXT input only; EDF/BDF remain future work.
- Browser preprocessing is intentionally lightweight and does not replace MNE/EEGLAB for clinical pipelines.
- No ICA, ASR, automated component labeling, mixed-effects models, or confirmatory hypothesis tests.
- Direct hardware support targets Cyton-compatible serial packets; Ganglion, WiFi Shield, and BrainFlow adapters remain future work.
- Experiment Mode records a browser session locally; it does not yet provide encrypted subject management, lab-wide synchronization, hardware impedance measurement, or operating-system-level acquisition guarantees.
- Project files embed the recording and study for portability and may be large.

## Definition of done

- Unit, hosting, and production-build checks pass.
- Experiment rehearsal, automatic markers, offline condition analysis, Study handoff, Live simulator, Interpretation, project persistence, exports, and prior trust features remain functional.
- Browser console contains no errors or warnings in the verified paths.
- Desktop, tablet, and mobile layouts preserve usable controls and readable results.
- Visual QA against the selected Option 3 direction ends with `final result: passed`.
