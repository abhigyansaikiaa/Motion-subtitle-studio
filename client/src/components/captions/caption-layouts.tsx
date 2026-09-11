import React, { useEffect, useState, useRef } from 'react';
import type { Segment, Word, TemplateDefinition } from '../../lib/types';
import { cn } from '../../lib/utils';
import { AnimatedWord } from './caption-engine';

export interface LayoutProps {
  segment: Segment;
  templateConfig: TemplateDefinition;
  time: any;
  dynamicBaseSize: number;
  dynamicHeroSize: number;
  videoScale: number;
  alignment: string;
  targetDepth?: 'all' | 'front' | 'behind';
}

export const CountUpWord = ({
  word,
  index,
  segmentStart,
  segmentEnd,
  templateConfig,
  time,
  videoScale = 1,
  forceColor,
  forceFontSize,
  forceFontFamily,
  forceFontWeight,
  forceFontStyle,
  targetDepth = 'all',
}: {
  word: Word;
  index: number;
  segmentStart: number;
  segmentEnd: number;
  templateConfig: TemplateDefinition;
  time: any;
  videoScale?: number;
  forceColor?: string;
  forceFontSize?: number;
  forceFontFamily?: string;
  forceFontWeight?: string | number;
  forceFontStyle?: string;
  targetDepth?: 'all' | 'front' | 'behind';
}) => {
  const [displayValue, setDisplayValue] = useState(word.text);

  // We extract numeric value to count up to
  const targetValueMatch = word.text.match(/(\d+)/);
  const targetValue = targetValueMatch ? parseInt(targetValueMatch[1], 10) : 0;

  useEffect(() => {
    if (!targetValue) return;
    
    // Subscribe to framer motion time value
    const unsubscribe = time.on('change', (t: number) => {
      if (t < word.start) {
        setDisplayValue(word.text.replace(targetValue.toString(), '0'));
      } else if (t > word.end - 0.2) {
        setDisplayValue(word.text);
      } else {
        const progress = Math.min(1, Math.max(0, (t - word.start) / (word.end - word.start - 0.2)));
        const currentNum = Math.floor(targetValue * progress);
        setDisplayValue(word.text.replace(targetValue.toString(), currentNum.toString()));
      }
    });
    return unsubscribe;
  }, [time, word.start, word.end, word.text, targetValue]);

  return (
    <AnimatedWord
      word={{ ...word, text: displayValue }}
      index={index}
      segmentStart={segmentStart}
      segmentEnd={segmentEnd}
      templateConfig={templateConfig}
      time={time}
      videoScale={videoScale}
      forceColor={forceColor}
      forceFontSize={forceFontSize}
      forceFontFamily={forceFontFamily}
      forceFontWeight={forceFontWeight}
      forceFontStyle={forceFontStyle}
      targetDepth={targetDepth}
    />
  );
};

// Layout Helpers
const getGroupedWords = (words: Word[]) => {
  const groups: { isHero: boolean; words: Word[] }[] = [];
  let currentGroup: Word[] = [];
  let currentIsHero = false;

  words.forEach(w => {
    const isHero = w.emphasis === 'hero' || w.isNumberGroup;
    if (currentGroup.length === 0) {
      currentIsHero = !!isHero;
      currentGroup.push(w);
    } else if (!!isHero === currentIsHero) {
      currentGroup.push(w);
    } else {
      groups.push({ isHero: currentIsHero, words: currentGroup });
      currentIsHero = !!isHero;
      currentGroup = [w];
    }
  });
  if (currentGroup.length > 0) {
    groups.push({ isHero: currentIsHero, words: currentGroup });
  }
  return groups;
};

