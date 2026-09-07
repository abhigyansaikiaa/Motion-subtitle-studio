const fs = require('fs');
const https = require('https');
const { execSync } = require('child_process');

const PROJECT_ID = '16619173774579839125';
const SCREENS = {
  'Design_System': 'asset-stub-assets_77e63c8a3d894cb1bb3dd1f4ab34695e',
  'Reel_Type_Emblem': '8442eb1b305c4e7d963a2fd0162e23d1',
  'Word_Timeline_Inspector': '4beb02d87ab248c4b9678f14fb69dd44',
  'Foundry_Style_Catalogue': '63c01758c6194a108a54cccb0affeef9',
  'Projects_Render_Vault': '84f96bd2169541aba96ed21c74e670e9'
};
const API_KEY = 'AQ.Ab8RN6Jc6qSmBmsp0XkAVFkcnhkKHszNiuhHmQ81EnIO0xDzJw';

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'X-Goog-Api-Key': API_KEY } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, path) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(path);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', err => {
      fs.unlink(path, () => {});
      reject(err);
    });
  });
}

async function fetchScreen(name, screenId) {
  console.log('Fetching', name, screenId);
  const url = `https://stitch.googleapis.com/v1/projects/${PROJECT_ID}/screens/${screenId}`;
  
  try {
    const data = await fetchJson(url);
    if (data.error) {
      console.error('Error for', name, data.error.message);
      return;
    }
    
    // Save design tokens (theme + designSystem)
    const tokens = {
      theme: data.theme,
      designSystem: data.designSystem
    };
    fs.writeFileSync(`design_new/${name}_tokens.json`, JSON.stringify(tokens, null, 2));
    console.log(`Saved ${name}_tokens.json`);
    
    // Save screenshot
    if (data.screenshot && data.screenshot.downloadUrl) {
      await downloadFile(data.screenshot.downloadUrl, `design_new/${name}.png`);
      console.log(`Saved ${name}.png`);
    }

    // Save html code
    if (data.htmlCode && data.htmlCode.downloadUrl) {
      await downloadFile(data.htmlCode.downloadUrl, `design_new/${name}.html`);
      console.log(`Saved ${name}.html`);
    }

  } catch (err) {
    console.error('Failed', name, err.message);
  }
}

async function main() {
  if (!fs.existsSync('design_new')) fs.mkdirSync('design_new');
  for (const [name, id] of Object.entries(SCREENS)) {
    await fetchScreen(name, id);
  }
}
main();
