import { useEffect, useRef } from 'react';

interface UnicornStudioWaterEffectProps {
  videoElement: HTMLVideoElement;
}

export function UnicornStudioWaterEffect({ videoElement }: UnicornStudioWaterEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const animationFrameRef = useRef<number>();
  
  // Ping-Pong textures for water ripple simulation
  const pingPongTexturesRef = useRef<{ texture: WebGLTexture; framebuffer: WebGLFramebuffer }[]>([]);
  
  // Render targets for passes
  const passTexturesRef = useRef<{ texture: WebGLTexture; framebuffer: WebGLFramebuffer }[]>([]);
  
  // Video texture
  const videoTextureRef = useRef<WebGLTexture | null>(null);
  
  // Programs
  const programsRef = useRef<{ [key: string]: WebGLProgram }>({});
  
  // Mouse state
  const mousePosRef = useRef({ x: 0.5, y: 0.5 });
  const prevMousePosRef = useRef({ x: 0.5, y: 0.5 });
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !videoElement) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) {
      console.error('WebGL2 not supported');
      return;
    }

    glRef.current = gl;

    // Float texture support
    const ext = gl.getExtension('OES_texture_float');
    if (!ext) {
      console.error('Float textures not supported');
      return;
    }

    // Common vertex shader
    const vertexShaderSource = `#version 300 es
      in vec3 aVertexPosition;
      in vec2 aTextureCoord;
      uniform mat4 uMVMatrix;
      uniform mat4 uPMatrix;
      uniform mat4 uTextureMatrix;
      out vec2 vTextureCoord;
      out vec3 vVertexPosition;
      
      void main() {
        gl_Position = uPMatrix * uMVMatrix * vec4(aVertexPosition, 1.0);
        vTextureCoord = (uTextureMatrix * vec4(aTextureCoord, 0.0, 1.0)).xy;
        vVertexPosition = aVertexPosition;
      }
    `;

    // Pass 1: Water Ripple Physics (Ping-Pong)
    const physicsShaderSource = `#version 300 es
      precision highp float;
      in vec3 vVertexPosition;
      in vec2 vTextureCoord;
      uniform sampler2D uPingPongTexture;
      uniform vec2 uPreviousMousePos;
      uniform vec2 uMousePos;
      uniform vec2 uResolution;
      
      const float PI = 3.1415926;
      const float TWOPI = 6.2831852;
      
      out vec4 fragColor;
      
      void main() {
        vec2 aspect = vec2(uResolution.x/uResolution.y, 1.0);
        vec2 texelSize = (1.0 / (vec2(1080.0) * aspect)) * mix(1.0, 8.0, 0.7500);
        vec2 vUv = vTextureCoord;
        
        vec2 mPos = mix(uMousePos, (uMousePos - 0.5) * 0.5 + 0.5, 0.7500);
        vec2 pmPos = mix(uPreviousMousePos, (uPreviousMousePos - 0.5) * 0.5 + 0.5, 0.7500);
        
        float waveSpeed = 1.0;
        float damping = mix(0.8, 0.999, 0.7500);
        float velocityDamping = damping;
        float heightDamping = damping;
        float time = 0.5;
        
        vec4 data = texture(uPingPongTexture, vUv);
        float height = data.r;
        float velocity = data.g;
        
        float laplacian = 0.0;
        float totalWeight = 0.0;
        float scaleDiff = 0.7500 * 0.25;
        vec2 clampRegionMin = vec2(0.7500 * 0.5 - scaleDiff);
        vec2 clampRegionMax = vec2(1.0 - 0.7500 * 0.5 + scaleDiff);
        
        vec2 offset = vec2(texelSize.x, 0.0);
        vec2 neighborUv = clamp(vUv + offset, clampRegionMin, clampRegionMax);
        float weight = 1.0 - length(offset) / (length(texelSize) * 2.0);
        laplacian += texture(uPingPongTexture, neighborUv).r * weight;
        totalWeight += weight;
        
        offset = vec2(-texelSize.x, 0.0);
        neighborUv = clamp(vUv + offset, clampRegionMin, clampRegionMax);
        weight = 1.0 - length(offset) / (length(texelSize) * 2.0);
        laplacian += texture(uPingPongTexture, neighborUv).r * weight;
        totalWeight += weight;
        
        offset = vec2(0.0, texelSize.y);
        neighborUv = clamp(vUv + offset, clampRegionMin, clampRegionMax);
        weight = 1.0 - length(offset) / (length(texelSize) * 2.0);
        laplacian += texture(uPingPongTexture, neighborUv).r * weight;
        totalWeight += weight;
        
        offset = vec2(0.0, -texelSize.y);
        neighborUv = clamp(vUv + offset, clampRegionMin, clampRegionMax);
        weight = 1.0 - length(offset) / (length(texelSize) * 2.0);
        laplacian += texture(uPingPongTexture, neighborUv).r * weight;
        totalWeight += weight;
        
        float avgNeighbors = laplacian / totalWeight;
        laplacian = avgNeighbors - height;
        
        velocity += waveSpeed * waveSpeed * laplacian;
        velocity *= velocityDamping;
        height += velocity;
        height *= heightDamping;
        
        float mouseSpeed = distance(mPos * aspect, pmPos * aspect);
        float dist = distance(vUv * aspect, mPos * aspect);
        float radius = 0.025;
        
        if (dist < radius && mouseSpeed > 0.0001) {
          float drop = cos(dist / radius * PI * time);
          float intensity = mouseSpeed * 20.0;
          height += drop * intensity;
        }
        
        fragColor = vec4(height, velocity, 0.0, 1.0);
      }
    `;

    // Pass 2: Normal calculation
    const normalShaderSource = `#version 300 es
      precision highp float;
      in vec2 vTextureCoord;
      in vec3 vVertexPosition;
      uniform sampler2D uPingPongTexture;
      
      const float PI = 3.1415926;
      const float ITERATIONS = 24.0;
      
      out vec4 fragColor;
      
      vec3 calculateNormal(sampler2D tex, vec2 uv) {
        float stengthScale = mix(3.0, 7.0, 0.7500);
        float stepScale = mix(1.0, 3.0, 0.7500);
        float strength = mix(1.0, stengthScale, 0.7700);
        float stepSize = mix(1.0, stepScale, 0.7700);
        float step = stepSize / 1080.0;
        
        float left = texture(tex, uv + vec2(-step, 0.0)).r;
        float right = texture(tex, uv + vec2(step, 0.0)).r;
        float top = texture(tex, uv + vec2(0.0, -step)).r;
        float bottom = texture(tex, uv + vec2(0.0, step)).r;
        
        vec3 normal;
        normal.x = (right - left) * strength;
        normal.y = -(bottom - top) * strength;
        normal.z = -1.0;
        return normalize(normal);
      }
      
      vec4 drawRipple(vec2 uv) {
        vec2 scaled = mix(uv, (uv - 0.5) * 0.5 + 0.5, 0.7500);
        vec3 normal = calculateNormal(uPingPongTexture, scaled);
        return vec4(normal, 1.0);
      }
      
      void main() {
        vec2 uv = vTextureCoord;
        vec4 color = drawRipple(uv);
        fragColor = color;
      }
    `;

    // Pass 3 & 4: Gaussian Blur (Horizontal and Vertical)
    const blurShaderSource = (direction: 'horizontal' | 'vertical') => `#version 300 es
      precision highp float;
      in vec2 vTextureCoord;
      in vec3 vVertexPosition;
      uniform sampler2D uTexture;
      
      const float PI = 3.1415926;
      const float ITERATIONS = 24.0;
      
      float getGaussianWeight(int index) {
        float weights[24] = float[24](
          0.7978845608028654, 0.795118932516684, 0.7868794322038799, 0.7733362336056986,
          0.7547664553859864, 0.7315447328280048, 0.704130653528599, 0.6730536454899063,
          0.6388960110447045, 0.6022748643096089, 0.5638237508206051, 0.5241747061566029,
          0.48394144903828673, 0.443704309411472, 0.40399737110811773, 0.36529817077804383,
          0.3280201493519873, 0.29250790855907144, 0.2590351913317835, 0.2278053882403838,
          0.19895427758549736, 0.17255463765302306, 0.1486223271179862, 0.12712341303392466
        );
        return index < 24 ? weights[index] : 0.0;
      }
      
      out vec4 fragColor;
      
      vec4 blur(vec2 uv, vec2 dir) {
        vec4 color = vec4(0.0);
        float total_weight = 0.0;
        vec4 center = texture(uTexture, uv);
        float center_weight = getGaussianWeight(0);
        color += center * center_weight;
        total_weight += center_weight;
        
        for (int i = 1; i <= 11; i++) {
          float weight = getGaussianWeight(i);
          float offset = mix(0.005, 0.015, 0.6400) * float(i) / 11.0;
          vec4 sample1 = texture(uTexture, uv + offset * dir);
          vec4 sample2 = texture(uTexture, uv - offset * dir);
          color += (sample1 + sample2) * weight;
          total_weight += 2.0 * weight;
        }
        
        return color / total_weight;
      }
      
      void main() {
        vec2 uv = vTextureCoord;
        vec2 dir = ${direction === 'horizontal' ? 'vec2(1.0, 0.0)' : 'vec2(0.0, 1.0)'};
        vec4 color = blur(uv, dir);
        fragColor = color;
      }
    `;

    // Pass 5: Final render with caustics, chromatic aberration, and water ripple
    const finalShaderSource = `#version 300 es
      precision highp float;
      in vec3 vVertexPosition;
      in vec2 vTextureCoord;
      uniform sampler2D uTexture;
      uniform sampler2D uBgTexture;
      uniform float uTime;
      uniform vec2 uMousePos;
      uniform vec2 uResolution;
      
      const float PI = 3.1415926;
      const float ITERATIONS = 24.0;
      
      out vec4 fragColor;
      
      // Noise functions (from JSON)
      vec4 permute(vec4 t) { return t * (t * 34.0 + 133.0); }
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
      
      float ease(int easingFunc, float t) { return t; }
      vec3 blend(int blendMode, vec3 src, vec3 dst) { return 1.0 - (1.0 - src) * (1.0 - dst); }
      vec4 normalizeNoise(vec4 noise, float amount) { return mix(noise, (noise + 0.5) * 0.5, amount); }
      mat2 rotate2d(float angle) { return mat2(cos(angle), -sin(angle), sin(angle), cos(angle)); }
      vec4 getNoise(vec3 p) {
        vec4 noise = bccNoiseDerivatives_XYBeforeZ(p);
        return normalizeNoise(noise, 0.0000);
      }
      
      void getCaustics(vec2 uv, out vec4 outNoise, out vec3 outColor) {
        vec2 aspect = vec2(uResolution.x/uResolution.y, 1.0);
        vec2 mPos = vec2(0.5123894806030065, 0.4975861842119629) + mix(vec2(0.0), (uMousePos - 0.5), 0.1200);
        vec2 drift = vec2(0.0, 0.1800 * uTime * 0.0125);
        vec2 pos = vec2(0.5123894806030065, 0.4975861842119629) + drift * rotate2d(-0.0189 * -2.0 * PI);
        float mDist = ease(0, max(0.0, 1.0 - distance(uv * aspect, mPos * aspect) * 4.0 * (1.0 - 0.8700)));
        uv -= pos;
        uv = uv * aspect * rotate2d(-0.0189 * 2.0 * PI) * vec2(1.0 - 0.0000, 1.0) * 16.0 * 0.1600;
        float refraction = mix(0.25, 1.3, 0.1500);
        vec3 p = vec3(uv, uTime * 0.05);
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
      
      vec3 chromatic_aberration(vec3 color, vec2 uv) {
        vec2 offset = (uv - vTextureCoord) * (0.2500 * 0.2);
        vec4 left = texture(uBgTexture, uv - offset);
        vec4 right = texture(uBgTexture, uv + offset);
        color.r = left.r;
        color.b = right.b;
        return color;
      }
      
      vec2 calculateRefraction(vec3 normal, float ior) {
        vec3 I = vec3(0.0, 0.0, 1.0);
        float ratio = 1.0 / ior;
        vec3 refracted = refract(I, normal, ratio);
        float refractionScale = mix(0.2, 0.4, 0.7500);
        float refractionAmount = mix(0.01, refractionScale, 0.7700);
        return refracted.xy * refractionAmount;
      }
      
      const vec3 LIGHT_POS = vec3(2.0, 2.0, 3.0);
      const vec3 VIEW_POS = vec3(0.0, 0.0, 2.0);
      const float SPECULAR = 2.4;
      const float SHININESS = 128.0;
      
      vec3 calculateLighting(vec3 normal, vec2 uv) {
        vec3 N = normal;
        vec3 worldPos = vec3(uv * 2.0 - 1.0, 0.0);
        vec3 lightDir = normalize(LIGHT_POS - worldPos);
        vec3 viewDir = normalize(VIEW_POS - worldPos);
        vec3 reflectDir = reflect(-lightDir, N);
        float diff = max(dot(N, lightDir), 0.0);
        vec3 diffuse = vec3(diff);
        float spec = pow(max(dot(viewDir, reflectDir), 0.0), SHININESS);
        vec3 specular = vec3(spec * SPECULAR);
        return diffuse + specular;
      }
      
      vec4 getRipple(vec2 uv) {
        vec3 normal = texture(uTexture, uv).rgb;
        vec2 refractionOffset = calculateRefraction(normal, 1.333);
        vec2 refractedUv = uv + refractionOffset;
        vec3 refractedNormal = texture(uTexture, refractedUv).rgb;
        vec4 refractedColor = texture(uBgTexture, refractedUv);
        refractedColor.rgb = chromatic_aberration(refractedColor.rgb, refractedUv);
        
        vec3 caustics = calculateLighting(refractedNormal, refractedUv);
        float causticsShadow = dot(normal, normalize(vec3(2.0, -2.0, 3.0) - vec3(uv * 2.0 - 1.0, 0.0))) + 1.0;
        float shadowFactor = causticsShadow;
        vec3 lightingFactor = caustics;
        
        shadowFactor = mix(1.0, shadowFactor, 0.0000);
        lightingFactor = mix(vec3(0.0), lightingFactor * vec3(1.0, 1.0, 1.0), 0.0000);
        vec4 finalColor = vec4(refractedColor.rgb - vec3(1.0 - shadowFactor) * vec3(1.0, 1.0, 1.0) + lightingFactor, refractedColor.a);
        return finalColor;
      }
      
      void main() {
        vec2 uv = vTextureCoord;
        
        // Get caustics
        vec4 causticNoise;
        vec3 causticColor;
        getCaustics(uv, causticNoise, causticColor);
        
        // Apply water ripple
        vec4 rippleColor = getRipple(uv);
        
        // Combine caustics with ripple
        vec4 color = vec4(rippleColor.rgb, rippleColor.a);
        vec4 causticsTex = texture(uBgTexture, uv + causticNoise.xy * 0.01 * 0.2500);
        
        if (4 > 0) {
          vec3 blended = blend(4, color.rgb, causticColor);
          color.rgb = mix(color.rgb, blended, 1.0000);
        } else {
          color.rgb = causticColor * 1.0000;
        }
        
        fragColor = color;
      }
    `;

    // Helper functions
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
        console.error('Program link error:', gl.getProgramInfoLog(program));
        return null;
      }
      return program;
    };

    // Create identity matrices
    const createIdentityMatrix = () => new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);

    const mvMatrix = createIdentityMatrix();
    const pMatrix = createIdentityMatrix();
    const textureMatrix = createIdentityMatrix();

    // Create programs
    const physicsProgram = createProgram(vertexShaderSource, physicsShaderSource);
    const normalProgram = createProgram(vertexShaderSource, normalShaderSource);
    const blurHProgram = createProgram(vertexShaderSource, blurShaderSource('horizontal'));
    const blurVProgram = createProgram(vertexShaderSource, blurShaderSource('vertical'));
    const finalProgram = createProgram(vertexShaderSource, finalShaderSource);

    if (!physicsProgram || !normalProgram || !blurHProgram || !blurVProgram || !finalProgram) {
      console.error('Failed to create programs');
      return;
    }

    programsRef.current = {
      physics: physicsProgram,
      normal: normalProgram,
      blurH: blurHProgram,
      blurV: blurVProgram,
      final: finalProgram
    };

    // Create buffers
    const createQuad = () => {
      const positions = new Float32Array([
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
         1,  1, 1, 1
      ]);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
      return buffer;
    };

    const quadBuffer = createQuad();

    // Create textures and framebuffers
    const createRenderTarget = (width: number, height: number, useFloat: boolean = false) => {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        useFloat ? gl.RGBA32F : gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        useFloat ? gl.FLOAT : gl.UNSIGNED_BYTE,
        null
      );
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const framebuffer = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      
      return { texture, framebuffer };
    };

    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      
      if (width === 0 || height === 0) return;
      
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);

      // Recreate render targets
      pingPongTexturesRef.current.forEach(t => {
        gl.deleteTexture(t.texture);
        gl.deleteFramebuffer(t.framebuffer);
      });
      pingPongTexturesRef.current = [
        createRenderTarget(width, height, true),
        createRenderTarget(width, height, true)
      ];

      passTexturesRef.current.forEach(t => {
        gl.deleteTexture(t.texture);
        gl.deleteFramebuffer(t.framebuffer);
      });
      passTexturesRef.current = [
        createRenderTarget(Math.floor(width * 0.25), Math.floor(height * 0.25)),
        createRenderTarget(Math.floor(width * 0.25), Math.floor(height * 0.25)),
        createRenderTarget(Math.floor(width * 0.25), Math.floor(height * 0.25))
      ];
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create video texture
    const videoTexture = gl.createTexture();
    videoTextureRef.current = videoTexture;
    gl.bindTexture(gl.TEXTURE_2D, videoTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      prevMousePosRef.current = { ...mousePosRef.current };
      mousePosRef.current.x = (e.clientX - rect.left) / rect.width;
      mousePosRef.current.y = (e.clientY - rect.top) / rect.height;
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    let frameCount = 0;
    let pingPongIndex = 0;

    const render = () => {
      if (!gl || !videoElement) return;

      timeRef.current += 0.016;
      frameCount++;

      // Update video texture
      if (videoElement.readyState >= 2) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, videoTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, videoElement);
      }

      // Ping-pong physics simulation
      const readIndex = pingPongIndex;
      const writeIndex = 1 - pingPongIndex;
      
      gl.useProgram(programsRef.current.physics);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pingPongTexturesRef.current[writeIndex].framebuffer);
      gl.viewport(0, 0, canvas.width, canvas.height);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      const positionLoc = gl.getAttribLocation(programsRef.current.physics, 'aVertexPosition');
      const texCoordLoc = gl.getAttribLocation(programsRef.current.physics, 'aTextureCoord');
      gl.enableVertexAttribArray(positionLoc);
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(texCoordLoc);
      gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, pingPongTexturesRef.current[readIndex].texture);
      gl.uniform1i(gl.getUniformLocation(programsRef.current.physics, 'uPingPongTexture'), 1);
      gl.uniform2f(gl.getUniformLocation(programsRef.current.physics, 'uResolution'), canvas.width, canvas.height);
      gl.uniform2f(gl.getUniformLocation(programsRef.current.physics, 'uMousePos'), mousePosRef.current.x, mousePosRef.current.y);
      gl.uniform2f(gl.getUniformLocation(programsRef.current.physics, 'uPreviousMousePos'), prevMousePosRef.current.x, prevMousePosRef.current.y);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.physics, 'uMVMatrix'), false, mvMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.physics, 'uPMatrix'), false, pMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.physics, 'uTextureMatrix'), false, textureMatrix);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      prevMousePosRef.current = { ...mousePosRef.current };
      pingPongIndex = writeIndex;

      // Pass 2: Normal calculation
      gl.useProgram(programsRef.current.normal);
      gl.bindFramebuffer(gl.FRAMEBUFFER, passTexturesRef.current[0].framebuffer);
      gl.viewport(0, 0, Math.floor(canvas.width * 0.25), Math.floor(canvas.height * 0.25));
      
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      const normalPositionLoc = gl.getAttribLocation(programsRef.current.normal, 'aVertexPosition');
      const normalTexCoordLoc = gl.getAttribLocation(programsRef.current.normal, 'aTextureCoord');
      gl.enableVertexAttribArray(normalPositionLoc);
      gl.vertexAttribPointer(normalPositionLoc, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(normalTexCoordLoc);
      gl.vertexAttribPointer(normalTexCoordLoc, 2, gl.FLOAT, false, 16, 8);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, pingPongTexturesRef.current[writeIndex].texture);
      gl.uniform1i(gl.getUniformLocation(programsRef.current.normal, 'uPingPongTexture'), 1);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.normal, 'uMVMatrix'), false, mvMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.normal, 'uPMatrix'), false, pMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.normal, 'uTextureMatrix'), false, textureMatrix);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Pass 3: Horizontal blur
      gl.useProgram(programsRef.current.blurH);
      gl.bindFramebuffer(gl.FRAMEBUFFER, passTexturesRef.current[1].framebuffer);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      const blurHPositionLoc = gl.getAttribLocation(programsRef.current.blurH, 'aVertexPosition');
      const blurHTexCoordLoc = gl.getAttribLocation(programsRef.current.blurH, 'aTextureCoord');
      gl.enableVertexAttribArray(blurHPositionLoc);
      gl.vertexAttribPointer(blurHPositionLoc, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(blurHTexCoordLoc);
      gl.vertexAttribPointer(blurHTexCoordLoc, 2, gl.FLOAT, false, 16, 8);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, passTexturesRef.current[0].texture);
      gl.uniform1i(gl.getUniformLocation(programsRef.current.blurH, 'uTexture'), 1);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.blurH, 'uMVMatrix'), false, mvMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.blurH, 'uPMatrix'), false, pMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.blurH, 'uTextureMatrix'), false, textureMatrix);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Pass 4: Vertical blur
      gl.useProgram(programsRef.current.blurV);
      gl.bindFramebuffer(gl.FRAMEBUFFER, passTexturesRef.current[2].framebuffer);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      const blurVPositionLoc = gl.getAttribLocation(programsRef.current.blurV, 'aVertexPosition');
      const blurVTexCoordLoc = gl.getAttribLocation(programsRef.current.blurV, 'aTextureCoord');
      gl.enableVertexAttribArray(blurVPositionLoc);
      gl.vertexAttribPointer(blurVPositionLoc, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(blurVTexCoordLoc);
      gl.vertexAttribPointer(blurVTexCoordLoc, 2, gl.FLOAT, false, 16, 8);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, passTexturesRef.current[1].texture);
      gl.uniform1i(gl.getUniformLocation(programsRef.current.blurV, 'uTexture'), 1);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.blurV, 'uMVMatrix'), false, mvMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.blurV, 'uPMatrix'), false, pMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.blurV, 'uTextureMatrix'), false, textureMatrix);
      
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Pass 5: Final render
      gl.useProgram(programsRef.current.final);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
      const finalPositionLoc = gl.getAttribLocation(programsRef.current.final, 'aVertexPosition');
      const finalTexCoordLoc = gl.getAttribLocation(programsRef.current.final, 'aTextureCoord');
      gl.enableVertexAttribArray(finalPositionLoc);
      gl.vertexAttribPointer(finalPositionLoc, 2, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(finalTexCoordLoc);
      gl.vertexAttribPointer(finalTexCoordLoc, 2, gl.FLOAT, false, 16, 8);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, videoTexture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, passTexturesRef.current[2].texture);
      
      gl.uniform1i(gl.getUniformLocation(programsRef.current.final, 'uTexture'), 1);
      gl.uniform1i(gl.getUniformLocation(programsRef.current.final, 'uBgTexture'), 0);
      gl.uniform1f(gl.getUniformLocation(programsRef.current.final, 'uTime'), timeRef.current);
      gl.uniform2f(gl.getUniformLocation(programsRef.current.final, 'uMousePos'), mousePosRef.current.x, mousePosRef.current.y);
      gl.uniform2f(gl.getUniformLocation(programsRef.current.final, 'uResolution'), canvas.width, canvas.height);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.final, 'uMVMatrix'), false, mvMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.final, 'uPMatrix'), false, pMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(programsRef.current.final, 'uTextureMatrix'), false, textureMatrix);
      
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
      
      pingPongTexturesRef.current.forEach(t => {
        gl.deleteTexture(t.texture);
        gl.deleteFramebuffer(t.framebuffer);
      });
      passTexturesRef.current.forEach(t => {
        gl.deleteTexture(t.texture);
        gl.deleteFramebuffer(t.framebuffer);
      });
      if (videoTexture) gl.deleteTexture(videoTexture);
      Object.values(programsRef.current).forEach(p => gl.deleteProgram(p));
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
        pointerEvents: 'auto'
      }}
    />
  );
}