// ─── HERO INTERRUPTION LAYOUT ───────────────────────────────────────────────
export const HeroInterruptionLayout = ({ segment, templateConfig, time, dynamicBaseSize, dynamicHeroSize, videoScale, alignment, targetDepth = 'all' }: LayoutProps) => {
  const groups = getGroupedWords(segment.words);
  const heroFontFamily = templateConfig.heroFontFamily ?? templateConfig.fontFamily;
  const heroFontWeight = templateConfig.heroFontWeight ?? templateConfig.fontWeight;

  return (
    <div className={cn('flex flex-col w-full h-full justify-center items-center pointer-events-none')}>
      {groups.map((group, gIdx) => (
        <div key={gIdx} className={cn('flex flex-wrap justify-center', group.isHero ? 'z-20' : 'z-10')} style={{ marginTop: group.isHero ? '-5%' : '0', marginBottom: group.isHero ? '-5%' : '0' }}>
          {group.words.map((word, i) => {
            const isCountUp = group.isHero && templateConfig.countUpEnabled && word.isNumberGroup;
            const WordComponent = isCountUp ? CountUpWord : AnimatedWord;
            return (
              <WordComponent
                key={word.id} word={word} index={i + gIdx * 10} segmentStart={segment.start} segmentEnd={segment.end}
                templateConfig={templateConfig} time={time} videoScale={videoScale}
                forceColor={group.isHero ? templateConfig.heroColor : templateConfig.baseColor}
                forceFontSize={group.isHero ? dynamicHeroSize * 1.5 : dynamicBaseSize}
                forceFontFamily={group.isHero ? heroFontFamily : templateConfig.fontFamily}
                forceFontWeight={group.isHero ? heroFontWeight : templateConfig.fontWeight}
              targetDepth={targetDepth}
            />
            );
          })}
        </div>
      ))}
    </div>
  );
};

// ─── CORNER HERO LAYOUT ───────────────────────────────────────────────────
export const CornerHeroLayout = ({ segment, templateConfig, time, dynamicBaseSize, dynamicHeroSize, videoScale, alignment, targetDepth = 'all' }: LayoutProps) => {
  const words = segment.words;
  const heroWords = words.filter(w => w.emphasis === 'hero' || w.isNumberGroup);
  const baseWords = words.filter(w => w.emphasis !== 'hero' && !w.isNumberGroup);
  
  const heroFontFamily = templateConfig.heroFontFamily ?? templateConfig.fontFamily;
  const pos = templateConfig.heroPosition || 'corner-tl';

  return (
    <div className="w-full h-full relative pointer-events-none">
      {/* Supporting text centered bottom by default */}
      <div className="absolute bottom-[10%] w-full flex justify-center flex-wrap gap-[0.35em]">
        {baseWords.map((word, i) => (
          <AnimatedWord key={word.id} word={word} index={i} segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale} forceColor={templateConfig.baseColor}
            forceFontSize={dynamicBaseSize} targetDepth={targetDepth}
          />
        ))}
      </div>
      
      {/* Hero pinned to corner */}
      <div className={cn('absolute flex flex-wrap gap-[0.2em]', 
        pos.includes('tl') ? 'top-[10%] left-[10%]' : 
        pos.includes('tr') ? 'top-[10%] right-[10%]' : 
        pos.includes('bl') ? 'bottom-[10%] left-[10%]' : 'bottom-[10%] right-[10%]'
      )}>
        {heroWords.map((word, i) => {
           const isCountUp = templateConfig.countUpEnabled && word.isNumberGroup;
           const WordComponent = isCountUp ? CountUpWord : AnimatedWord;
           return <WordComponent key={word.id} word={word} index={i + baseWords.length} segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale} forceColor={templateConfig.heroColor}
            forceFontSize={dynamicHeroSize} forceFontFamily={heroFontFamily} targetDepth={targetDepth}
           />
        })}
      </div>
    </div>
  );
};

