# Motion Subtitle — Product Requirements Document (PRD)

## 1. Product Overview
Motion Subtitle is a premium video caption and kinetic typography editor. Unlike generic subtitle generators that simply overlay static or gently fading text, Motion Subtitle treats every word as a dynamic, editable element driven by designed typography systems. The product spans a full marketing presence and an in-browser studio experience.

## 2. Product Goal
To provide a complete, polished, caption-first video editing product that allows creators to produce visually stunning, word-timed captions (kinetic typography) without using complex desktop software like Adobe After Effects. The output must look premium, editorial, and intentionally designed.

## 3. Target Users
- Video Editors & Content Creators focusing on social-first formats (TikTok, Reels, Shorts).
- Marketing Teams needing high-fidelity, branded kinetic typography.
- Agencies and Freelancers seeking a faster workflow for premium captions.

## 4. Core Value Proposition
- **Word-Level Captions**: Every spoken word is timed independently.
- **Editorial Templates**: Designed typography systems instead of generic subtitle boxes.
- **Live Preview**: See changes immediately on the actual video.
- **Word-Level Editing**: Change text and timing directly.
- **Hero Word Emphasis**: Make important words visually dominant.

## 5. Marketing Website Requirements
The marketing website must feel like a premium editorial/video-creation product, utilizing a dark visual foundation, strong typography, subtle gradients, and motion. It must avoid generic SaaS tropes (e.g., placeholder screenshots, fake metrics).

## 6. Navigation
- **Brand**: MOTION SUBTITLE
- **Left**: Features, Templates, How It Works, Pricing, FAQ
- **Right**: Log in, Get Started
- **Mobile**: Compact logo with a mobile navigation sheet/menu.

## 7. Homepage Sections
- NAV
- HERO
- FEATURES
- HOW IT WORKS
- TEMPLATE SHOWCASE
- EDITOR SHOWCASE
- WORD-LEVEL SECTION
- CUSTOMIZATION SECTION
- SOCIAL PROOF (if data exists)
- PRICING (if data exists)
- FAQ
- FINAL CTA
- FOOTER

## 8. Hero Requirements
Adapted from `hero-ascii.tsx` removing any third-party branding (UIMIX/Vitruvian).
- Small technical eyebrow: `MOTION SUBTITLE / CAPTION STUDIO`
- Headline: e.g., `MAKE EVERY WORD MOVE WITH THE STORY.`
- Supporting copy focusing on word-level control and editorial typography.
- Real product/caption visuals, not static dashboard screenshots.
- Primary CTA: `START CREATING`
- Secondary CTA: `EXPLORE TEMPLATES`

## 9. Caption Template System
A shared template engine driving thumbnails, editor preview, and final ASS render. One source of truth ensuring `TEMPLATE PREVIEW = EDITOR PREVIEW = FINAL VIDEO`. The templates are complete typography and composition systems, not just color presets.

## 10. Template Definitions (The 8 Templates)
Must strictly follow the visual specifications found in `reference/assets/`.
1. **SERIF BLOOM** (`serif-bloom.mp4`): Elegant serif typography, editorial composition, restrained motion, warm light typography, subtle entrance.
2. **SIGNAL** (`encore.mp4`): Bold sans-serif, compact word grouping, strong readability, active/accent word emphasis.
3. **CLEAN FOCUS** (`minimal.mp4`): Bold modern sans, minimal composition, single-word emphasis, clean spacing.
4. **COMIC PUNCH** (`pop-comics.mp4`): Large display typography, uppercase hero words, yellow/bright hero treatment, dark outline/shadow, energetic scale/pop.
5. **POSTER** (`dynamic.mp4`): Poster-like layout, very large hero word, small supporting words, asymmetric positioning.
6. **AMBER STACK** (`dynamic-stack-amber.mp4`): Stacked layout, dominant hero word, amber/orange hero, strong vertical hierarchy.
7. **EDITORIAL FRAME** (`editorial 2.mp4`): Large hero word, smaller supporting words, asymmetric composition, clean negative space.
8. **PREMIERE** (`premiere 1.mp4`): Dramatic serif hero, large expressive word, red hero treatment, cinematic composition.

