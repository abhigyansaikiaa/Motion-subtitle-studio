/**
 * CaptionModel represents the structured internal model of captions.
 * A single Video has many Segments (caption blocks on screen).
 * A Segment has many Words.
 * A Segment is broken visually into Lines.
 */

function createWord(id, text, start, end) {
  return {
    id,
    text: text.trim(),
    start,
    end,
    cleanText: text.trim().replace(/[^\w]/g, '').toLowerCase()
  };
}

function createSegment(id, words, lines, emphasis = null, styleOverride = null) {
  // Compute total segment boundaries based on words
  const start = words.length > 0 ? words[0].start : 0;
  const end = words.length > 0 ? words[words.length - 1].end : 0;
  const text = words.map(w => w.text).join(' ');

  return {
    id,
    start,
    end,
    text,
    words,
    lines,           // Array of arrays of word objects (or word references) representing visual lines
    emphasis,        // { wordId: "w3", reason: "hero" }
    style: styleOverride
  };
}

module.exports = { createWord, createSegment };
