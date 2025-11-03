import { useState, useEffect } from 'react';
import { motion, useScroll, useSpring } from 'motion/react';
import { ArrowLeft } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ProjectData {
  id: string;
  title: string;
  heroImage: string;
  heroVideo?: string; // 동영상 경로 또는 YouTube URL
  isYouTube?: boolean; // YouTube 여부
  myRole: string[];
  team: string[];
  duration: string;
  industry: string;
  summary: string;
  sections: {
    title: string;
    content: string;
    image?: string;
  }[];
}

// 실제 프로젝트 데이터
const projectsData: { [key: string]: ProjectData } = {
  'railway-redesign': {
    id: 'railway-redesign',
    title: 'Railway Redesign',
    heroImage: 'modern train station platform',
    myRole: ['Lead UX/UI Designer', 'Web Designer', 'User Research'],
    team: ['3명 (기획 공동, 디자인 1명)'],
    duration: '3개월',
    industry: 'Transportation / Public Service',
    summary: 'NRC 웹사이트에서 기업/투자자 정보(B2B)와 승객 이용 정보(B2C)가 한 화면에 섞여 있던 문제를 해결하기 위해, 철도 산업의 기본 원칙인 상하 분리를 사이트 구조에 반영한 프로젝트입니다.\n승객 포털과 기업 사이트를 분리하여 각 사용자 그룹의 목적에 맞는 접근 경로를 제공했습니다.',
    sections: [
      {
        title: '문제 (WHY)',
        content: 'NRC 웹사이트는 기업/투자자 정보(B2B)와 승객 이용 정보(B2C)가 한 화면에 섞여 있었습니다.\n철도 산업의 기본 원칙인 상하 분리(인프라/운영 분리)가 사이트 구조에 반영되지 않은 상태였습니다.',
      },
      {
        title: '근거 (EVIDENCE)',
        content: '승객은 실행 기능을 가장 먼저 찾습니다 (예매 66.7% / 요금 54.5% / 운행정보 51.5%).\n독일/한국 등 국철 사이트 사례에서도 승객 포털과 기업 사이트가 명확히 분리되어 있습니다.',
        image: 'user research data global comparison'
      },
      {
        title: '전략 (HOW)',
        content: '승객 실행 기능(예매/요금) → 승객 전용 포털로 완전 분리.\n기업 정보(회사소개/정책/프로젝트) → 메인 사이트 중심 재편.',
        image: 'domain-driven ia reconstruction'
      }
    ]
  },
  'hourtaste': {
    id: 'hourtaste',
    title: 'HourTaste',
    heroImage: 'food discount shopping mobile',
    heroVideo: '/videos/hourtaste.mp4',
    myRole: ['Product Designer', 'UX/UI Designer', 'Service Planner'],
    team: ['1 CEO', '1 Product Manager', '2 Designers', '4 Developers'],
    duration: '4개월 (2024.03 - 2024.07)',
    industry: 'Food Tech / E-commerce',
    summary: 'HourTaste는 마감 시간이 임박한 음식점의 재고를 실시간으로 할인 판매하는 맞춤 마감할인 앱입니다. 음식물 쓰레기를 줄이고 소비자는 합리적인 가격에 신선한 음식을 구매할 수 있는 윈-윈 플랫폼을 기획하고 디자인했습니다.',
    sections: [
      {
        title: '서비스 기획 배경',
        content: '한국에서는 연간 500만 톤 이상의 음식물 쓰레기가 발생하며, 그 중 상당수가 매장의 당일 마감 재고입니다. 반면 물가 상승으로 합리적인 소비를 원하는 소비자가 늘어나고 있습니다. HourTaste는 이 두 니즈를 연결하는 서비스로 기획되었습니다.',
      },
      {
        title: 'Core Concept',
        content: '시간대별 동적 할인율이 핵심입니다. 마감 2시간 전 20% 할인으로 시작하여, 마감 30분 전에는 최대 60%까지 할인율이 올라갑니다. 사용자는 실시간으로 변하는 할인율을 보며 최적의 타이밍에 구매할 수 있습니다. 게이미피케이션 요소를 더해 "할인 헌터" 배지 시스템도 도입했습니다.',
        image: 'mobile app timer discount'
      },
      {
        title: 'UX/UI Design',
        content: '메인 화면은 지도 기반으로, 내 주변 마감 임박 매장을 한눈에 확인할 수 있습니다. 각 매장 카드에는 실시간 카운트다운 타이머와 현재 할인율이 크게 표시됩니다. 오렌지-레드 그라데이션을 사용해 긴급함과 기회를 시각적으로 전달했습니다. 예약 프로세스는 3단계로 단순화하여 10초 안에 완료 가능합니다.',
        image: 'app interface screens'
      },
      {
        title: 'Personalization',
        content: 'AI 기반 추천 알고리즘으로 사용자의 선호 음식, 자주 방문하는 지역, 평균 구매 시간대를 분석하여 맞춤 알림을 보냅니다. "곧 출근하시네요! 회사 근처 ○○카페에서 샌드위치 40% 할인 중"처럼 상황에 맞는 푸시 알림으로 전환율을 높였습니다.',
      },
      {
        title: '성과',
        content: '베타 런칭 3개월 만에 가입자 3만 명 돌파, 월 거래액 5억 원 달성했습니다. 참여 매장은 음식물 쓰레기 평균 32% 감소, 사용자 만족도 4.7/5.0, 재구매율 68%를 기록했습니다. 환경 보호와 경제성을 동시에 실현한 임팩트 있는 서비스로 평가받고 있습니다.',
      }
    ]
  },
  'nook': {
    id: 'nook',
    title: 'NOOK',
    heroImage: 'luxury furniture interior ar',
    heroVideo: '/videos/nook.mp4',
    myRole: ['Lead Product Designer', 'AR UX Designer', 'Service Planner'],
    team: ['1 Product Owner', '2 Designers', '3 AR Developers', '2 Backend Developers'],
    duration: '6개월 (2024.02 - 2024.08)',
    industry: 'Furniture / AR Tech / Rental Service',
    summary: 'NOOK은 명품 가구를 구매 전 AR로 내 공간에 미리 배치해보고, 합리적인 가격에 렌탈할 수 있는 서비스입니다. AR 기술과 가구 렌탈을 결합하여 새로운 인테리어 경험을 제공하는 앱을 기획하고 디자인했습니다.',
    sections: [
      {
        title: '서비스 기획',
        content: '명품 가구는 가격이 비싸 구매 결정이 어렵고, 실제 공간에 놓았을 때의 느낌을 사전에 확인하기 어렵습니다. 또한 이사나 라이프스타일 변화로 가구를 자주 바꾸고 싶어하는 니즈가 증가하고 있습니다. NOOK은 AR 기술로 가구 배치를 시뮬레이션하고, 렌탈 서비스로 부담을 낮춘 새로운 형태의 인테리어 플랫폼입니다.',
      },
      {
        title: 'AR Experience Design',
        content: '스마트폰 카메라로 공간을 스캔하면 자동으로 벽, 바닥, 창문을 인식합니다. 1,000개 이상의 명품 가구를 AR로 실제 크기 그대로 배치해볼 수 있으며, 360도 회전, 색상 변경, 조명 시뮬레이션이 가능합니다. 특히 햇빛 각도에 따른 가구의 색감 변화까지 시뮬레이션하여 실제와 거의 동일한 경험을 제공합니다.',
        image: 'augmented reality furniture'
      },
      {
        title: 'UI/UX Design',
        content: 'AR 인터페이스는 최소화하여 가구에 집중할 수 있도록 했습니다. 하단에 플로팅 컨트롤 바만 배치하고, 제스처 기반 인터랙션으로 직관적인 조작이 가능합니다. 렌탈 기간은 1개월부터 선택 가능하며, 구매 전환 시 렌탈비의 70%를 차감해주는 시스템으로 부담 없는 체험을 유도했습니다.',
        image: 'mobile app interface design'
      },
      {
        title: 'Social Features',
        content: 'AR로 꾸민 나만의 공간을 3D 이미지로 저장하고 커뮤니티에 공유할 수 있습니다. 다른 사용자의 인테리어를 보고 원클릭으로 똑같이 따라할 수 있는 "Copy This Room" 기능이 인기를 끌었습니다. 인테리어 디자이너의 큐레이션 컬렉션도 제공하여 전문적인 조합을 쉽게 적용할 수 있습니다.',
      },
      {
        title: 'Results',
        content: '출시 4개월 만에 앱 다운로드 5만 건, 월 활성 사용자 1.2만 명 달성했습니다. AR 체험 후 렌탈 전환율 42%, 렌탈 후 구매 전환율 28%로 높은 전환율을 기록했습니다. 특히 2030 여성과 신혼부부 사이에서 "가구 쇼핑의 새로운 기준"이라는 평가를 받으며 빠르게 성장하고 있습니다.',
      }
    ]
  },
  'cat-peaceful-day': {
    id: 'cat-peaceful-day',
    title: "A Cat's Peaceful Day",
    heroImage: 'miniature cat peaceful scene',
    heroVideo: '/videos/cat.mp4',
    myRole: ['Art Director'],
    team: ['Photographer\n(박소현, 본인, 강민진, 송예준)'],
    duration: '1개월',
    industry: 'Art / Figure Design',
    summary: '낚시하는 고양이 피규어를 통해 작고 평화로운 하루를 "미니어처 세계"로 표현하는 촬영 프로젝트입니다. 거울을 연못처럼 사용한 반사 연출과 색/톤/각도 조정으로 피규어 세계가 실재감 있게 보이는 이미지를 완성했습니다.',
    sections: [
      {
        title: '의도 (Why)',
        content: '거울을 물 표면처럼 사용하는 레퍼런스를 보고, 작은 세계가 실제 공간처럼 보이게 연출하고자 했습니다. 그래서 "낚시하는 고양이" 장면을 여유로운 하루의 미니어처 풍경으로 구현했습니다.',
      },
      {
        title: '방법 (How)',
        content: '거울을 연못/강처럼 보이게 활용했습니다. 인조 잔디·나무 피규어로 자연 풍경을 구성했습니다. 샷마다 물/하늘 색을 조정해 고양이 피규어가 가장 먼저 눈에 들어오도록 시선 흐름을 정리했습니다.',
        image: 'miniature diorama scene'
      }
    ]
  }
};

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToAbout?: () => void;
}

