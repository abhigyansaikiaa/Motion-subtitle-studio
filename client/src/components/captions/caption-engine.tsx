import React, { useMemo, useState } from 'react';
import type { Segment, Word, TemplateDefinition } from '../../lib/types';
import { cn } from '../../lib/utils';
import { useAppStore } from '../../lib/store';
import { getTemplate } from '../../lib/templates';
import { motion, useMotionValue, useTransform, useAnimationFrame } from 'motion/react';

interface CaptionEngineProps {
  targetDepth?: 'front' | 'behind' | 'all';
  segments?: Segment[];
  currentTime?: number;
  template?: TemplateDefinition;
  compositionWidth?: number;
  compositionHeight?: number;
  scale?: number;
}

import { clamp, easeOutCubic, easeOutBack, generateAnimationState } from './animation-primitives';

// ─── ANIMATED WORD ───────────────────────────────────────────────────────────
// Each word animates independently using the shared MotionValue `time`.
// This avoids React re-renders — only the Framer Motion driver reads the value.
export const AnimatedWord = ({
  word,
  index,
  segmentStart,
  segmentEnd,
  templateConfig,
  time,
  videoScale = 1,
  compositionWidth = 1080,
  compositionHeight = 1920,
  forceColor,
  forceFontSize,
  forceFontFamily,
  forceFontWeight,
  forceFontStyle,
  forceEntranceAnimation,
  targetDepth = 'all',
}: {
  word: Word;
  index: number;
  segmentStart: number;
  segmentEnd: number;
  templateConfig: TemplateDefinition;
  time: any;
  videoScale?: number;
  compositionWidth?: number;
  compositionHeight?: number;
  forceColor?: string;
  forceFontSize?: number;
  forceFontFamily?: string;
  forceFontWeight?: string | number;
  forceFontStyle?: string;
  forceEntranceAnimation?: string;
  targetDepth?: 'all' | 'front' | 'behind';
}) => {
  const speed = templateConfig.animationSpeed ?? 1.0;
  const entranceDuration = 0.35 * speed;
  
  // If animationLevel is segment, all words animate together (no stagger)
  const staggerDelay = templateConfig.animationLevel === 'segment' ? 0 : index * 0.06 * speed;
  const entranceStart = segmentStart + staggerDelay;

  const derived = useTransform(time, (t: number) => {
    const isActive = t >= word.start && t < word.end;
    const raw = clamp((t - entranceStart) / entranceDuration, 0, 1);
    const eased = easeOutCubic(raw);
    const exitRaw = clamp((t - segmentEnd) / (0.25 * speed), 0, 1);
    const exitEased = easeOutCubic(exitRaw);

    const invEased = 1 - eased;
    let opacity = Math.max(0, eased - exitEased);

    const isHero = word.emphasis === 'hero' || word.isNumberGroup;
    const isAccent = word.emphasis === 'accent';

    // Mixed depth logic: hide words that don't belong on this layer
    const depthSetting = templateConfig.captionDepth || 'front';
    let isVisibleOnLayer = true;
    if (depthSetting === 'mixed' && targetDepth !== 'all') {
      if (targetDepth === 'front' && !isHero) isVisibleOnLayer = false;
      if (targetDepth === 'behind' && isHero) isVisibleOnLayer = false;
    } else if (depthSetting === 'behind-subject' && targetDepth === 'front') {
      isVisibleOnLayer = false;
    } else if (depthSetting === 'front' && targetDepth === 'behind') {
      isVisibleOnLayer = false;
    }

    if (!isVisibleOnLayer || t < segmentStart - 0.5 || t > segmentEnd + 2.0) {
      return { opacity: 0, color: forceColor || '#ffffff', transform: 'scale(1)', filter: 'none' };
    }

    let color = forceColor ?? (isHero ? templateConfig.heroColor : isAccent ? templateConfig.accentColor : templateConfig.baseColor);

    if (!forceColor) {
      if (!isHero && !isAccent) {
        opacity *= templateConfig.baseOpacity ?? 1;
      }
      if (isActive && templateConfig.wordActivation === 'color-fill') {
        color = !isHero ? (templateConfig.accentColor || '#ffffff') : color;
        opacity = Math.max(opacity, eased);
      }
    }

    let animName = forceEntranceAnimation || (isHero && templateConfig.heroEntranceAnimation ? templateConfig.heroEntranceAnimation : templateConfig.entranceAnimation);

    // True Slide Collide logic: alternate odd/even words from left/right
    if (animName === 'slide-collide') {
      animName = index % 2 === 0 ? 'collision-right' : 'collision-left';
    }

    const { scaleX: baseScaleX, scaleY: baseScaleY, translateY, translateX, blur, rotation } = generateAnimationState(
      animName, raw, eased, invEased, videoScale, index, compositionWidth, compositionHeight
    );

    let finalScaleX = baseScaleX;
    let finalScaleY = baseScaleY;

    if (!forceColor && isActive && templateConfig.wordActivation === 'scale-up') {
      finalScaleX *= 1.08;
      finalScaleY *= 1.08;
    }

    return {
      opacity,
      color,
      transform: `translate(${translateX}px, ${translateY}px) scale(${finalScaleX}, ${finalScaleY}) rotateZ(${rotation}deg)`,
      filter: blur > 0 ? `blur(${blur * videoScale}px)` : 'none',
    };
  });

  const opacity   = useTransform(derived, s => s.opacity);
  const color     = useTransform(derived, s => s.color);
  const transform = useTransform(derived, s => s.transform);
  const filter    = useTransform(derived, s => s.filter);

  const style: React.CSSProperties = {
    fontSize: forceFontSize !== undefined ? `${forceFontSize * (word.scale || 1.0)}px` : undefined,
    fontFamily: forceFontFamily ?? undefined,
    fontWeight: forceFontWeight !== undefined ? forceFontWeight : undefined,
    fontStyle: forceFontStyle ?? undefined,
  };

  return (
    <motion.span
      data-testid="caption-word"
      style={{ opacity, color, transform, filter, ...style, transformOrigin: 'center bottom', willChange: 'transform, opacity' }}
      className="inline-block relative"
    >
      {word.text}
    </motion.span>
  );
};

