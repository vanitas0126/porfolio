import { useEffect, useRef } from 'react';

interface ShadertoyWaterEffectProps {
  videoElement: HTMLVideoElement;
  waveSpeed?: number;
  springStrength?: number;
  velocityDamping?: number;
  pressureDamping?: number;
  distortionStrength?: number;
  rippleSize?: number;
  rippleStrength?: number;
  chromaticAberrationStrength?: number;
  chromaticAberrationDispersal?: number;
}

export function ShadertoyWaterEffect({
  videoElement,
  waveSpeed = 1.0,
  springStrength = 0.005,
  velocityDamping = 0.002,
  pressureDamping = 0.999,
  distortionStrength = 0.2,
  rippleSize = 20.0,
  rippleStrength = 1.0,
  chromaticAberrationStrength = 1.0,
  chromaticAberrationDispersal = 0.01
}: ShadertoyWaterEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const animationFrameRef = useRef<number>();
  
  // Ping-Pong textures
  const textureARef = useRef<WebGLTexture | null>(null);
  const textureBRef = useRef<WebGLTexture | null>(null);
  const framebufferARef = useRef<WebGLFramebuffer | null>(null);
  const framebufferBRef = useRef<WebGLFramebuffer | null>(null);
  
  // Video texture
  const videoTextureRef = useRef<WebGLTexture | null>(null);
  
  // Programs
  const physicsProgramRef = useRef<WebGLProgram | null>(null);
  const renderProgramRef = useRef<WebGLProgram | null>(null);
  
  // Mouse state
  const mousePosRef = useRef({ x: 0.5, y: 0.5 });
  const prevMousePosRef = useRef({ x: 0.5, y: 0.5 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }

    // Float texture support 확인
    if (!gl.getExtension('OES_texture_float')) {
      console.error('Float textures not supported');
      return;
    }

    glRef.current = gl;

    // Vertex shader (공통)
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Physics shader (물리 시뮬레이션)
    const physicsShaderSource = `#version 300 es
      precision highp float;
      
      in vec2 v_texCoord;
      out vec4 fragColor;
      
      uniform sampler2D u_state; // pressure(r), velocity(g)
      uniform float u_delta;
      uniform float u_waveSpeed;
      uniform float u_springStrength;
      uniform float u_velocityDamping;
      uniform float u_pressureDamping;
      uniform vec2 u_resolution;
      uniform vec2 u_mousePos;
      uniform float u_rippleSize;
      uniform float u_rippleStrength;
      uniform vec2 u_previousMouse;
      
      void main() {
        vec2 uv = v_texCoord;
        vec2 texelSize = 1.0 / u_resolution;
        
        // 이웃 셀 읽기 (RG = pressure, velocity)
        vec4 state = texture(u_state, uv);
        float p = state.r;
        float v = state.g;
        
        vec4 state_right = texture(u_state, uv + vec2(texelSize.x, 0.0));
        vec4 state_left = texture(u_state, uv - vec2(texelSize.x, 0.0));
        vec4 state_up = texture(u_state, uv + vec2(0.0, texelSize.y));
        vec4 state_down = texture(u_state, uv - vec2(0.0, -texelSize.y));
        
        float p_right = state_right.r;
        float p_left = state_left.r;
        float p_up = state_up.r;
        float p_down = state_down.r;
        
        float p_right = texture(u_pressure, uv + vec2(texelSize.x, 0.0)).r;
        float p_left = texture(u_pressure, uv - vec2(texelSize.x, 0.0)).r;
        float p_up = texture(u_pressure, uv + vec2(0.0, texelSize.y)).r;
        float p_down = texture(u_pressure, uv - vec2(0.0, -texelSize.y)).r;
        
        // 파동 전파 (Wave Equation)
        float laplacian = p_right + p_left + p_up + p_down - 4.0 * p;
        v += u_waveSpeed * u_waveSpeed * laplacian * u_delta;
        
        // 스프링 복원력
        v -= u_springStrength * u_delta * p;
        
        // 감쇠
        v *= 1.0 - u_velocityDamping * u_delta;
        
        // 마우스 호버 상호작용 (항상 작동)
        vec2 mouseCoord = vec2(u_mousePos.x, 1.0 - u_mousePos.y);
        vec2 mouseDelta = mouseCoord - vec2(u_previousMouse.x, 1.0 - u_previousMouse.y);
        float mouseSpeed = length(mouseDelta);
        
        vec2 fragCoord = uv * u_resolution;
        vec2 mousePixel = mouseCoord * u_resolution;
        float dist = distance(fragCoord, mousePixel);
        
        // 마우스가 움직였을 때만 물결 생성
        if (mouseSpeed > 0.001 && dist <= u_rippleSize) {
          float falloff = 1.0 - (dist / u_rippleSize);
          falloff = falloff * falloff * falloff; // 더 부드러운 곡선
          p += u_rippleStrength * falloff * mouseSpeed * 20.0;
        }
        
        // 압력 업데이트
        p += v * u_delta;
        p *= u_pressureDamping;
        
        fragColor = vec4(p, v, 0.0, 1.0);
      }
    `;

    // Render shader (최종 렌더링 + 색수차)
    const renderShaderSource = `#version 300 es
      precision highp float;
      
      in vec2 v_texCoord;
      out vec4 fragColor;
      
      uniform sampler2D u_videoTexture;
      uniform sampler2D u_state; // pressure(r), velocity(g)
      uniform vec2 u_resolution;
      uniform float u_distortionStrength;
      uniform float u_chromaticAberrationStrength;
      uniform float u_chromaticAberrationDispersal;
      
      void main() {
        vec2 uv = v_texCoord;
        vec2 texelSize = 1.0 / u_resolution;
        
        // 물의 그래디언트로 굴절 계산
        float p = texture(u_state, uv).r;
        float p_right = texture(u_state, uv + vec2(texelSize.x, 0.0)).r;
        float p_left = texture(u_state, uv - vec2(texelSize.x, 0.0)).r;
        float p_up = texture(u_state, uv + vec2(0.0, texelSize.y)).r;
        float p_down = texture(u_state, uv - vec2(0.0, -texelSize.y)).r;
        
        vec2 normal = vec2((p_right - p_left) * 0.5, (p_up - p_down) * 0.5);
        vec2 refractionOffset = normal * u_distortionStrength * 3.0; // 굴절 효과
        
        // 색수차 효과
        vec2 center = vec2(0.5);
        vec2 offset = v_texCoord - center;
        float dist = length(offset);
        vec2 direction = normalize(offset);
        float aberration = dist * u_chromaticAberrationStrength * u_chromaticAberrationDispersal;
        
        vec2 distortedUv = uv + refractionOffset;
        vec2 chromaOffset = direction * aberration;
        
        // 비디오 텍스처 샘플링
        vec4 videoColor = texture(u_videoTexture, distortedUv);
        vec4 leftColor = texture(u_videoTexture, distortedUv - chromaOffset);
        vec4 rightColor = texture(u_videoTexture, distortedUv + chromaOffset);
        
        // 색수차 적용 (R과 B 채널만 오프셋)
        vec3 color = vec3(leftColor.r, videoColor.g, rightColor.b);
        
        // 물 효과가 있을 때만 적용 (pressure가 0이 아닐 때)
        float effectStrength = abs(p) * 2.0;
        effectStrength = min(effectStrength, 1.0);
        
        // 원본 비디오를 기본으로 사용하고, 효과가 있을 때만 굴절과 색수차 적용
        // 물 효과가 거의 없을 때는 원본 비디오를 그대로 표시
        vec3 baseColor = videoColor.rgb;
        
        // 효과 강도에 따라 굴절과 색수차를 적용
        vec3 effectColor = color;
        
        // 효과가 있을 때만 블렌딩 (매우 약하게)
        vec3 finalColor = mix(baseColor, effectColor, effectStrength * 0.2);
        
        // 완전히 투명한 배경 (물 효과가 없을 때는 보이지 않음)
        // 효과가 있을 때만 약간 보이도록
        float alpha = step(0.01, effectStrength) * effectStrength * 0.15;
        
        fragColor = vec4(finalColor, alpha);
      }
    `;

    // Compile shader
    const compileShader = (source: string, type: number): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    // Create programs
    const createProgram = (vertexSource: string, fragmentSource: string): WebGLProgram | null => {
      const vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
      const fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);
      if (!vertexShader || !fragmentShader) return null;

      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Program error:', gl.getProgramInfoLog(program));
        return null;
      }
      return program;
    };

    const physicsProgram = createProgram(vertexShaderSource, physicsShaderSource);
    const renderProgram = createProgram(vertexShaderSource, renderShaderSource);
    
    if (!physicsProgram || !renderProgram) return;

    physicsProgramRef.current = physicsProgram;
    renderProgramRef.current = renderProgram;

    // Geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  0, 1,
       1, -1,  1, 1,
      -1,  1,  0, 0,
       1,  1,  1, 0,
    ]), gl.STATIC_DRAW);

    // Create ping-pong textures
    const createFloatTexture = (width: number, height: number): WebGLTexture | null => {
      const texture = gl.createTexture();
      if (!texture) return null;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return texture;
    };

    const createFramebuffer = (texture: WebGLTexture): WebGLFramebuffer | null => {
      const fb = gl.createFramebuffer();
      if (!fb) return null;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return fb;
    };

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        
        if (width === 0 || height === 0) return;
        
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);

        // Ping-pong textures 재생성
        if (textureARef.current) gl.deleteTexture(textureARef.current);
        if (textureBRef.current) gl.deleteTexture(textureBRef.current);
        if (framebufferARef.current) gl.deleteFramebuffer(framebufferARef.current);
        if (framebufferBRef.current) gl.deleteFramebuffer(framebufferBRef.current);

        textureARef.current = createFloatTexture(width, height);
        textureBRef.current = createFloatTexture(width, height);
        
        if (textureARef.current) framebufferARef.current = createFramebuffer(textureARef.current);
        if (textureBRef.current) framebufferBRef.current = createFramebuffer(textureBRef.current);
        
        // 초기 상태 설정 (0으로 초기화)
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferARef.current);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        
        gl.bindFramebuffer(gl.FRAMEBUFFER, framebufferBRef.current);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Video texture
    const videoTexture = gl.createTexture();
    videoTextureRef.current = videoTexture;
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Mouse tracking - 호버로 작동
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      prevMousePosRef.current = { ...mousePosRef.current };
      mousePosRef.current.x = (e.clientX - rect.left) / rect.width;
      mousePosRef.current.y = (e.clientY - rect.top) / rect.height;
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    let frameCount = 0;
    const render = () => {
      if (!gl || !physicsProgram || !renderProgram) return;
      if (!textureARef.current || !textureBRef.current) return;

      frameCount++;
      const isEvenFrame = frameCount % 2 === 0;

      // Ping-pong 선택
      const readTexture = isEvenFrame ? textureARef.current : textureBRef.current;
      const writeFramebuffer = isEvenFrame ? framebufferBRef.current : framebufferARef.current;
      const writeTexture = isEvenFrame ? textureBRef.current : textureARef.current;

      // Update video texture
      if (videoElement.readyState >= 2) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
      }

      // Physics pass
      gl.useProgram(physicsProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeFramebuffer);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      const positionLoc = gl.getAttribLocation(physicsProgram, 'a_position');
      const texCoordLoc = gl.getAttribLocation(physicsProgram, 'a_texCoord');
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(texCoordLoc);
      gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, readTexture);

      gl.uniform1i(gl.getUniformLocation(physicsProgram, 'u_state'), 1);
      
      // 이전 프레임과 현재 프레임이 같으면 초기화 (첫 프레임)
      if (frameCount === 1) {
        prevMousePosRef.current = { ...mousePosRef.current };
      }
      gl.uniform1f(gl.getUniformLocation(physicsProgram, 'u_delta'), 0.016);
      gl.uniform1f(gl.getUniformLocation(physicsProgram, 'u_waveSpeed'), waveSpeed);
      gl.uniform1f(gl.getUniformLocation(physicsProgram, 'u_springStrength'), springStrength);
      gl.uniform1f(gl.getUniformLocation(physicsProgram, 'u_velocityDamping'), velocityDamping);
      gl.uniform1f(gl.getUniformLocation(physicsProgram, 'u_pressureDamping'), pressureDamping);
      gl.uniform2f(gl.getUniformLocation(physicsProgram, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform2f(gl.getUniformLocation(physicsProgram, 'u_mousePos'), mousePosRef.current.x, mousePosRef.current.y);
      gl.uniform1f(gl.getUniformLocation(physicsProgram, 'u_rippleSize'), rippleSize);
      gl.uniform1f(gl.getUniformLocation(physicsProgram, 'u_rippleStrength'), rippleStrength);
      gl.uniform2f(gl.getUniformLocation(physicsProgram, 'u_previousMouse'), prevMousePosRef.current.x, prevMousePosRef.current.y);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      prevMousePosRef.current = { ...mousePosRef.current };

      // Render pass
      gl.useProgram(renderProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, videoTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, writeTexture);

      gl.uniform1i(gl.getUniformLocation(renderProgram, 'u_videoTexture'), 0);
      gl.uniform1i(gl.getUniformLocation(renderProgram, 'u_state'), 1);
      gl.uniform2f(gl.getUniformLocation(renderProgram, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform1f(gl.getUniformLocation(renderProgram, 'u_distortionStrength'), distortionStrength);
      gl.uniform1f(gl.getUniformLocation(renderProgram, 'u_chromaticAberrationStrength'), chromaticAberrationStrength);
      gl.uniform1f(gl.getUniformLocation(renderProgram, 'u_chromaticAberrationDispersal'), chromaticAberrationDispersal);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('mousemove', handleMouseMove);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      if (textureARef.current) gl.deleteTexture(textureARef.current);
      if (textureBRef.current) gl.deleteTexture(textureBRef.current);
      if (framebufferARef.current) gl.deleteFramebuffer(framebufferARef.current);
      if (framebufferBRef.current) gl.deleteFramebuffer(framebufferBRef.current);
      if (videoTexture) gl.deleteTexture(videoTexture);
      if (physicsProgram) gl.deleteProgram(physicsProgram);
      if (renderProgram) gl.deleteProgram(renderProgram);
    };
  }, [
    videoElement,
    waveSpeed,
    springStrength,
    velocityDamping,
    pressureDamping,
    distortionStrength,
    rippleSize,
    rippleStrength,
    chromaticAberrationStrength,
    chromaticAberrationDispersal
  ]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'auto',
        mixBlendMode: 'screen' // 스크린 블렌드로 밝게 표시
      }}
    />
  );
}
