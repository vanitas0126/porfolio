import React, { useEffect, useRef } from 'react';

interface WaterRippleProps {
  strength?: number; // 0-100
  viscosity?: number; // 0-100
  decay?: number; // 0-100
  speed?: number; // 0-100
  chromaticDispersion?: number; // 0-100
  style?: React.CSSProperties;
}

export function WaterRipple({
  strength = 77,
  viscosity = 64,
  decay = 75,
  speed = 75,
  chromaticDispersion = 25,
  style = {}
}: WaterRippleProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Water ripple simulation
    const gridWidth = 128;
    const gridHeight = 128;
    let current = new Float32Array(gridWidth * gridHeight);
    let previous = new Float32Array(gridWidth * gridHeight);
    
    // Normalize values to 0-1 (JSON 기반 정확한 값)
    const damping = 1 - (decay / 100) * 0.02; // decay 75%
    const viscosityFactor = (viscosity / 100) * 0.025; // viscosity 64%
    // JSON에서 speed는 0.75이지만 0-1 범위이므로 *100해서 전달된 경우: speed={75}
    const animationSpeed = (speed / 100) * 0.75; // JSON speed: 0.75
    const rippleStrength = (strength / 100) * 20; // strength 77%
    const chromaticOffset = (chromaticDispersion / 100) * 3; // chromaticDispersion 25%

    let time = 0;
    let animationSpeedCounter = 0;

    const render = () => {
      time += animationSpeed;
      animationSpeedCounter += animationSpeed;

      // Update simulation
      if (animationSpeedCounter >= 1) {
        animationSpeedCounter = 0;
        
        for (let i = 1; i < gridWidth - 1; i++) {
          for (let j = 1; j < gridHeight - 1; j++) {
            const index = i + j * gridWidth;
            const neighbors = (
              current[index - 1] +
              current[index + 1] +
              current[index - gridWidth] +
              current[index + gridWidth]
            ) / 2;
            
            current[index] = (neighbors - previous[index]) * damping;
            current[index] *= 1 - viscosityFactor;
          }
        }

        // Add random ripples
        if (Math.random() < 0.02) {
          const x = Math.floor(Math.random() * (gridWidth - 20)) + 10;
          const y = Math.floor(Math.random() * (gridHeight - 20)) + 10;
          current[x + y * gridWidth] = rippleStrength;
        }

        // Swap buffers
        [current, previous] = [previous, current];
      }

      // Render to canvas (optimized)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scaleX = canvas.width / gridWidth;
      const scaleY = canvas.height / gridHeight;

      for (let i = 0; i < gridWidth; i++) {
        for (let j = 0; j < gridHeight; j++) {
          const value = current[i + j * gridWidth];
          const intensity = Math.abs(value) * 15;
          
          if (intensity < 0.01) continue;
          
          const x = Math.floor(i * scaleX);
          const y = Math.floor(j * scaleY);
          const w = Math.ceil((i + 1) * scaleX) - x;
          const h = Math.ceil((j + 1) * scaleY) - y;
          
          // Chromatic dispersion effect - 굴절 느낌을 위해 더 강하게
          const r = Math.min(255, intensity * 255);
          const g = Math.min(255, intensity * (255 - chromaticOffset * 30));
          const b = Math.min(255, intensity * (255 - chromaticOffset * 60));
          const a = Math.min(255, intensity * 200);
          
          // Fill rectangle directly
          ctx.fillStyle = `rgba(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)}, ${a / 255})`;
          ctx.fillRect(x, y, w, h);
        }
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
  }, [strength, viscosity, decay, speed, chromaticDispersion]);

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
        mixBlendMode: 'screen',
        opacity: 0.8,
        filter: 'contrast(1.5) brightness(1.3)',
        ...style
      }}
    />
  );
}

