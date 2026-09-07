const crypto = require('crypto');

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'but', 'if', 'or', 'because', 'as',
  'which', 'this', 'that', 'these', 'those', 'then', 'so', 'than', 'such',
  'with', 'at', 'by', 'for', 'in', 'into', 'of', 'on', 'to', 'from', 'up', 'down',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'my', 'your', 'his', 'her', 'its', 'our', 'their'
]);

const QUESTION_WORDS = new Set(['who', 'what', 'where', 'when', 'why', 'how']);
const NUMBER_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'hundred', 'thousand', 'million', 'billion']);

const SEMANTIC_CONTEXT_WORDS = new Set(['days', 'day', 'years', 'year', 'seconds', 'second', 'minutes', 'minute', 'hours', 'hour', 'times', 'time']);

/**
 * Helper to generate simple ID
 */
function uuid() {
  return crypto.randomUUID();
}

/**
 * Checks if a word is part of a number (digits, percentages, currency, or spelled out).
 */
function isNumericWord(cleanText, rawText) {
  if (NUMBER_WORDS.has(cleanText)) return true;
  if (/\d+/.test(cleanText)) return true;
  if (/[%$€£₹×]/.test(rawText)) return true;
  return false;
}

/**
 * Analyzes a composed segment and assigns a 'hero' word if appropriate.
 * It also mutates the word objects to add numeric grouping data if found.
 * 
 * Returns { wordId: string, reason: string } or null, representing the primary hero.
 */
function assignEmphasis(segment) {
  if (!segment.words || segment.words.length === 0) return null;

  // 1. First Pass: Detect Semantic Numeric Groups
  let currentGroupId = null;
  let inGroup = false;
  let groupMembers = [];
  
  // We look for sequences of numbers + optional context words
  for (let i = 0; i < segment.words.length; i++) {
    const w = segment.words[i];
    const clean = w.cleanText.toLowerCase();
    
    const isNum = isNumericWord(clean, w.text);
    const isContext = SEMANTIC_CONTEXT_WORDS.has(clean);
    
    if (isNum) {
      if (!inGroup) {
        inGroup = true;
        currentGroupId = uuid();
        groupMembers = [];
      }
      w.isNumberGroup = true;
      w.groupId = currentGroupId;
      w.emphasis = 'hero';
      groupMembers.push(w);
    } else if (isContext && inGroup) {
      // Context word right after a number
      w.isNumberGroup = true;
      w.groupId = currentGroupId;
      w.emphasis = 'hero';
      groupMembers.push(w);
      // Group usually ends after the context word
      inGroup = false; 
    } else {
      // Not a number or context, end any active group
      inGroup = false;
    }
  }

  // If we found any numeric groups, the first word of the first group is our "primary" hero
  // so that legacy systems still have a wordId to attach to.
  const firstNumericHero = segment.words.find(w => w.isNumberGroup);
  if (firstNumericHero) {
    return {
      wordId: firstNumericHero.id,
      reason: 'number-group'
    };
  }

  // 2. Fallback: Standard NLP Scoring
  const candidates = segment.words.map((w, index) => {
    let score = 0;
    const clean = w.cleanText.toLowerCase();

    // Penalty for stop words
    if (STOP_WORDS.has(clean)) {
      score -= 10;
    }

    // Boost question words
    if (QUESTION_WORDS.has(clean)) {
      score += 4;
    }

    // Reward length
    if (clean.length > 6) score += 3;
    else if (clean.length > 4) score += 1;

    // Reward punctuation
    if (/[!?]$/.test(w.text)) score += 5;
    
    // Reward ALL CAPS (sometimes Whisper outputs this for emphasis)
    if (w.text === w.text.toUpperCase() && clean.length > 1) {
      score += 4;
    }

    // Slight reward for being the last word (usually the punchline/subject)
    if (index === segment.words.length - 1) {
      score += 2;
    }

    return { word: w, score };
  });

  // Sort descending by score
  candidates.sort((a, b) => b.score - a.score);

  const top = candidates[0];
  
  // Only assign emphasis if the word actually scored positively
  if (top.score > 0) {
    // We mutate the word here to ensure modern templates can read it directly
    const targetWord = segment.words.find(w => w.id === top.word.id);
    if (targetWord) targetWord.emphasis = 'hero';

    return {
      wordId: top.word.id,
      reason: 'hero'
    };
  }

  return null;
}

module.exports = { assignEmphasis };
