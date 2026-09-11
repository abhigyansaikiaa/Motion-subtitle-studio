const { createSegment } = require('./CaptionModel');

const MAX_WORDS_PER_LINE = 5;
const MAX_CHARS_PER_LINE = 22;
const MAX_LINES_PER_SEGMENT = 2;
const MAX_WORDS_PER_SEGMENT = MAX_WORDS_PER_LINE * MAX_LINES_PER_SEGMENT;
const PAUSE_THRESHOLD_SECONDS = 0.4; // A gap longer than this is a natural break

// Punctuation that usually denotes a phrase boundary
const END_PUNCTUATION = /[.?!]$/;
const PAUSE_PUNCTUATION = /[,;:—\-]$/;

function compose(wordsRaw) {
  if (!wordsRaw || wordsRaw.length === 0) return [];
  
  const segments = [];
  let currentWords = [];
  let segIndex = 0;

  // 1. Group into segments based on pauses, punctuation, and length constraints
  for (let i = 0; i < wordsRaw.length; i++) {
    const word = wordsRaw[i];
    currentWords.push(word);

    const nextWord = wordsRaw[i + 1];
    let shouldBreak = false;

    if (nextWord) {
      const gap = nextWord.start - word.end;
      
      // Break if there's a long pause
      if (gap > PAUSE_THRESHOLD_SECONDS) {
        shouldBreak = true;
      }
      
      // Break if we hit a sentence end, BUT only if the current segment isn't too short 
      // (prevents breaking "I am." / "Happy.")
      const wText = word.text || word.word || '';
      if (END_PUNCTUATION.test(wText) && currentWords.length >= 3) {
        shouldBreak = true;
      }
      
      // Break if segment is getting too long
      if (currentWords.length >= MAX_WORDS_PER_SEGMENT) {
        shouldBreak = true;
      }
    } else {
      // Last word always breaks
      shouldBreak = true;
    }

    if (shouldBreak) {
      // 2. Format segment into lines
      const lines = breakIntoLines(currentWords);
      
      // 3. Inject Number Groups
      let currentGroupId = null;
      let inGroup = false;
      
      const normalizedWords = currentWords.map((w, index) => {
        const text = (w.cleanText || w.text || w.word || '').toString();
        const isNumeric = text.match(/^[\d.,$€£₹%+-]+[a-z]*$/i);
        
        // Ensure consistent schema: { id, text, start, end, index, groupId?, isNumberGroup? }
        // The original whisper word uses w.word, we normalize to w.text
        const newWord = {
          id: w.id || `w_${segIndex}_${index}`,
          text: w.text || w.word || text,
          start: w.start,
          end: w.end,
          index: index,
        };

        if (isNumeric) {
          if (!inGroup) {
            inGroup = true;
            currentGroupId = 'g_' + Math.random().toString(36).substring(2, 9);
          }
          newWord.isNumberGroup = true;
          newWord.groupId = currentGroupId;
        } else {
          const lower = text.toLowerCase();
          const numberUnits = ['k', 'm', 'b', 'percent', 'seconds', 'second', 'secs', 'sec', 'days', 'day', 'hours', 'hour', 'years', 'year', 'months', 'month', 'minutes', 'minute', 'mins', 'min', 'x'];
          if (inGroup && numberUnits.includes(lower)) {
            newWord.isNumberGroup = true;
            newWord.groupId = currentGroupId;
            inGroup = false;
          } else {
            inGroup = false;
            currentGroupId = null;
          }
        }
        return newWord;
      });

      // Update lines to reference the normalized words
      const normalizedLines = breakIntoLines(normalizedWords);
      
      segments.push(createSegment(`seg_${segIndex++}`, normalizedWords, normalizedLines));
      currentWords = [];
    }
  }

  return segments;
}

function breakIntoLines(words) {
  const lines = [];
  let currentLine = [];
  let currentLineChars = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const text = word.text || word.word || '';
    const wordLen = text.length;

    // Check if adding this word would overflow the line constraints
    const wouldOverflowChars = currentLineChars + wordLen + (currentLine.length > 0 ? 1 : 0) > MAX_CHARS_PER_LINE;
    const wouldOverflowWords = currentLine.length >= MAX_WORDS_PER_LINE;
    
    // Check if previous word had a pause punctuation (like a comma)
    const prevWord = i > 0 ? words[i - 1] : null;
    const prevText = prevWord ? (prevWord.text || prevWord.word || '') : '';
    const isAfterComma = prevWord && PAUSE_PUNCTUATION.test(prevText);
    
    // Smart line breaks: try to keep sentences together, break on commas/pauses
    if (currentLine.length > 0 && (wouldOverflowChars || wouldOverflowWords || (isAfterComma && currentLine.length >= 2))) {
      // Push current line and start a new one
      lines.push([...currentLine]);
      currentLine = [word];
      currentLineChars = wordLen;
    } else {
      currentLine.push(word);
      currentLineChars += wordLen + (currentLine.length > 1 ? 1 : 0); // +1 for space
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

module.exports = { compose, breakIntoLines };
