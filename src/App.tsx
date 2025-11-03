import React, { useState, useEffect, useRef } from 'react';
import { ImageWithFallback } from './components/figma/ImageWithFallback';
import { TiltCard } from './components/TiltCard';
import { AnimatedDots } from './components/AnimatedDots';
import About from './components/About';
import { ProjectDetail } from './components/ProjectDetail';
import { VideoWaterEffect } from './components/VideoWaterEffect';
import { motion, useInView, useScroll, useTransform, useSpring } from 'motion/react';

// Unicorn Studio 타입 정의
declare global {
  interface Window {
    UnicornStudio?: {
      isInitialized: boolean;
      init: (options: { includeLogo: boolean }) => void;
      [key: string]: any;
    };
  }
}

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // If viewing About page, render About component early
  if (currentPage === 'about') {
    return <About onNavigateHome={() => setCurrentPage('home')} />;
  }

  // If viewing a project detail page
  if (currentPage === 'project' && selectedProject) {
    return (
      <ProjectDetail 
        projectId={selectedProject} 
        onBack={() => {
          setCurrentPage('home');
          setSelectedProject(null);
        }}
        onNavigateToProject={(projectId: string) => {
          setSelectedProject(projectId);
          setCurrentPage('project');
          window.scrollTo(0, 0);
        }}
        onNavigateToAbout={() => setCurrentPage('about')}
      />
    );
  }

  return (
    <HomePage 
      onNavigateToAbout={() => setCurrentPage('about')}
      onNavigateToProject={(projectId: string) => {
        setSelectedProject(projectId);
        setCurrentPage('project');
        window.scrollTo(0, 0);
      }}
    />
  );
}

// 비디오 렌더링 컴포넌트 (물 효과 포함)
function VideoComponent({ onHeightChange }: { onHeightChange?: (height: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // isMobile은 더 이상 사용하지 않으므로 제거 가능하지만, 혹시 모를 참조를 위해 유지
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 1000);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 비디오 원본 비율 가져오기
    const handleLoadedMetadata = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setVideoAspectRatio(video.videoWidth / video.videoHeight);
      }
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    if (video.readyState >= 2) {
      handleLoadedMetadata();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const container = containerRef.current;
    if (!container || !videoAspectRatio || !video) return;

    const updateDimensions = () => {
      if (!container || !videoAspectRatio) return;

      // 텍스트 컨텐츠 컨테이너의 실제 너비 찾기
      const viewportWidth = window.innerWidth;
      const contentMaxWidth = 1180;
      
      // 텍스트 컨텐츠 컨테이너 찾기 (hero-content가 있는 div의 부모)
      // 이 div는 maxWidth: 1180px, padding: clamp(40px, 8vw, 120px) 스타일을 가짐
      const textContainer = document.querySelector('.hero-content')?.parentElement as HTMLElement;
      let actualContentWidth = contentMaxWidth;
      
      if (textContainer) {
        const textContainerRect = textContainer.getBoundingClientRect();
        // 컨테이너의 전체 너비 사용 (패딩 포함한 전체 너비)
        actualContentWidth = textContainerRect.width;
        
        // 만약 너비가 여전히 작다면, viewport 기준으로 다시 계산
        // 패딩을 제외한 실제 컨텐츠 영역이 아니라 컨테이너 전체 너비를 사용
        if (actualContentWidth < contentMaxWidth) {
          // 컨테이너가 화면보다 작다면 실제 화면 너비에서 패딩을 빼지 않고 전체 사용
          const computedStyle = window.getComputedStyle(textContainer);
          const maxWidth = computedStyle.maxWidth;
          if (maxWidth === '1180px' || maxWidth.includes('1180')) {
            actualContentWidth = Math.min(viewportWidth, contentMaxWidth);
          }
        }
      } else {
        // 찾지 못한 경우 계산: maxWidth: 1180px
        actualContentWidth = Math.min(viewportWidth, contentMaxWidth);
      }
      
      // 컨텐츠 비율에 맞춰 비디오 크기 계산
      const finalWidth = actualContentWidth;
      const finalHeight = finalWidth / videoAspectRatio;

      if (finalWidth > 0 && finalHeight > 0) {
        setDimensions((prev) => {
          // 값이 변경되었을 때만 업데이트
          if (prev.width === finalWidth && prev.height === finalHeight) {
            return prev;
          }
          return { width: finalWidth, height: finalHeight };
        });
        
        video.style.width = `${finalWidth}px`;
        video.style.height = `${finalHeight}px`;
        video.style.objectFit = 'cover';
        
        if (overlayRef.current) {
          overlayRef.current.style.width = `${finalWidth}px`;
          overlayRef.current.style.height = `${finalHeight}px`;
        }

        // 배경 블러 비디오 높이 동기화
        if (onHeightChange) {
          onHeightChange(finalHeight);
        }
      }
    };

    const handleResize = () => {
      requestAnimationFrame(updateDimensions);
    };
    
    const resizeObserver = new ResizeObserver(handleResize);
    if (container) {
      resizeObserver.observe(container);
    }
    
    window.addEventListener('resize', handleResize);

    // 초기 크기 업데이트
    requestAnimationFrame(() => {
      updateDimensions();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
    };
  }, [videoAspectRatio, onHeightChange]);

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    >
      <video
        ref={videoRef}
        id="hero-video"
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          const video = e.currentTarget;
          video.play().catch(err => console.error('Video play error:', err));
        }}
        onCanPlay={(e) => {
          const video = e.currentTarget;
          if (video.paused) {
            video.play().catch(err => console.error('Video play error:', err));
          }
        }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) translateZ(0)',
          width: dimensions.width > 0 ? `${dimensions.width * 1.2}px` : '95%',
          height: dimensions.height > 0 ? `${dimensions.height * 1.2}px` : 'auto',
          maxWidth: '120%',
          maxHeight: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          pointerEvents: 'none',
          display: 'block',
          opacity: 1,
          zIndex: 2,
          borderRadius: '0 0 100px 100px',
          imageRendering: 'auto',
          willChange: 'transform',
          backfaceVisibility: 'hidden'
        }}
      >
        <source src="/Hero-video.mp4" type="video/mp4" />
      </video>
      
      {/* 물 효과 제거 */}
      
      {/* 모바일에서는 비디오만 표시 */}
      {isMobile && videoRef.current && dimensions.width > 0 && dimensions.height > 0 && (
        <video
          src="/Hero-video.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) translateZ(0)',
            width: dimensions.width > 0 ? `${dimensions.width * 1.2}px` : '95%',
            height: `${dimensions.height * 1.2}px`,
            objectFit: 'cover',
            objectPosition: 'center',
            pointerEvents: 'none',
            zIndex: 2,
            maxWidth: '120%',
            borderRadius: '0 0 100px 100px'
          }}
        />
      )}
    </div>
  );
}

