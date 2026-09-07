CAPTION CANVAS FIX — PLAYWRIGHT TEST

Objective: Verify the caption layer is fully inside the visible video rectangle.

Test steps (manual or with existing playwright_e2e.cjs):
1. Open app at localhost:5173, auth, navigate to studio.
2. Upload dummy_with_audio.mp4.
3. Click Generate Captions → wait for style selection.
4. Select any template (e.g., SERIF BLOOM).
5. Inspect via Playwright evaluate:
   - Get preview container rect (`containerRef` element via querySelector)
   - Get video rect (`video` element `getBoundingClientRect()`)
   - Compute visible video rect (using same logic as computeVideoRect)
   - Get caption layer rect (inner div in VideoCompositionFrame)
6. Assert: caption layer `left` ≈ visible video `left`, `top` ≈ visible video `top`, `width` ≈ visible video `width`, `height` ≈ visible video `height` (within 2px).
7. Assert: no caption text elements (`motion.span` elements) have bounding boxes extending outside the caption layer rect.
8. Resize browser to 800x600; repeat assertions.

PASS: All assertions true.
FAIL: Any caption pixel outside visible video rect.
