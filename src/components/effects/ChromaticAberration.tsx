import React, { useEffect, useRef } from 'react';

interface ChromaticAberrationProps {
  spread?: number; // 0-100
  angle?: number; // 0-360
  steps?: number; // 0-50
  tiltShift?: number; // 0-100
  colorMode?: 'Blue/Green' | 'Red/Blue' | 'RGB';
  blend?: boolean;
  style?: React.CSSProperties;
}

export function ChromaticAberration({
  spread = 47,
  angle = 88,
  steps = 14,
  tiltShift = 81,
  colorMode = 'Blue/Green',
  blend = true,
  style = {}
}: ChromaticAberrationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const colors = colorMode === 'Blue/Green' 
      ? ['#00FFFF', '#00FF00', '#FFFF00']
      : colorMode === 'Red/Blue'
      ? ['#FF0000', '#0000FF', '#FF00FF']
      : ['#FF0000', '#00FF00', '#0000FF'];

    const maxOffset = (spread / 100) * 15;
    const blurAmount = tiltShift / 20;
    const alpha = blend ? 0.08 / steps : 0.15 / steps;
    let time = 0;
    const speed = 0.25;

    const render = () => {
      time += 0.016; // ~60fps
      
      // JSON에서 angle이 동적으로 변함: (0.2457 + uTime * 0.05) * 360.0
      const dynamicAngle = ((0.2457 + time * 0.05) * 360.0) % 360;
      const rad = (dynamicAngle * Math.PI) / 180;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      for (let i = 0; i < steps; i++) {
        const offset = (i / steps) * maxOffset;
        const x = Math.cos(rad) * offset;
        const y = Math.sin(rad) * offset;
        const colorIndex = Math.floor((i / steps) * colors.length) % colors.length;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.globalCompositeOperation = blend ? 'screen' : 'multiply';
        ctx.filter = `blur(${blurAmount}px)`;
        ctx.fillStyle = colors[colorIndex];
        ctx.fillRect(x, y, canvas.width, canvas.height);
        ctx.restore();
      }
      
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [spread, angle, steps, tiltShift, colorMode, blend]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        mixBlendMode: 'screen',
        opacity: 0.6,
        filter: 'blur(2px) contrast(1.2)',
        ...style
      }}
    />
  );
}