## 11. Upload Workflow
Step 1. Supports drag-and-drop and file picker. Displays filename, duration, dimensions, file size, and upload progress. Transitions naturally to the language step.

## 12. Transcription Workflow
Step 2. Uses the existing Whisper/faster-whisper system. Displays a premium `shining-text` effect (e.g., "GENERATING WORD-LEVEL CAPTIONS") during processing.

## 13. Language Selection
Part of Step 2. Supports English, Hindi, Hinglish, and Auto Detect.

## 14. Style Workflow
Step 3. Presents the 8 templates using real caption composition previews driven by the unified template engine.

## 15. Customization
Controls for Typography (font, size, weight, line height, tracking, case), Color (primary, accent, hero), Layout (position, alignment, spacing, width), Word Hierarchy, Effects, and Motion.

## 16. Word-Level Editing
Users can edit text, correct transcription errors, change word timing, split/merge groups, select words, mark hero/accent words, and see immediate live previews.

## 17. Timeline
Displays video duration, playback position, caption segments, editable timing. Clicking a caption moves playback.

## 18. Preview (Editor)
Three-panel layout: caption/segment list (Left), large real video preview (Center), contextual styling controls (Right), and timeline (Bottom). The preview updates immediately upon any change and uses the actual project video.

## 19. Render
Step 6. Triggered ONLY by explicit user action. Uses a polished `shining-text` processing screen. No automatic or fake renders. Deducts credits via the existing backend logic.

## 20. Download
Step 7. Displays "RENDER COMPLETE" and "DOWNLOAD VIDEO" with filename, resolution, and file size. Includes a video player to review the final MP4.

## 21. Credits
Preserve existing rules: 300 signup credits, 100 credits per render, 3 videos max. Do not deduct credits for previewing, styling, or editing.

## 22. Responsive Behavior
- **Desktop**: Full studio view.
- **Mobile**: Video-first approach. Controls, timelines, and lists do not cover the video unnecessarily.

## 23. Accessibility
Ensure keyboard navigation, visible focus states, semantic HTML, readable contrast, and respect `prefers-reduced-motion` for animations like the shining text and footer.

## 24. Performance
Keep the application responsive. Prevent full-page re-renders when a single word changes. Lazy-load non-critical homepage content.

## 25. Rendering Parity
Mandatory: The exported FFmpeg/ASS result must visually match the in-browser React preview as closely as technically possible.

## 26. Acceptance Criteria
- [ ] Homepage, Nav, Hero, Features, Workflow, Template Showcase, Editor Showcase, Word-level Section, Customization, FAQ, CTA, and Footer exist and are branded Motion Subtitle.
- [ ] 7-Step Studio Workflow functions correctly (Upload -> Transcribe -> Style -> Compose -> Edit -> Render -> Download).
- [ ] The 8 templates perfectly mimic the visual specifications of the reference MP4s.
- [ ] Word-level timestamps, hero words, and manual overrides work.
- [ ] Hindi and Hinglish languages are supported.
- [ ] Multiple aspect ratios (9:16, 4:5, 1:1, 16:9) are supported.
- [ ] Final render matches the preview.
- [ ] Existing backend (Auth, Storage, Whisper, FFmpeg, Credits) remains intact and functional.

## 27. Non-Goals
- Do not build a generic AI SaaS landing page.
- Do not create fake data (users, reviews, renders, metrics).
- Do not replace the existing Express/Node.js backend or FFmpeg pipeline.
- Do not create generic, simplistic caption presets (e.g., "white text + fade").

## 28. Technical Constraints
- Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn/ui, motion, lucide-react.
- Backend (Existing): Node.js, Express, FFmpeg, ASSRenderer, Whisper.
- The 8 new templates must be mapped into `StyleEngine.js` and `ASSRenderer.js` with minimal compatible backend changes to ensure parity.

## 29. Reference Asset Handling
Files in `reference/assets/` are STRICTLY development reference materials. They will not be shipped to production, used as overlays, or served publicly. The visual systems must be recreated natively in the template engine.
