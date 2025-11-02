import React, { useEffect, useRef } from 'react';

interface CausticsProps {
  scale?: number; // 0-100
  refraction?: number; // 0-100
  distortion?: number; // 0-100
  angle?: number; // -180 to 180
  color?: string;
  blendMode?: 'Screen' | 'Multiply' | 'Overlay' | 'Normal';
  speed?: number; // 0-100
  drift?: number; // 0-100
  trackMouse?: number; // 0-100
  mouseAxes?: 'X only' | 'Y only' | 'Both';
  momentum?: number; // 0-100
  style?: React.CSSProperties;
}

export function Caustics({
  scale = 16,
  refraction = 15,
  distortion = 25,
  angle = -7,
  color = '#6BD2FF',
  blendMode = 'Screen',
  speed = 11,
  drift = 18,
  trackMouse = 12,
  mouseAxes = 'Both',
  momentum = 0,
  style = {}
}: CausticsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mousePosRef = useRef({ x: 0.5, y: 0.5 });
  const velocityRef = useRef({ x: 0, y: 0 });
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

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      const prevX = mousePosRef.current.x;
      const prevY = mousePosRef.current.y;
      
      velocityRef.current.x = (x - prevX) * (momentum / 100) * 10;
      velocityRef.current.y = (y - prevY) * (momentum / 100) * 10;
      
      if (mouseAxes === 'X only') {
        mousePosRef.current.x = x;
      } else if (mouseAxes === 'Y only') {
        mousePosRef.current.y = y;
      } else {
        mousePosRef.current.x = x;
        mousePosRef.current.y = y;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);

    let time = 0;
    const animationSpeed = (speed / 100) * 0.02;
    const driftAmount = (drift / 100) * 2;
    const trackMouseAmount = (trackMouse / 100);
    const scaleFactor = (scale / 100) * 2;
    const refractionAmount = (refraction / 100) * 10;
    const distortionAmount = (distortion / 100) * 5;

    // Parse hex color
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
          }
        : { r: 107, g: 210, b: 255 };
    };

    const rgb = hexToRgb(color);

    const render = () => {
      time += animationSpeed;
      
      // Apply momentum
      mousePosRef.current.x += velocityRef.current.x;
      mousePosRef.current.y += velocityRef.current.y;
      velocityRef.current.x *= 0.9;
      velocityRef.current.y *= 0.9;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Calculate center position with mouse tracking and drift
      const centerX = canvas.width / 2 + 
        (mousePosRef.current.x - 0.5) * canvas.width * trackMouseAmount +
        Math.sin(time * 0.5) * driftAmount;
      const centerY = canvas.height / 2 + 
        (mousePosRef.current.y - 0.5) * canvas.height * trackMouseAmount +
        Math.cos(time * 0.3) * driftAmount;

      const gridSize = 40;
      const cellWidth = canvas.width / gridSize;
      const cellHeight = canvas.height / gridSize;

      // Create caustics pattern
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const x = i * cellWidth;
          const y = j * cellHeight;
          
          // Distance from center with distortion
          const dx = (x - centerX) / canvas.width;
          const dy = (y - centerY) / canvas.height;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          // Refraction effect
          const refractionOffset = Math.sin(dist * Math.PI * refractionAmount + time) * distortionAmount;
          const angleRad = (angle * Math.PI) / 180;
          
          // Caustic intensity
      const intensity = Math.max(0, 
        Math.sin(dist * Math.PI * scaleFactor + time + refractionOffset) * 
        Math.cos(angleRad + dist * 2) * 
        (1 - dist * 0.8)
      );

      if (intensity > 0.01) {
        // 굴절 효과를 위한 더 강한 강도
        const alpha = Math.min(1, intensity * 0.8);
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [scale, refraction, distortion, angle, color, blendMode, speed, drift, trackMouse, mouseAxes, momentum]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        mixBlendMode: blendMode.toLowerCase() as any,
        opacity: 0.9,
        filter: 'contrast(1.5) brightness(1.4) saturate(1.3)',
        ...style
      }}
    />
  );
}

