const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('public/index.html', 'utf8');
const $ = cheerio.load(html);

// 1. Fix Editor View
const editorBg = $('div[data-alt^="A cinematic 35mm film frame"]');
editorBg.replaceWith(`<video id="editorVideo" class="absolute inset-0 w-full h-full object-contain bg-[#0a0a0a]" crossorigin="anonymous" playsinline></video>`);

const captionText = $('p.font-headline-lg-mobile');
captionText.attr('id', 'livePreviewCaption');
captionText.html(''); // clear demo text

const clock = $('span:contains("TC 00:02.140")');
clock.attr('id', 'timelineClock');
clock.text('00:00:00:00');

// Timeline words container
// In the original Stitch html, there is a track with words: "TRACK 3: WORD-BY-WORD"
const wordTrack = $('div.h-10:has(button:contains("I"))');
if(wordTrack.length) {
    wordTrack.attr('id', 'transcriptBox');
    wordTrack.html('');
    wordTrack.removeClass('h-10').addClass('min-h-[40px] flex-wrap h-auto'); // Allow wrapping
}

// 2. Fix Dashboard View
const newProjectBtn = $('button:contains("New Cinematic Project")');
newProjectBtn.attr('id', 'dropzone');
newProjectBtn.after(`<input type="file" id="videoInput" accept="video/mp4,video/quicktime" class="hidden" />`);

// Add a render status hidden text in dashboard
$('#dashboardView').prepend(`<div id="uploadStatus" class="hidden text-primary px-space-md py-space-xs"></div>`);

// 3. Fix Styles View
// The Foundry_Style_Catalogue has a `<main>` container with `<section class="w-full flex flex-col gap-space-xl pb-space-2xl">`
// We'll give that section an ID and clear it so app.js can inject the demo cards
const stylesContainer = $('#catalogueView section.gap-space-xl');
stylesContainer.attr('id', 'styleCatalogueList');
stylesContainer.html('');

// 4. Update Navigation
// The navigation in Stitch has:
// data-path="studio" -> we don't have a studio tab.
// data-path="styles" -> maps to 'catalogue'
// data-path="timeline" -> maps to 'editor'
// data-path="projects" -> maps to 'dashboard'
$('a[data-path="timeline"]').attr('data-path', 'editor').addClass('nav-btn');
$('a[data-path="projects"]').attr('data-path', 'dashboard').addClass('nav-btn');
$('a[data-path="styles"]').attr('data-path', 'catalogue').addClass('nav-btn');

fs.writeFileSync('public/index.html', $.html());
console.log('index.html patched with IDs');
