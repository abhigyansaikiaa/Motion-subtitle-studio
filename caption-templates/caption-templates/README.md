# Caption Template Pack

26 animated caption styles in the spirit of videocaption.ai — ready to drop into
any subtitle/caption generator website (e.g. toolkb.in). All styles are original
recreations written for this pack (no copied assets).

## Folder layout

```
caption-templates/
├── README.md            ← this file
├── templates.json       ← array of all 26 template metadata objects
├── captions.css         ← all styles + keyframes (source of truth for rendering)
├── preview.html         ← demo page rendering every template with animated text
└── templates/
    ├── word-by-word.json
    ├── karaoke.json
    └── ... (one JSON file per template, kebab-case id as filename)
```

## Template JSON schema

Every `templates/<id>.json` (and every entry in `templates.json`) follows this schema.
Every field is always present; non-applicable values use `null`.

| Field | Type | Meaning |
|---|---|---|
| `id` | string | kebab-case identifier, also the JSON filename |
| `name` | string | display name |
| `description` | string | one-line style description |
| `tags` | string[] | searchable tags |
| `bestFor` | string | suggested use cases |
| `version` | string | semver of the template definition |
| `layout.position` | `center` \| `bottom` \| `top` | where the caption sits on the video |
| `layout.maxWidth` | string | CSS width of the caption block |
| `layout.textAlign` | string | CSS text-align |
| `layout.wordsPerLine` | number \| null | how many words to group per visual line |
| `layout.window` | `{wordsBefore, wordsAfter}` \| null | sliding context window for word-by-word templates |
| `text.*` | | typography: `fontFamily`, `fontUrl` (Google Fonts CSS), `fontWeight`, `fontSize` (vmin `clamp()`), `lineHeight`, `color`, `textTransform`, `letterSpacing`, `stroke` (`{width,color}`), `shadow`, `background`, `borderRadius`, `padding` |
| `behavior.mode` | `word-by-word` \| `karaoke` \| `block` \| `single-word` | how the template animates |
| `behavior.active` / `.past` / `.upcoming` | object \| null | word-state styling hints (`color`, `opacity`, `scale`, `background`) |
| `behavior.animation` | `{keyframes, duration, easing}` \| null | animation applied to the active word |
| `cssClass` | string | root CSS class in `captions.css` (`.cap-tpl-<id>`) |

## Integration guide

### 1. HTML structure

```html
<link rel="stylesheet" href="captions.css">
<!-- load the template's Google Font (see its text.fontUrl) -->

<div class="cap-stage cap-tpl-hormozi">
  <div class="cap-line">
    <span class="cap-word">Create</span>
    <span class="cap-word">viral</span>
    <span class="cap-word">captions</span>
  </div>
</div>
```

`templates.json` → `cssClass` tells you which root class to put on the stage.
Toggle `.is-active` on the currently-spoken word and `.is-past` on already-spoken
words; everything else (upcoming words) needs no class.

### 2. Vanilla JS word cycler (driven by word timestamps)

```js
// words: [{text, start, end}] from your speech-to-text / alignment step
const stage = document.querySelector('.cap-stage');
const line  = stage.querySelector('.cap-line');
const spans = words.map(w => {
  const s = document.createElement('span');
  s.className = 'cap-word';
  s.textContent = w.text;
  line.appendChild(s);
  return s;
});

function renderAt(timeMs){
  let active = spans.length - 1;
  words.forEach((w, i) => { if (timeMs >= w.start) active = i; });
  spans.forEach((s, i) => {
    s.classList.toggle('is-active', i === active);
    s.classList.toggle('is-past',   i <  active);
  });
}

// hook into your video element:
video.addEventListener('timeupdate', () =>
  renderAt(video.currentTime * 1000));
```

For `block`-mode templates (`fade`, `caption-bar`), toggle `.is-active` on the
`.cap-line` element per caption segment instead of per word.

### 3. Switching templates at runtime

```js
const t = templates.find(t => t.id === selectedId); // from templates.json
stage.className = 'cap-stage ' + t.cssClass;
```

### 4. Adding a new template

1. Copy an existing `templates/<id>.json`, change `id`/`name`/styling fields.
2. Add matching `.cap-tpl-<id>` rules (and any `@keyframes`) to `captions.css`.
3. Rebuild `templates.json` (or append the object) and check `preview.html`.

### Google Fonts note

Each template's `text.fontUrl` is a Google Fonts stylesheet URL. Load only the
fonts for the templates you actually render (see `preview.html` for a combined
`<link>` example).

## License

The CSS and JSON in this pack are original works created for toolkb.in and are
free to use in your own projects, commercial or otherwise. Google Fonts used by
the templates are licensed under the SIL Open Font License.
