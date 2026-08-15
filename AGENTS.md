# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Durable product decision: use a specparam-compatible fixed-mode decomposition with explicit settings, modeled periodic peaks, fit diagnostics, validation fixtures, and conservative interpretation. Never hide poor-fit or boundary warnings.

V0.3 trust decision: Dynamics may plot low-quality moving-window estimates for inspection, but it must not label transitions, compute summary statistics, or imply stability from windows below R² 0.90. Excluded windows remain absent rather than interpolated.

V0.4 trust decision: preserve raw arrays; preprocessing creates derived arrays. Automatic artifact intervals are suggestions until explicitly applied. Confidence must reflect clean duration, Welch segments, model fit, fit error, and channel quality. Reference-parity language must be limited to the pinned Welch and fitting fixtures.

V0.5 study decision: reduce repeated sessions to participant-level condition means before paired summaries. Report paired coverage, mean change, Cohen's dz, and an approximate 95% confidence interval as descriptive exploratory outputs; never imply a confirmatory test.

V0.6 live decision: treat Web Serial and simulation as two inputs to the same rolling analysis path. Weak-fit windows remain visible but do not count as reliable. Live Mode is not neurofeedback or a medical device.

V0.7 interpretation decision: always separate observed data, bounded neuroscience, and conceptual prompt. Flow, fold, and field are philosophical lenses—not neural measures—and low-quality or unpaired evidence must limit the language automatically.

V0.7 navigation decision: the left rail represents peer modes, not a required numbered sequence. Group Analyze, Compare, Dynamics, and Trust under Analysis; group Experiment, Study, Live, and Interpret under Research modes. Keep mode switching in the rail and do not duplicate the same navigation in the inspector.

V0.8 experiment decision: Experiment is a peer Research mode, placed before Study. A protocol owns participant/session identity, named timed phases, participant instructions, and explicit analyze flags. Every phase boundary becomes an automatic event marker and raw posterior samples remain local and exportable.

V0.8 acquisition decision: the simulator is for protocol rehearsal and engineering verification, not neuroscience validation. Live values are provisional; only the trusted offline Welch/fixed-mode fit may create condition observations, and the researcher must explicitly add reviewed results to Study Mode.

V0.8 safety decision: timed prompts and markers do not replace researcher supervision, consent, signal/contact checks, participant-comfort monitoring, or protocol-deviation notes. Preserve early-stop recordings and never imply that a completed run is automatically a valid observation.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.
