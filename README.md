# Reel Type — stylish auto-caption generator

Upload a video → free transcript → pick a caption style (Neon Glow, Hype Pop,
Minimal Clean, Karaoke Highlight, TikTok Bold, Gradient Fire) → burn captions
into a 1080p export. New accounts get 300 credits; each 1080p render costs
100 credits (3 exports per account).

## How captions get their look

Plain subtitle files (.srt) can't do outlines, glow, or per-word animation.
This project renders captions as an **.ass** (Advanced SubStation Alpha) file
and burns it into the video with FFmpeg's `ass` filter — that's what lets
each style have its own font, outline width, color, and per-word motion
(`\t`, `\fscx`, `\kf` tags), instead of looking like generic auto-captions.
All the style definitions live in `server/render.js` — add a new entry to
`STYLE_PRESETS` to add a new look.

## Project structure

```
caption-app/
├── server/
│   ├── index.js          # Express routes: auth, upload, transcribe, render
│   ├── auth.js            # signup/login, JWT, SQLite user table
│   ├── credits.js         # credit balance + video-count bookkeeping
│   ├── transcription.js   # ffmpeg audio extract -> whisper transcript
│   ├── render.js          # caption style presets + ASS/FFmpeg burn-in
│   └── package.json
└── public/
    ├── index.html          # landing + auth modal + dashboard + editor (SPA)
    ├── css/style.css
    └── js/app.js
```

## Requirements

- Node.js 18+
- Python 3.9+ with `pip install -U openai-whisper` (free, local transcription —
  first run downloads the model, ~150MB for the `base` model)
- FFmpeg is bundled via the `ffmpeg-static` npm package, no separate install needed

## Run locally

```bash
cd server
npm install
npm start
# server runs on http://localhost:3000, serving the SPA from /public
```

Open http://localhost:3000, sign up, upload a short clip, pick a style, render.

## Opening this in Antigravity (or any agentic IDE)

This is a plain Node/Express + static-HTML project — no build step, no
framework lock-in — so it opens as-is:

1. Unzip `caption-app.zip` into a folder and open that folder as the project root.
2. Point the agent at `server/index.js` as the entry file and `public/` as the
   static frontend.
3. Ask it to run `npm install` inside `server/` before first launch.
4. The two things most worth having an agent iterate on next: (a) swapping
   the local Whisper CLI call in `transcription.js` for a hosted Whisper API
   if you want to skip the Python dependency, and (b) adding new entries to
   `STYLE_PRESETS` in `render.js` for more caption looks.

## Known limits / next steps

- SQLite (`better-sqlite3`) is fine for one server instance; move to Postgres
  before deploying with multiple instances.
- The JWT secret in `auth.js` must be overridden via the `JWT_SECRET` env var
  in production.
- Uploaded/rendered files are stored on local disk (`server/uploads`,
  `server/outputs`) — swap for S3 or similar before deploying.
- No password-reset flow yet.
