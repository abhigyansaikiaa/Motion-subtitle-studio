import React, { useEffect, useState } from 'react';
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
};
