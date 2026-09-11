export interface User {
  id: string;
  email: string;
  name: string;
  credits: number;
  videos_used: number;
}

export interface Word {
  id: string;
  text: string;
  start: number;
  end: number;
  index?: number;
  emphasis?: 'none' | 'hero' | 'accent';
  isNumberGroup?: boolean;
  groupId?: string | null;
}

export interface Segment {
  id: string;
  start: number;
  end: number;
  text: string;
  words: Word[];
  lines?: Word[][];
  emphasis?: { wordId: string; reason: string };
  style?: string;
}

export interface Project {
  id: string;
  userId: string;
  videoId: string;
  status: 'UPLOADING' | 'UPLOADED' | 'TRANSCRIBING' | 'TRANSCRIBED' | 'COMPOSING' | 'READY_TO_EDIT' | 'RENDERING' | 'COMPLETED' | 'FAILED';
  segments: Segment[];
  style: string;
  videoUrl?: string;
  downloadUrl?: string;
  filename?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Job {
  id: string;
  userId: string;
  projectId: string;
  videoId: string;
  segments: Segment[];
  style: string;
  status: 'QUEUED' | 'PROCESSING' | 'RENDERING' | 'ENCODING' | 'COMPLETED' | 'FAILED';
  progress: number;
  message: string;
  outputFilename?: string;
  downloadUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  category?: 'Modern' | 'Minimalist' | 'Dynamic' | 'Editorial' | 'MOGRT' | string;
  animationLevel?: 'word' | 'segment';
  
  fontFamily: string;
  fontWeight: string | number;
  fontStyle: string; // 'normal' | 'italic'
  textTransform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  
  // Base / supporting word properties
  baseColor: string;
  baseSize: number; // reference size at 1920px tall canvas
  baseOpacity: number;
  
  // Hero word independent typography
  heroColor: string;
  heroScale: number;           // size multiplier vs baseSize e.g. 2.5
  heroFontFamily?: string;     // if omitted, inherits fontFamily
  heroFontWeight?: string | number; // if omitted, inherits fontWeight
  heroFontStyle?: string;      // if omitted, inherits fontStyle
  
  // Accent properties
  accentColor: string;
  
  // Layout & Composition
  alignment: 'left' | 'center' | 'right';
  layoutType: 'inline' | 'stacked' | 'asymmetric' | 'editorial' | 'hero-interruption' | 'corner-hero' | 'split-hero' | 'editorial-offset' | 'giant-bg' | 'vertical-stack' | 'editorial-magazine' | 'word-collision' | 'cinematic' | 'kinetic' | 'sentence-hero' | 'hero-micro';
  letterSpacing: string;
  lineHeight: number;
  
  // Styling
  shadow?: string;
  outline?: string;
  
  // Motion / Animation
  entranceAnimation: 'fade' | 'fade-up' | 'fade-down' | 'pop' | 'scale' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'reveal' | 'bounce' | 'blur-in' | 'elastic' | 'none' | 'rise' | 'soft-reveal' | 'focus-in' | 'pop-in' | 'punch-in' | 'zoom-in' | 'stagger' | 'cascade' | 'split-reveal' | 'flip-in' | 'elastic-rise' | 'snap-in' | 'spring-up' | 'stretch-in' | 'glitch' | 'motion-blur' | 'shutter' | 'mask-reveal' | 'collision-left' | 'collision-right' | 'spin-in' | 'slide-from-right' | 'slide-from-bottom' | 'slide-right-to-left' | 'slide-from-top' | 'slide-from-left';
  heroEntranceAnimation?: 'fade' | 'fade-up' | 'fade-down' | 'pop' | 'scale' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'reveal' | 'bounce' | 'blur-in' | 'elastic' | 'none' | 'rise' | 'soft-reveal' | 'focus-in' | 'pop-in' | 'punch-in' | 'zoom-in' | 'stagger' | 'cascade' | 'split-reveal' | 'flip-in' | 'elastic-rise' | 'snap-in' | 'spring-up' | 'stretch-in' | 'glitch' | 'motion-blur' | 'shutter' | 'mask-reveal' | 'collision-left' | 'collision-right' | 'spin-in' | 'slide-from-right' | 'slide-from-bottom' | 'slide-right-to-left' | 'slide-from-top' | 'slide-from-left';
  wordActivation: 'color-fill' | 'scale-up' | 'none';
  animationSpeed: number; // 0.5 = fast, 1.0 = normal, 2.0 = slow
  
  // Compositing / Depth / Position
  captionDepth: 'front' | 'behind-subject' | 'mixed';
  position: 'center' | 'top' | 'bottom' | 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';

  // Number Emphasis
  numberEmphasis?: 'auto' | 'always' | 'never';
  countUpEnabled?: boolean;

  // Composition-specific controls
  compositionVariant?: string;
  heroPosition?: 'inline' | 'above' | 'below' | 'left' | 'right' | 'offset-left' | 'offset-right' | 'corner-tl' | 'corner-tr' | 'corner-bl' | 'corner-br';
  bgWordOpacity?: number;
  bgWordBlur?: number;
  bgWordSize?: number;
  staggerDirection?: 'left' | 'right' | 'center';
}

