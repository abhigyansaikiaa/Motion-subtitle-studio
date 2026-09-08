const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const ffmpegPath = require('ffmpeg-static');

/**
 * Extract audio from an uploaded video, then transcribe it with faster-whisper
 * via a custom python worker script.
 *
 * Returns an array of segments: { start, end, text, words: [{word,start,end}] }
 */
async function transcribeVideo(videoPath, language = null) {
  const audioPath = videoPath.replace(/\.[^.]+$/, '.wav');
  const startTime = Date.now();

  try {
    // 1. Extract 16kHz mono audio (faster-whisper handles many formats, but this guarantees consistency and small size)
    console.log(`[TRANSCRIBE] audio extraction started`);
    const extStart = Date.now();
    await runCommand(
      `"${ffmpegPath}" -i "${videoPath}" -ar 16000 -ac 1 -c:a pcm_s16le "${audioPath}" -y`
    );
    console.log(`[TRANSCRIBE] audio extraction completed: ${Date.now() - extStart} ms`);

    // 2. Transcribe using Python worker
    console.log(`[TRANSCRIBE] worker started`);
    const workerStart = Date.now();
    
    const scriptPath = path.join(__dirname, 'transcribe.py');
    const resultJson = await runPythonWorker(scriptPath, audioPath, language);
    
    console.log(`[TRANSCRIBE] worker completed: ${Date.now() - workerStart} ms`);

    const data = JSON.parse(resultJson);

    let wordCount = 0;
    const segments = data.segments.map(seg => {
      wordCount += seg.words ? seg.words.length : 0;
      return {
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
        words: (seg.words || []).map(w => ({
          word: (w.word || '').trim(),
          start: w.start,
          end: w.end
        }))
      };
    });

    console.log(`[TRANSCRIBE] words parsed: ${wordCount}`);
    
    // The persist happens in index.js, so we just log total time here
    console.log(`[TRANSCRIBE] total processing time: ${Date.now() - startTime} ms`);
    return segments;
  } finally {
    // Cleanup intermediate files
    try { 
      if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath); 
    } catch (e) { /* ignore */ }
  }
}

function runPythonWorker(scriptPath, inputPath, language = null) {
  return new Promise((resolve, reject) => {
    // Spawn python directly.
    const args = [scriptPath, inputPath];
    if (language && language !== 'auto') {
      args.push('--language', language);
    }
    const py = spawn('python', args);
    
    let stdoutData = '';
    let stderrData = '';

    py.stdout.on('data', data => {
      stdoutData += data.toString();
    });

    py.stderr.on('data', data => {
      stderrData += data.toString();
      // Pass stderr through to node console for diagnostic logging
      process.stderr.write(data);
    });

    // 5 minute timeout for safety
    const timeout = setTimeout(() => {
      py.kill('SIGKILL');
      reject(new Error('Transcription worker timed out after 5 minutes.'));
    }, 5 * 60 * 1000);

    py.on('close', code => {
      clearTimeout(timeout);
      if (code !== 0) {
        return reject(new Error(`Transcription worker failed with exit code ${code}. Check server logs for details.`));
      }
      resolve(stdoutData);
    });
    
    py.on('error', err => {
      clearTimeout(timeout);
      reject(new Error(`Failed to spawn Python transcription worker: ${err.message}`));
    });
  });
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
