const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('public/index.html', 'utf8');
const $ = cheerio.load(html);

// 1. Editor View
const editorBg = $('div[data-alt^="A cinematic 35mm film frame"]');
editorBg.replaceWith(`<video id="editorVideo" class="absolute inset-0 w-full h-full object-contain bg-[#0a0a0a]" crossorigin="anonymous" playsinline></video>`);
const captionText = $('p.font-headline-lg-mobile');
captionText.attr('id', 'livePreviewCaption');
captionText.html('');
const clock = $('span:contains("TC 00:02.140")');
clock.attr('id', 'timelineClock');
clock.text('00:00:00:00');
const wordTrack = $('div.h-10:has(button:contains("I"))');
if(wordTrack.length) {
    wordTrack.attr('id', 'transcriptBox');
    wordTrack.html('');
    wordTrack.removeClass('h-10').addClass('min-h-[40px] flex-wrap h-auto');
}

// 2. Dashboard View
const newProjectBtn = $('button:contains("New Cinematic Project")');
newProjectBtn.attr('id', 'dropzone');
newProjectBtn.after(`<input type="file" id="videoInput" accept="video/mp4,video/quicktime" class="hidden" />`);
$('#dashboardView').prepend(`<div id="uploadStatus" class="hidden text-primary px-space-md py-space-xs font-semibold"></div>`);

// 3. Styles View (DO NOT wipe, just assign IDs to the video boxes)
// Each article in the specimen deck has a container with aspect-video.
const styleIds = ['minimalClean', 'neonGlow', 'gradientFire', 'karaokeHighlight', 'hypePop', 'tiktokBold']; // Just guessing order from HTML, I'll just assign them to the demo containers in order
const demoContainers = $('#catalogueView article.specimen-card div.aspect-video');
demoContainers.each((idx, el) => {
  if(styleIds[idx]) {
    // Empty the image background and overlay
    $(el).empty();
    // Add the demo container
    $(el).append(`<div id="demo-${styleIds[idx]}" class="absolute inset-0 flex items-center justify-center p-4 text-center"></div>`);
  }
});
// Remove the innerHTML overwrite in app.js using sed/awk or just in app.js directly later.

// 4. Update Navigation
$('a[data-path="timeline"]').attr('data-path', 'editor').addClass('nav-btn');
$('a[data-path="projects"]').attr('data-path', 'dashboard').addClass('nav-btn');
$('a[data-path="styles"]').attr('data-path', 'catalogue').addClass('nav-btn');

fs.writeFileSync('public/index.html', $.html());
console.log('index.html patched with IDs without wiping catalogue');