// ─── SPLIT HERO LAYOUT ────────────────────────────────────────────────────
export const SplitHeroLayout = ({ segment, templateConfig, time, dynamicBaseSize, dynamicHeroSize, videoScale, alignment, targetDepth = 'all' }: LayoutProps) => {
  const groups = getGroupedWords(segment.words);
  const heroFontFamily = templateConfig.heroFontFamily ?? templateConfig.fontFamily;

  return (
    <div className="flex flex-col w-full h-full justify-evenly items-center pointer-events-none py-[20%]">
      {groups.map((group, gIdx) => (
        <div key={gIdx} className="flex flex-wrap justify-center gap-[0.3em]">
          {group.words.map((word, i) => {
            const isCountUp = group.isHero && templateConfig.countUpEnabled && word.isNumberGroup;
            const WordComponent = isCountUp ? CountUpWord : AnimatedWord;
            return <WordComponent key={word.id} word={word} index={i + gIdx * 10} segmentStart={segment.start} segmentEnd={segment.end}
              templateConfig={templateConfig} time={time} videoScale={videoScale}
              forceColor={group.isHero ? templateConfig.heroColor : templateConfig.baseColor}
              forceFontSize={group.isHero ? dynamicHeroSize * 1.2 : dynamicBaseSize * 1.2}
              forceFontFamily={group.isHero ? heroFontFamily : templateConfig.fontFamily}
            targetDepth={targetDepth}
            />
          })}
        </div>
      ))}
    </div>
  );
};

// ─── GIANT BG WORD LAYOUT ─────────────────────────────────────────────────
export const GiantBgWordLayout = ({ segment, templateConfig, time, dynamicBaseSize, dynamicHeroSize, videoScale, alignment, targetDepth = 'all' }: LayoutProps) => {
  const heroWords = segment.words.filter(w => w.emphasis === 'hero' || w.isNumberGroup);
  const heroFontFamily = templateConfig.heroFontFamily ?? templateConfig.fontFamily;
  const bgSize = templateConfig.bgWordSize ? templateConfig.bgWordSize * dynamicBaseSize : dynamicHeroSize * 3;
  
  return (
    <div className="w-full h-full relative pointer-events-none flex justify-center items-center">
      {heroWords.length > 0 && (
        <div className="absolute inset-0 flex justify-center items-center overflow-hidden z-0" style={{ opacity: templateConfig.bgWordOpacity ?? 0.15, filter: `blur(${templateConfig.bgWordBlur ?? 0}px)` }}>
           {heroWords.map((word, i) => (
             <AnimatedWord key={`bg-${word.id}`} word={word} index={i} segmentStart={segment.start} segmentEnd={segment.end}
              templateConfig={{...templateConfig, entranceAnimation: 'fade'}} time={time} videoScale={videoScale} 
              forceColor={templateConfig.heroColor} forceFontSize={bgSize} forceFontFamily={heroFontFamily} targetDepth={targetDepth}
            />
           ))}
        </div>
      )}
      
      <div className="z-10 flex flex-wrap justify-center gap-[0.35em] max-w-[80%]">
        {segment.words.map((word, i) => (
          <AnimatedWord key={word.id} word={word} index={i} segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale} 
            forceColor={templateConfig.baseColor} forceFontSize={dynamicBaseSize} targetDepth={targetDepth}
          />
        ))}
      </div>
    </div>
  );
};

// ─── SENTENCE HERO LAYOUT ─────────────────────────────────────────────────
export const SentenceHeroLayout = ({ segment, templateConfig, time, dynamicBaseSize, dynamicHeroSize, videoScale, alignment, targetDepth = 'all' }: LayoutProps) => {
  const groups = getGroupedWords(segment.words);
  const heroFontFamily = templateConfig.heroFontFamily ?? templateConfig.fontFamily;

  return (
    <div className="flex flex-col justify-end pb-[15%] items-center w-full h-full pointer-events-none">
       {groups.filter(g => g.isHero).map((group, gIdx) => (
         <div key={`h-${gIdx}`} className="flex justify-center gap-[0.2em] mb-4">
           {group.words.map((word, i) => {
             const isCountUp = templateConfig.countUpEnabled && word.isNumberGroup;
             const WordComponent = isCountUp ? CountUpWord : AnimatedWord;
             return <WordComponent key={word.id} word={word} index={i} segmentStart={segment.start} segmentEnd={segment.end}
              templateConfig={templateConfig} time={time} videoScale={videoScale} 
              forceColor={templateConfig.heroColor} forceFontSize={dynamicHeroSize * 1.5} forceFontFamily={heroFontFamily} targetDepth={targetDepth}
             />
           })}
         </div>
       ))}
       <div className="flex flex-wrap justify-center gap-[0.35em] max-w-[85%]">
         {segment.words.map((word, i) => (
            <AnimatedWord key={word.id} word={word} index={i + 10} segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale} 
            forceColor={templateConfig.baseColor} forceFontSize={dynamicBaseSize * 0.8} targetDepth={targetDepth}
          />
         ))}
       </div>
    </div>
  );
};

