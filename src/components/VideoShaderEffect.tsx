import { useEffect, useRef } from 'react';

interface VideoShaderEffectProps {
  videoElement: HTMLVideoElement;
}

export function VideoShaderEffect({ videoElement }: VideoShaderEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const videoTextureRef = useRef<WebGLTexture | null>(null);
  const timeRef = useRef(0);
  const mousePosRef = useRef({ x: 0.5, y: 0.5 });
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }

    glRef.current = gl;

    // Vertex shader
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      in vec2 a_texCoord;
      out vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;

    // Fragment shader - Caustics + Chromatic Aberration + Water Ripple combined
    const fragmentShaderSource = `#version 300 es
      precision highp float;
      
      in vec2 v_texCoord;
      out vec4 fragColor;
      
      uniform sampler2D u_videoTexture;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_mousePos;
      
      const float PI = 3.14159265359;
      
      // Noise functions from JSON
      vec4 permute(vec4 t) { 
        return t * (t * 34.0 + 133.0); 
      }
      
      vec3 grad(float hash) { 
        vec3 cube = mod(floor(hash / vec3(1.0, 2.0, 4.0)), 2.0) * 2.0 - 1.0; 
        vec3 cuboct = cube;
        float index0 = step(0.0, 1.0 - floor(hash / 16.0)); 
        float index1 = step(0.0, floor(hash / 16.0) - 1.0);
        cuboct.x *= 1.0 - index0; 
        cuboct.y *= 1.0 - index1; 
        cuboct.z *= 1.0 - (1.0 - index0 - index1);
        float type = mod(floor(hash / 8.0), 2.0); 
        vec3 rhomb = (1.0 - type) * cube + type * (cuboct + cross(cube, cuboct));
        vec3 grad = cuboct * 1.22474487139 + rhomb;
        grad *= (1.0 - 0.042942436724648037 * type) * 3.5946317686139184;
        return grad; 
      } 
      
      vec4 bccNoiseDerivativesPart(vec3 X) { 
        vec3 b = floor(X); 
        vec4 i4 = vec4(X - b, 2.5); 
        vec3 v1 = b + floor(dot(i4, vec4(.25))); 
        vec3 v2 = b + vec3(1, 0, 0) + vec3(-1, 1, 1) * floor(dot(i4, vec4(-.25, .25, .25, .35))); 
        vec3 v3 = b + vec3(0, 1, 0) + vec3(1, -1, 1) * floor(dot(i4, vec4(.25, -.25, .25, .35))); 
        vec3 v4 = b + vec3(0, 0, 1) + vec3(1, 1, -1) * floor(dot(i4, vec4(.25, .25, -.25, .35))); 
        vec4 hashes = permute(mod(vec4(v1.x, v2.x, v3.x, v4.x), 289.0)); 
        hashes = permute(mod(hashes + vec4(v1.y, v2.y, v3.y, v4.y), 289.0)); 
        hashes = mod(permute(mod(hashes + vec4(v1.z, v2.z, v3.z, v4.z), 289.0)), 48.0); 
        vec3 d1 = X - v1; 
        vec3 d2 = X - v2; 
        vec3 d3 = X - v3; 
        vec3 d4 = X - v4; 
        vec4 a = max(0.75 - vec4(dot(d1, d1), dot(d2, d2), dot(d3, d3), dot(d4, d4)), 0.0); 
        vec4 aa = a * a; 
        vec4 aaaa = aa * aa; 
        vec3 g1 = grad(hashes.x); 
        vec3 g2 = grad(hashes.y); 
        vec3 g3 = grad(hashes.z); 
        vec3 g4 = grad(hashes.w); 
        vec4 extrapolations = vec4(dot(d1, g1), dot(d2, g2), dot(d3, g3), dot(d4, g4)); 
        vec3 derivative = -8.0 * mat4x3(d1, d2, d3, d4) * (aa * a * extrapolations) + mat4x3(g1, g2, g3, g4) * aaaa; 
        return vec4(derivative, dot(aaaa, extrapolations)); 
      } 
      
      vec4 bccNoiseDerivatives_XYBeforeZ(vec3 X) { 
        mat3 orthonormalMap = mat3(
          0.788675134594813, -0.211324865405187, -0.577350269189626,
          -0.211324865405187, 0.788675134594813, -0.577350269189626,
          0.577350269189626, 0.577350269189626, 0.577350269189626
        ); 
        X = orthonormalMap * X; 
        vec4 result = bccNoiseDerivativesPart(X) + bccNoiseDerivativesPart(X + 144.5); 
        return vec4(result.xyz * orthonormalMap, result.w); 
      }
      
      vec4 getNoise(vec3 p) { 
        vec4 noise = bccNoiseDerivatives_XYBeforeZ(p); 
        return mix(noise, (noise + 0.5) * 0.5, 0.0); 
      }
      
      void getCaustics(vec2 uv, out vec4 outNoise, out vec3 outColor) { 
        vec2 aspect = vec2(u_resolution.x/u_resolution.y, 1.0);
        // 마우스 추적 강화 - 0.12 대신 더 큰 값 사용 (JSON: trackMouse 0.12)
        vec2 mPos = vec2(0.5123894806030065, 0.4975861842119629) + mix(vec2(0.0), (u_mousePos - 0.5), 1.0); 
        vec2 drift = vec2(0.0, 0.1800 * u_time * 0.0125); 
        mat2 rot = mat2(cos(-0.0189 * -2.0 * PI), -sin(-0.0189 * -2.0 * PI),
                        sin(-0.0189 * -2.0 * PI), cos(-0.0189 * -2.0 * PI));
        vec2 pos = vec2(0.5123894806030065, 0.4975861842119629) + drift * rot; 
        // 마우스 거리 계산 - 더 넓은 영향 범위
        float mDist = max(0.0, 1.0 - distance(uv * aspect, mPos * aspect) * 2.0 * (1.0 - 0.50)); 
        uv -= pos; 
        mat2 rot2 = mat2(cos(-0.0189 * 2.0 * PI), -sin(-0.0189 * 2.0 * PI),
                         sin(-0.0189 * 2.0 * PI), cos(-0.0189 * 2.0 * PI));
        uv = uv * aspect * rot2 * vec2(1.0 - 0.0000, 1.0) * 16.0 * 0.1600; 
        float refraction = mix(0.25, 1.3, 0.1500); 
        vec3 p = vec3(uv, u_time * 0.05); 
        vec4 noise = getNoise(p); 
        vec4 baseNoise = noise; 
        vec4 balanceNoise = getNoise(p - vec3(baseNoise.xyz / 32.0) * refraction); 
        noise = getNoise(p - vec3(balanceNoise.xyz / 16.0) * refraction); 
        float balancer = (0.5 + 0.5 * balanceNoise.w); 
        float normalized = pow(0.5 + 0.5 * noise.w, 2.0); 
        float value = mix(0.0, normalized + 0.2 * (1.0 - normalized), balancer * mDist); 
        outNoise = baseNoise * mDist; 
        outColor = vec3(0.4196078431372549, 0.8235294117647058, 1.0) * value; 
      }
      
      vec3 getAbberatedColor(vec3 color, vec3 left, vec3 center, vec3 right) { 
        return vec3(mix(color.r, center.r, 1.0), left.g, right.b); 
      }
      
      void main() { 
        vec2 uv = v_texCoord;
        float aspectRatio = u_resolution.x/u_resolution.y;
        vec2 mPos = vec2(0.48519163763066203, 0.5111498257839722) + mix(vec2(0.0), (u_mousePos - 0.5), 0.0);
        vec2 pos = vec2(0.48519163763066203, 0.5111498257839722);
        float angle = ((0.2457 + u_time * 0.05) * 360.0) * PI / 180.0;
        vec2 rotation = vec2(sin(angle), cos(angle));
        
        // Get caustics
        vec4 causticNoise;
        vec3 causticColor;
        getCaustics(uv, causticNoise, causticColor);
        
        // 마우스 위치에 따라 직접적인 굴절 효과
        vec2 mouseOffset = (u_mousePos - 0.5) * 0.1;
        vec2 mouseDist = uv - u_mousePos;
        float mouseDistFactor = 1.0 / (1.0 + length(mouseDist) * 5.0);
        
        // Apply caustics distortion to UV - 마우스에 더 강하게 반응하도록
        vec2 distortedUv = uv + causticNoise.xy * 0.01 * 0.2500 + mouseOffset * mouseDistFactor * 0.3;
        
        // Chromatic aberration
        float mDist = max(0.0, 1.0 - distance(distortedUv * vec2(aspectRatio, 1.0), mPos * vec2(aspectRatio, 1.0)) * 4.0 * (1.0 - 0.8300));
        vec2 aberrated;
        vec2 dir = distortedUv - pos;
        float dist = length(dir);
        dir = normalize(dir);
        aberrated = 0.4700 * dir * 0.03 * mix(1.0, dist * (1.0 + 0.8100), 0.8100);
        aberrated *= mDist;
        
        float amt = length(aberrated);
        vec4 color;
        
        if(amt < 0.001) {
          color = texture(u_videoTexture, distortedUv);
        } else {
          vec4 left = vec4(0.0);
          vec4 right = vec4(0.0);
          vec4 center = vec4(0.0);
          float steps = max(2.0, min(14.0, 24.0));
          float invSteps = 1.0 / (steps + 1.0);
          
          for (float i = 0.0; i <= steps; i++) {
            vec2 offset = aberrated * (i * invSteps);
            left += texture(u_videoTexture, distortedUv - offset) * invSteps;
            right += texture(u_videoTexture, distortedUv + offset) * invSteps;
          }
          
          for (float i = 0.0; i <= steps; i++) {
            vec2 offset = aberrated * ((i / steps) - 0.5);
            center += texture(u_videoTexture, distortedUv + offset) * invSteps;
          }
          
          color.rgb = getAbberatedColor(color.rgb, left.rgb, center.rgb, right.rgb);
          color.a = max(max(left.a, center.a), right.a);
        }
        
        // Blend caustics
        vec3 blended = 1.0 - (1.0 - color.rgb) * (1.0 - causticColor);
        color.rgb = mix(color.rgb, blended, 1.0);
        
        fragColor = color;
      }
    `;

    // Compile shader
    const compileShader = (source: string, type: number): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      
      return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    
    if (!vertexShader || !fragmentShader) return;

    // Create program
    const program = gl.createProgram();
    if (!program) return;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    programRef.current = program;

    // Setup geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  0, 1,
       1, -1,  1, 1,
      -1,  1,  0, 0,
       1,  1,  1, 0,
    ]), gl.STATIC_DRAW);

    // Create video texture
    const videoTexture = gl.createTexture();
    videoTextureRef.current = videoTexture;

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse tracking - 더 넓은 영역에서도 작동하도록
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mousePosRef.current.x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      mousePosRef.current.y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
      
      // 디버깅용 콘솔 로그 (선택적)
      // console.log('Mouse pos:', mousePosRef.current);
    };

    // 캔버스뿐만 아니라 부모 컨테이너에서도 마우스 추적
    const parent = canvas.parentElement;
    const handleParentMouseMove = (e: MouseEvent) => {
      const parentRect = parent!.getBoundingClientRect();
      mousePosRef.current.x = Math.max(0, Math.min(1, (e.clientX - parentRect.left) / parentRect.width));
      mousePosRef.current.y = Math.max(0, Math.min(1, (e.clientY - parentRect.top) / parentRect.height));
    };

    if (parent) {
      parent.addEventListener('mousemove', handleParentMouseMove);
    }
    canvas.addEventListener('mousemove', handleMouseMove);
    
    // 전역 마우스 추적도 추가 (히어로 섹션 전체에서 작동)
    const handleGlobalMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      
      // 캔버스 영역 내에 있는지 확인
      if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
        mousePosRef.current.x = Math.max(0, Math.min(1, x));
        mousePosRef.current.y = Math.max(0, Math.min(1, y));
      }
    };
    
    window.addEventListener('mousemove', handleGlobalMouseMove);

    const render = () => {
      if (!gl || !program || !videoTexture) return;

      timeRef.current += 0.016;

      // Update video texture
      if (videoElement.readyState >= 2) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }

      gl.useProgram(program);

      // Setup attributes
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
      
      const positionLocation = gl.getAttribLocation(program, 'a_position');
      const texCoordLocation = gl.getAttribLocation(program, 'a_texCoord');
      
      gl.enableVertexAttribArray(positionLocation);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 16, 0);
      
      gl.enableVertexAttribArray(texCoordLocation);
      gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 16, 8);

      // Set uniforms
      gl.uniform1i(gl.getUniformLocation(program, 'u_videoTexture'), 0);
      gl.uniform1f(gl.getUniformLocation(program, 'u_time'), timeRef.current);
      gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height);
      gl.uniform2f(gl.getUniformLocation(program, 'u_mousePos'), mousePosRef.current.x, 1.0 - mousePosRef.current.y);

      // Draw
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      canvas.removeEventListener('mousemove', handleMouseMove);
      if (parent) {
        parent.removeEventListener('mousemove', handleParentMouseMove);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (videoTexture) gl.deleteTexture(videoTexture);
      if (program) gl.deleteProgram(program);
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
    };
  }, [videoElement]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }}
    />
  );
}

