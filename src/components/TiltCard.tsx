import { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface TiltCardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  maxTilt?: number;
  neonColor?: string;
}

export function TiltCard({ children, style, maxTilt = 8, neonColor = '#ffd900' }: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Motion values for smooth animations
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  
  // Spring config for ultra-smooth physics-based motion
  const springConfig = { stiffness: 150, damping: 25, mass: 0.5 };
  
  // Transform motion values to rotation
  const rotateX = useSpring(useTransform(y, [0, 1], [maxTilt, -maxTilt]), springConfig);
  const rotateY = useSpring(useTransform(x, [0, 1], [-maxTilt, maxTilt]), springConfig);
  
  // Brightness and scale effects
  const brightness = useSpring(1, springConfig);
  const scale = useSpring(1, springConfig);

  // Helper function to convert hex to rgba
  const hexToRgb = (hex: string): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return 'rgba(255, 217, 0';
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}`;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Normalize to 0-1 range
    x.set(mouseX / rect.width);
    y.set(mouseY / rect.height);
    
    // Scale and brightness on hover
    scale.set(1.015);
    brightness.set(1.15);
  };

  const handleMouseLeave = () => {
    // Reset to center position with spring animation
    x.set(0.5);
    y.set(0.5);
    scale.set(1);
    brightness.set(1);
  };

  const neonRgb = hexToRgb(neonColor);

  return (
    <motion.div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        ...style,
        rotateX,
        rotateY,
        scale,
        transformStyle: 'preserve-3d',
        transformPerspective: 1500,
        willChange: 'transform',
      }}
      animate={{
        filter: `brightness(${brightness.get()}) contrast(1.05) saturate(1.08)`,
      }}
      transition={{ 
        filter: { 
          type: "spring", 
          stiffness: 150, 
          damping: 25 
        } 
      }}
    >
      <motion.div
        style={{
          width: '100%',
          height: '100%',
          boxShadow: useTransform(
            [rotateX, rotateY],
            ([rx, ry]: number[]) => {
              const shadowX = ry * 0.15;
              const shadowY = -rx * 0.15;
              const isHovered = Math.abs(rx) > 0.1 || Math.abs(ry) > 0.1;
              
              if (isHovered) {
                return `
                  ${shadowX}vw ${shadowY}vw 5vw rgba(0, 0, 0, 0.8),
                  ${shadowX * 0.6}vw ${shadowY * 0.6}vw 2.5vw rgba(0, 0, 0, 0.6),
                  0 0 2.5vw ${neonRgb}, 0.4),
                  0 0 1vw ${neonRgb}, 0.6),
                  0 0.1vw 0.3vw ${neonRgb}, 0.8),
                  inset 0 0 0 0.15vw ${neonRgb}, 0.5),
                  inset 0 -0.2vw 0.5vw ${neonRgb}, 0.3)
                `;
              }
              return '0 2.08vw 5.21vw rgba(0, 0, 0, 0.6), 0 1.04vw 2.6vw rgba(0, 0, 0, 0.4), inset 0 0 0 0.05vw rgba(255, 255, 255, 0.05)';
            }
          )
        }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
