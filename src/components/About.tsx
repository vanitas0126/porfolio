import { useState, useEffect, useRef } from 'react';
import { motion, useInView, useScroll, useSpring } from 'motion/react';

interface AboutProps {
  onNavigateHome?: () => void;
}

export default function About({ onNavigateHome }: AboutProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isWorkHovered, setIsWorkHovered] = useState(false);
  const footerSectionRef = useRef<HTMLElement>(null);
  const footerVideoRef = useRef<HTMLVideoElement>(null);
  const [footerHeight, setFooterHeight] = useState<number | null>(null);
  const [isFooterInView, setIsFooterInView] = useState(false);

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

  const SectionWithAnimation = ({ children, id }: { children: React.ReactNode, id?: string }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, amount: 0.05 });
    return <div ref={ref} id={id}>{children}</div>;
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      style={{ 
        backgroundColor: '#000', 
        width: '100%', 
        minHeight: '100vh',
        color: '#fff',
        fontFamily: '"Darker Grotesque", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif'
      }}>
      
      {/* Font Imports */}
      <link rel="preconnect" href="https://4pl67mv56j.execute-api.ap-northeast-2.amazonaws.com" />
      <link rel="stylesheet" href="https://4pl67mv56j.execute-api.ap-northeast-2.amazonaws.com/v1/api/css/drop_fontstream_css/?sid=gAAAAABpAXw9Z1kK-P7e81ieW4WGtlt32HI2K7gJbY-WvazpQXj_FEsqywrroKMfMEd2GMEqQP-Ktipnz-Q4m5QT24jkFo_sljMLl_qzvsmgd6fK0MP5OANSpQOYrGxj4H9VCaUc9XiSmdyIdbi3fDZAgUGbU-qC8nnGQJV77uN4aiBrGhTcGMQlWg7J5Pt5DPCp_qz8NMWwXjx4OoydnNjqca5j0CZRDoOLgiUVtVJZ9kKlViajxR84ESogA1YHiKrfrghliwxN" charSet="utf-8" referrerPolicy="origin" />
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@300;400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@100;200;300;400;500;600;700&display=swap');
        
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>
      
      {/* Scroll Progress */}
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
      
      {/* Navigation */}
      <motion.nav 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
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
          boxShadow: isScrolled ? '0 0 1vw rgba(255, 217, 0, 0.1)' : 'none',
          overflow: 'visible'
        }}
      >
        <div style={{
          maxWidth: '1180px',
          margin: '0 auto',
          width: '100%',
          padding: isCompact ? '12px 60px' : '20px 60px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <button
            onClick={onNavigateHome}
            style={{ 
              fontSize: isCompact ? '17px' : '21px', 
              fontWeight: 800,
              color: '#ffd900',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0
            }}
          >
            SONGHEE ⓒ
          </button>
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
                if (!relatedTarget || !(relatedTarget instanceof HTMLElement) || !relatedTarget.closest('.work-dropdown-wrapper')) {
                  setIsWorkHovered(false);
                }
              }}
            >
              <button 
                onClick={onNavigateHome}
                style={{ 
                  color: 'rgba(255, 217, 0, 0.6)', 
                  textDecoration: 'none', 
                  fontSize: isCompact ? '14px' : '17px', 
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0
                }}
              >
                WORK
              </button>
              
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
                    { name: 'HourTaste', label: 'HourTaste' },
                    { name: 'NOOK', label: 'NOOK' },
                    { name: 'Railway', label: 'Railway Redesign' },
                    { name: 'ACat', label: "A Cat's Peaceful Day" }
                  ].map((project, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        onNavigateHome?.();
                        setTimeout(() => {
                          const element = document.getElementById('work');
                          element?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
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
                      {project.label}
                    </button>
                  ))}
                  </div>
                </motion.div>
              )}
            </div>
            <div 
              style={{ 
                color: '#ffd900', 
                fontSize: isCompact ? '14px' : '17px', 
                fontWeight: 600,
                position: 'relative',
                paddingBottom: '4px'
              }}
            >
              ABOUT
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: '#ffd900',
                  boxShadow: '0 0 8px rgba(255, 217, 0, 0.6)'
                }}
              />
            </div>
          </div>
        </div>
      </motion.nav>

      {/* About Me Section */}
      <SectionWithAnimation>
        <section style={{
          padding: '180px 60px 100px',
          maxWidth: '1180px',
          margin: '0 auto'
        }}>
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{
              fontSize: '42px',
              fontWeight: 600,
              marginBottom: '0',
              color: '#fff'
            }}>
              About Me
            </h2>
          </div>

          <div>
            <p style={{
              fontSize: '18px',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '22px',
              fontWeight: 400,
              fontFamily: 'SD Greta Sans'
            }}>
              저에게 디자인은 표면을 꾸미는 작업이 아니라, 생각을 시각적으로 정리하는 과정 그 자체입니다. 최종 형태는 그 안에 담긴 생각이 논리적으로 전개된 결과이자 흔적입니다.
            </p>
            
            <p style={{
              fontSize: '18px',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '22px',
              fontWeight: 400,
              fontFamily: 'SD Greta Sans'
            }}>
              그래서 저는 모든 디자인 작업을 시작할 때 <strong style={{ fontWeight: 600 }}>"왜 이 형태가 최선인가?"</strong>라는 질문을 가장 먼저 던집니다.
            </p>
            
            <p style={{
              fontSize: '18px',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '22px',
              fontWeight: 400,
              fontFamily: 'SD Greta Sans'
            }}>
              아름다움에 대한 제 관점도 같습니다. 미학은 감각적 즐거움이 아니라 철학이 담긴 판단입니다. 무언가 아름답게 느껴진다면, 그것은 우연이 아니라 그 안에 내재된 가치, 질서, 존재 이유 때문입니다.
            </p>
            
            <p style={{
              fontSize: '18px',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '22px',
              fontWeight: 400,
              fontFamily: 'SD Greta Sans'
            }}>
              제가 만드는 디자인은 표면적인 아름다움을 넘어, 윤리 의식과 균형감 같은 깊은 가치들이 함께 작동하기를 바랍니다. 겉모습은 명료하고 단순하게 다듬되, 그 안에는 치밀하게 계산된 논리와 정돈된 감정의 질서가 숨 쉽니다. 제가 가장 중요하게 여기는 것은 바로 이 <strong style={{ fontWeight: 600 }}>'단순함 속에 담긴 깊이'</strong>입니다.
            </p>
            
            <p style={{
              fontSize: '18px',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.85)',
              marginBottom: '0',
              fontWeight: 400,
              fontFamily: 'SD Greta Sans'
            }}>
              결국 제가 추구하는 디자인은 '논리'와 '감각'이 분리되지 않고 자연스럽게 하나로 맞물리는 지점��� 있습니다. 생각이 구체적인 감각을 만들어내고, 그 감각이 다시 생각을 날카롭게 다듬는 선순환의 과정이죠. 저는 이 둘 사이의 건강한 '긴장감' 속에서 비로소 진정으로 의미 있는 디자인이 태어난다고 믿습니다.
            </p>
          </div>
        </section>
      </SectionWithAnimation>

      {/* Education Section */}
      <SectionWithAnimation>
        <section style={{
          padding: '100px 60px 180px',
          maxWidth: '1180px',
          margin: '0 auto'
        }}>
          <div style={{ marginBottom: '28px' }}>
            <h2 style={{
              fontSize: '42px',
              fontWeight: 600,
              marginBottom: '0',
              color: '#fff'
            }}>
              Education
            </h2>
          </div>

          <div>
            <h3 style={{
              fontSize: '24px',
              fontWeight: 600,
              color: '#fff',
              marginBottom: '10px'
            }}>
              Visual Design - Digital Media Major
            </h3>
            <p style={{
              fontSize: '17px',
              fontWeight: 500,
              color: 'rgba(255, 255, 255, 0.65)',
              margin: 0
            }}>
              Korea Polytechnics · 2024-2026
            </p>
          </div>
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
                  src="/footer-video2.mp4"
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
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8 }}
          >
            <h2 
              style={{
                fontSize: '64px',
                fontWeight: 600,
                lineHeight: 1,
                marginBottom: '38px'
              }}
            >
              Let's create<br />
              something<br />
              meaningful.
            </h2>
            
            <a href="mailto:allisvanitas@gmail.com" style={{ textDecoration: 'none', display: 'inline-block' }}>
              <button 
                style={{
                  padding: '10px 28px',
                  fontSize: '20px',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'transparent',
                  border: '2.5px solid rgba(255, 255, 255, 0.8)',
                  borderRadius: '9999px',
                  cursor: 'pointer'
                }}
              >
                Get in touch →
              </button>
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

    </motion.div>
  );
}