// ─── HERO MICRO LAYOUT ────────────────────────────────────────────────────
export const HeroMicroLayout = ({ segment, templateConfig, time, dynamicBaseSize, dynamicHeroSize, videoScale, alignment, targetDepth = 'all' }: LayoutProps) => {
  const groups = getGroupedWords(segment.words);
  const heroFontFamily = templateConfig.heroFontFamily ?? templateConfig.fontFamily;

  return (
    <div className="flex flex-col justify-center items-center w-full h-full pointer-events-none gap-[1%]">
       {groups.map((group, gIdx) => (
         <div key={gIdx} className="flex justify-center gap-[0.2em]">
           {group.words.map((word, i) => {
             const isHero = group.isHero;
             const isCountUp = isHero && templateConfig.countUpEnabled && word.isNumberGroup;
             const WordComponent = isCountUp ? CountUpWord : AnimatedWord;
             return <WordComponent key={word.id} word={word} index={i + gIdx * 5} segmentStart={segment.start} segmentEnd={segment.end}
              templateConfig={templateConfig} time={time} videoScale={videoScale} 
              forceColor={isHero ? templateConfig.heroColor : templateConfig.baseColor} 
              forceFontSize={isHero ? dynamicHeroSize * 2 : dynamicBaseSize * 0.5} 
              forceFontFamily={isHero ? heroFontFamily : templateConfig.fontFamily} 
              forceFontWeight={isHero ? templateConfig.heroFontWeight : 400} targetDepth={targetDepth}
             />
           })}
         </div>
       ))}
    </div>
  );
};


// --- SUBTITLE HIGHLIGHT LAYOUT ------------------------------------------------
// Reference: subtitle-highlight_350p.mp4
// Active spoken word gets a colored background highlight pill. No scale change.
export const SubtitleHighlightLayout = ({
  segment, templateConfig, time, dynamicBaseSize, videoScale, targetDepth = 'all',
}: LayoutProps) => {
  const [activeWordId, setActiveWordId] = React.useState<string | null>(null);
  const [segOpacity, setSegOpacity] = React.useState(0);

  React.useEffect(() => {
    const unsub1 = time.on('change', (t: number) => {
      const active = segment.words.find(w => t >= w.start && t < w.end);
      setActiveWordId(active?.id ?? null);
    });
    return unsub1;
  }, [time, segment.words]);

  React.useEffect(() => {
    const unsub2 = time.on('change', (t: number) => {
      const raw = Math.min(1, Math.max(0, (t - segment.start) / 0.2));
      const exit = Math.min(1, Math.max(0, (t - segment.end) / 0.15));
      setSegOpacity(raw - exit);
    });
    return unsub2;
  }, [time, segment.start, segment.end]);

  const hlColor = templateConfig.highlightColor ?? '#F5D020';
  const padX = (templateConfig.highlightPadX ?? 10) * videoScale;
  const padY = (templateConfig.highlightPadY ?? 3) * videoScale;
  const radius = (templateConfig.highlightRadius ?? 5) * videoScale;

  return (
    <div className="flex flex-wrap justify-center gap-[0.25em] max-w-[88%] pointer-events-none"
      style={{
        fontFamily: templateConfig.fontFamily, fontWeight: templateConfig.fontWeight,
        fontStyle: templateConfig.fontStyle, fontSize: `${dynamicBaseSize}px`,
        letterSpacing: templateConfig.letterSpacing, lineHeight: templateConfig.lineHeight,
        textShadow: templateConfig.shadow && templateConfig.shadow !== 'none' ? templateConfig.shadow : undefined,
        opacity: segOpacity,
      }}
    >
      {segment.words.map((word) => {
        const isActive = word.id === activeWordId;
        return (
          <span key={word.id} style={{
            display: 'inline-block',
            color: isActive ? (templateConfig.heroColor ?? '#111111') : templateConfig.baseColor,
            backgroundColor: isActive ? hlColor : 'transparent',
            padding: `${padY}px ${isActive ? padX : 0}px`,
            borderRadius: `${radius}px`,
            transition: 'background-color 0.1s ease, color 0.1s ease, padding 0.1s ease',
            fontWeight: isActive ? (templateConfig.heroFontWeight ?? templateConfig.fontWeight) : templateConfig.fontWeight,
          }}>
            {word.text}
          </span>
        );
      })}
    </div>
  );
};

