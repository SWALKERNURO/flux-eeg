# Python reference validation

This harness compares Flux EEG against pinned SciPy and specparam versions using three deterministic signals. It treats SciPy's normalized Welch PSD as the PSD reference and specparam's fixed/gaussian `SpectralModel` as the parameter reference.

## Pinned environment

- Python 3.12+
- NumPy 2.1.3
- SciPy 1.14.1
- specparam 2.0.0rc7

## Reproduce

1. Create an isolated Python environment and install `requirements.lock.txt`.
2. Run `node generate-fixtures.mjs`.
3. Run `python run-reference.py`.
4. Run `node compare-results.mjs`.

The final artifact is `artifacts/validation-report.json`. A comparison is not validated until this file exists and its top-level `status` is `passed`.

## Declared tolerances

PSD is expected to match SciPy to `1e-7` maximum relative error because both paths use the same detrending, periodic Hann window, segment size, overlap, density scaling, and one-sided correction. Parameter tolerances are wider because Flux uses a lightweight compatible peak optimizer rather than SciPy's nonlinear optimizer: exponent ±0.15, offset ±0.20, alpha CF ±0.5 Hz, alpha PW ±0.35 log10 power, and alpha BW ±1.5 Hz.
