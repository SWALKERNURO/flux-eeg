# Flux EEG V0.2 product specification

## Product thesis
Flux EEG turns an OpenBCI recording into an understandable, inspectable comparison of aperiodic 1/f structure without requiring a Brainstorm-to-FOOOF toolchain. The promise remains: drag it in, understand it fast, trust the analysis.

## V0.2 user journey
1. Import a recording and confirm detected metadata.
2. Select channels and a time interval on the shared raw-signal timeline.
3. Save named experimental conditions and mark artifact intervals for exclusion.
4. Analyze a single interval or every saved condition using the same validated defaults.
5. Compare two conditions with effect direction, parameter values, and fit quality visible together.
6. Export either a compact CSV or a reproducible JSON analysis manifest.

## V0.2 scope
- Everything in V0.1: delimited OpenBCI import, raw EEG, interval selection, events, Welch PSD, fixed-mode spectral parameterization, alpha peaks, moving-window exponent, and fit warnings.
- Named condition intervals with reusable timeline selection.
- Artifact intervals visibly marked and excluded from condition analyses.
- PSD aggregation across clean continuous sub-intervals, weighted by contributing Welch segments.
- Side-by-side condition comparison for exponent, offset, R², alpha CF, and alpha PW.
- Conservative difference language that does not imply significance, cause, health, or function.
- CSV results export.
- Versioned JSON manifest containing source metadata, channels, conditions, exclusions, settings, engine, validation provenance, clean intervals, results, and warnings.
- Visible provenance for validation against SciPy 1.14.1 and specparam 2.0.0rc7.

## Trust contract
Raw signals, selections, conditions, exclusions, defaults, model fit, fit warnings, and provenance remain inspectable. Excluded samples are never silently discarded. Condition differences are descriptive; study-level inference requires repeated observations and an appropriate statistical model.

## Deliberate V0.2 limits
- Conditions currently contain one contiguous source interval each; artifact exclusion can split them into multiple clean analysis intervals.
- No automatic artifact classifier, ICA, bad-channel interpolation, filtering pipeline, batch statistics, or clinical interpretation.
- EDF/BDF and installable desktop packaging remain V0.3 candidates.
- Browser exports are local downloads; there is no cloud storage or account system.

## Acceptance criteria
- A user can create and recall named conditions from the shared timeline.
- An excluded interval is visibly distinct and omitted from analysis.
- Two conditions can be analyzed and compared without leaving the screen.
- Exported values match visible values and the manifest includes complete reproducibility metadata.
- Existing numerical validation and application tests continue to pass.