// --- MULTI POSITION LAYOUT ----------------------------------------------------
// Reference: multi-position-text-plain_350p.mp4, multi-position-text-color_350p.mp4
// Caption groups cycle deterministically through screen positions.
const MULTI_POSITIONS = [
  { top: '8%',  left: '6%',  right: 'auto', bottom: 'auto', align: 'flex-start' as const },
  { top: '8%',  right: '6%', left: 'auto',  bottom: 'auto', align: 'flex-end' as const },
  { top: '8%',  left: '0',   right: '0',    bottom: 'auto', align: 'center' as const },
  { bottom: '16%', left: '6%', right: 'auto', top: 'auto', align: 'flex-start' as const },
  { bottom: '16%', right: '6%',left: 'auto',  top: 'auto', align: 'flex-end' as const },
  { top: '0', bottom: '0', left: '0', right: '0', align: 'center' as const },
];

export const MultiPositionLayout = ({
  segment, templateConfig, time, dynamicBaseSize, dynamicHeroSize, videoScale, targetDepth = 'all',
}: LayoutProps) => {
  const posIdx = Math.floor(segment.start * 10) % MULTI_POSITIONS.length;
  const pos = MULTI_POSITIONS[posIdx];
  const heroFF = templateConfig.heroFontFamily ?? templateConfig.fontFamily;
  const heroFS = templateConfig.heroFontStyle  ?? templateConfig.fontStyle;
  const heroFW = templateConfig.heroFontWeight ?? templateConfig.fontWeight;
  const firstHeroIdx = segment.words.findIndex(w => w.emphasis === 'hero' || w.isNumberGroup);
  const preW  = firstHeroIdx === -1 ? segment.words : segment.words.slice(0, firstHeroIdx);
  const heroW = firstHeroIdx === -1 ? [] : segment.words.filter(w => w.emphasis === 'hero' || w.isNumberGroup);
  const postW = firstHeroIdx === -1 ? [] : segment.words.slice(firstHeroIdx + heroW.length);

  return (
    <div className="absolute pointer-events-none" style={{
      top: pos.top, left: pos.left, right: pos.right, bottom: pos.bottom,
      display: 'flex', flexDirection: 'column', alignItems: pos.align,
      gap: `${dynamicBaseSize * 0.12}px`, maxWidth: '80%',
    }}>
      {preW.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: pos.align, gap: '0.25em',
          fontFamily: templateConfig.fontFamily, fontWeight: templateConfig.fontWeight,
          fontStyle: templateConfig.fontStyle, fontSize: `${dynamicBaseSize}px`,
          letterSpacing: templateConfig.letterSpacing }}>
          {preW.map((word, i) => <AnimatedWord key={word.id} word={word} index={i}
            segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale}
            forceColor={templateConfig.baseColor} targetDepth={targetDepth} />)}
        </div>
      )}
      {heroW.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: pos.align, gap: '0.1em',
          fontFamily: heroFF, fontWeight: heroFW, fontStyle: heroFS,
          fontSize: `${dynamicHeroSize}px`, lineHeight: 1.0 }}>
          {heroW.map((word, i) => <AnimatedWord key={word.id} word={word} index={preW.length + i}
            segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale}
            forceColor={templateConfig.heroColor}
            forceFontFamily={heroFF} forceFontWeight={heroFW} forceFontStyle={heroFS}
            forceFontSize={dynamicHeroSize} targetDepth={targetDepth} />)}
        </div>
      )}
      {postW.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: pos.align, gap: '0.25em',
          fontFamily: templateConfig.fontFamily, fontWeight: templateConfig.fontWeight,
          fontStyle: templateConfig.fontStyle, fontSize: `${dynamicBaseSize}px` }}>
          {postW.map((word, i) => <AnimatedWord key={word.id} word={word} index={preW.length + heroW.length + i}
            segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale}
            forceColor={templateConfig.baseColor} targetDepth={targetDepth} />)}
        </div>
      )}
    </div>
  );
};

