# Flux EEG V0.4 design QA

## Evidence

- Source visual truth: `source-option-3.png`
- Browser-rendered implementation: `implementation-v0.4-trust.png`
- Additional analyzed state: `implementation-v0.4.png`
- Full-view comparison: `design-comparison-v0.4.png`
- Focused inspector comparison: `design-comparison-v0.4-trust-focus.png`
- Browser viewport: 1440 × 1024 CSS px
- Device scale factor: 1
- Source pixels: 1488 × 1058; normalized to 1440 × 1024 for comparison
- Implementation pixels: 1440 × 1024
- State: demo recording, O1 + O2 selected, 1:00–3:00 interval, cleaned preview, one reviewed artifact exclusion, self-check passed, Trust tab open, condition analysis and dynamics already run

## Findings

No actionable P0, P1, or P2 mismatch remains.

- Information architecture: the source's three-column guided-analysis structure remains intact. V0.4 intentionally adds a fourth Trust step and a fourth inspector tab without changing the established hierarchy.
- Fonts and typography: Manrope display labels and Inter interface text preserve the compact technical hierarchy, optical weight, wrapping, and small-label treatment of the source. No clipping or unreadable truncation is visible at the target viewport.
- Spacing and layout rhythm: left workflow rail, central signal workspace, and sticky right inspector retain the source proportions and vertical rhythm. New trust controls use the existing dividers, row density, radii, and padding.
- Colors and visual tokens: navy surfaces, cyan signals, violet selections, lime success, gold caution, and red artifact states match the selected direction and remain semantically consistent.
- Image quality and asset fidelity: the UI uses native canvas data visualizations at browser density. Signal traces, dynamics, selection regions, and artifact markers are sharp and correctly aligned. No source imagery or non-standard visual asset was replaced by a placeholder or code-drawn decorative substitute.
- Copy and content: V0.4 replaces the source's unqualified healthy-adult interpretation with explicit confidence, validation-domain, and descriptive-research language. This is an intentional trust improvement, not drift.
- Responsiveness and overflow: the desktop target has no horizontal overflow. The inspector scrolls independently, keeping the tab switcher and research controls usable.
- Accessibility: primary controls have semantic roles or labels, keyboard focus styling, selected states, disabled states, and readable contrast.

## Focused comparison

The right-inspector comparison confirms the new Trust view follows the source inspector's anatomy: recording metadata, channel selection, divider rhythm, primary status color, dense technical rows, and chart-adjacent research context. The content difference is intentional because the selected state is Trust rather than Results.

## Interaction verification

- Switched between raw and cleaned signal previews.
- Opened Trust and changed no hidden state unexpectedly.
- Detected one demonstration artifact, applied it only after review, and confirmed it disappeared from pending suggestions.
- Ran the built-in analytic self-check and observed a passing exponent and alpha result.
- Ran the current selection and confirmed low-fit results received a 55/100 Low confidence assessment rather than a trust claim.
- Analyzed both conditions and confirmed the two-row comparison.
- Opened Dynamics and confirmed 0/57 weak windows produced no transition claims.
- Confirmed the publication-figure export becomes enabled after analysis.
- Browser console errors and warnings: none.

## Comparison history

- Initial V0.4 browser capture preserved the selected Option 3 composition and introduced no P0/P1/P2 visual mismatch.
- Before final capture, trust copy was narrowed to the validated Welch-and-fit core and the preprocessing passband was moved outside the 1–45 Hz fit range. These were scientific-trust corrections rather than visual-fidelity fixes.
- Final full-view and focused comparisons show no actionable P0/P1/P2 issue.

## Follow-up polish

- P3: a future study-mode release could offer a collapsible inspector summary so export controls remain above the fold on shorter displays.

## Final result

final result: passed

---

# Flux EEG V0.8 Experiment Mode design QA

## Evidence

- Source visual truth: `source-option-3.png`
- Browser-rendered setup: `implementation-v0.8-experiment-setup.png`
- Browser-rendered running state: `implementation-v0.8-experiment-running.png`
- Browser-rendered analyzed state: `implementation-v0.8-experiment-complete.png`
- Full-view comparison: `design-comparison-v0.8.png`
- Desktop viewport: 1440 × 1024 CSS px at density 1
- Responsive checks: 820 × 1180 and 390 × 844 CSS px at density 1
- Source pixels: 1487 × 1058, proportionally normalized to 1440 × 1024 in the comparison
- Implementation pixels: 1440 × 1024
- Compared state: dark desktop workspace, quick demonstration protocol, Experiment selected, editable four-phase setup

