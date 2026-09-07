const https = require('https');
const url = 'https://stitch.googleapis.com/v1/projects/16619173774579839125/screens/4beb02d87ab248c4b9678f14fb69dd44';
https.get(url, { headers: { 'X-Goog-Api-Key': 'AQ.Ab8RN6Jc6qSmBmsp0XkAVFkcnhkKHszNiuhHmQ81EnIO0xDzJw' } }, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log(data.slice(0, 500));
    try {
      const j = JSON.parse(data);
      console.log('Parsed JSON keys:', Object.keys(j));
      console.log('Has designJson:', !!j.designJson);
    } catch(e) { console.error('Parse error', e); }
  });
});