// --- DIFFERENCE TEXT LAYOUT ---------------------------------------------------
// Reference: difference-text_350p.mp4
// Small supporting words above + very large hero word below. ~3x size contrast.
export const DifferenceTextLayout = ({
  segment, templateConfig, time, dynamicBaseSize, dynamicHeroSize, videoScale, targetDepth = 'all',
}: LayoutProps) => {
  const heroFF = templateConfig.heroFontFamily ?? templateConfig.fontFamily;
  const heroFW = templateConfig.heroFontWeight ?? templateConfig.fontWeight;
  const heroFS = templateConfig.heroFontStyle  ?? templateConfig.fontStyle;
  const firstHeroIdx = segment.words.findIndex(w => w.emphasis === 'hero' || w.isNumberGroup);
  const preW  = firstHeroIdx === -1 ? segment.words : segment.words.slice(0, firstHeroIdx);
  const heroW = firstHeroIdx === -1 ? [] : segment.words.filter(w => w.emphasis === 'hero' || w.isNumberGroup);
  const postW = firstHeroIdx === -1 ? [] : segment.words.slice(firstHeroIdx + heroW.length);
  const supporting = [...preW, ...postW];
  const shadowVal = templateConfig.shadow && templateConfig.shadow !== 'none' ? templateConfig.shadow : undefined;

  return (
    <div className="flex flex-col items-center pointer-events-none" style={{ gap: `${dynamicBaseSize * 0.2}px` }}>
      {supporting.length > 0 && (
        <div className="flex flex-wrap justify-center gap-[0.3em]" style={{
          fontFamily: templateConfig.fontFamily, fontWeight: templateConfig.fontWeight,
          fontStyle: templateConfig.fontStyle, fontSize: `${dynamicBaseSize}px`,
          letterSpacing: templateConfig.letterSpacing, lineHeight: templateConfig.lineHeight,
          textShadow: shadowVal,
        }}>
          {supporting.map((word, i) => <AnimatedWord key={word.id} word={word} index={i}
            segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale}
            forceColor={templateConfig.baseColor} forceFontSize={dynamicBaseSize}
            targetDepth={targetDepth} />)}
        </div>
      )}
      {heroW.length > 0 && (
        <div className="flex flex-wrap justify-center gap-[0.05em]" style={{
          fontFamily: heroFF, fontWeight: heroFW, fontStyle: heroFS,
          fontSize: `${dynamicHeroSize}px`, lineHeight: 0.9,
          letterSpacing: '-0.02em', textShadow: shadowVal,
        }}>
          {heroW.map((word, i) => <AnimatedWord key={word.id} word={word} index={i + 10}
            segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale}
            forceColor={templateConfig.heroColor}
            forceFontFamily={heroFF} forceFontWeight={heroFW} forceFontStyle={heroFS}
            forceFontSize={dynamicHeroSize} targetDepth={targetDepth} />)}
        </div>
      )}
      {firstHeroIdx === -1 && (
        <div className="flex flex-wrap justify-center gap-[0.3em]" style={{
          fontFamily: templateConfig.fontFamily, fontWeight: templateConfig.fontWeight,
          fontSize: `${dynamicBaseSize}px`,
        }}>
          {segment.words.map((word, i) => <AnimatedWord key={word.id} word={word} index={i}
            segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale}
            forceColor={templateConfig.baseColor} targetDepth={targetDepth} />)}
        </div>
      )}
    </div>
  );
};