## Findings

No actionable P0, P1, or P2 finding remains.

- Information architecture: the source's persistent left rail, central research workspace, and dense right inspector remain intact. Experiment is intentionally presented as a peer Research mode rather than restoring the source's numbered-step implication.
- Fonts and typography: Manrope headings and Inter interface text preserve the source's compact hierarchy, weights, label scale, line height, and muted-caption treatment. Long participant instructions remain editable and scroll within their text fields rather than breaking the inspector grid.
- Spacing and layout rhythm: the 190 px rail, flexible center, 390 px inspector, one-pixel dividers, square technical cards, and compact vertical gaps remain aligned with the selected direction. Setup, running, and analyzed states keep the primary action in the inspector and evidence in the center.
- Colors and tokens: navy surfaces, violet selected/research actions, cyan signal accents, lime successful fits, gold cautions, and muted blue-gray text reuse the established semantic palette. Ready, running, captured, analyzed, disabled, warning, and focus states are distinct.
- Image quality and asset fidelity: the source contains quantitative traces rather than decorative imagery. Experiment uses the existing sharp canvas signal renderer and native UI surfaces; no logo, illustration, non-standard icon, or image asset was replaced with a placeholder or CSS drawing.
- Copy and content: protocol instructions, automatic-marker language, local-storage language, offline-analysis gating, simulator limitations, researcher checks, and Study inclusion warnings stand alone without overstating hardware or neuroscience validation.
- Behavior and accessibility: participant/session/protocol fields, phase names, durations, analyze flags, presets, start/stop, exports, analysis, and Study handoff are semantic controls with visible focus, selected, disabled, and status states.
- Responsiveness: the Experiment layout has no horizontal page overflow at desktop, tablet, or mobile widths. At 390 px, the two navigation groups become two-column button grids and the session inspector precedes the long workspace content.

## Full-view and focused comparison

The native-size full-view composite preserves enough resolution to inspect the rail, hierarchy, timeline, inspector anatomy, typography, tokens, controls, and copy together. A separate focused crop was not necessary because the comparison is already 2880 × 1072 pixels and the V0.8 change is a workflow/state extension rather than a small icon, illustration, or typographic-detail replacement.

## Interaction verification

- Entered participant `P09` and session `Pilot 01`, selected the 14-second quick protocol, and started the simulator.
- Observed timed prompt advancement, phase countdown, rolling CH7/CH8 traces, marker count, and sample count while running.
- Completed four phases automatically with four markers and 3,500 samples per channel.
- Ran offline analysis and received Eyes open and Eyes closed exponent, R², and alpha-frequency results.
- Added the participant to Study Mode and verified one participant, one recording, two conditions, and one complete paired observation.
- Verified zero horizontal page overflow at 820 px and 390 px widths.
- Browser console errors and warnings: none.

## Comparison history

- Initial V0.8 setup capture preserved the source composition but exposed a visible horizontal scrollbar beneath the four-phase timeline, a P2 polish mismatch at the target desktop viewport.
- Fix: retained horizontal timeline scrolling for longer protocols while hiding the browser scrollbar through cross-browser scrollbar styling.
- Post-fix evidence: `implementation-v0.8-experiment-setup.png` and `design-comparison-v0.8.png` show an uninterrupted timeline and clean center-panel rhythm with no clipped content.

## Follow-up polish

- P3: a future desktop release could add optional protocol templates and researcher-authored deviation notes without changing the core three-stage Prepare → Run → Analyze journey.

## Final result

final result: passed

---

# Flux EEG V0.7 mode-navigation QA

## Evidence

- Source visual truth: `source-option-3.png`
- Rendered implementation: `implementation-v0.7-mode-nav.png`
- Mobile rail: `implementation-v0.7-mode-nav-mobile-rail.png`
- Full comparison: `design-comparison-v0.7-mode-nav.png`
- Focused rail comparison: `design-comparison-v0.7-mode-nav-focus.png`
- Desktop implementation capture: 1280 × 720 CSS px at density 1
- Source normalization: center-cropped from 1488 × 1058 to 16:9, then resized to 1280 × 720
- Mobile check: 375 px CSS content width; rail crop 375 × 389; zero horizontal overflow
- State: demo recording, Analyze selected

## Findings

No actionable P0, P1, or P2 issue remains.