// ─── EDITORIAL LAYOUT ────────────────────────────────────────────────────────
// Splits words into: [pre-hero words] / [hero words] / [post-hero words]
// Hero words render at heroScale with their own font treatment.
// Supporting words wrap above and below the hero line.
const EditorialLayout = ({
  segment,
  templateConfig,
  time,
  dynamicBaseSize,
  dynamicHeroSize,
  videoScale,
  compositionWidth,
  compositionHeight,
  alignment,
  targetDepth = 'all',
}: {
  segment: Segment;
  templateConfig: TemplateDefinition;
  time: any;
  dynamicBaseSize: number;
  dynamicHeroSize: number;
  videoScale: number;
  compositionWidth: number;
  compositionHeight: number;
  alignment: string;
  targetDepth?: 'all' | 'front' | 'behind';
}) => {
  const words = segment.words;

  // Split into pre, hero, post groups
  const firstHeroIdx = words.findIndex(w => w.emphasis === 'hero');
  const lastHeroIdx  = words.reduce((acc, w, i) => w.emphasis === 'hero' ? i : acc, -1);

  let preWords: Word[], heroWords: Word[], postWords: Word[];

  if (firstHeroIdx === -1) {
    // No hero word — show all as supporting
    preWords = words;
    heroWords = [];
    postWords = [];
  } else {
    preWords  = words.slice(0, firstHeroIdx);
    heroWords = words.slice(firstHeroIdx, lastHeroIdx + 1);
    postWords = words.slice(lastHeroIdx + 1);
  }

  const heroFontFamily = templateConfig.heroFontFamily ?? templateConfig.fontFamily;
  const heroFontWeight = templateConfig.heroFontWeight ?? templateConfig.fontWeight;
  const heroFontStyle  = templateConfig.heroFontStyle  ?? templateConfig.fontStyle;

  const alignClass = alignment === 'left' ? 'items-start text-left'
                   : alignment === 'right' ? 'items-end text-right'
                   : 'items-center text-center';

  const gapScale = dynamicBaseSize * 0.2;

  return (
    <div className={cn('flex flex-col pointer-events-none', alignClass)} style={{ gap: `${gapScale}px` }}>
      {/* Pre-hero supporting words */}
      {preWords.length > 0 && (
        <div
          className="flex flex-wrap gap-[0.35em]"
          style={{
            fontFamily: templateConfig.fontFamily,
            fontWeight: templateConfig.fontWeight,
            fontStyle: templateConfig.fontStyle,
            fontSize: `${dynamicBaseSize}px`,
            letterSpacing: templateConfig.letterSpacing,
            lineHeight: templateConfig.lineHeight,
            textTransform: templateConfig.textTransform as any,
            justifyContent: alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center',
          }}
        >
          {preWords.map((word, i) => (
            <AnimatedWord
              key={word.id}
              word={word}
              index={i}
              segmentStart={segment.start}
              segmentEnd={segment.end}
              templateConfig={templateConfig}
              time={time}
              videoScale={videoScale}
              compositionWidth={compositionWidth}
              compositionHeight={compositionHeight}
              forceColor={templateConfig.baseColor}
              targetDepth={targetDepth}
            />
          ))}
        </div>
      )}

      {/* Hero words — own font, own color, own large size */}
      {heroWords.length > 0 && (
        <div
          className="flex flex-wrap gap-[0.2em]"
          style={{
            justifyContent: alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center',
          }}
        >
          {heroWords.map((word, i) => (
            <AnimatedWord
              key={word.id}
              word={word}
              index={preWords.length + i}
              segmentStart={segment.start}
              segmentEnd={segment.end}
              templateConfig={templateConfig}
              time={time}
              videoScale={videoScale}
              compositionWidth={compositionWidth}
              compositionHeight={compositionHeight}
              forceColor={templateConfig.heroColor}
              forceFontSize={dynamicHeroSize}
              forceFontFamily={heroFontFamily}
              forceFontWeight={heroFontWeight}
              forceFontStyle={heroFontStyle}
              targetDepth={targetDepth}
            />
          ))}
        </div>
      )}

      {/* Post-hero supporting words */}
      {postWords.length > 0 && (
        <div
          className="flex flex-wrap gap-[0.35em]"
          style={{
            fontFamily: templateConfig.fontFamily,
            fontWeight: templateConfig.fontWeight,
            fontStyle: templateConfig.fontStyle,
            fontSize: `${dynamicBaseSize}px`,
            letterSpacing: templateConfig.letterSpacing,
            lineHeight: templateConfig.lineHeight,
            textTransform: templateConfig.textTransform as any,
            justifyContent: alignment === 'left' ? 'flex-start' : alignment === 'right' ? 'flex-end' : 'center',
          }}
        >
          {postWords.map((word, i) => (
            <AnimatedWord
              key={word.id}
              word={word}
              index={preWords.length + heroWords.length + i}
              segmentStart={segment.start}
              segmentEnd={segment.end}
              templateConfig={templateConfig}
              time={time}
              videoScale={videoScale}
              compositionWidth={compositionWidth}
              compositionHeight={compositionHeight}
              forceColor={templateConfig.baseColor}
              targetDepth={targetDepth}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ─── CAPTION ENGINE ───────────────────────────────────────────────────────────
import { LayoutRegistry } from './caption-layouts';

export function CaptionEngine({
  targetDepth = 'all',
  segments: propSegments,
  currentTime: propTime,
  template: propTemplate,
  compositionWidth = 1080,
  compositionHeight = 1920,
  scale = 1,
  getVideoTime,
}: CaptionEngineProps & { getVideoTime?: () => number }) {
  const storeSegments       = useAppStore(state => state.editorSegments);
  const selectedStyleId     = useAppStore(state => state.selectedStyleId);
  const customOverrides     = useAppStore(state => state.customOverrides);
  const captionDepthOverride = useAppStore(state => state.captionDepthOverride);
  const isPlaying           = useAppStore(state => state.isPlaying);
  const storeTime           = useAppStore(state => state.currentTime);

  const storeTemplateConfig = useMemo(() => ({
    ...getTemplate(selectedStyleId),
    ...customOverrides,
  }), [selectedStyleId, customOverrides]);

  const segments       = propSegments     || storeSegments;
  const templateConfig = propTemplate     || storeTemplateConfig;

  const time = useMotionValue(propTime ?? storeTime);
  const [activeSegment, setActiveSegment] = useState<Segment | undefined>(undefined);

  // Sync MotionValue from store or props
  useAnimationFrame(() => {
    let t = 0;
    if (getVideoTime) {
      t = getVideoTime();
    } else if (propTime !== undefined) {
      t = propTime;
    } else {
      t = useAppStore.getState().currentTime;
    }
    time.set(t);
    
    // Exact segment boundary check: t >= s.start && t < s.end
    const currentSeg = segments.find(s => t >= s.start && t < s.end);
    if (currentSeg?.id !== activeSegment?.id) {
       setActiveSegment(currentSeg);
    }
  });

  if (!activeSegment || !templateConfig) return null;

  // Depth gating
  const effectiveDepth = captionDepthOverride || templateConfig.captionDepth || 'front';
  const isVisibleLayer = targetDepth === 'all'
    || (targetDepth === 'front'  && effectiveDepth !== 'behind-subject')
    || (targetDepth === 'behind' && effectiveDepth === 'behind-subject');

  // Position → flex alignment classes
  const getPositionClass = () => {
    switch (templateConfig.position) {
      case 'top':          return 'justify-start items-center';
      case 'top-left':     return 'justify-start items-start';
      case 'top-right':    return 'justify-start items-end';
      case 'bottom-left':  return 'justify-end items-start';
      case 'bottom-right': return 'justify-end items-end';
      case 'center':       return 'justify-center items-center';
      case 'bottom':
      default:             return 'justify-end items-center';
    }
  };

  // Dynamic padding that scales with video dimensions
  const getPaddingStyle = (): React.CSSProperties => {
    const refH = compositionHeight || 1920;
    const pt = 48 * (refH / 1920) * scale;
    const pb = 96 * (refH / 1920) * scale;
    const px = 48 * (refH / 1920) * scale;
    const yOffset = (templateConfig.offsetY || 0) * (refH / 1920) * scale;
    const xOffset = (templateConfig.offsetX || 0) * (refH / 1920) * scale;
    
    const baseStyle: React.CSSProperties = { transform: `translate(${xOffset}px, ${yOffset}px)` };

    switch (templateConfig.position) {
      case 'top':          return { ...baseStyle, paddingTop: `${pt}px` };
      case 'top-left':     return { ...baseStyle, paddingTop: `${pt}px`, paddingLeft: `${px}px` };
      case 'top-right':    return { ...baseStyle, paddingTop: `${pt}px`, paddingRight: `${px}px` };
      case 'bottom-left':  return { ...baseStyle, paddingBottom: `${pb}px`, paddingLeft: `${px}px` };
      case 'bottom-right': return { ...baseStyle, paddingBottom: `${pb}px`, paddingRight: `${px}px` };
      case 'center':       return { ...baseStyle };
      case 'bottom':
      default:             return { ...baseStyle, paddingBottom: `${pb}px` };
    }
  };

  // Inline/stacked layout classes
  const getLayoutClass = () => {
    switch (templateConfig.layoutType) {
      case 'stacked':    return 'flex-col text-center';
      case 'asymmetric': return 'flex-wrap justify-start text-left';
      case 'editorial':  return templateConfig.alignment === 'left'  ? 'flex-wrap justify-start text-left'
                              : templateConfig.alignment === 'right' ? 'flex-wrap justify-end text-right'
                              : 'flex-wrap justify-center text-center';
      case 'inline':
      default:           return templateConfig.alignment === 'center' ? 'flex-wrap justify-center text-center'
                              : templateConfig.alignment === 'right'  ? 'flex-wrap justify-end text-right'
                              : 'flex-wrap justify-start text-left';
    }
  };

  // Font sizes scaled to actual composition dimensions
  const refH = compositionHeight || 1920;
  const dynamicBaseSize = (templateConfig.baseSize * scale) * (refH / 1920);
  const dynamicHeroSize = dynamicBaseSize * (templateConfig.heroScale ?? 2.0);
  const videoScale      = scale * (refH / 1920);

  const isEditorial = templateConfig.layoutType === 'editorial';
  const CustomLayoutComponent = LayoutRegistry[templateConfig.layoutType];

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    
    const startX = e.clientX;
    const startY = e.clientY;
    
    const storeState = useAppStore.getState();
    const startOffsetX = storeState.customOverrides.offsetX ?? templateConfig.offsetX ?? 0;
    const startOffsetY = storeState.customOverrides.offsetY ?? templateConfig.offsetY ?? 0;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) / (scale * (refH / 1920));
      const deltaY = (moveEvent.clientY - startY) / (scale * (refH / 1920));
      
      useAppStore.getState().setCustomOverrides({
        ...useAppStore.getState().customOverrides,
        offsetX: startOffsetX + deltaX,
        offsetY: startOffsetY + deltaY,
      });
    };

    const handlePointerUp = () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div
      data-testid="caption-engine"
      className={cn(
        'absolute inset-0 pointer-events-none flex flex-col w-full h-full z-10 overflow-hidden',
        getPositionClass(),
      )}
      style={{ opacity: isVisibleLayer ? 1 : 0, ...getPaddingStyle() }}
    >
      <div 
        className="pointer-events-auto cursor-move inline-flex flex-col items-center justify-center"
        onPointerDown={handlePointerDown}
        style={{ touchAction: 'none' }}
      >
        {CustomLayoutComponent ? (
        /* ── Dynamic Editorial Layout from Registry ────────────────────── */
        <CustomLayoutComponent
          segment={activeSegment}
          templateConfig={templateConfig}
          time={time}
          dynamicBaseSize={dynamicBaseSize}
          dynamicHeroSize={dynamicHeroSize}
          videoScale={videoScale}
          alignment={templateConfig.alignment}
          targetDepth={targetDepth}
        />
      ) : isEditorial ? (
        /* ── Legacy Editorial two-tier layout ──────────────────────────── */
        <EditorialLayout
          segment={activeSegment}
          templateConfig={templateConfig}
          time={time}
          dynamicBaseSize={dynamicBaseSize}
          dynamicHeroSize={dynamicHeroSize}
          videoScale={videoScale}
          compositionWidth={compositionWidth}
          compositionHeight={compositionHeight}
          alignment={templateConfig.alignment}
          targetDepth={targetDepth}
        />
      ) : (
        /* ── Standard inline / stacked layout ─────────────────────────── */
        <div
          className={cn('flex gap-[0.3em] max-w-[85%]', getLayoutClass())}
          style={{
            fontFamily:     templateConfig.fontFamily,
            fontWeight:     templateConfig.fontWeight,
            fontStyle:      templateConfig.fontStyle,
            textTransform:  templateConfig.textTransform as any,
            fontSize:       `${dynamicBaseSize}px`,
            letterSpacing:  templateConfig.letterSpacing,
            lineHeight:     templateConfig.lineHeight,
            textShadow:     templateConfig.shadow !== 'none' ? templateConfig.shadow : undefined,
            WebkitTextStroke: templateConfig.outline && templateConfig.outline !== 'none'
              ? templateConfig.outline.replace('solid ', '')
              : undefined,
          }}
        >
          {activeSegment.words.map((word, index) => (
            <AnimatedWord
              key={word.id}
              word={word}
              index={index}
              segmentStart={activeSegment.start}
              segmentEnd={activeSegment.end}
              templateConfig={templateConfig}
              time={time}
              videoScale={videoScale}
              compositionWidth={compositionWidth}
              compositionHeight={compositionHeight}
              targetDepth={targetDepth}
            />
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
