const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');
const { randomUUID } = require('crypto');

let daemon = null;
let requestQueue = new Map();

function startDaemon() {
  if (daemon) return;
  const scriptPath = path.join(__dirname, 'transcribe_daemon.py');
  
  // Use spawn to launch Python
  daemon = spawn('python', [scriptPath], { stdio: ['pipe', 'pipe', 'inherit'] });
  
  let buffer = '';
  
  daemon.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop(); // Keep the incomplete line
    
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
    // Reject all pending requests
    for (const [id, { reject }] of requestQueue.entries()) {
      reject(new Error(`Daemon exited unexpectedly (code ${code})`));
    }
    requestQueue.clear();
  });
}

function processTask(videoPath, language) {
  return new Promise((resolve, reject) => {
    if (!daemon) startDaemon();
    
    const id = randomUUID();
    requestQueue.set(id, { resolve, reject });
    
    const req = {
      id,
      videoPath,
      language
    };
    
    daemon.stdin.write(JSON.stringify(req) + '\n');
  });
}

/**
 * Extract audio from an uploaded video, then transcribe it with faster-whisper
 * via the persistent python daemon.
 */
async function transcribeVideo(videoPath, language = null) {
  const audioPath = videoPath.replace(/\.[^.]+$/, '.wav');
  const startTime = Date.now();

  try {
    // 1. Extract 16kHz mono audio
    console.log(`[TRANSCRIBE] audio extraction started`);
    const extStart = Date.now();
    await runCommand(
      `"${ffmpegPath}" -i "${videoPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}" -y`
    );
    console.log(`[TRANSCRIBE] audio extraction completed: ${Date.now() - extStart} ms`);

    // 2. Transcribe using Python worker
    console.log(`[TRANSCRIBE] daemon transcription started`);
    const workerStart = Date.now();
    
    const result = await processTask(audioPath, language);
    
    console.log(`[TRANSCRIBE] daemon transcription completed: ${Date.now() - workerStart} ms`);

    // 3. Schema Normalization (Run Exactly Once)
    // Map words into { id, text, start, end, index }
    let globalIndex = 0;
    const words = [];
    result.segments.forEach(seg => {
      (seg.words || []).forEach(w => {
        words.push({
          id: `w${globalIndex}`,
          text: (w.word || w.text || '').trim(),
          start: w.start,
          end: w.end,
          index: globalIndex++
        });
      });
    });

    console.log(`[TRANSCRIBE] total processing time: ${Date.now() - startTime} ms`);
    return {
      language: result.language,
      languageProbability: result.language_probability,
      words
    };
  } finally {
    // Cleanup intermediate files
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