// 전문 분야 아이템 컴포넌트 (비디오 포함)
function ExpertiseItem({ skill, videoNumber, variants }: { skill: string; videoNumber: number; variants: any }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasPlayedOnce, setHasPlayedOnce] = useState(false);
  const [isInView, setIsInView] = useState(false);

  // 뷰포트 감지
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            // 뷰포트에 들어왔을 때 비디오 재생
            if (videoRef.current && !hasPlayedOnce && !isHovered) {
              const video = videoRef.current;
              video.loop = false;
              if (video.readyState >= 2) {
                video.play().catch((err) => {
                  console.error('Video play error:', err);
                });
              }
            }
          }
        });
      },
      {
        threshold: 0.3,
        rootMargin: '50px'
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [hasPlayedOnce, isHovered]);

  return (
    <motion.div 
      style={{ 
        textAlign: 'center',
        cursor: 'pointer'
      }}
      variants={variants}
      whileTap={{ scale: 0.99 }}
      onMouseEnter={() => {
        setIsHovered(true);
        if (videoRef.current) {
          videoRef.current.loop = true;
          videoRef.current.play().catch((err) => {
            console.error('Video play error:', err);
          });
        }
      }}
      onMouseLeave={() => {
        setIsHovered(false);
        if (videoRef.current) {
          videoRef.current.loop = false;
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }}
    >
      <div 
        ref={containerRef}
        style={{
          position: 'relative',
          width: '70%',
          paddingBottom: '70%',
          margin: '0 auto',
          background: 'transparent',
          borderRadius: '20px',
          marginBottom: 'clamp(24px, 5vw, 48px)',
          overflow: 'hidden',
          transition: 'all 0.8s cubic-bezier(0.19, 1, 0.22, 1)'
        }}
      >
        {/* 비디오 - 처음 한 번 재생 후 정지, 호버 시 재생 */}
        <video
          ref={videoRef}
          src={`${import.meta.env.BASE_URL}icon${videoNumber}.mp4`}
          muted
          playsInline
          preload="auto"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 1,
            pointerEvents: 'none',
            transition: 'opacity 0.3s ease'
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.loop = false;
              // 뷰포트에 이미 들어와 있고 아직 재생 안 했으면 재생
              if (isInView && !hasPlayedOnce && !isHovered && videoRef.current.paused) {
                setTimeout(() => {
                  if (videoRef.current && isInView && !hasPlayedOnce && !isHovered) {
                    videoRef.current.play().catch((err) => {
                      console.error('Video play error:', err);
                    });
                  }
                }, 200);
              }
            }
          }}
          onCanPlay={() => {
            if (videoRef.current) {
              videoRef.current.loop = false;
              // 뷰포트에 들어와 있고 아직 재생 안 했으면 재생
              if (isInView && !hasPlayedOnce && !isHovered && videoRef.current.paused) {
                videoRef.current.play().catch((err) => {
                  console.error('Video play error:', err);
                });
              }
            }
          }}
          onEnded={() => {
            if (!isHovered) {
              setHasPlayedOnce(true);
              if (videoRef.current) {
                videoRef.current.pause();
              }
            }
          }}
          onError={(e) => {
            console.error(`Failed to load icon${videoNumber}.mp4`, e);
          }}
        />
        
      </div>
      
      <p className="expertise-text" style={{
        fontSize: '18px',
        fontWeight: 600,
        lineHeight: 1.35,
        margin: 0,
        color: 'rgba(255, 255, 255, 0.85)'
      }}>
        {skill}
      </p>
    </motion.div>
  );
}

