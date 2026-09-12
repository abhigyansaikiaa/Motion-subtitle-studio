const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const { randomUUID } = require('crypto');

// ─── DAEMON STATE (persistent server mode only) ─────────────────────────────
let daemon = null;
let requestQueue = new Map();
let daemonFailed = false; // If daemon fails to start, fall back to one-shot

function startDaemon() {
  if (daemon || daemonFailed) return;
  const scriptPath = path.join(__dirname, 'transcribe_daemon.py');

  if (!fs.existsSync(scriptPath)) {
    console.warn('[TRANSCRIBE] transcribe_daemon.py not found, will use one-shot mode');
    daemonFailed = true;
    return;
  }

  // Test Python availability first
  const testProc = exec('python --version', (err) => {
    if (err) {
      console.warn('[TRANSCRIBE] Python not available, using one-shot fallback:', err.message);
      daemonFailed = true;
      return;
    }
    _spawnDaemon();
  });
}

function _spawnDaemon() {
  const scriptPath = path.join(__dirname, 'transcribe_daemon.py');
  daemon = spawn('python', [scriptPath], { stdio: ['pipe', 'pipe', 'inherit'] });

  let buffer = '';

  daemon.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep incomplete line

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const result = JSON.parse(line);
        if (result.id && requestQueue.has(result.id)) {
          const { resolve, reject } = requestQueue.get(result.id);
          requestQueue.delete(result.id);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        }
      } catch (err) {
        console.error('[DAEMON] Failed to parse output line:', line, err);
      }
    }
  });

  daemon.on('close', (code) => {
    console.error(`[DAEMON] Process exited with code ${code}`);
    daemon = null;
    if (code !== 0) daemonFailed = true;
    // Reject all pending requests
    for (const [, { reject }] of requestQueue.entries()) {
      reject(new Error(`Daemon exited unexpectedly (code ${code})`));
    }
    requestQueue.clear();
  });

  daemon.on('error', (err) => {
    console.error('[DAEMON] Spawn error:', err.message);
    daemon = null;
    daemonFailed = true;
    for (const [, { reject }] of requestQueue.entries()) {
      reject(new Error(`Daemon spawn failed: ${err.message}`));
    }
    requestQueue.clear();
  });
}

function processTaskViaDaemon(videoPath, language) {
  return new Promise((resolve, reject) => {
    if (!daemon) {
      return reject(new Error('Daemon not available'));
    }
    const id = randomUUID();
    requestQueue.set(id, { resolve, reject });
    daemon.stdin.write(JSON.stringify({ id, videoPath, language }) + '\n');
  });
}

// ─── ONE-SHOT MODE (GitHub Actions / fallback) ────────────────────────────────
function runPythonWorker(scriptPath, inputPath, language) {
  return new Promise((resolve, reject) => {
    const args = [scriptPath, inputPath];
    if (language && language.toLowerCase() !== 'auto') {
      args.push('--language', language);
    }
    const py = spawn('python', args);

    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', data => { stdoutData += data.toString(); });
    py.stderr.on('data', data => {
      stderrData += data.toString();
      process.stderr.write(data);
    });

    const timeout = setTimeout(() => {
      py.kill('SIGKILL');
      reject(new Error('Transcription worker timed out after 5 minutes.'));
    }, 5 * 60 * 1000);

    py.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0) {
        return reject(new Error(
          `Python transcription failed (exit ${code}). stderr: ${stderrData.slice(-500)}`
        ));
      }
      resolve(stdoutData);
    });

    py.on('error', err => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn Python: ${err.message}`));
    });
  });
}

// ─── SCHEMA NORMALIZER ────────────────────────────────────────────────────────
function normalizeToWords(segments) {
  let globalIndex = 0;
  const words = [];
  segments.forEach(seg => {
    (seg.words || []).forEach(w => {
      const text = (w.word || w.text || '').trim();
      if (!text) return; // skip empty tokens
      words.push({
        id: `w${globalIndex}`,
        text,
        start: w.start,
        end: w.end,
        index: globalIndex++
      });
    });
  });
  return words;
}

// ─── MAIN EXPORTED FUNCTION ────────────────────────────────────────────────────
/**
 * transcribeVideo(videoPath, language)
 * 
 * Tries daemon mode first (if available, i.e., running as persistent server
 * with Python installed). Falls back to one-shot subprocess if daemon is
 * unavailable (e.g., GitHub Actions, Render without Python).
 *
 * Returns: { language, languageProbability, words: [{id, text, start, end, index}] }
 */
async function transcribeVideo(videoPath, language = null) {
  const audioPath = videoPath.replace(/\.[^.]+$/, '.wav');
  const startTime = Date.now();

  try {
    // 1. Extract 16kHz mono audio
    console.log('[TRANSCRIBE] audio extraction started');
    const extStart = Date.now();
    await runCommand(
      `"${ffmpegPath}" -i "${videoPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}" -y`
    );
    console.log(`[TRANSCRIBE] audio extraction: ${Date.now() - extStart}ms`);

    let result;

    // 2a. Try daemon mode (persistent server — model stays warm)
    if (!daemonFailed) {
      if (!daemon) startDaemon();
      // Give daemon up to 3s to start before falling back
      await new Promise(r => setTimeout(r, daemon ? 0 : 3000));
    }

    if (daemon && !daemonFailed) {
      try {
        console.log('[TRANSCRIBE] Using daemon (warm model)');
        const workerStart = Date.now();
        const daemonResult = await processTaskViaDaemon(audioPath, language);
        console.log(`[TRANSCRIBE] daemon completed: ${Date.now() - workerStart}ms`);
        result = {
          language: daemonResult.language,
          languageProbability: daemonResult.language_probability,
          words: normalizeToWords(daemonResult.segments)
        };
      } catch (daemonErr) {
        console.warn('[TRANSCRIBE] Daemon failed, falling back to one-shot:', daemonErr.message);
        daemonFailed = true;
        daemon = null;
      }
    }

    // 2b. One-shot fallback (GitHub Actions or Render without Python)
    if (!result) {
      const scriptPath = path.join(__dirname, 'transcribe.py');
      if (!fs.existsSync(scriptPath)) {
        throw new Error('transcribe.py not found and daemon unavailable');
      }
      console.log('[TRANSCRIBE] Using one-shot Python worker');
      const workerStart = Date.now();
      const rawJson = await runPythonWorker(scriptPath, audioPath, language);
      let parsed;
      try {
        const jsonStart = rawJson.indexOf('{');
        const jsonEnd = rawJson.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1) {
          parsed = JSON.parse(rawJson.substring(jsonStart, jsonEnd + 1));
        } else {
          parsed = JSON.parse(rawJson);
        }
      } catch (err) {
        throw new Error(`Failed to parse python output. Output: ${rawJson.slice(-500)}`);
      }
      result = {
        language: parsed.language || null,
        languageProbability: parsed.language_probability || null,
        words: normalizeToWords(parsed.segments || [])
      };
    }

    console.log(`[TRANSCRIBE] total: ${Date.now() - startTime}ms, words: ${result.words.length}`);
    return result;

  } finally {
    try {
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
    } catch (e) { /* ignore */ }
  }
}

function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 100 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

module.exports = { transcribeVideo };