export function ProjectDetail({ projectId, onBack, onNavigateToProject, onNavigateToAbout }: ProjectDetailProps) {
  const [scrollY, setScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isWorkHovered, setIsWorkHovered] = useState(false);
  
  const project = projectsData[projectId];

  const { scrollYProgress } = useScroll();
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      setScrollY(currentScrollY);
      setIsScrolled(currentScrollY > 50);
      setIsCompact(currentScrollY > 200);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (!project) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        background: '#000', 
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"Darker Grotesque", sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: '20px' }}>프로젝트를 찾을 수 없습니다</p>
          <button 
            onClick={onBack} 
            style={{ 
              color: '#ffd900', 
              cursor: 'pointer',
              background: 'none',
              border: '1px solid #ffd900',
              padding: '12px 24px',
              borderRadius: '8px',
              fontWeight: 600
            }}
          >
            ← 홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: '#000',
      color: '#fff',
      fontFamily: '"Darker Grotesque", sans-serif'
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Darker+Grotesque:wght@300;400;500;600;700;800;900&display=swap');
        @import url('https://4pl67mv56j.execute-api.ap-northeast-2.amazonaws.com/v1/api/css/drop_fontstream_css/?sid=gAAAAABpAXw9Z1kK-P7e81ieW4WGtlt32HI2K7gJbY-WvazpQXj_FEsqywrroKMfMEd2GMEqQP-Ktipnz-Q4m5QT24jkFo_sljMLl_qzvsmgd6fK0MP5OANSpQOYrGxj4H9VCaUc9XiSmdyIdbi3fDZAgUGbU-qC8nnGQJV77uN4aiBrGhTcGMQlWg7J5Pt5DPCp_qz8NMWwXjx4OoydnNjqca5j0CZRDoOLgiUVtVJZ9kKlViajxR84ESogA1YHiKrfrghliwxN');
        
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }
      `}</style>

      {/* Scroll Progress Indicator */}
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

      {/* Fixed Header - 홈과 100% 동일한 스타일 */}
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
          <div 
            onClick={onBack}
            style={{ 
              fontSize: isCompact ? '17px' : '21px', 
              fontWeight: 800,
              color: '#ffd900',
              transition: 'all 0.8s cubic-bezier(0.19, 1, 0.22, 1)',
              cursor: 'pointer'
            }}
          >
            SONGHEE ⓒ
          </div>
          
          <div style={{ display: 'flex', gap: isCompact ? '36px' : '47px' }}>
            {/* WORK Dropdown */}
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
              {isWorkHovered && onNavigateToProject && (
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
                    ].map((proj, idx) => (
                      <a
                        key={idx}
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigateToProject(proj.projectId);
                          setIsWorkHovered(false);
                          window.scrollTo(0, 0);
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
                          e.currentTarget.style.background = 'rgba(255, 217, 0, 0.1)';
                          e.currentTarget.style.color = '#ffd900';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'none';
                          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                        }}
                      >
                        {proj.name}
                      </a>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* ABOUT Button */}
            {onNavigateToAbout && (
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
            )}
          </div>
        </div>
      </motion.nav>

      {/* Main Content - 디자인 시스템에 맞춘 레이아웃 */}
      <section style={{
        paddingTop: '140px',
        paddingBottom: '0'
      }}>
        <div style={{ 
          maxWidth: '1180px', 
          margin: '0 auto',
          padding: '0 60px'
        }}>
          
          {/* Title Section */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
            style={{ marginBottom: '50px' }}
          >
            <h1 style={{
              fontSize: '56px',
              fontWeight: 700,
              marginBottom: '0',
              fontFamily: '"Darker Grotesque", sans-serif',
              lineHeight: 0.95,
              color: '#fff',
              letterSpacing: '-0.04em'
            }}>
              {project.title}
            </h1>
          </motion.div>

          {/* Hero Video or Image */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.19, 1, 0.22, 1] }}
            style={{
              width: '100%',
              height: '55vh',
              maxHeight: '600px',
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '16px',
              overflow: 'hidden',
              marginBottom: '70px',
              border: '1px solid rgba(255, 217, 0, 0.08)'
            }}
          >
            {project.heroVideo ? (
              project.isYouTube ? (
                <iframe
                  src={project.heroVideo}
                  title={project.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                />
              ) : (
                <video
                  src={project.heroVideo}
                  autoPlay
                  loop
                  muted
                  playsInline
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              )
            ) : (
              <ImageWithFallback
                src={`https://source.unsplash.com/1200x600/?${project.heroImage}`}
                alt={project.title}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            )}
          </motion.div>

          {/* Project Info Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '50px',
              marginBottom: '80px',
              paddingBottom: '70px',
              borderBottom: '1px solid rgba(255, 217, 0, 0.1)'
            }}
          >
            <div>
              <h3 style={{
                fontSize: '14px',
                color: '#ffd900',
                marginBottom: '18px',
                fontFamily: '"Darker Grotesque", sans-serif',
                fontWeight: 600,
                letterSpacing: '1.5px',
                textTransform: 'uppercase'
              }}>MY ROLE</h3>
              {project.myRole.map((role, i) => (
                <p key={i} style={{
                  fontSize: '16px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  marginBottom: '8px',
                  fontFamily: '"SD Greta Sans", "IBM Plex Sans KR", sans-serif',
                  lineHeight: 1.6,
                  fontWeight: 400
                }}>{role}</p>
              ))}
            </div>

            <div>
              <h3 style={{
                fontSize: '14px',
                color: '#ffd900',
                marginBottom: '18px',
                fontFamily: '"Darker Grotesque", sans-serif',
                fontWeight: 600,
                letterSpacing: '1.5px',
                textTransform: 'uppercase'
              }}>TEAM</h3>
              {project.team.map((member, i) => (
                <p key={i} style={{
                  fontSize: '16px',
                  color: 'rgba(255, 255, 255, 0.85)',
                  marginBottom: '8px',
                  fontFamily: '"SD Greta Sans", "IBM Plex Sans KR", sans-serif',
                  lineHeight: 1.6,
                  fontWeight: 400,
                  whiteSpace: 'pre-line'
                }}>{member}</p>
              ))}
            </div>

            <div>
              <h3 style={{
                fontSize: '14px',
                color: '#ffd900',
                marginBottom: '18px',
                fontFamily: '"Darker Grotesque", sans-serif',
                fontWeight: 600,
                letterSpacing: '1.5px',
                textTransform: 'uppercase'
              }}>DURATION</h3>
              <p style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.85)',
                fontFamily: '"SD Greta Sans", "IBM Plex Sans KR", sans-serif',
                lineHeight: 1.6,
                fontWeight: 400
              }}>{project.duration}</p>
            </div>

            <div>
              <h3 style={{
                fontSize: '14px',
                color: '#ffd900',
                marginBottom: '18px',
                fontFamily: '"Darker Grotesque", sans-serif',
                fontWeight: 600,
                letterSpacing: '1.5px',
                textTransform: 'uppercase'
              }}>INDUSTRY</h3>
              <p style={{
                fontSize: '16px',
                color: 'rgba(255, 255, 255, 0.85)',
                fontFamily: '"SD Greta Sans", "IBM Plex Sans KR", sans-serif',
                lineHeight: 1.6,
                fontWeight: 400
              }}>{project.industry}</p>
            </div>
          </motion.div>

          {/* Summary Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            style={{
              marginBottom: '100px',
              background: 'rgba(255, 217, 0, 0.03)',
              padding: '50px',
              borderRadius: '16px',
              border: '1px solid rgba(255, 217, 0, 0.08)'
            }}
          >
            <h2 style={{
              fontSize: '28px',
              fontWeight: 600,
              marginBottom: '28px',
              fontFamily: '"Darker Grotesque", sans-serif',
              color: '#ffd900',
              letterSpacing: '-0.02em'
            }}>Project Overview</h2>
            <p style={{
              fontSize: '18px',
              lineHeight: 1.8,
              color: 'rgba(255, 255, 255, 0.9)',
              fontFamily: '"SD Greta Sans", "IBM Plex Sans KR", sans-serif',
              fontWeight: 300,
              whiteSpace: 'pre-line'
            }}>
              {project.summary}
            </p>
          </motion.div>

          {/* Detail Sections */}
          {project.sections.map((section, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{
                marginBottom: '100px'
              }}
            >
              <h2 style={{
                fontSize: '32px',
                fontWeight: 600,
                marginBottom: '24px',
                fontFamily: '"Darker Grotesque", sans-serif',
                color: '#fff',
                letterSpacing: '-0.02em'
              }}>{section.title}</h2>
              
              <p style={{
                fontSize: '17px',
                lineHeight: 1.9,
                color: 'rgba(255, 255, 255, 0.8)',
                fontFamily: '"SD Greta Sans", "IBM Plex Sans KR", sans-serif',
                marginBottom: section.image ? '50px' : '0',
                whiteSpace: 'pre-line',
                fontWeight: 300
              }}>
                {section.content}
              </p>

              {section.image && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  style={{
                    width: '100%',
                    height: '45vh',
                    maxHeight: '500px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '1px solid rgba(255, 217, 0, 0.08)'
                  }}
                >
                  <ImageWithFallback
                    src={`https://source.unsplash.com/1200x500/?${section.image}`}
                    alt={section.title}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                </motion.div>
              )}
            </motion.div>
          ))}

        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: 'relative',
        zIndex: 2,
        padding: '60px 60px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: '9px',
        maxWidth: '1180px',
        margin: '0 auto',
        width: '100%',
        borderTop: '1px solid rgba(255, 217, 0, 0.1)'
      }}>
        <div className="footer-content" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '0',
          borderBottom: 'none'
        }}>
          <p className="footer-logo" style={{
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 'normal',
            margin: 0,
            color: '#fff',
            fontFamily: '"Darker Grotesque", sans-serif'
          }}>
            SONGHEE ⓒ
          </p>
          <a href="mailto:allisvanitas@gmail.com" className="footer-email" style={{
            fontSize: '14px',
            fontWeight: 500,
            lineHeight: 'normal',
            margin: 0,
            color: 'rgba(255, 255, 255, 0.7)',
            textDecoration: 'none',
            transition: 'color 0.3s ease',
            fontFamily: '"Darker Grotesque", sans-serif'
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
      </footer>
    </div>
  );
}
