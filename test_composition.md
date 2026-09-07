PHASE COMPLETION REPORT — ACTUAL REPO ONLY

INSPECTED FILES (verified not reconstructed): composited-preview.tsx (233 lines, videoRect computed, VideoCompositionFrame implemented), caption-engine.tsx (240 lines after patch, props updated), templates.ts, types.ts, studio-workflow.tsx (upload/auth preserved), composited-preview existing architecture preserved.

ACTUAL BUG: CaptionEngine props (`compositionWidth`, `compositionHeight`, `scale`) existed in composited-preview call but were not declared/used in CaptionEngine definition; font size used absolute `baseSize` px; animation transforms used fixed 50px offsets.

CHANGES MADE (minimal, no unrelated systems changed):
- caption-engine.tsx: Added props to interface and function signature. Applied scale to fontSize (`baseSize * scale * height/1920`). Applied `videoScale` to animation offset values (`50 * videoScale`, `20 * videoScale`) and blur. Passed `videoScale` to `AnimatedWord`.
- composited-preview.tsx already has `computeVideoRect`, `VideoCompositionFrame` wrapper with `overflow: hidden`, absolute positioned over visible video rect; no change needed.
- No changes to auth (auth.js), credits (credits.js), upload limit (200MB in studio-workflow.tsx), transcription, render/job/download flow.
- No framework change. No SQLite change. No new dependency.

CLIPPING: `overflow: hidden` on VideoCompositionFrame (line 200 of composited-preview.tsx) ensures caption content clipped to visible video.
COORDINATE SYSTEM: Caption layer is inside VideoCompositionFrame (`left: videoRect.left`, `top: videoRect.top`, exact visible dimensions) — confirmed by source inspection.
RESPONSIVE: `ResizeObserver` updates `videoRect`; caption layer updates accordingly. Typography scales with `compositionHeight`.
BEHIND-SUBJECT: Canvas mask (`canvasRef`) positioned inside same VideoCompositionFrame; depth enabled for `mixed`/`behind-subject` (existing logic preserved).

TEST FILES ADDED:
- `C:/Captions AI/caption-app/caption-app/test_composition_frame.cjs` — Playwright assertion plan.
- `C:/Captions AI/caption-app/caption-app/client/src/components/captions/test_composition.md` — manual verification instructions.

SECURITY: No auth/upload/download changes; no new endpoints; temporary uploads preserved; download requires JWT (existing behavior preserved). Strix not needed since no new server code added.

REGRESSION: Existing upload/auth/transcribe/edit/render/download preserved. No automatic render. Credits only deducted on explicit render (existing JobEngine preserved).

LIMITATIONS:
- `CaptionEngine` uses React `motion.span` with `transformOrigin: 'center bottom'`. If animation still exceeds frame, `overflow: hidden` clips it — but the coordinate fix (scale applied) should prevent overflow.
- The `VideoCompositionFrame` uses `ResizeObserver`; in very rapid resize cycles the caption layer may briefly lag 1 frame. Acceptable for this phase.
- Full Playwright execution not performed in this session (requires running server + browser); test file added for execution.

KILL CRITERIA (if this fix fails): If Playwright test shows caption still outside visible video rect after this change, the root cause may be in the `CaptionEngine` parent container's `flex` layout (line 207 `flex flex-col`) rather than the absolute wrapper. That can be fixed by changing the inner caption container to `absolute inset-0` relative to VideoCompositionFrame (already the case for the parent `div` with `inset: 0` inside VideoCompositionFrame — the caption layer is inside that parent, so absolute inset-0 within it spans the video frame, which is correct). If `getPositionClass()` pushes content with `pt-12` etc. beyond frame, the `overflow: hidden` on VideoCompositionFrame handles it.
