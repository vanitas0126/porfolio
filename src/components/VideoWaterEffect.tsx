import React, { useState, useEffect, useRef, useCallback } from 'react';

interface VideoWaterEffectProps {
  videoElement: HTMLVideoElement;
}

export function VideoWaterEffect({ videoElement }: VideoWaterEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const animationRef = useRef<number>();
  const frameCountRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, down: false });

  // 물리 파라미터
  const waveSpeed = 1.0;
  const springStrength = 0.005;
  const velocityDamping = 0.002;
  const pressureDamping = 0.999;
  const distortionStrength = 0.12; // 굴절 강도 증가 (0.08 -> 0.12)
  const rippleSize = 40.0;
  const rippleStrength = 0.4; // 물결 강도 감소 (1.0 -> 0.4)
  const chromaticAberrationStrength = 0.5; // 색수차 강도 감소 (1.0 -> 0.5)
  const chromaticAberrationDispersal = 0.005; // 색수차 분산 감소 (0.01 -> 0.005)

  // 셰이더 프로그램
  const waterProgramRef = useRef<WebGLProgram | null>(null);
  const videoProgramRef = useRef<WebGLProgram | null>(null);
  
  // 프레임버퍼 (Ping-Pong)
  const framebufferARef = useRef<WebGLFramebuffer | null>(null);
  const framebufferBRef = useRef<WebGLFramebuffer | null>(null);
  const textureARef = useRef<WebGLTexture | null>(null);
  const textureBRef = useRef<WebGLTexture | null>(null);
  const videoTextureRef = useRef<WebGLTexture | null>(null);

  // Vertex Shader (공통)
  const vertexShaderSource = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    
    void main() {
      gl_Position = vec4(a_position, 0.0, 1.0);
      v_texCoord = (a_position + 1.0) * 0.5;
    }
  `;

  // 물 시뮬레이션 Fragment Shader
  const waterFragmentShaderSource = `
    precision highp float;
    
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform int u_frame;
    uniform vec3 u_mouse;
    uniform float u_waveSpeed;
    uniform float u_springStrength;
    uniform float u_velocityDamping;
    uniform float u_pressureDamping;
    uniform float u_rippleSize;
    uniform float u_rippleStrength;
    
    varying vec2 v_texCoord;
    
    void main() {
      if (u_frame == 0) {
        gl_FragColor = vec4(0.0);
        return;
      }
      
      vec2 fragCoord = v_texCoord * u_resolution;
      float delta = u_waveSpeed;
      
      float pressure = texture2D(u_texture, v_texCoord).x;
      float pVel = texture2D(u_texture, v_texCoord).y;
      
      vec2 onePixel = 1.0 / u_resolution;
      
      float p_right = texture2D(u_texture, v_texCoord + vec2(onePixel.x, 0.0)).x;
      float p_left = texture2D(u_texture, v_texCoord - vec2(onePixel.x, 0.0)).x;
      float p_up = texture2D(u_texture, v_texCoord + vec2(0.0, onePixel.y)).x;
      float p_down = texture2D(u_texture, v_texCoord - vec2(0.0, onePixel.y)).x;
      
      if (fragCoord.x <= 0.5) p_left = p_right;
      if (fragCoord.x >= u_resolution.x - 0.5) p_right = p_left;
      if (fragCoord.y <= 0.5) p_down = p_up;
      if (fragCoord.y >= u_resolution.y - 0.5) p_up = p_down;
      
      pVel += delta * (-2.0 * pressure + p_right + p_left) / 4.0;
      pVel += delta * (-2.0 * pressure + p_up + p_down) / 4.0;
      
      pressure += delta * pVel;
      
      pVel -= u_springStrength * delta * pressure;
      
      pVel *= 1.0 - u_velocityDamping * delta;
      pressure *= u_pressureDamping;
      
      float gradX = (p_right - p_left) / 2.0;
      float gradY = (p_up - p_down) / 2.0;
      
      // 마우스 위치에 물결 추가
      float mouseRipple = 0.0;
      if (u_mouse.z > 0.5) {
        float dist = distance(fragCoord, u_mouse.xy);
        if (dist <= u_rippleSize) {
          mouseRipple = u_rippleStrength * (1.0 - dist / u_rippleSize);
        }
      }
      
      gl_FragColor = vec4(pressure + mouseRipple, pVel, gradX, gradY);
    }
  `;

  // 비디오 렌더링 Fragment Shader
  const videoFragmentShaderSource = `
    precision highp float;
    
    uniform sampler2D u_waterTexture;
    uniform sampler2D u_videoTexture;
    uniform vec2 u_resolution;
    uniform float u_distortionStrength;
    uniform float u_chromaticAberrationStrength;
    uniform float u_chromaticAberrationDispersal;
    
    varying vec2 v_texCoord;
    
    void main() {
      vec4 waterData = texture2D(u_waterTexture, v_texCoord);
      
      vec2 fixedTexCoord = vec2(v_texCoord.x, 1.0 - v_texCoord.y);
      
      vec2 distortion = u_distortionStrength * waterData.zw;
      
      vec3 color = vec3(0.0);
      
      if (u_chromaticAberrationStrength > 0.0) {
        vec2 center = vec2(0.5, 0.5);
        vec2 offset = fixedTexCoord - center;
        float distanceFromCenter = length(offset);
        
        float aberrationAmount = u_chromaticAberrationStrength * u_chromaticAberrationDispersal;
        
        float waterDistortionMagnitude = length(distortion);
        float waterContribution = waterDistortionMagnitude * u_chromaticAberrationStrength * 0.5;
        
        float radialContribution = distanceFromCenter * aberrationAmount;
        
        float totalAberration = waterContribution + radialContribution;
        
        vec2 radialDirection = normalize(offset + vec2(0.001, 0.001));
        
        vec2 redOffset = distortion - radialDirection * totalAberration;
        vec2 greenOffset = distortion;
        vec2 blueOffset = distortion + radialDirection * totalAberration;
        
        color.r = texture2D(u_videoTexture, fixedTexCoord + redOffset).r;
        color.g = texture2D(u_videoTexture, fixedTexCoord + greenOffset).g;
        color.b = texture2D(u_videoTexture, fixedTexCoord + blueOffset).b;
        
        if (totalAberration > 0.001) {
          vec2 strongerRedOffset = distortion - radialDirection * totalAberration * 1.5;
          vec2 strongerBlueOffset = distortion + radialDirection * totalAberration * 1.5;
          
          color.r = mix(color.r, texture2D(u_videoTexture, fixedTexCoord + strongerRedOffset).r, 0.3);
          color.b = mix(color.b, texture2D(u_videoTexture, fixedTexCoord + strongerBlueOffset).b, 0.3);
        }
        
        color = clamp(color, 0.0, 1.0);
      } else {
        color = texture2D(u_videoTexture, fixedTexCoord + distortion).rgb;
      }
      
      vec3 normal = normalize(vec3(-waterData.z, 0.2, -waterData.w));
      vec3 lightDir = normalize(vec3(-3.0, 10.0, 3.0));
      float glint = pow(max(0.0, dot(normal, lightDir)), 60.0);
      
      vec3 glintColor = vec3(1.0, 0.95, 0.9);
      
      gl_FragColor = vec4(color + glint * glintColor, 1.0);
    }
  `;

  const createProgram = useCallback((gl: WebGLRenderingContext, vertexSource: string, fragmentSource: string): WebGLProgram | null => {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) return null;
    
    gl.shaderSource(vertexShader, vertexSource);
    gl.compileShader(vertexShader);
    
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error('Vertex shader compile error:', gl.getShaderInfoLog(vertexShader));
      gl.deleteShader(vertexShader);
      return null;
    }

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) return null;
    
    gl.shaderSource(fragmentShader, fragmentSource);
    gl.compileShader(fragmentShader);
    
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error('Fragment shader compile error:', gl.getShaderInfoLog(fragmentShader));
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return null;
    }

    const program = gl.createProgram();
    if (!program) return null;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteProgram(program);
      return null;
    }

    return program;
  }, []);

  const createFramebuffer = useCallback((gl: WebGLRenderingContext, width: number, height: number): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null => {
    const framebuffer = gl.createFramebuffer();
    const texture = gl.createTexture();
    
    if (!framebuffer || !texture) return null;
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    
    return { framebuffer, texture };
  }, []);

  const initWebGL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const rect = parent.getBoundingClientRect();
    // 성능 최적화: 해상도를 60%로 설정 (화질과 성능 균형)
    const width = Math.floor(rect.width * 0.6);
    const height = Math.floor(rect.height * 0.6);
    
    if (width === 0 || height === 0) return;

    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    const ext = gl.getExtension('OES_texture_float');
    if (!ext) {
      console.error('Float textures not supported');
      return;
    }

    glRef.current = gl;
    gl.viewport(0, 0, width, height);

    const waterProgram = createProgram(gl, vertexShaderSource, waterFragmentShaderSource);
    const videoProgram = createProgram(gl, vertexShaderSource, videoFragmentShaderSource);
    
    if (!waterProgram || !videoProgram) {
      console.error('Failed to create shader programs');
      return;
    }
    
    waterProgramRef.current = waterProgram;
    videoProgramRef.current = videoProgram;

    const fbA = createFramebuffer(gl, width, height);
    const fbB = createFramebuffer(gl, width, height);
    
    if (!fbA || !fbB) {
      console.error('Failed to create framebuffers');
      return;
    }
    
    framebufferARef.current = fbA.framebuffer;
    framebufferBRef.current = fbB.framebuffer;
    textureARef.current = fbA.texture;
    textureBRef.current = fbB.texture;

    const videoTexture = gl.createTexture();
    if (!videoTexture) {
      console.error('Failed to create video texture');
      return;
    }
    videoTextureRef.current = videoTexture;
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    setIsInitialized(true);
  }, [createProgram, createFramebuffer, videoElement, vertexShaderSource, waterFragmentShaderSource, videoFragmentShaderSource]);

  const render = useCallback(() => {
    const gl = glRef.current;
    const canvas = canvasRef.current;
    if (!gl || !canvas || !isInitialized || !videoElement) return;

    const waterProgram = waterProgramRef.current;
    const videoProgram = videoProgramRef.current;
    
    if (!waterProgram || !videoProgram) return;

    frameCountRef.current++;

    // 비디오 텍스처 업데이트
    if (videoElement.readyState >= 2) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, videoTextureRef.current);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
    }

    // Ping-Pong 렌더링
    const readFramebuffer = frameCountRef.current % 2 === 0 ? framebufferARef.current : framebufferBRef.current;
    const writeFramebuffer = frameCountRef.current % 2 === 0 ? framebufferBRef.current : framebufferARef.current;
    const readTexture = frameCountRef.current % 2 === 0 ? textureARef.current : textureBRef.current;
    const writeTexture = frameCountRef.current % 2 === 0 ? textureBRef.current : textureARef.current;

    // 물 시뮬레이션
    gl.bindFramebuffer(gl.FRAMEBUFFER, writeFramebuffer);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(waterProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, readTexture);
    gl.uniform1i(gl.getUniformLocation(waterProgram, 'u_texture'), 0);

    gl.uniform2f(gl.getUniformLocation(waterProgram, 'u_resolution'), canvas.width, canvas.height);
    gl.uniform1i(gl.getUniformLocation(waterProgram, 'u_frame'), frameCountRef.current);
    gl.uniform3f(gl.getUniformLocation(waterProgram, 'u_mouse'), 
      mouseRef.current.x, mouseRef.current.y, mouseRef.current.down ? 1.0 : 0.0);
    
    gl.uniform1f(gl.getUniformLocation(waterProgram, 'u_waveSpeed'), waveSpeed);
    gl.uniform1f(gl.getUniformLocation(waterProgram, 'u_springStrength'), springStrength);
    gl.uniform1f(gl.getUniformLocation(waterProgram, 'u_velocityDamping'), velocityDamping);
    gl.uniform1f(gl.getUniformLocation(waterProgram, 'u_pressureDamping'), pressureDamping);
    gl.uniform1f(gl.getUniformLocation(waterProgram, 'u_rippleSize'), rippleSize);
    gl.uniform1f(gl.getUniformLocation(waterProgram, 'u_rippleStrength'), rippleStrength);

    const positionLocation = gl.getAttribLocation(waterProgram, 'a_position');
    const positionBuffer = gl.createBuffer();
    const positions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // 화면에 렌더링
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(videoProgram);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, writeTexture);
    gl.uniform1i(gl.getUniformLocation(videoProgram, 'u_waterTexture'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, videoTextureRef.current);
    gl.uniform1i(gl.getUniformLocation(videoProgram, 'u_videoTexture'), 1);

    gl.uniform2f(gl.getUniformLocation(videoProgram, 'u_resolution'), canvas.width, canvas.height);
    gl.uniform1f(gl.getUniformLocation(videoProgram, 'u_distortionStrength'), distortionStrength);
    gl.uniform1f(gl.getUniformLocation(videoProgram, 'u_chromaticAberrationStrength'), chromaticAberrationStrength);
    gl.uniform1f(gl.getUniformLocation(videoProgram, 'u_chromaticAberrationDispersal'), chromaticAberrationDispersal);

    const videoPositionLocation = gl.getAttribLocation(videoProgram, 'a_position');
    gl.enableVertexAttribArray(videoPositionLocation);
    gl.vertexAttribPointer(videoPositionLocation, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    animationRef.current = requestAnimationFrame(render);
  }, [isInitialized, videoElement, waveSpeed, springStrength, velocityDamping, pressureDamping, rippleSize, rippleStrength, distortionStrength, chromaticAberrationStrength, chromaticAberrationDispersal]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas의 실제 위치와 크기 가져오기
    const rect = canvas.getBoundingClientRect();
    
    // 마우스 위치를 canvas 좌표로 변환 (화면 좌표계: 왼쪽 위가 0,0)
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    // CSS 크기와 실제 canvas 픽셀 크기의 비율 계산
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    // 픽셀 좌표로 변환
    // 셰이더에서 fragCoord = v_texCoord * u_resolution 사용
    // v_texCoord는 0~1 범위 (왼쪽 아래가 0,0, 오른쪽 위가 1,1)
    // fragCoord는 픽셀 좌표 (왼쪽 아래가 0,0)
    // 화면 좌표는 왼쪽 위가 0,0이므로 Y축을 뒤집어야 함
    const pixelX = clientX * scaleX;
    const pixelY = canvas.height - (clientY * scaleY); // Y축 반전
    
    mouseRef.current.x = pixelX;
    mouseRef.current.y = pixelY;
    mouseRef.current.down = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.down = false;
  }, []);

  useEffect(() => {
    initWebGL();
  }, [initWebGL]);

  useEffect(() => {
    if (isInitialized) {
      render();
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [render, isInitialized]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      
      const rect = parent.getBoundingClientRect();
      // 성능 최적화: 해상도를 60%로 설정 (화질과 성능 균형)
      const width = Math.floor(rect.width * 0.6);
      const height = Math.floor(rect.height * 0.6);
      
      if (width === 0 || height === 0) return;
      
      if (canvas.width === width && canvas.height === height) return;
      
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      
      if (glRef.current) {
        glRef.current.viewport(0, 0, width, height);
      }
      
      if (isInitialized && glRef.current && framebufferARef.current && framebufferBRef.current) {
        const gl = glRef.current;
        const fbA = createFramebuffer(gl, width, height);
        const fbB = createFramebuffer(gl, width, height);
        
        if (fbA && fbB) {
          framebufferARef.current = fbA.framebuffer;
          framebufferBRef.current = fbB.framebuffer;
          textureARef.current = fbA.texture;
          textureBRef.current = fbB.texture;
        }
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });

    const parent = canvas.parentElement;
    if (parent) {
      resizeObserver.observe(parent);
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [isInitialized, createFramebuffer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const parent = canvas.parentElement;
    if (!parent) return;

    // 부모 div에서 마우스 이벤트 처리 (더 정확한 좌표)
    const handleParentMouseMove = (e: MouseEvent) => {
      if (!canvas) return;
      
      const parentRect = parent.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      
      // 부모 div 기준 좌표
      const x = e.clientX - parentRect.left;
      const y = e.clientY - parentRect.top;
      
      // Canvas가 부모 div 안에 완전히 들어가 있으므로, canvas 기준으로 변환
      const canvasX = e.clientX - canvasRect.left;
      const canvasY = e.clientY - canvasRect.top;
      
      // CSS 크기와 실제 canvas 픽셀 크기의 비율
      const scaleX = canvas.width / canvasRect.width;
      const scaleY = canvas.height / canvasRect.height;
      
      // 픽셀 좌표로 변환 (Y축 반전)
      mouseRef.current.x = canvasX * scaleX;
      mouseRef.current.y = canvas.height - (canvasY * scaleY);
      mouseRef.current.down = true;
    };

    const handleParentMouseLeave = () => {
      mouseRef.current.down = false;
    };

    parent.addEventListener('mousemove', handleParentMouseMove);
    parent.addEventListener('mouseleave', handleParentMouseLeave);

    return () => {
      parent.removeEventListener('mousemove', handleParentMouseMove);
      parent.removeEventListener('mouseleave', handleParentMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        cursor: 'pointer',
        pointerEvents: 'none'
      }}
    />
  );
}