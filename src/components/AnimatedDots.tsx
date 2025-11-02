import { useState, useEffect } from 'react';

interface AnimatedDotsProps {
  baseText: string;
  style?: React.CSSProperties;
}

export function AnimatedDots({ baseText, style }: AnimatedDotsProps) {
  const [dots, setDots] = useState('');
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <h2 style={style}>
      {baseText}
      <span style={{ 
        display: 'inline-block',
        width: '1.2em',
        textAlign: 'left'
      }}>
        {dots}
      </span>
    </h2>
  );
}
