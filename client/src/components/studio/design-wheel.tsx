import React, { useState, useRef, useEffect } from 'react';
import { motion, useAnimation } from 'motion/react';
import { 
  Layers, 
  Type, 
  Film, 
  PaintRoller, 
  LayoutTemplate, 
  Hash, 
  Palette, 
  Wand2
} from 'lucide-react';

export type ToolId = 'clips' | 'templates' | 'typography' | 'animation' | 'color' | 'layout' | 'numbers' | 'depth';

interface ToolItem {
  id: ToolId;
  label: string;
  icon: React.ElementType;
}

const TOOLS: ToolItem[] = [
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'clips', label: 'Clips', icon: Film },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'animation', label: 'Animation', icon: Wand2 },
  { id: 'color', label: 'Color', icon: Palette },
  { id: 'layout', label: 'Layout', icon: Layers },
  { id: 'numbers', label: 'Numbers', icon: Hash },
  { id: 'depth', label: 'Depth', icon: PaintRoller },
];

export function DesignWheel({ 
  activeTool, 
  onSelectTool 
}: { 
  activeTool: ToolId; 
  onSelectTool: (id: ToolId) => void 
}) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const controls = useAnimation();
  const currentAngle = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const segmentAngle = 360 / TOOLS.length;

  // Track pointer for manual rotation
  const dragStartAngle = useRef(0);
  const dragStartRotation = useRef(0);

  const getAngleFromCenter = (clientX: number, clientY: number) => {
    if (!wheelRef.current) return 0;
    const rect = wheelRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    // Make 0 degrees point UP (-90 in standard math)
    angle += 90;
    if (angle < 0) angle += 360;
    return angle;
  };

  useEffect(() => {
    if (!isDragging) {
      const targetIndex = TOOLS.findIndex(t => t.id === activeTool);
      if (targetIndex !== -1) {
        // Find shortest path
        let targetRotation = -targetIndex * segmentAngle;
        let diff = (targetRotation - currentAngle.current) % 360;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        
        currentAngle.current += diff;
        
        controls.start({
          rotate: currentAngle.current,
          transition: { type: 'spring', stiffness: 200, damping: 20 }
        });
      }
    }
  }, [activeTool, controls, isDragging, segmentAngle]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartAngle.current = getAngleFromCenter(e.clientX, e.clientY);
    dragStartRotation.current = currentAngle.current;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const currentPointerAngle = getAngleFromCenter(e.clientX, e.clientY);
    
    // Calculate difference (handle wraparound)
    let diff = currentPointerAngle - dragStartAngle.current;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const newRotation = dragStartRotation.current + diff;
    currentAngle.current = newRotation;
    controls.set({ rotate: newRotation });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!isDragging) return;
    setIsDragging(false);

    // Snap to nearest segment
    const normalizedRotation = currentAngle.current % 360;
    const positiveRotation = normalizedRotation < 0 ? normalizedRotation + 360 : normalizedRotation;
    
    // Find nearest multiple of segmentAngle
    const snapRotation = Math.round(currentAngle.current / segmentAngle) * segmentAngle;
    currentAngle.current = snapRotation;
    
    // Which index does this correspond to?
    // snapRotation = -i * segmentAngle + k * 360
    let snappedIndex = Math.round(-snapRotation / segmentAngle) % TOOLS.length;
    if (snappedIndex < 0) snappedIndex += TOOLS.length;
    
    onSelectTool(TOOLS[snappedIndex].id);
    
    controls.start({
      rotate: snapRotation,
      transition: { type: 'spring', stiffness: 250, damping: 25 }
    });
  };

  const activeToolObj = TOOLS.find(t => t.id === activeTool) || TOOLS[0];

  return (
    <div className="flex flex-col items-center justify-center w-full h-full relative p-4 pointer-events-none select-none">
      <div 
        ref={wheelRef}
        className="relative w-64 h-64 md:w-[320px] md:h-[320px] clay-surface rounded-full flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <motion.div 
          animate={controls}
          className="absolute inset-0 w-full h-full rounded-full"
          style={{ originX: 0.5, originY: 0.5 }}
        >
          {TOOLS.map((tool, index) => {
            const angle = index * segmentAngle;
            // The item is placed at `angle` around the circle.
            // On desktop we translate out 110px, maybe 130px for 320px wheel
            // Using a relative % translation is safer: translateY(-38%) of the 320px is ~120px
            return (
              <div 
                key={tool.id}
                className="absolute w-16 h-16 left-1/2 top-1/2 -mt-8 -ml-8 flex flex-col items-center justify-center text-on-surface"
                style={{
                  transform: `rotate(${angle}deg) translateY(-120px)`,
                  opacity: activeTool === tool.id ? 1 : 0.4,
                  transition: 'opacity 0.3s'
                }}
              >
                <tool.icon className="w-5 h-5 mb-1.5" strokeWidth={activeTool === tool.id ? 2.5 : 2} />
                <span className="text-[10px] font-bold tracking-widest uppercase opacity-90" style={{ fontFamily: 'var(--font-label-md)' }}>
                  {tool.label}
                </span>
              </div>
            );
          })}
        </motion.div>

        {/* Center Hub Indicator */}
        <div className="absolute w-24 h-24 bg-surface rounded-full shadow-[inset_0_-4px_8px_rgba(0,0,0,0.1),_0_8px_16px_rgba(0,0,0,0.05)] flex items-center justify-center z-10 pointer-events-none">
          <div className="w-20 h-20 rounded-full border-2 border-surface-container-highest flex flex-col items-center justify-center text-primary">
            {activeToolObj && <activeToolObj.icon className="w-6 h-6 mb-1" />}
            {activeToolObj && <span className="text-[9px] font-bold tracking-widest uppercase">{activeToolObj.label}</span>}
          </div>
        </div>

        {/* Outer Ring Indicator at top (0 degrees) */}
        <div className="absolute -top-3 w-6 h-6 rounded-full bg-primary shadow-[0_0_15px_rgba(230,92,64,0.5)] pointer-events-none z-20 flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full"></div>
        </div>
      </div>
    </div>
  );
}
