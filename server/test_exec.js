const { exec } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const cmd = `"${ffmpegPath}" -version`;
console.log('Command:', cmd);
exec(cmd, (err, stdout, stderr) => {
  console.log('err:', err);
  console.log('stdout:', stdout.substring(0, 100));
});