- Information architecture: the reference's numbered progress tracker was intentionally replaced after user feedback because it falsely implied a required order. The final rail uses two explicit groups—Analysis and Research modes—and every entry is a direct button.
- Typography: Manrope labels and Inter captions retain the compact technical hierarchy. Group headings use small uppercase labels with sufficient separation; no desktop or mobile truncation is visible.
- Spacing and layout: the selected mode receives a contained surface and left accent without changing the established 190 px rail proportion. The research-mode divider creates a clear semantic break.
- Colors and tokens: cyan identifies the selected analysis mode; violet identifies the research-mode group and its selected state. Existing navy, muted text, and focus colors are preserved.
- Image quality: this navigation contains no imagery or icon assets. No placeholder, CSS illustration, custom SVG, or text-glyph icon was introduced.
- Copy: labels describe destinations rather than completion states: “Selection and fit,” “Conditions side by side,” “Participants and effects,” and similar.
- Accessibility and behavior: the rail is a labeled `nav`, every destination is a semantic button, keyboard focus remains visible, and the current mode exposes a selected visual state.
- Responsiveness: at phone width the two groups become compact button grids, the seven modes remain visible without horizontal scrolling, and file/project actions remain separate below them.

## Interaction verification

- Switched through Analyze, Compare, Dynamics, Trust, Study, Live, Interpret, and back to Analyze.
- Confirmed each clicked destination received the selected state.
- Removed the duplicate seven-tab switcher from the right inspector.
- Verified zero horizontal overflow at 375 px.

## Comparison history

- Initial state: numbered circles and connecting lines made the seven destinations appear sequential.
- Fix: replaced the tracker with grouped mode buttons and removed duplicate inspector navigation.
- Post-fix evidence: the focused comparison clearly distinguishes the former “Sequential steps” model from the final “Grouped modes” model.

## Final result

final result: passed

---

# Flux EEG V0.7 design QA

## Evidence

- Source visual truth: `source-option-3.png`
- Study implementation: `implementation-v0.7-study.png`
- Live implementation: `implementation-v0.7-live.png`
- Interpretation implementation: `implementation-v0.7-interpretation.png`
- Full comparison: `design-comparison-v0.7.png`
- Focused comparison: `design-comparison-v0.7-focus.png`
- Desktop viewport: 1440 × 1024 CSS px; responsive checks: 1024 × 768 and 390 × 844

## Findings and fixes

- Information architecture: V0.7 preserves the source's guided left rail, analytical canvas, and dense right inspector. Study, Live, and Interpret extend the rail and reuse the established tab, status, divider, and action patterns.
- Typography: compact Manrope headings and Inter interface text remain visually aligned with the source. Long explanatory copy wraps within its cards at all verified widths.
- Layout and spacing: desktop proportions match the selected direction. An initial tablet/mobile pass exposed a fixed 1180 px canvas; the final responsive rules now stack the inspector under the workspace at tablet width and place navigation/control panels before content on phones. Verified horizontal overflow is zero at 1024 and 390 px.
- Colors and states: cyan data, lime reliable status, gold caution, red stop/artifact, and violet conceptual actions remain semantically distinct. Focus, selected, disabled, streaming, limited-evidence, and empty states are visible.
- Charts: Study participant pairs, Live posterior traces, rolling exponent, and the original analysis canvases render sharply without label collisions. Participant IDs were removed from the plot body after an early overlap finding; identities remain available in the adjacent records list.
- Content: Study statistics are labeled descriptive; Live estimates are marked provisional; Interpretation separates observed, bounded, and conceptual layers and withholds claims below R² 0.90.
- Accessibility: mode controls are semantic buttons, inputs carry labels, keyboard focus is high contrast, and all primary mobile targets are at least 38 px tall.
- Assets and shortcuts: no decorative placeholders, fake imagery, custom SVG substitutions, or generic hero art were introduced. Canvas is used only for quantitative data visualization.

## Interaction verification

- Loaded the eight-participant demo study and confirmed 8 complete pairs, mean change +0.28, Cohen's dz 1.01, and the approximate 95% interval.
- Started the Cyton simulator and observed CH7/CH8 traces, exponent updates, alpha frequency, fit quality, and reliable-window counts through the same rolling analysis path.
- Ran both demo conditions, opened Interpretation, switched from Flow to Fold, and confirmed that weak fits automatically withheld condition-level and neuroscience claims.
- Verified 30 automated checks, production output, Sites packaging, and a clean browser console.

## Final result

No actionable P0, P1, or P2 finding remains.

final result: passed
