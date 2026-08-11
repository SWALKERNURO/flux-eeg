import json, platform, sys
from pathlib import Path

import numpy as np
import scipy
from scipy.signal import welch
import specparam
from specparam import SpectralModel

ROOT = Path(__file__).parent
payload = json.loads((ROOT / "artifacts" / "fixtures.json").read_text())
settings = payload["settings"]
results = []

def scalar(value):
    arr = np.asarray(value, dtype=float).reshape(-1)
    return float(arr[0]) if arr.size else None

for fixture in payload["fixtures"]:
    rate = fixture["sampleRate"]
    signal = np.asarray(fixture["signal"], dtype=float)
    nperseg = fixture["flux"]["nperseg"]
    freq, psd = welch(signal, fs=rate, window="hann", nperseg=nperseg,
                      noverlap=nperseg // 2, nfft=nperseg, detrend="constant",
                      return_onesided=True, scaling="density", average="mean")
    algorithm_settings = {
        "peak_width_limits": tuple(settings["peakWidthLimits"]),
        "max_n_peaks": settings["maxPeaks"],
        "min_peak_height": settings["minPeakHeight"],
        "peak_threshold": settings["peakThreshold"],
    }
    model = SpectralModel(
        aperiodic_mode="fixed", periodic_mode="gaussian",
        algorithm_settings=algorithm_settings,
        metrics=["error_mae", "gof_rsquared"], verbose=False,
    )
    model.fit(freq, psd, settings["frequencyRange"])
    aperiodic = np.asarray(model.get_params("aperiodic"), dtype=float).reshape(-1)
    periodic = np.asarray(model.get_params("periodic"), dtype=float)
    if periodic.ndim == 1 and periodic.size:
        periodic = periodic.reshape(1, -1)
    alpha_rows = periodic[(periodic[:, 0] >= 7) & (periodic[:, 0] <= 14)] if periodic.size else np.empty((0, 3))
    alpha = alpha_rows[np.argmax(alpha_rows[:, 1])] if len(alpha_rows) else None
    metrics = {"error_mae": scalar(model.get_metrics("error")),
               "gof_rsquared": scalar(model.get_metrics("gof"))}
    results.append({
        "id": fixture["definition"]["id"],
        "scipy": {"freq": freq.tolist(), "psd": psd.tolist()},
        "specparam": {
            "offset": float(aperiodic[0]), "exponent": float(aperiodic[-1]),
            "alphaCF": float(alpha[0]) if alpha is not None else 0,
            "alphaPW": float(alpha[1]) if alpha is not None else 0,
            "alphaBW": float(alpha[2]) if alpha is not None else 0,
            "periodic": periodic.tolist() if periodic.size else [],
            "metrics": metrics,
        },
    })

output = {
    "environment": {"python": sys.version, "platform": platform.platform(),
                    "numpy": np.__version__, "scipy": scipy.__version__,
                    "specparam": specparam.__version__},
    "results": results,
}
(ROOT / "artifacts" / "python-reference.json").write_text(json.dumps(output))
print(f"Wrote Python reference results for {len(results)} fixtures.")
