/**
 * The Style Engine abstracts the visual properties from the rendering implementation.
 * It defines WHAT the caption should look like, not HOW the renderer implements it.
 * 
 * Note: ASS colors are in &HAABBGGRR format (Blue and Red are swapped vs RGB).
 * For the frontend live preview, use `cssColor` properties.
 */

const STYLES = {
  'serif-bloom': {
    name: 'SERIF BLOOM', category: 'EDITORIAL', blurb: 'Elegant serif typography with warm tones and editorial composition.',
    typography: { font: 'Playfair Display', size: 42, weight: '600', case: 'normal', spacing: 1, italic: true },
    composition: { maxLines: 2, align: 'center', marginV: 160 },
    emphasis: { hero: { font: 'Playfair Display', scale: 120, color: '&H00FFFFFF', cssColor: '#ffffff' } },
    motion: { entrance: 'fade', duration: 200 },
    color: { primary: '&H00E1EAF2', outline: '&H00000000', back: '&H00000000', cssPrimary: '#f2eae1', cssOutline: 'transparent', cssBack: 'transparent', outlineW: 0, shadowD: 2 }
  },
  'signal': {
    name: 'SIGNAL', category: 'BOLD', blurb: 'Bold sans-serif, compact word grouping, strong readability.',
    typography: { font: 'Geist', size: 48, weight: '700', case: 'upper', spacing: 0 },
    composition: { maxLines: 2, align: 'center', marginV: 160 },
    emphasis: { hero: { color: '&H00AAFF00', cssColor: '#00ffaa', scale: 100 } },
    motion: { entrance: 'rise', duration: 150 },
    color: { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', cssPrimary: '#ffffff', cssOutline: 'transparent', cssBack: 'transparent', outlineW: 0, shadowD: 4 }
  },
  'clean-focus': {
    name: 'CLEAN FOCUS', category: 'MINIMAL', blurb: 'Bold modern sans, minimal composition, single-word emphasis.',
    typography: { font: 'Geist', size: 40, weight: '600', case: 'normal', spacing: 0 },
    composition: { maxLines: 1, align: 'center', marginV: 160 },
    emphasis: { hero: { scale: 110, color: '&H00FFFFFF', cssColor: '#ffffff' } },
    motion: { entrance: 'fade', duration: 150 },
    color: { primary: '&H00E0E0E0', outline: '&H00000000', back: '&H00000000', cssPrimary: '#e0e0e0', cssOutline: 'transparent', cssBack: 'transparent', outlineW: 0, shadowD: 0 }
  },
  'comic-punch': {
    name: 'COMIC PUNCH', category: 'KINETIC', blurb: 'Large display typography, uppercase hero words, energetic scale.',
    typography: { font: 'JetBrains Mono', size: 52, weight: '800', case: 'upper', spacing: 2 },
    composition: { maxLines: 2, align: 'center', marginV: 160 },
    emphasis: { hero: { scale: 140, color: '&H0000CCFF', cssColor: '#ffcc00' } },
    motion: { entrance: 'pop', duration: 100 },
    color: { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', cssPrimary: '#ffffff', cssOutline: '#000000', cssBack: 'transparent', outlineW: 3, shadowD: 4 }
  },
  'poster': {
    name: 'POSTER', category: 'BOLD', blurb: 'Poster-like layout, very large hero word, asymmetric positioning.',
    typography: { font: 'Geist', size: 32, weight: '800', case: 'upper', spacing: -1 },
    composition: { maxLines: 3, align: 'left', marginV: 160 },
    emphasis: { hero: { scale: 250, color: '&H00FFFFFF', cssColor: '#ffffff' } },
    motion: { entrance: 'rise', duration: 200 },
    color: { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', cssPrimary: '#ffffff', cssOutline: 'transparent', cssBack: 'transparent', outlineW: 0, shadowD: 8 }
  },
  'amber-stack': {
    name: 'AMBER STACK', category: 'EDITORIAL', blurb: 'Stacked layout, dominant hero word, amber hero, vertical hierarchy.',
    typography: { font: 'Geist', size: 44, weight: '700', case: 'upper', spacing: 1 },
    composition: { maxLines: 3, align: 'center', marginV: 160 },
    emphasis: { hero: { scale: 160, color: '&H00008CFF', cssColor: '#ff8c00' } },
    motion: { entrance: 'rise', duration: 150 },
    color: { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', cssPrimary: '#ffffff', cssOutline: 'transparent', cssBack: 'transparent', outlineW: 0, shadowD: 4 }
  },
  'editorial-frame': {
    name: 'EDITORIAL FRAME', category: 'EDITORIAL', blurb: 'Large hero word, smaller supporting words, clean negative space.',
    typography: { font: 'Playfair Display', size: 28, weight: '400', case: 'normal', spacing: 0 },
    composition: { maxLines: 2, align: 'left', marginV: 160 },
    emphasis: { hero: { scale: 220, color: '&H00FFFFFF', cssColor: '#ffffff' } },
    motion: { entrance: 'fade', duration: 200 },
    color: { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', cssPrimary: '#ffffff', cssOutline: 'transparent', cssBack: 'transparent', outlineW: 0, shadowD: 2 }
  },
  'premiere': {
    name: 'PREMIERE', category: 'EDITORIAL', blurb: 'Dramatic serif hero, cinematic composition, red hero treatment.',
    typography: { font: 'Playfair Display', size: 36, weight: '700', case: 'upper', spacing: 2, italic: true },
    composition: { maxLines: 2, align: 'center', marginV: 160 },
    emphasis: { hero: { scale: 180, color: '&H001111CC', cssColor: '#cc1111' } },
    motion: { entrance: 'fade', duration: 250 },
    color: { primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', cssPrimary: '#ffffff', cssOutline: 'transparent', cssBack: 'transparent', outlineW: 0, shadowD: 6 }
  },
  'editorial-serif': {
    name: 'Editorial Red',
    category: 'EDITORIAL',
    blurb: 'Cinematic serif emphasis with one red hero word.',
    typography: { font: 'Plus Jakarta Sans', size: 18, weight: '500', case: 'normal', spacing: 1 },
    composition: { maxLines: 2, align: 'center', marginV: 160 },
    emphasis: { 
      hero: { 
        font: 'Playfair Display', italic: true, scale: 135, weight: '700',
        color: '&H001111CC', // Red in BGR
        cssColor: '#CC1111'
      } 
    },
    motion: { entrance: 'softRise', duration: 150 },
    color: { 
      primary: '&H00FFFFFF', outline: '&H00000000', back: '&H90000000', 
      cssPrimary: '#FFFFFF', cssOutline: 'transparent', cssBack: 'rgba(0,0,0,0.56)',
      outlineW: 0, shadowD: 2 
    }
  },
  'minimal-cut': {
    name: 'Cutline',
    category: 'BOLD',
    blurb: 'Hard editorial cuts and oversized type.',
    typography: { font: 'Barlow Condensed', size: 36, weight: '800', case: 'upper', spacing: 2 },
    composition: { maxLines: 3, align: 'center', marginV: 180 },
    emphasis: { 
      hero: { 
        scale: 150,
        color: '&H00FFFFFF',
        cssColor: '#FFFFFF'
      } 
    },
    motion: { entrance: 'cut', duration: 0 },
    color: { 
      primary: '&H00E0E0E0', outline: '&H00000000', back: '&H00000000', 
      cssPrimary: '#E0E0E0', cssOutline: 'transparent', cssBack: 'transparent',
      outlineW: 0, shadowD: 0 
    }
  },
  'whisper': {
    name: 'Whisper',
    category: 'MINIMAL',
    blurb: 'Quiet typography with restrained motion.',
    typography: { font: 'Plus Jakarta Sans', size: 14, weight: '300', case: 'normal', spacing: 2 },
    composition: { maxLines: 1, align: 'center', marginV: 100 },
    emphasis: { 
      hero: { 
        font: 'Playfair Display', italic: true, scale: 110, weight: '400',
        color: '&H003333CC', // Soft red BGR
        cssColor: '#CC3333'
      } 
    },
    motion: { entrance: 'fade', duration: 400 },
    color: { 
      primary: '&H00D0D0D0', outline: '&H00000000', back: '&H00000000', 
      cssPrimary: '#D0D0D0', cssOutline: 'transparent', cssBack: 'transparent',
      outlineW: 0, shadowD: 1 
    }
  },
  'kinetic': {
    name: 'Kinetic',
    category: 'KINETIC',
    blurb: 'Every word moves with the rhythm of speech.',
    typography: { font: 'Plus Jakarta Sans', size: 28, weight: '800', case: 'upper', spacing: 0 },
    composition: { maxLines: 1, align: 'center', marginV: 200 },
    emphasis: { 
      active: { 
        scale: 110,
        color: '&H0000D7FF', // Gold/Amber BGR
        cssColor: '#FFD700'
      } 
    },
    motion: { entrance: 'pop', duration: 100 },
    color: { 
      primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', 
      cssPrimary: '#FFFFFF', cssOutline: 'transparent', cssBack: 'transparent',
      outlineW: 4, shadowD: 2 
    }
  },
  'offset': {
    name: 'Offset',
    category: 'EDITORIAL',
    blurb: 'Asymmetric type placement for a magazine feel.',
    typography: { font: 'Barlow Condensed', size: 24, weight: '500', case: 'normal', spacing: 1 },
    composition: { maxLines: 2, align: 'left', marginV: 160 },
    emphasis: { 
      hero: { 
        font: 'Playfair Display', scale: 150, weight: '800', case: 'upper',
        color: '&H00FFFFFF',
        cssColor: '#FFFFFF'
      } 
    },
    motion: { entrance: 'slideRight', duration: 250 },
    color: { 
      primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', 
      cssPrimary: '#FFFFFF', cssOutline: 'transparent', cssBack: 'transparent',
      outlineW: 0, shadowD: 3 
    }
  },
  'punch-hero': {
    name: 'Serif Punch',
    category: 'BOLD',
    blurb: 'Small sans text against oversized expressive serif words.',
    typography: { font: 'Plus Jakarta Sans', size: 16, weight: '600', case: 'upper', spacing: 3 },
    composition: { maxLines: 2, align: 'center', marginV: 180 },
    emphasis: { 
      hero: { 
        font: 'Playfair Display', italic: true, scale: 250, weight: '900', case: 'normal',
        color: '&H001111CC', // Deep red BGR
        cssColor: '#CC1111'
      } 
    },
    motion: { entrance: 'rise', duration: 200 },
    color: { 
      primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', 
      cssPrimary: '#FFFFFF', cssOutline: 'transparent', cssBack: 'transparent',
      outlineW: 0, shadowD: 4 
    }
  },
  'typewriter-cut': {
    name: 'Typewriter Cut',
    category: 'KINETIC',
    blurb: 'Rapid documentary-style word reveals.',
    typography: { font: 'Space Mono', size: 20, weight: '400', case: 'normal', spacing: 0 },
    composition: { maxLines: 2, align: 'left', marginV: 140 },
    emphasis: { 
      hero: { 
        font: 'Playfair Display', scale: 140, weight: '700', italic: true,
        color: '&H0000D7FF',
        cssColor: '#FFD700'
      } 
    },
    motion: { entrance: 'cut', duration: 0 },
    color: { 
      primary: '&H00E0E0E0', outline: '&H00000000', back: '&HA0000000', 
      cssPrimary: '#E0E0E0', cssOutline: 'transparent', cssBack: 'rgba(0,0,0,0.6)',
      outlineW: 0, shadowD: 0 
    }
  },
  'magazine-spread': {
    name: 'Magazine',
    category: 'EDITORIAL',
    blurb: 'Luxury editorial hierarchy with oversized statements.',
    typography: { font: 'Barlow Condensed', size: 28, weight: '400', case: 'upper', spacing: 4 },
    composition: { maxLines: 3, align: 'center', marginV: 150 },
    emphasis: { 
      hero: { 
        scale: 220, weight: '900',
        color: '&H00FFFFFF',
        cssColor: '#FFFFFF'
      } 
    },
    motion: { entrance: 'fade', duration: 300 },
    color: { 
      primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', 
      cssPrimary: '#FFFFFF', cssOutline: 'transparent', cssBack: 'transparent',
      outlineW: 0, shadowD: 2 
    }
  },
  'documentary-quiet': {
    name: 'Documentary',
    category: 'MINIMAL',
    blurb: 'Classic cinematic subtitles. Clear, legible, traditional.',
    typography: { font: 'Roboto', size: 16, weight: '500', case: 'normal', spacing: 1 },
    composition: { maxLines: 2, align: 'center', marginV: 80 },
    emphasis: { 
      hero: { 
        font: 'Roboto', italic: true, scale: 110, weight: '700',
        color: '&H0000FFFF', // Yellow BGR
        cssColor: '#FFFF00'
      } 
    },
    motion: { entrance: 'fade', duration: 200 },
    color: { 
      primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', 
      cssPrimary: '#FFFFFF', cssOutline: '#000000', cssBack: 'transparent',
      outlineW: 2, shadowD: 2 
    }
  },
  'karaoke-sync': {
    name: 'Karaoke Bop',
    category: 'KINETIC',
    blurb: 'High-energy bounding text with vivid color pops.',
    typography: { font: 'Plus Jakarta Sans', size: 32, weight: '900', case: 'upper', spacing: 2 },
    composition: { maxLines: 2, align: 'center', marginV: 150 },
    emphasis: { 
      active: { 
        scale: 120,
        color: '&H0000FF00', // Green BGR
        cssColor: '#00FF00'
      },
      hero: {
        scale: 150,
        color: '&H00FF00FF', // Magenta BGR
        cssColor: '#FF00FF'
      }
    },
    motion: { entrance: 'pop', duration: 150 },
    color: { 
      primary: '&H00FFFFFF', outline: '&H00000000', back: '&H00000000', 
      cssPrimary: '#FFFFFF', cssOutline: '#000000', cssBack: 'transparent',
      outlineW: 4, shadowD: 4 
    }
  }
};

function getStyle(styleId) {
  return STYLES[styleId] || STYLES['editorial-serif'];
}

function getAllStyles() {
  return Object.keys(STYLES).map(id => ({ id, ...STYLES[id] }));
}

module.exports = { getStyle, getAllStyles, STYLES };
