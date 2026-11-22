/**
 * Viscous Fluidity // Interactive WebGL Red Oil Slick Pointer (Theme Red)
 */
(function () {
  'use strict';

  /* -------------------------------------------------------------------
     1. RED FLUID CONFIGURATION
     ------------------------------------------------------------------- */
  const RED_PALETTE = {
    iridescence: 0.55,
    specTint: [1.0, 0.88, 0.85],
    colors: [
      [1.00, 0.2824, 0.1843], // Primary #FF482F
      [1.00, 0.38, 0.26],     // Bright coral highlight
      [0.85, 0.18, 0.10],     // Deep warm red
      [1.00, 0.45, 0.32],     // Vibrant flame tint
      [0.65, 0.12, 0.08],     // Deep shadow red
    ],
  };

  const config = {
    SIM_RESOLUTION: 128,
    DYE_RESOLUTION: 768,
    PRESSURE_ITERATIONS: 20,
    PRESSURE: 0.82,
    CURL: 0,
    VISCOSITY: 1.0,
    DENSITY_DISSIPATION: 10.0,
    SPLAT_RADIUS: 0.02,
    SPLAT_FORCE: 1450,
  };

  /* -------------------------------------------------------------------
     2. WEBGL CONTEXT & FORMAT NEGOTIATION
     ------------------------------------------------------------------- */
  const canvas = document.getElementById('fluid-canvas');
  if (!canvas) return;

  function supportRenderTextureFormat(gl, internalFormat, format, type) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.deleteFramebuffer(fbo);
    gl.deleteTexture(texture);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return status === gl.FRAMEBUFFER_COMPLETE;
  }

  function getSupportedFormat(gl, internalFormat, format, type) {
    if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
      switch (internalFormat) {
        case gl.R16F:
          return getSupportedFormat(gl, gl.RG16F, gl.RG, type);
        case gl.RG16F:
          return getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
        default:
          return null;
      }
    }
    return { internalFormat, format };
  }

  function getWebGLContext(targetCanvas) {
    const params = {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      preserveDrawingBuffer: false,
    };

    let gl = targetCanvas.getContext('webgl2', params);
    const isWebGL2 = Boolean(gl);
    if (!isWebGL2) {
      gl =
        targetCanvas.getContext('webgl', params) ||
        targetCanvas.getContext('experimental-webgl', params);
    }
    if (!gl) return null;

    let halfFloat;
    let supportLinearFiltering;
    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = Boolean(gl.getExtension('OES_texture_float_linear'));
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float');
      supportLinearFiltering = Boolean(gl.getExtension('OES_texture_half_float_linear'));
    }

    gl.clearColor(0.0, 0.0, 0.0, 0.0);

    const halfFloatTexType = isWebGL2
      ? gl.HALF_FLOAT
      : halfFloat
      ? halfFloat.HALF_FLOAT_OES
      : gl.UNSIGNED_BYTE;

    let formatRGBA;
    let formatRG;
    let formatR;

    if (isWebGL2) {
      formatRGBA = getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl, gl.RG16F, gl.RG, halfFloatTexType);
      formatR = getSupportedFormat(gl, gl.R16F, gl.RED, halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    }

    let texType = halfFloatTexType;
    if (!formatRGBA) {
      texType = gl.UNSIGNED_BYTE;
      formatRGBA = { internalFormat: gl.RGBA, format: gl.RGBA };
      formatRG = { internalFormat: gl.RGBA, format: gl.RGBA };
      formatR = { internalFormat: gl.RGBA, format: gl.RGBA };
    }

    return {
      gl,
      ext: {
        formatRGBA,
        formatRG: formatRG || formatRGBA,
        formatR: formatR || formatRGBA,
        halfFloatTexType: texType,
        supportLinearFiltering,
      },
    };
  }

  const webgl = getWebGLContext(canvas);
  if (!webgl) {
    console.warn('WebGL fluid simulation not supported on this device.');
    return;
  }

  const { gl, ext } = webgl;

  /* -------------------------------------------------------------------
     3. SHADER COMPILATION
     ------------------------------------------------------------------- */
  function compileShader(type, source, keywords) {
    let finalSource = source;
    if (keywords && keywords.length) {
      finalSource = keywords.map((k) => '#define ' + k + '\n').join('') + source;
    }
    const shader = gl.createShader(type);
    gl.shaderSource(shader, finalSource);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(shader) || 'Shader compilation error');
    }
    return shader;
  }

  class Program {
    constructor(vertexShader, fragmentShader) {
      this.uniforms = {};
      this.program = gl.createProgram();
      gl.attachShader(this.program, vertexShader);
      gl.attachShader(this.program, fragmentShader);
      gl.linkProgram(this.program);
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(this.program) || 'Program link error');
      }
      const uniformCount = gl.getProgramParameter(this.program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < uniformCount; i++) {
        const info = gl.getActiveUniform(this.program, i);
        if (info) {
          this.uniforms[info.name] = gl.getUniformLocation(this.program, info.name);
        }
      }
    }
    bind() {
      gl.useProgram(this.program);
    }
  }

  const baseVertexShader = compileShader(gl.VERTEX_SHADER, `
    precision highp float;
    attribute vec2 aPosition;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform vec2 texelSize;

    void main () {
      vUv = aPosition * 0.5 + 0.5;
      vL = vUv - vec2(texelSize.x, 0.0);
      vR = vUv + vec2(texelSize.x, 0.0);
      vT = vUv + vec2(0.0, texelSize.y);
      vB = vUv - vec2(0.0, texelSize.y);
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `);

  const clearShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    uniform sampler2D uTexture;
    uniform float value;

    void main () {
      gl_FragColor = value * texture2D(uTexture, vUv);
    }
  `);

  const splatShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uTarget;
    uniform float aspectRatio;
    uniform vec3 color;
    uniform vec2 point;
    uniform float radius;

    void main () {
      vec2 p = vUv - point.xy;
      p.x *= aspectRatio;
      vec3 splat = exp(-dot(p, p) / radius) * color;
      vec3 base = texture2D(uTarget, vUv).xyz;
      gl_FragColor = vec4(base + splat, 1.0);
    }
  `);

  const advectionShader = compileShader(
    gl.FRAGMENT_SHADER,
    `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    uniform sampler2D uVelocity;
    uniform sampler2D uSource;
    uniform vec2 texelSize;
    uniform vec2 dyeTexelSize;
    uniform float dt;
    uniform float dissipation;

    vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
      vec2 st = uv / tsize - 0.5;
      vec2 iuv = floor(st);
      vec2 fuv = fract(st);
      vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
      vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
      vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
      vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);
      return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
    }

    void main () {
      #ifdef MANUAL_FILTERING
        vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
        vec4 result = bilerp(uSource, coord, dyeTexelSize);
      #else
        vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
        vec4 result = texture2D(uSource, coord);
      #endif
      float decay = 1.0 + dissipation * dt;
      gl_FragColor = result / decay;
    }
    `,
    ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']
  );

  const divergenceShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
      float L = texture2D(uVelocity, vL).x;
      float R = texture2D(uVelocity, vR).x;
      float T = texture2D(uVelocity, vT).y;
      float B = texture2D(uVelocity, vB).y;
      vec2 C = texture2D(uVelocity, vUv).xy;
      if (vL.x < 0.0) { L = -C.x; }
      if (vR.x > 1.0) { R = -C.x; }
      if (vT.y > 1.0) { T = -C.y; }
      if (vB.y < 0.0) { B = -C.y; }
      float div = 0.5 * (R - L + T - B);
      gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
    }
  `);

  const curlShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uVelocity;

    void main () {
      float L = texture2D(uVelocity, vL).y;
      float R = texture2D(uVelocity, vR).y;
      float T = texture2D(uVelocity, vT).x;
      float B = texture2D(uVelocity, vB).x;
      float vorticity = R - L - T + B;
      gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
    }
  `);

  const vorticityShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uVelocity;
    uniform sampler2D uCurl;
    uniform float curl;
    uniform float dt;

    void main () {
      float L = texture2D(uCurl, vL).x;
      float R = texture2D(uCurl, vR).x;
      float T = texture2D(uCurl, vT).x;
      float B = texture2D(uCurl, vB).x;
      float C = texture2D(uCurl, vUv).x;

      vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
      force /= length(force) + 0.0001;
      force *= curl * C;
      force.y *= -1.0;

      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity += force * dt;
      velocity = min(max(velocity, -1000.0), 1000.0);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `);

  const pressureShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uDivergence;

    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      float divergence = texture2D(uDivergence, vUv).x;
      float pressure = (L + R + B + T - divergence) * 0.25;
      gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
    }
  `);

  const gradientSubtractShader = compileShader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    precision mediump sampler2D;
    varying highp vec2 vUv;
    varying highp vec2 vL;
    varying highp vec2 vR;
    varying highp vec2 vT;
    varying highp vec2 vB;
    uniform sampler2D uPressure;
    uniform sampler2D uVelocity;

    void main () {
      float L = texture2D(uPressure, vL).x;
      float R = texture2D(uPressure, vR).x;
      float T = texture2D(uPressure, vT).x;
      float B = texture2D(uPressure, vB).x;
      vec2 velocity = texture2D(uVelocity, vUv).xy;
      velocity.xy -= vec2(R - L, T - B);
      gl_FragColor = vec4(velocity, 0.0, 1.0);
    }
  `);

  /* Reduced Opacity Red Oil Display Shader */
  const displayShader = compileShader(gl.FRAGMENT_SHADER, `
    precision highp float;
    precision highp sampler2D;
    varying vec2 vUv;
    varying vec2 vL;
    varying vec2 vR;
    varying vec2 vT;
    varying vec2 vB;
    uniform sampler2D uTexture;
    uniform float uTime;
    uniform float uIridescence;
    uniform vec3 uSpecTint;

    vec3 thinFilm (float phase) {
      return 0.5 + 0.5 * cos(6.28318 * (phase + vec3(0.0, 0.33, 0.67)));
    }

    void main () {
      vec3 c  = texture2D(uTexture, vUv).rgb;
      vec3 cL = texture2D(uTexture, vL).rgb;
      vec3 cR = texture2D(uTexture, vR).rgb;
      vec3 cT = texture2D(uTexture, vT).rgb;
      vec3 cB = texture2D(uTexture, vB).rgb;

      float h  = length(c);
      float hL = length(cL);
      float hR = length(cR);
      float hT = length(cT);
      float hB = length(cB);

      float dx = (hR - hL);
      float dy = (hT - hB);
      vec3 normal = normalize(vec3(-dx * 7.8, -dy * 7.8, 0.20));

      float presence = smoothstep(0.005, 0.12, h);
      if (presence <= 0.001) {
        gl_FragColor = vec4(0.0);
        return;
      }

      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      vec3 light1  = normalize(vec3(-0.45, 0.62, 0.72));
      vec3 light2  = normalize(vec3(0.65, -0.48, 0.58));

      vec3 half1 = normalize(light1 + viewDir);
      vec3 half2 = normalize(light2 + viewDir);

      float specSharp = pow(max(dot(normal, half1), 0.0), 48.0);
      float specBroad = pow(max(dot(normal, half2), 0.0), 14.0);
      float fresnel   = pow(1.0 - max(dot(normal, viewDir), 0.0), 2.5);

      float filmPhase = h * 0.85 + fresnel * 1.05 + uTime * 0.02;
      vec3 iridColor  = thinFilm(filmPhase);

      vec3 oilBody = c * (0.85 + 0.42 * max(dot(normal, light1), 0.0));
      oilBody = mix(oilBody, oilBody * (0.65 + 0.90 * iridColor), uIridescence * 0.62);

      vec3 rimGlow = mix(uSpecTint, iridColor, uIridescence) * fresnel * 0.54 * presence;
      vec3 specHighlight = uSpecTint * (specSharp * 1.12 + specBroad * 0.34) * presence;

      vec3 color = oilBody + rimGlow + specHighlight;
      color = color / (1.0 + color * 0.25);

      float alpha = clamp(presence * 0.55, 0.0, 0.52);
      gl_FragColor = vec4(color, alpha);
    }
  `);

  const clearProgram = new Program(baseVertexShader, clearShader);
  const splatProgram = new Program(baseVertexShader, splatShader);
  const advectionProgram = new Program(baseVertexShader, advectionShader);
  const divergenceProgram = new Program(baseVertexShader, divergenceShader);
  const curlProgram = new Program(baseVertexShader, curlShader);
  const vorticityProgram = new Program(baseVertexShader, vorticityShader);
  const pressureProgram = new Program(baseVertexShader, pressureShader);
  const gradientSubtractProgram = new Program(baseVertexShader, gradientSubtractShader);
  const displayProgram = new Program(baseVertexShader, displayShader);

  /* -------------------------------------------------------------------
     4. QUAD BLIT & FRAMEBUFFERS
     ------------------------------------------------------------------- */
  const quadBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);

  const indexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);

  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);

  function blit(target) {
    if (target == null) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    } else {
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    }
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  function createFBO(w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    return {
      texture,
      fbo,
      width: w,
      height: h,
      texelSizeX: 1.0 / w,
      texelSizeY: 1.0 / h,
      attach(id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      },
    };
  }

  function createDoubleFBO(w, h, internalFormat, format, type, param) {
    let fbo1 = createFBO(w, h, internalFormat, format, type, param);
    let fbo2 = createFBO(w, h, internalFormat, format, type, param);
    return {
      width: w,
      height: h,
      texelSizeX: fbo1.texelSizeX,
      texelSizeY: fbo1.texelSizeY,
      get read() { return fbo1; },
      set read(val) { fbo1 = val; },
      get write() { return fbo2; },
      set write(val) { fbo2 = val; },
      swap() {
        const temp = fbo1;
        fbo1 = fbo2;
        fbo2 = temp;
      },
    };
  }

  function getResolution(resolution) {
    let aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
    const min = Math.round(resolution);
    const max = Math.round(resolution * aspectRatio);
    if (gl.drawingBufferWidth > gl.drawingBufferHeight) {
      return { width: max, height: min };
    }
    return { width: min, height: max };
  }

  let dye, velocity, divergence, curl, pressure;

  function initFramebuffers() {
    const simRes = getResolution(config.SIM_RESOLUTION);
    const dyeRes = getResolution(config.DYE_RESOLUTION);

    const texType = ext.halfFloatTexType;
    const rgba = ext.formatRGBA;
    const rg = ext.formatRG;
    const r = ext.formatR;
    const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;

    gl.disable(gl.BLEND);

    dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
    velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
    divergence = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    curl = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    pressure = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
  }

  const rippleCanvas = document.getElementById('fluid-ripple-canvas');
  const rippleCtx = rippleCanvas ? rippleCanvas.getContext('2d') : null;

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    if (rippleCanvas) {
      rippleCanvas.width = window.innerWidth;
      rippleCanvas.height = window.innerHeight;
    }
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      return true;
    }
    return false;
  }

  resizeCanvas();
  initFramebuffers();

  window.addEventListener('resize', () => {
    if (resizeCanvas()) {
      initFramebuffers();
    }
  });

  /* -------------------------------------------------------------------
     5. FLUID OPERATIONS
     ------------------------------------------------------------------- */
  let colorCycleIndex = 0;

  function samplePaletteColor(intensity = 1.0) {
    const list = RED_PALETTE.colors;
    const base = list[colorCycleIndex % list.length];
    colorCycleIndex = (colorCycleIndex + 1) % list.length;
    const jitter = 0.94 + Math.random() * 0.12;
    return {
      r: base[0] * intensity * jitter,
      g: base[1] * intensity * jitter,
      b: base[2] * intensity * jitter,
    };
  }

  function splat(x, y, dx, dy, color, radiusOverride) {
    const aspect = canvas.width / canvas.height;
    const radius = ((radiusOverride != null ? radiusOverride : config.SPLAT_RADIUS) / 100.0) * (aspect > 1 ? 1.0 : aspect);

    // Inject velocity
    splatProgram.bind();
    gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(splatProgram.uniforms.aspectRatio, aspect);
    gl.uniform2f(splatProgram.uniforms.point, x, y);
    gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0.0);
    gl.uniform1f(splatProgram.uniforms.radius, Math.max(radius, 0.0001));
    blit(velocity.write);
    velocity.swap();

    // Inject dye
    gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
    blit(dye.write);
    dye.swap();
  }

  function stepFluid(dt) {
    gl.disable(gl.BLEND);

    // 1. Curl
    curlProgram.bind();
    gl.uniform2f(curlProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(curl);

    // 2. Vorticity Confinement
    vorticityProgram.bind();
    gl.uniform2f(vorticityProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(vorticityProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(vorticityProgram.uniforms.uCurl, curl.attach(1));
    gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
    gl.uniform1f(vorticityProgram.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    // 3. Divergence
    divergenceProgram.bind();
    gl.uniform2f(divergenceProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(divergenceProgram.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergence);

    // 4. Clear Pressure
    clearProgram.bind();
    gl.uniform1i(clearProgram.uniforms.uTexture, pressure.read.attach(0));
    gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
    blit(pressure.write);
    pressure.swap();

    // 5. Jacobi Pressure
    pressureProgram.bind();
    gl.uniform2f(pressureProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(pressureProgram.uniforms.uDivergence, divergence.attach(0));
    for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(pressureProgram.uniforms.uPressure, pressure.read.attach(1));
      blit(pressure.write);
      pressure.swap();
    }

    // 6. Subtract Gradient
    gradientSubtractProgram.bind();
    gl.uniform2f(gradientSubtractProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(gradientSubtractProgram.uniforms.uPressure, pressure.read.attach(0));
    gl.uniform1i(gradientSubtractProgram.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    // 7. Advect Velocity
    advectionProgram.bind();
    gl.uniform2f(advectionProgram.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering) {
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    }
    const velId = velocity.read.attach(0);
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velId);
    gl.uniform1i(advectionProgram.uniforms.uSource, velId);
    gl.uniform1f(advectionProgram.uniforms.dt, dt);
    gl.uniform1f(advectionProgram.uniforms.dissipation, config.VISCOSITY);
    blit(velocity.write);
    velocity.swap();

    // 8. Advect Dye
    if (!ext.supportLinearFiltering) {
      gl.uniform2f(advectionProgram.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    }
    gl.uniform1i(advectionProgram.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(advectionProgram.uniforms.dissipation, config.DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();
  }

  function renderFluid(timeSec) {
    displayProgram.bind();
    gl.uniform2f(displayProgram.uniforms.texelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(displayProgram.uniforms.uTexture, dye.read.attach(0));
    gl.uniform1f(displayProgram.uniforms.uTime, timeSec);
    gl.uniform1f(displayProgram.uniforms.uIridescence, RED_PALETTE.iridescence);
    gl.uniform3f(
      displayProgram.uniforms.uSpecTint,
      RED_PALETTE.specTint[0],
      RED_PALETTE.specTint[1],
      RED_PALETTE.specTint[2]
    );
    blit(null);
  }

  /* -------------------------------------------------------------------
     6. MOUSE & TOUCH POINTER TRACKING & SURFACE REACTIVITY
     ------------------------------------------------------------------- */
  const pointer = {
    active: false,
    currX: 0.5,
    currY: 0.5,
    targetX: 0.5,
    targetY: 0.5,
    screenX: window.innerWidth * 0.5,
    screenY: window.innerHeight * 0.5,
  };

  const ripples = [];
  let lastRippleTime = 0;
  const dispMapEl = document.getElementById('fluid-fe-disp');
  let dispScale = 0;
  const rootStyle = document.documentElement.style;

  function addRipple(x, y, intensity) {
    if (ripples.length > 10) ripples.shift();
    ripples.push({
      x: x,
      y: y,
      r: 8,
      maxR: 90 + intensity * 80,
      alpha: Math.min(0.38 * intensity, 0.45),
      speed: 150 + intensity * 60,
    });
  }

  function updatePointerTarget(clientX, clientY, snapIfNew) {
    const nx = clientX / Math.max(window.innerWidth, 1);
    const ny = 1.0 - clientY / Math.max(window.innerHeight, 1);
    pointer.screenX = clientX;
    pointer.screenY = clientY;
    if (!pointer.active || snapIfNew) {
      pointer.currX = nx;
      pointer.currY = ny;
    }
    pointer.targetX = nx;
    pointer.targetY = ny;
    pointer.active = true;
  }

  window.addEventListener('mousemove', (e) => {
    updatePointerTarget(e.clientX, e.clientY, false);
  }, { passive: true });

  window.addEventListener('mousedown', (e) => {
    updatePointerTarget(e.clientX, e.clientY, true);
    addRipple(e.clientX, e.clientY, 1.4);
    const color = samplePaletteColor(0.85);
    splat(
      pointer.targetX,
      pointer.targetY,
      (Math.random() - 0.5) * 60,
      (Math.random() - 0.5) * 60,
      color,
      config.SPLAT_RADIUS * 1.2
    );
  }, { passive: true });

  window.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 0) {
      const t = e.touches[0];
      updatePointerTarget(t.clientX, t.clientY, true);
      addRipple(t.clientX, t.clientY, 1.2);
    }
  }, { passive: true });

  window.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 0) {
      const t = e.touches[0];
      updatePointerTarget(t.clientX, t.clientY, false);
    }
  }, { passive: true });

  /* -------------------------------------------------------------------
     7. ANIMATION LOOP (MOUSE POINTER & SURFACE EFFECTS)
     ------------------------------------------------------------------- */
  let lastTime = performance.now();
  let smoothVx = 0;
  let smoothVy = 0;
  let smoothSpeed = 0;

  function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min((now - lastTime) / 1000, 0.033);
    lastTime = now;
    const timeSec = now * 0.001;

    let currentSpeed = 0;
    let dx = 0;
    let dy = 0;

    if (pointer.active) {
      const lerpFactor = 0.12;
      const nextX = pointer.currX + (pointer.targetX - pointer.currX) * lerpFactor;
      const nextY = pointer.currY + (pointer.targetY - pointer.currY) * lerpFactor;
      dx = nextX - pointer.currX;
      dy = nextY - pointer.currY;

      pointer.currX = nextX;
      pointer.currY = nextY;

      const dist = Math.hypot(dx, dy);
      currentSpeed = dist;
      if (dist > 0.0002) {
        const aspect = canvas.width / canvas.height;
        const forceX = dx * config.SPLAT_FORCE * (aspect > 1 ? 1.0 : aspect);
        const forceY = dy * config.SPLAT_FORCE;
        const color = samplePaletteColor(Math.min(0.55 + dist * 16.0, 1.05));
        splat(pointer.currX, pointer.currY, forceX, forceY, color);

        if (dist > 0.003 && now - lastRippleTime > 120) {
          addRipple(pointer.screenX, pointer.screenY, Math.min(dist * 20, 1.0));
          lastRippleTime = now;
        }
      }
    }

    // Smooth kinetic velocity and speed for surface interaction
    smoothVx += (dx - smoothVx) * 0.15;
    smoothVy += (dy - smoothVy) * 0.15;
    smoothSpeed += (currentSpeed - smoothSpeed) * 0.12;

    // 1. Viewport surface custom properties
    if (rootStyle) {
      rootStyle.setProperty('--fluid-px', pointer.screenX + 'px');
      rootStyle.setProperty('--fluid-py', pointer.screenY + 'px');
      rootStyle.setProperty('--fluid-vx', (smoothVx * 60).toFixed(3));
      rootStyle.setProperty('--fluid-vy', (smoothVy * 60).toFixed(3));
      rootStyle.setProperty('--fluid-tilt-x', (smoothVy * 14).toFixed(2) + 'deg');
      rootStyle.setProperty('--fluid-tilt-y', (-smoothVx * 14).toFixed(2) + 'deg');
      rootStyle.setProperty('--fluid-speed', smoothSpeed.toFixed(3));
      rootStyle.setProperty('--fluid-sheen-opacity', Math.min(smoothSpeed * 2.8, 0.75).toFixed(3));
      rootStyle.setProperty('--fluid-sheen-radius', Math.round(200 + smoothSpeed * 280) + 'px');
    }

    // 2. Liquid surface refraction / SVG displacement map
    if (dispMapEl) {
      const targetScale = Math.min(smoothSpeed * 22.0, 5.0);
      dispScale += (targetScale - dispScale) * 0.18;
      if (dispScale > 0.02) {
        dispMapEl.setAttribute('scale', dispScale.toFixed(2));
      } else if (dispScale !== 0) {
        dispScale = 0;
        dispMapEl.setAttribute('scale', '0');
      }
    }

    // 3. Surface shockwaves & ripples canvas render
    if (rippleCtx && rippleCanvas) {
      rippleCtx.clearRect(0, 0, rippleCanvas.width, rippleCanvas.height);
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rip = ripples[i];
        rip.r += rip.speed * dt;
        const progress = rip.r / rip.maxR;
        if (progress >= 1.0) {
          ripples.splice(i, 1);
          continue;
        }
        const currentAlpha = rip.alpha * (1.0 - progress);
        rippleCtx.beginPath();
        rippleCtx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
        rippleCtx.strokeStyle = 'rgba(255, 72, 47, ' + currentAlpha.toFixed(3) + ')';
        rippleCtx.lineWidth = Math.max(1, 2.2 * (1.0 - progress));
        rippleCtx.stroke();
      }
    }

    stepFluid(dt);
    renderFluid(timeSec);
  }

  requestAnimationFrame(animate);
})();