// --- BOLD BEHIND LAYOUT -------------------------------------------------------
// Reference: bold-text-behind_350p.mp4, serif-italic-text-behind_350p.mp4
// Hero word placed behind subject (captionDepth: 'behind-subject').
// targetDepth='behind' ? hero only (behind subject layer)
// targetDepth='front'  ? supporting words or fallback hero in front
export const BoldBehindLayout = ({
  segment, templateConfig, time, dynamicBaseSize, dynamicHeroSize, videoScale, targetDepth = 'all',
}: LayoutProps) => {
  const heroFF = templateConfig.heroFontFamily ?? templateConfig.fontFamily;
  const heroFW = templateConfig.heroFontWeight ?? templateConfig.fontWeight;
  const heroWords = segment.words.filter(w => w.emphasis === 'hero' || w.isNumberGroup);
  const baseWords = segment.words.filter(w => w.emphasis !== 'hero' && !w.isNumberGroup);
  const displayWord = heroWords[0] ?? segment.words[0];
  if (!displayWord) return null;
  const heroSize = dynamicHeroSize * 2.4;
  const shadowVal = '2px 4px 16px rgba(0,0,0,0.85)';

  const HeroWordEl = () => (
    <AnimatedWord key={"hw-" + displayWord.id} word={displayWord} index={0}
      segmentStart={segment.start} segmentEnd={segment.end}
      templateConfig={{ ...templateConfig, shadow: shadowVal }}
      time={time} videoScale={videoScale}
      forceColor={templateConfig.heroColor}
      forceFontFamily={heroFF} forceFontWeight={heroFW}
      forceFontSize={heroSize} targetDepth={targetDepth} />
  );

  if (targetDepth === 'behind') {
    return <div className="absolute inset-0 flex justify-center pointer-events-none" style={{ paddingTop: '4%' }}><HeroWordEl /></div>;
  }

  if (targetDepth === 'front') {
    if (baseWords.length > 0) {
      return (
        <div className="flex flex-wrap justify-center gap-[0.3em] pointer-events-none"
          style={{ fontFamily: templateConfig.fontFamily, fontWeight: templateConfig.fontWeight, fontSize: `${dynamicBaseSize}px` }}>
          {baseWords.map((word, i) => <AnimatedWord key={word.id} word={word} index={i}
            segmentStart={segment.start} segmentEnd={segment.end}
            templateConfig={templateConfig} time={time} videoScale={videoScale}
            forceColor={templateConfig.baseColor} forceFontSize={dynamicBaseSize}
            targetDepth={targetDepth} />)}
        </div>
      );
    }
    // Fallback: segmentation unavailable ? show hero in front
    return <div className="flex justify-center pointer-events-none" style={{ paddingTop: '4%' }}><HeroWordEl /></div>;
  }

  // 'all' mode preview � show hero
  return <div className="flex justify-center pointer-events-none" style={{ paddingTop: '4%' }}><HeroWordEl /></div>;
};
// Export a registry map to be used by CaptionEngine
export const LayoutRegistry: Record<string, React.FC<any>> = {
  'hero-interruption': HeroInterruptionLayout,
  'corner-hero': CornerHeroLayout,
  'split-hero': SplitHeroLayout,
  'editorial-offset': HeroInterruptionLayout, // Fallback for brevity
  'giant-bg': GiantBgWordLayout,
  'vertical-stack': SplitHeroLayout, // Fallback
  'sentence-hero': SentenceHeroLayout,
  'hero-micro': HeroMicroLayout,
  'editorial-magazine': SentenceHeroLayout, // Fallback
  'word-collision': HeroInterruptionLayout, // Fallback
  'cinematic': SentenceHeroLayout, // Fallback
  'kinetic': SplitHeroLayout, // Fallback
  'subtitle-highlight': SubtitleHighlightLayout,
  'multi-position': MultiPositionLayout,
  'difference-text': DifferenceTextLayout,
  'bold-behind': BoldBehindLayout,
};