function HomePage({ onNavigateToAbout, onNavigateToProject }: { onNavigateToAbout: () => void; onNavigateToProject: (projectId: string) => void }) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isWorkHovered, setIsWorkHovered] = useState(false);
  const heroSectionRef = useRef<HTMLElement>(null);
  const blurBgRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [videoHeight, setVideoHeight] = useState<number | null>(null);
  const [heroHeight, setHeroHeight] = useState<number | null>(null);
  const footerSectionRef = useRef<HTMLElement>(null);
  const footerVideoRef = useRef<HTMLVideoElement>(null);
  const [footerHeight, setFooterHeight] = useState<number | null>(null);
  const [isFooterInView, setIsFooterInView] = useState(false);
  const heroEffectContainerRef = useRef<HTMLDivElement>(null);

  // Smooth scroll progress tracking
  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });


  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const heroHeight = window.innerHeight;
      
      setIsScrolled(scrollY > 50);
      setIsCompact(scrollY > heroHeight * 0.5);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 푸터 섹션 뷰포트 감지
  useEffect(() => {
    const footerSection = footerSectionRef.current;
    if (!footerSection) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsFooterInView(true);
            // 비디오 자동 재생 (무한 반복)
            const tryPlay = () => {
              if (footerVideoRef.current) {
                const video = footerVideoRef.current;
                video.loop = true;
                if (video.paused) {
                  const playPromise = video.play();
                  if (playPromise !== undefined) {
                    playPromise.catch(err => {
                      console.error('Footer video play error:', err);
                    });
                  }
                }
              }
            };
            tryPlay();
            setTimeout(tryPlay, 200);
            setTimeout(tryPlay, 500);
          } else {
            setIsFooterInView(false);
            // 뷰포트를 벗어나면 일시정지
            if (footerVideoRef.current) {
              footerVideoRef.current.pause();
            }
          }
        });
      },
      {
        threshold: 0,
        rootMargin: '150px'
      }
    );

    observer.observe(footerSection);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Unicorn Studio 효과 초기화
  useEffect(() => {
    const container = heroEffectContainerRef.current;
    if (!container || typeof window === 'undefined') return;

    const initEffect = () => {
      if (window.UnicornStudio && window.UnicornStudio.isInitialized && container) {
        try {
          const effectId = "c6k24zO7a5YYpZ33cvZM";
          
          // 방법 1: data-unicorn-id 사용 시도
          container.setAttribute('data-unicorn-id', effectId);
          
          // 방법 2: 직접 API 호출 시도
          const US = window.UnicornStudio as any;
          
          // 여러 가능한 API 메서드 시도
          if (US.render) {
            US.render(container, effectId);
          } else if (US.create) {
            US.create(container, effectId);
          } else if (US.load) {
            US.load(effectId, container);
          }
          
          // MutationObserver로 DOM 변화 감지하여 Unicorn Studio가 초기화하도록 유도
          const observer = new MutationObserver(() => {
            // Unicorn Studio가 자동으로 처리할 수 있도록 대기
          });
          
          observer.observe(container, {
            attributes: true,
            childList: true,
            subtree: true
          });
          
          setTimeout(() => {
            observer.disconnect();
          }, 2000);
          
        } catch (err) {
          console.error('Failed to initialize Unicorn Studio effect:', err);
        }
      }
    };

    // Unicorn Studio 로드 대기
    const checkUnicornStudio = () => {
      if (window.UnicornStudio && window.UnicornStudio.isInitialized) {
        setTimeout(initEffect, 300);
      } else if (window.UnicornStudio) {
        // 아직 초기화되지 않았으면 다시 시도
        setTimeout(checkUnicornStudio, 100);
      } else {
        // Unicorn Studio가 아직 로드되지 않았으면 대기
        setTimeout(checkUnicornStudio, 100);
      }
    };

    // 처음 시도
    setTimeout(checkUnicornStudio, 500);

    return () => {
      if (container) {
        container.removeAttribute('data-unicorn-id');
      }
    };
  }, []);

  // Animation variants - Spring-based physics
  const fadeInUp = {
    hidden: { opacity: 0, y: 40 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { 
        type: "spring",
        stiffness: 100,
        damping: 20,
        mass: 0.8
      }
    }
  };

  const fadeInLeft = {
    hidden: { opacity: 0, x: -40 },
    visible: { 
      opacity: 1, 
      x: 0,
      transition: { 
        type: "spring",
        stiffness: 100,
        damping: 20,
        mass: 0.8
      }
    }
  };

  const staggerContainer = {
    hidden: { opacity: 1 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.12,
        delayChildren: 0.2,
        when: "beforeChildren"
      }
    }
  };

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.95, y: 20 },
    visible: (custom: number) => ({ 
      opacity: 1, 
      scale: 1,
      y: 0,
      transition: { 
        type: "spring",
        stiffness: 80,
        damping: 20,
        mass: 1,
        delay: custom * 0.12
      }
    })
  };

  return (
    <div style={{ 
      backgroundColor: '#000', 
      width: '100%', 
      minHeight: '100vh',
      color: '#fff',
      fontFamily: '"Darker Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif'
    }}>
      
      {/* Google Fonts Import */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@300;400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@100;200;300;400;500;600;700&display=swap');
        
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
        
        /* 네온 펄스 효과 */
        @keyframes neonPulse {
          0%, 100% { 
            text-shadow: 
              0 0 0.5vw rgba(255, 217, 0, 0.8),
              0 0 1vw rgba(255, 217, 0, 0.6),
              0 0 1.5vw rgba(255, 217, 0, 0.4);
          }
          50% { 
            text-shadow: 
              0 0 0.7vw rgba(255, 217, 0, 1),
              0 0 1.4vw rgba(255, 217, 0, 0.8),
              0 0 2vw rgba(255, 217, 0, 0.6);
          }
        }
        
        /* 아주 작은 모바일 - 히어로 텍스트 제거 */
        @media (max-width: 480px) {
          .hero-content {
            display: none !important;
          }
        }
        
        /* 모바일 반응형 */
        @media (max-width: 768px) {
          /* 히어로 섹션 - 超集中 숨기기 */
          .hero-chinese {
            display: none !important;
          }
          
          /* 히어로 텍스트 가운데 정렬 */
          .hero-content {
            flex-direction: column !important;
            align-items: center !important;
            justify-content: flex-end !important;
            text-align: center !important;
            gap: 4vw !important;
          }
          
          .hero-main-text {
            max-width: 100% !important;
            text-align: center !important;
          }
          
          .hero-main-text h1 {
            font-size: clamp(28px, 8vw, 70px) !important;
            letter-spacing: -0.5vw !important;
          }
          
          /* 네비게이션 */
          nav {
            padding: 4vw 6vw !important;
          }
          
          nav > div:first-child {
            font-size: 4.5vw !important;
          }
          
          nav a {
            font-size: 3.5vw !important;
          }
          
          /* 섹션 패딩 */
          section {
            padding-left: 6vw !important;
            padding-right: 6vw !important;
          }
          
          /* 히어로 비디오 가운데 정렬 */
          .hero-video-container {
            justify-content: center !important;
            align-items: center !important;
          }
          
          .hero-video-container > div {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
          }
          
          .hero-video-container > div > div {
            width: 100% !important;
            max-width: 100% !important;
          }
          
          /* Selected Work 그리드 */
          .work-grid {
            grid-template-columns: 1fr !important;
            gap: 6vw !important;
            row-gap: 8vw !important;
          }
          
          .work-grid > div {
            width: 100% !important;
          }
          
          .work-grid > div > div {
            width: 100% !important;
          }
          
          .work-grid > div > div > div {
            width: 100% !important;
            padding-bottom: 125% !important;
          }
          
          /* 작은 모바일 - 2x2 그리드 */
          @media (max-width: 480px) {
            .work-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: 4vw !important;
              row-gap: 6vw !important;
            }
            
            .work-grid > div > div > div {
              padding-bottom: 125% !important;
            }
          }
          
          /* Expertise 그리드 */
          .expertise-grid {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 5vw !important;
            row-gap: 6vw !important;
          }
          
          /* 제목 크기 */
          .section-title {
            font-size: 9vw !important;
            letter-spacing: -0.4vw !important;
            margin-bottom: 2.5vw !important;
          }
          
          .section-subtitle {
            font-size: 3.5vw !important;
          }
          
          /* 프로젝트 카드 텍스트 */
          .project-category {
            font-size: 4.5vw !important;
          }
          
          .project-tags {
            font-size: 3.2vw !important;
          }
          
          .project-card-title {
            font-size: 8vw !important;
          }
          
          .project-card-desc {
            font-size: 3.5vw !important;
          }
          
          /* Expertise 텍스트 */
          .expertise-text {
            font-size: 3.2vw !important;
          }
          
          /* CTA */
          .cta-title {
            font-size: 8vw !important;
            letter-spacing: -0.3vw !important;
            margin-bottom: 5vw !important;
          }
          
          .cta-button {
            padding: 2.5vw 5vw !important;
            font-size: 3vw !important;
            border-width: 1px !important;
          }
          
          /* 푸터 */
          footer {
            padding: 8vw 6vw 6vw !important;
          }
          
          .footer-content {
            flex-direction: column !important;
            gap: 4vw !important;
            align-items: flex-start !important;
          }
          
          .footer-logo {
            font-size: 5vw !important;
          }
          
          .footer-email {
            font-size: 3.5vw !important;
          }
        }
        
        /* 1400px 이하 - 컨텐츠 최대 너비 조정 */
        @media (max-width: 1400px) {
          section {
            max-width: 1000px !important;
          }
          
          nav > div {
            max-width: 1000px !important;
            padding-left: 50px !important;
            padding-right: 50px !important;
          }
        }
        
        /* 1200px 이하 - 더 작게 */
        @media (max-width: 1200px) {
          section {
            max-width: 900px !important;
            padding-left: 40px !important;
            padding-right: 40px !important;
          }
          
          nav > div {
            max-width: 900px !important;
            padding-left: 40px !important;
            padding-right: 40px !important;
          }
        }
        
        /* 992px 이하 */
        @media (max-width: 992px) {
          section {
            max-width: 100% !important;
            padding-left: 30px !important;
            padding-right: 30px !important;
          }
          
          nav > div {
            padding-left: 30px !important;
            padding-right: 30px !important;
          }
          
          .work-grid {
            gap: 20px !important;
            row-gap: 35px !important;
          }
          
          .expertise-grid {
            grid-template-columns: repeat(3, 1fr) !important;
          }
        }
      `}</style>
      
      {/* Smooth Scroll Progress Indicator */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '3px',
          background: 'linear-gradient(90deg, #ffd900, #ff6b00, #ffd900)',
          transformOrigin: '0%',
          scaleX: smoothProgress,
          zIndex: 9999,
          boxShadow: '0 0 10px rgba(255, 217, 0, 0.8), 0 0 20px rgba(255, 217, 0, 0.4)'
        }}
      />
      
      {/* Glassmorphism Fixed Navigation with CRT effect */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ 
          type: "spring",
          stiffness: 100,
          damping: 20,
          delay: 0.2
        }}
        style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        background: isScrolled ? 'rgba(0, 0, 0, 0.75)' : 'transparent',
        backdropFilter: isScrolled ? 'blur(30px) saturate(180%)' : 'none',
        WebkitBackdropFilter: isScrolled ? 'blur(30px) saturate(180%)' : 'none',
        borderBottom: isScrolled ? '2px solid rgba(255, 217, 0, 0.15)' : '2px solid transparent',
        boxShadow: isScrolled ? '0 0 1vw rgba(255, 217, 0, 0.1), inset 0 0 2vw rgba(0, 0, 0, 0.5)' : 'none',
        overflow: 'visible'
      }}>
        {/* Nav Content Container */}
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          width: '100%',
          padding: isCompact ? '12px 60px' : '20px 60px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ 
            fontSize: isCompact ? '17px' : '21px', 
            fontWeight: 800,
            color: '#ffd900',
            transition: 'all 0.8s cubic-bezier(0.19, 1, 0.22, 1)'
          }}>
            SONGHEE ⓒ
          </div>
        <div style={{ display: 'flex', gap: isCompact ? '36px' : '47px' }}>
          <div 
            style={{ 
              position: 'relative',
              padding: '10px 15px',
              margin: '-10px -15px'
            }}
            onMouseEnter={() => setIsWorkHovered(true)}
            onMouseLeave={(e) => {
              const relatedTarget = e.relatedTarget;
              if (relatedTarget && relatedTarget instanceof HTMLElement && relatedTarget.closest('.work-dropdown-wrapper')) {
                return;
              }
              setIsWorkHovered(false);
            }}
          >
            <motion.button 
              onClick={(e) => e.preventDefault()}
              style={{ 
                color: '#ffd900', 
                textDecoration: 'none', 
                fontSize: isCompact ? '14px' : '17px', 
                fontWeight: 600,
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: 0
              }}
              whileHover={{ 
                scale: 1.08,
                color: 'rgba(255, 217, 0, 0.7)',
                transition: { type: "spring", stiffness: 300, damping: 15 }
              }}
              whileTap={{ scale: 0.95 }}
            >
              WORK
            </motion.button>
            
            {/* Dropdown Menu */}
            {isWorkHovered && (
              <motion.div
                className="work-dropdown-wrapper"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                onMouseEnter={() => setIsWorkHovered(true)}
                onMouseLeave={() => setIsWorkHovered(false)}
                style={{
                  position: 'absolute',
                  top: '-10px',
                  left: '-40px',
                  right: '-40px',
                  paddingTop: '50px',
                  background: 'transparent',
                  zIndex: 10000
                }}
              >
                <div style={{
                  background: 'rgba(0, 0, 0, 0.95)',
                  backdropFilter: 'blur(20px)',
                  borderRadius: '12px',
                  padding: '12px 0',
                  minWidth: '200px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 217, 0, 0.2)'
                }}>
                {[
                  { name: 'HourTaste', projectId: 'hourtaste' },
                  { name: 'NOOK', projectId: 'nook' },
                  { name: 'Railway Redesign', projectId: 'railway-redesign' },
                  { name: "A Cat's Peaceful Day", projectId: 'cat-peaceful-day' }
                ].map((project, idx) => (
                  <a
                    key={idx}
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigateToProject(project.projectId);
                      setIsWorkHovered(false);
                    }}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '10px 20px',
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '15px',
                      fontWeight: 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      textDecoration: 'none',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#ffd900';
                      e.currentTarget.style.background = 'rgba(255, 217, 0, 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                      e.currentTarget.style.background = 'none';
                    }}
                  >
                    {project.name}
                  </a>
                ))}
                </div>
              </motion.div>
            )}
          </div>
          <motion.button 
            onClick={onNavigateToAbout}
            style={{ 
              color: '#ffd900', 
              textDecoration: 'none', 
              fontSize: isCompact ? '14px' : '17px', 
              fontWeight: 600,
              cursor: 'pointer',
              background: 'none',
              border: 'none',
              padding: 0
            }}
            whileHover={{ 
              scale: 1.08,
              color: 'rgba(255, 217, 0, 0.7)',
              transition: { type: "spring", stiffness: 300, damping: 15 }
            }}
            whileTap={{ scale: 0.95 }}
          >
            ABOUT
          </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section 
        ref={heroSectionRef}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: heroHeight ? `${heroHeight}px` : '80vh',
          height: heroHeight ? `${heroHeight}px` : '80vh',
          overflow: 'hidden',
          borderRadius: '0 0 100px 100px'
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        {/* 배경 비디오 - 블러 제거 */}

        {/* Unicorn Studio 효과 - 비디오 위에 */}
        <div
          ref={heroEffectContainerRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            overflow: 'hidden',
            borderRadius: '0 0 100px 100px'
          }}
        />

        {/* 메인 영상 */}
        <motion.div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            pointerEvents: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
          className="hero-video-container"
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ 
            opacity: 1, 
            scale: 1
          }}
          transition={{ 
            duration: 0.8, 
            delay: 0.3,
            ease: [0.22, 1, 0.36, 1]
          }}
        >
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 0
          }}>
            {/* 비디오 - 꽉 차게 */}
            <div 
              ref={videoContainerRef}
            style={{
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <VideoComponent onHeightChange={(height) => {
                if (blurBgRef.current) {
                  blurBgRef.current.style.height = `${height}px`;
                }
                setHeroHeight(height);
                if (heroSectionRef.current) {
                  heroSectionRef.current.style.height = `${height}px`;
                }
              }} />
            </div>
          </div>
        </motion.div>


        <div style={{
              position: 'absolute',
              inset: 0,
          zIndex: 3,
              width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          paddingBottom: 'clamp(60px, 12vh, 150px)',
          justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '1180px',
            position: 'relative',
            margin: '0 auto',
            paddingLeft: '2.25rem',
            paddingRight: '2.25rem'
        }}>
          <motion.div 
            className="hero-content" 
            style={{
                position: 'relative',
              width: '100%',
                height: '100%'
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
          >
            <motion.div 
              className="hero-main-text" 
              style={{ 
                  position: 'absolute',
                  left: '2.25rem',
                  bottom: '-20px',
                y: useTransform(smoothProgress, [0, 0.3], [0, -30])
              }}
              initial={{ opacity: 0, x: -80 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                type: "spring",
                  stiffness: 100,
                  damping: 25,
                  delay: 0.2
              }}
            >
              <h1 style={{
                fontSize: 'clamp(32px, 4.5vw, 70px)',
                fontWeight: 600,
                lineHeight: 0.95,
                margin: 0,
                textShadow: `
                  0 8px 50px rgba(0, 0, 0, 0.9),
                  0 4px 25px rgba(0, 0, 0, 0.8),
                  0 2px 12px rgba(0, 0, 0, 0.6)
                `,
                color: '#fff'
              }}>
                Turning challenges
                <br />
                into opportunities!
              </h1>
            </motion.div>
            
            <motion.div 
              className="hero-chinese" 
              style={{ 
                  position: 'absolute',
                  right: '2.25rem',
                  bottom: '-20px',
                textAlign: 'right',
                y: useTransform(smoothProgress, [0, 0.3], [0, -20])
              }}
              initial={{ opacity: 0, x: 80 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                type: "spring",
                  stiffness: 100,
                  damping: 25,
                  delay: 0.3
              }}
            >
              <AnimatedDots 
                baseText="超集中"
                style={{
                  fontSize: '45px',
                  fontWeight: 800,
                  color: '#ffd900',
                  margin: 0,
                  lineHeight: 0.9,
                  textShadow: `
                    0 6px 30px rgba(0, 0, 0, 0.9),
                    0 3px 15px rgba(0, 0, 0, 0.8),
                    0 0 20px rgba(255, 217, 0, 0.3)
                  `,
                  whiteSpace: 'nowrap',
                  fontFamily: '"Noto Serif HK", serif'
                }}
              />
            </motion.div>
          </motion.div>
          </div>
        </div>
      </motion.section>

      {/* Selected Work Section */}
      <SectionWithAnimation id="work">
        <section id="work" style={{
          padding: '180px 60px 120px',
          width: '100%',
          maxWidth: '1180px',
          margin: '0 auto'
        }}>
          <motion.div 
            style={{
              marginBottom: '45px'
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={fadeInUp}
          >
            <h2 className="section-title" style={{
              fontSize: '45px',
              fontWeight: 600,
              marginBottom: '12px',
              color: '#fff'
            }}>
              Selected Work
            </h2>
            <p className="section-subtitle" style={{
              fontSize: '16px',
              fontWeight: 400,
              color: 'rgba(255, 255, 255, 0.5)',
              margin: 0
            }}>
              Projects that shaped my creative journey
            </p>
          </motion.div>

          <div 
            className="work-grid" 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '30px',
              rowGap: '50px',
              width: '100%'
            }}
          >
            
            {/* Project Cards */}
            {[
              { 
                name: 'HourTaste',
                desc: '',
                category: 'HourTaste',
                tags: 'App Design / UX/UI',
                gradient: 'linear-gradient(135deg, rgba(234, 88, 12, 0.8) 0%, rgba(220, 38, 38, 0.75) 50%, rgba(185, 28, 28, 0.82) 100%)',
                neonColor: '#ea580c',
                projectId: 'hourtaste'
              },
              { 
                name: 'NOOK',
                desc: '',
                category: 'NOOK',
                tags: 'App Design / AR / UX/UI',
                gradient: 'linear-gradient(135deg, rgba(52, 115, 92, 0.82) 0%, rgba(16, 92, 70, 0.85) 50%, rgba(1, 51, 33, 0.88) 100%)',
                neonColor: '#10b981',
                projectId: 'nook'
              },
              { 
                name: 'Railway',
                desc: '',
                category: 'Railway Redesign',
                tags: 'Web Design / UX/UI',
                gradient: 'rgba(255, 255, 255, 0.06)',
                neonColor: '#3b82f6',
                projectId: 'railway-redesign'
              },
              { 
                name: 'A Cat\'s Peaceful Day',
                desc: '',
                category: "A Cat's Peaceful Day",
                tags: 'Figure / Exhibition',
                gradient: 'rgba(255, 255, 255, 0.04)',
                neonColor: '#a855f7',
                projectId: 'cat-peaceful-day'
              }
            ].map((project, idx) => (
              <motion.div 
                key={idx} 
                style={{ width: '100%' }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, amount: 0.2 }}
                variants={scaleIn}
                custom={idx}
              >
                <div
                  onClick={() => onNavigateToProject(project.projectId)}
                  style={{ cursor: 'pointer' }}
                >
                <TiltCard
                  maxTilt={3}
                  neonColor={project.neonColor}
                  style={{
                    position: 'relative',
                    width: '100%',
                    paddingBottom: '125%',
                    borderRadius: '33px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    boxShadow: '0 26px 65px rgba(0, 0, 0, 0.6), 0 13px 33px rgba(0, 0, 0, 0.4), inset 0 0 0 0.6px rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    background: '#2a2a2a'
                  }} />
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    background: project.gradient,
                    mixBlendMode: 'multiply',
                    opacity: 0.95
                  }} />
                  
                  {project.desc && (
                    <div style={{
                      position: 'absolute',
                      top: '40px',
                      left: '40px',
                      right: '40px',
                      zIndex: 1
                    }}>
                      <h3 className="project-card-title" style={{
                        fontSize: '40px',
                        fontWeight: 700,
                        marginBottom: '13px',
                        lineHeight: 0.9,
                        textShadow: '0 6px 26px rgba(0, 0, 0, 0.8), 0 3px 13px rgba(0, 0, 0, 0.6)'
                      }}>
                        {project.name}
                      </h3>
                      <p className="project-card-desc" style={{
                        fontSize: '14px',
                        lineHeight: 1.5,
                        margin: 0,
                        textShadow: '0 3px 13px rgba(0, 0, 0, 0.75)',
                        opacity: 0.95,
                        fontWeight: 400
                      }}>
                        {project.desc}
                      </p>
                    </div>
                  )}
                </TiltCard>
                </div>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  marginTop: '20px'
                }}>
                  <p className="project-category" style={{
                    fontSize: '24px',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    margin: 0,
                    color: '#fff'
                  }}>
                    {project.category}
                  </p>
                  <p className="project-tags" style={{
                    fontSize: '15px',
                    fontWeight: 500,
                    lineHeight: 'normal',
                    margin: 0,
                    color: 'rgba(255, 255, 255, 0.6)'
                  }}>
                    {project.tags}
                  </p>
                </div>
              </motion.div>
            ))}

          </div>
        </section>
      </SectionWithAnimation>

      {/* Expertise Section */}
      <SectionWithAnimation>
        <section style={{
          padding: '60px 60px 240px',
          width: '100%',
          maxWidth: '1180px',
          margin: '0 auto',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(10,10,10,0.5) 100%)'
        }}>
          <motion.div 
            style={{
              marginBottom: '45px'
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={fadeInUp}
          >
            <h2 className="section-title" style={{
              fontSize: '45px',
              fontWeight: 600,
              marginBottom: '12px',
              color: '#fff'
            }}>
              Expertise I bring
            </h2>
            <p className="section-subtitle" style={{
              fontSize: '16px',
              fontWeight: 400,
              color: 'rgba(255, 255, 255, 0.5)',
              margin: 0
            }}>
              Skills that drive meaningful experiences
            </p>
          </motion.div>

          <motion.div 
            className="expertise-grid" 
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '19px',
              rowGap: 'clamp(50px, 8vw, 80px)',
              width: '100%',
              justifyContent: 'space-between'
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            variants={staggerContainer}
          >
            {[
              'UX Flow & Wireframing',
              'Interaction & Motion',
              'Product Thinking',
              'Branding & Visual Direction',
              'Design System Building',
              'Information Architecture',
              'Research & User Insight',
              'Storytelling & Narrative UX'
            ].map((skill, i) => (
              <ExpertiseItem key={i} skill={skill} videoNumber={i + 1} variants={scaleIn} />
            ))}
          </motion.div>
        </section>
      </SectionWithAnimation>

      {/* CTA Section with Footer Video Background */}
      <SectionWithAnimation>
        <section 
          ref={footerSectionRef}
          style={{
          position: 'relative',
            height: footerHeight ? `${footerHeight}px` : '80vh',
            minHeight: footerHeight ? `${footerHeight}px` : '80vh',
          width: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          paddingTop: '80px',
          borderRadius: '100px 100px 0 0'
          }}
        >
          {/* 배경 비디오 - 블러 제거 */}

          {/* 메인 영상 */}
          <motion.div
            style={{
            position: 'absolute',
            inset: 0,
              zIndex: 1,
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              pointerEvents: 'none',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            borderRadius: '100px 100px 0 0'
            }}
            className="footer-video-container"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ 
              opacity: 1, 
              scale: 1
            }}
            transition={{ 
              duration: 0.8, 
              delay: 0.3,
              ease: [0.22, 1, 0.36, 1]
            }}
          >
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: 0
            }}>
              <div style={{
                width: '100%',
                height: '100%',
                maxWidth: '100%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}>
                <video
                  ref={footerVideoRef}
                  src="/footer-video.mp4"
                  muted
                  playsInline
                  loop
                  preload="auto"
                  onLoadedMetadata={(e) => {
                    const video = e.currentTarget;
                    const aspectRatio = video.videoWidth / video.videoHeight;
                    const containerWidth = Math.min(window.innerWidth, 1180);
                    const videoWidth = containerWidth * 0.8; // 80% width
                    const videoHeight = videoWidth / aspectRatio;
                    setFooterHeight(videoHeight + 80);
                    if (footerSectionRef.current) {
                      footerSectionRef.current.style.height = `${videoHeight + 80}px`;
                    }
                    video.loop = true;
                    // 메타데이터 로드되면 자동 재생 시도
                    setTimeout(() => {
                      if (video.paused) {
                        video.play().catch(() => {});
                      }
                    }, 300);
                  }}
                  onCanPlay={(e) => {
                    const video = e.currentTarget;
                    video.loop = true;
                    // 재생 가능하면 자동 재생
                    if (video.paused) {
                      video.play().catch(() => {});
                    }
                  }}
                  onLoadedData={(e) => {
                    const video = e.currentTarget;
                    video.loop = true;
                    // 데이터 로드되면 자동 재생
                    if (video.paused) {
                      video.play().catch(() => {});
                    }
                  }}
                  onPlaying={(e) => {
                    // 재생이 시작되면 loop 확실히 설정
                    e.currentTarget.loop = true;
                  }}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%) translateZ(0)',
                    width: '80%',
                    height: 'auto',
                    maxWidth: '1180px',
                    maxHeight: '100%',
                objectFit: 'cover',
                    objectPosition: 'center',
                    pointerEvents: 'none',
                    display: 'block',
                      opacity: 1,
                      zIndex: 2,
                      borderRadius: '100px 100px 0 0',
                      imageRendering: 'auto',
                      willChange: 'transform',
                      backfaceVisibility: 'hidden'
                    }}
                  />
          </div>
            </div>
          </motion.div>

          {/* CTA Content */}
          <motion.div 
            style={{
              position: 'relative',
              zIndex: 3,
              textAlign: 'right',
              padding: '0 60px 0',
              maxWidth: '1180px',
              margin: '0 auto',
              width: '100%'
            }}
            initial={{ opacity: 0.5 }}
            whileInView={{ 
              opacity: [0.5, 0.7, 0.6, 0.9, 1],
              filter: [
                'brightness(0.7)',
                'brightness(0.85)',
                'brightness(0.8)',
                'brightness(0.95)',
                'brightness(1)'
              ]
            }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: 1.2,
              times: [0, 0.25, 0.4, 0.7, 1],
              ease: "easeOut"
            }}
          >
            <motion.h2 
              className="cta-title" 
              style={{
                fontSize: '64px',
                fontWeight: 600,
                lineHeight: 1,
                marginBottom: '38px'
              }}
              initial={{ 
                textShadow: '0 0 0px rgba(255, 217, 0, 0)'
              }}
              whileInView={{
                textShadow: [
                  '0 0 0px rgba(255, 217, 0, 0)',
                  '0 0 8px rgba(255, 217, 0, 0.15)',
                  '0 0 5px rgba(255, 217, 0, 0.1)',
                  '0 0 12px rgba(255, 217, 0, 0.2), 0 0 25px rgba(255, 217, 0, 0.1)',
                  '0 0 15px rgba(255, 217, 0, 0.25), 0 0 30px rgba(255, 217, 0, 0.15)'
                ]
              }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{
                duration: 1.2,
                times: [0, 0.25, 0.4, 0.7, 1],
                ease: "easeOut"
              }}
            >
              Light up<br />
              something<br />
              together.
            </motion.h2>
            
            <a href="mailto:allisvanitas@gmail.com" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <motion.button 
                className="cta-button" 
                style={{
                  padding: '10px 28px',
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'transparent',
                  border: '2.5px solid rgba(255, 255, 255, 0.8)',
                  borderRadius: '9999px',
                  cursor: 'pointer',
                  fontFamily: '"Darker Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif'
                }}
                whileHover={{ 
                  y: -6,
                  scale: 1.03,
                  background: 'rgba(255, 255, 255, 1)',
                  color: '#000',
                  borderColor: 'rgba(255, 255, 255, 1)',
                  transition: {
                    type: "spring",
                    stiffness: 300,
                    damping: 15
                  }
                }}
                whileTap={{ 
                  scale: 0.97,
                  transition: {
                    type: "spring",
                    stiffness: 400,
                    damping: 10
                  }
                }}
              >
                Get in touch →
              </motion.button>
            </a>
          </motion.div>

          {/* Footer Content */}
          <div style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'flex-end',
            paddingBottom: 'clamp(40px, 8vh, 80px)',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <div style={{
            maxWidth: '1180px',
              width: '100%',
              padding: '0 clamp(40px, 8vw, 120px)',
              display: 'flex',
              flexDirection: 'column',
              gap: '9px'
          }}>
            <div className="footer-content" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
                width: '100%',
              paddingBottom: '0',
                borderBottom: 'none',
                pointerEvents: 'auto'
            }}>
              <p className="footer-logo" style={{
                fontSize: '14px',
                fontWeight: 600,
                lineHeight: 'normal',
                margin: 0,
                textShadow: '0 3px 13px rgba(0, 0, 0, 0.8)',
                color: '#fff'
              }}>
                SONGHEE ⓒ
              </p>
              <a href="mailto:allisvanitas@gmail.com" className="footer-email" style={{
                fontSize: '14px',
                fontWeight: 500,
                lineHeight: 'normal',
                margin: 0,
                textShadow: '0 2px 10px rgba(0, 0, 0, 0.8)',
                color: 'rgba(255, 255, 255, 0.7)',
                textDecoration: 'none',
                transition: 'color 0.3s ease'
              }}
              onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fff';
              }}
              onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
              }}
              >
                allisvanitas@gmail.com
              </a>
            </div>
            </div>
          </div>
        </section>
      </SectionWithAnimation>

    </div>
  );
}

// Helper component for scroll animations
function SectionWithAnimation({ children, id }: { children: React.ReactNode; id?: string }) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.05 });

  return (
    <div ref={ref} id={id}>
      {children}
    </div>
  );
}
