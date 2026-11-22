/**
 * Swiss WebGL Liquid Loader Screen
 * Independent, modular loading screen for Mohit Kataria Portfolio.
 */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
   * 1. GSAP CustomEase Registration & Fallbacks
   * ---------------------------------------------------------------------- */
  let EASE_EDITORIAL = 'power4.out';
  let EASE_LIQUID = 'expo.inOut';
  let EASE_IMPLODE = 'power3.inOut';

  try {
    if (typeof gsap !== 'undefined' && typeof CustomEase !== 'undefined') {
      gsap.registerPlugin(CustomEase);
      EASE_EDITORIAL = CustomEase.create('swissEditorial', 'M0,0 C0.19,1 0.22,1 1,1');
      EASE_LIQUID = CustomEase.create('liquidPull', 'M0,0 C0.76,0 0.24,1 1,1');
      EASE_IMPLODE = CustomEase.create('circleImplode', 'M0,0 C0.65,0 0.35,1 1,1');
    }
  } catch (err) {
    console.warn('CustomEase fallback:', err);
  }

  /* ----------------------------------------------------------------------
   * 2. Build Rolling Vertical Odometer DOM (00 -> 100)
   * ---------------------------------------------------------------------- */
  function initOdometerTracks() {
    const tensTrack = document.getElementById('odoTensTrack');
    const onesTrack = document.getElementById('odoOnesTrack');
    if (!tensTrack || !onesTrack) return;

    // Tens column: 0..9 + trailing 0 for 100 (11 rows)
    const tensFrag = document.createDocumentFragment();
    for (let i = 0; i <= 10; i++) {
      const span = document.createElement('span');
      span.className = 'odo-digit';
      span.textContent = String(i % 10);
      tensFrag.appendChild(span);
    }
    tensTrack.innerHTML = '';
    tensTrack.appendChild(tensFrag);

    // Ones column: 0..100 (101 rows) for exact continuous vertical roll
    const onesFrag = document.createDocumentFragment();
    for (let i = 0; i <= 100; i++) {
      const span = document.createElement('span');
      span.className = 'odo-digit';
      span.textContent = String(i % 10);
      onesFrag.appendChild(span);
    }
    onesTrack.innerHTML = '';
    onesTrack.appendChild(onesFrag);
  }

  function updateOdometer(value) {
    const clamped = Math.max(0, Math.min(100, value));
    const hud = document.getElementById('loader-hud');
    const hundredsCol = document.getElementById('odoHundredsCol');
    const hundredsTrack = document.getElementById('odoHundredsTrack');
    const tensTrack = document.getElementById('odoTensTrack');
    const onesTrack = document.getElementById('odoOnesTrack');

    if (hud) hud.setAttribute('aria-valuenow', String(Math.round(clamped)));

    // Smooth mechanical carry for tens digit
    const tensBase = Math.floor(clamped / 10);
    const onesRem = clamped % 10;
    const tensProgress = onesRem > 8.6 ? tensBase + (onesRem - 8.6) / 1.4 : tensBase;

    if (onesTrack) {
      onesTrack.style.transform = `translate3d(0, ${-clamped}em, 0)`;
    }
    if (tensTrack) {
      tensTrack.style.transform = `translate3d(0, ${-tensProgress}em, 0)`;
    }

    // Smoothly reveal the "1" column as counter reaches 100
    if (hundredsCol && hundredsTrack) {
      if (clamped >= 98.6) {
        hundredsCol.classList.add('is-active');
        const hProg = Math.min(1, (clamped - 98.6) / 1.4);
        hundredsTrack.style.transform = `translate3d(0, ${-hProg}em, 0)`;
      } else {
        hundredsCol.classList.remove('is-active');
        hundredsTrack.style.transform = 'translate3d(0, 0em, 0)';
      }
    }
  }

  /* ----------------------------------------------------------------------
   * 3. Three.js WebGL Liquid-Ink Shader
   * ---------------------------------------------------------------------- */
  const WebGLIntro = (function () {
    let renderer = null;
    let scene = null;
    let camera = null;
    let material = null;
    let canvas = null;
    let rafId = null;
    let isRunning = false;
    let startTime = performance.now();

    const targetMouse = { x: 0.5, y: 0.5 };
    const smoothMouse = { x: 0.5, y: 0.5 };

    const uniforms = {
      uResolution: { value: null },
      uTime: { value: 0 },
      uMouse: { value: null },
      uMorph: { value: 0 },        // 0 = full-screen red curtain, 1 = centered circle
      uWobble: { value: 0 },       // liquid surface-tension angular distortion
      uScale: { value: 1 },        // circle scale (1 -> elastic inhale -> 0 implode)
      uRingProgress: { value: 0 }, // 0 -> 1 expanding 1px shockwave ring
      uRingAlpha: { value: 0 },    // opacity of shockwave ring
    };

    const vertexShader = /* glsl */ `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = /* glsl */ `
      precision highp float;

      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec2 uMouse;
      uniform float uMorph;
      uniform float uWobble;
      uniform float uScale;
      uniform float uRingProgress;
      uniform float uRingAlpha;

      // Hash for ultra-fine Swiss print micro-grain
      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      // Smooth 2D value noise for subtle living silk-like sheen
      float noise2D(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      // Signed Distance Field for a Rounded Rectangle
      float sdRoundedBox(vec2 p, vec2 b, float r) {
        vec2 q = abs(p) - b + r;
        return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
      }

      void main() {
        float minDim = min(uResolution.x, uResolution.y);
        float px = 1.0 / minDim;

        vec2 p = (gl_FragCoord.xy - 0.5 * uResolution) / minDim;
        vec2 uv = gl_FragCoord.xy / uResolution;

        vec2 halfScreen = 0.5 * uResolution / minDim + vec2(0.04);

        float baseRadius = 0.115;
        float targetRadius = max(0.0, baseRadius * uScale);

        vec2 boxHalf = mix(halfScreen, vec2(targetRadius), uMorph);
        float cornerRadius = mix(0.0, targetRadius, pow(clamp(uMorph, 0.0, 1.0), 0.72));
        cornerRadius = min(cornerRadius, min(boxHalf.x, boxHalf.y));

        float d = sdRoundedBox(p, boxHalf, cornerRadius);

        // Organic surface-tension distortion
        if (uWobble > 0.0001) {
          float angle = atan(p.y, p.x);
          float radialWave =
            sin(angle * 3.0 + uTime * 3.4) * 0.42 +
            cos(angle * 5.0 - uTime * 2.6) * 0.28 +
            sin(angle * 7.0 + uTime * 4.2) * 0.14 +
            cos(angle * 2.0 + uTime * 1.9) * 0.22;
          d += radialWave * 0.052 * uWobble;
        }

        // Anti-aliased liquid curtain mask
        float curtainAlpha = 0.0;
        if (uScale > 0.001) {
          curtainAlpha = 1.0 - smoothstep(-px * 0.9, px * 0.9, d);
        }

        // Swiss Vermilion Red (#FF482F)
        vec3 swissRed = vec3(1.0, 0.2824, 0.1843);

        // Mouse-reactive highlight
        vec2 mousePos = (uMouse - 0.5) * (uResolution / minDim);
        float mouseDist = length(p - mousePos);
        float mouseGlow = exp(-mouseDist * 2.6) * 0.055 * (1.0 - uMorph * 0.7);

        // Subtle silk sheen + fine print grain
        float silk = noise2D(uv * 2.6 + vec2(uTime * 0.12, -uTime * 0.09));
        float grain = (hash21(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.024;

        vec3 curtainColor = swissRed + vec3(silk * 0.035 + mouseGlow + grain, silk * 0.008 + mouseGlow * 0.18, silk * 0.006);
        curtainColor = clamp(curtainColor, 0.0, 1.0);

        // Expanding 1px shockwave ring
        float ringAlpha = 0.0;
        if (uRingAlpha > 0.001) {
          float ringRadius = baseRadius * 0.92 + uRingProgress * 0.62;
          float ringDist = abs(length(p) - ringRadius);
          float strokeHalf = px * 0.95;
          ringAlpha = (1.0 - smoothstep(0.0, strokeHalf * 1.6, ringDist)) * uRingAlpha;
        }

        float finalAlpha = clamp(max(curtainAlpha, ringAlpha), 0.0, 1.0);
        vec3 finalColor = mix(swissRed, curtainColor, curtainAlpha);

        gl_FragColor = vec4(finalColor, finalAlpha);
      }
    `;

    function resize() {
      if (!renderer || !material) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      uniforms.uResolution.value.set(w * dpr, h * dpr);
      if (!isRunning) {
        renderer.render(scene, camera);
      }
    }

    function renderLoop(now) {
      if (!isRunning) return;
      rafId = requestAnimationFrame(renderLoop);

      uniforms.uTime.value = (now - startTime) * 0.001;

      smoothMouse.x += (targetMouse.x - smoothMouse.x) * 0.08;
      smoothMouse.y += (targetMouse.y - smoothMouse.y) * 0.08;
      uniforms.uMouse.value.set(smoothMouse.x, smoothMouse.y);

      renderer.render(scene, camera);
    }

    function init() {
      canvas = document.getElementById('webgl-intro');
      if (!canvas || typeof THREE === 'undefined') return false;

      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        });
        renderer.setClearColor(0x000000, 0);

        scene = new THREE.Scene();
        camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

        uniforms.uResolution.value = new THREE.Vector2(1, 1);
        uniforms.uMouse.value = new THREE.Vector2(0.5, 0.5);

        material = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          uniforms,
          transparent: true,
          depthTest: false,
          depthWrite: false,
        });

        const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
        scene.add(quad);

        resize();
        window.addEventListener('resize', resize);

        window.addEventListener('mousemove', (e) => {
          targetMouse.x = e.clientX / window.innerWidth;
          targetMouse.y = 1.0 - e.clientY / window.innerHeight;
        });

        return true;
      } catch (err) {
        console.warn('WebGL initialization error:', err);
        canvas.style.display = 'none';
        return false;
      }
    }

    function start() {
      if (!renderer) return;
      canvas.style.pointerEvents = 'auto';
      canvas.style.visibility = 'visible';
      canvas.style.opacity = '1';
      if (!isRunning) {
        isRunning = true;
        rafId = requestAnimationFrame(renderLoop);
      }
    }

    function pause() {
      if (!renderer) return;
      isRunning = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      renderer.render(scene, camera);
      canvas.style.pointerEvents = 'none';
      canvas.style.visibility = 'hidden';
      canvas.style.opacity = '0';
    }

    return { init, start, pause, uniforms };
  })();

  /* ----------------------------------------------------------------------
   * 4. Master Loader Animation Timeline
   * ---------------------------------------------------------------------- */
  let loaderTL = null;

  function runSwissLoader() {
    if (typeof gsap === 'undefined') {
      document.body.classList.remove('intro-locked');
      const hud = document.getElementById('loader-hud');
      const c = document.getElementById('webgl-intro');
      if (hud) hud.style.display = 'none';
      if (c) c.style.display = 'none';
      return;
    }

    try {
      if (loaderTL) loaderTL.kill();

      const hud = document.getElementById('loader-hud');
      const orbitalStroke = document.getElementById('orbitalStroke');
      const u = WebGLIntro.uniforms;

      document.body.classList.add('intro-locked');

      // Safety unlock timeout so scroll is never trapped under any condition
      setTimeout(() => {
        document.body.classList.remove('intro-locked');
      }, 4200);

      u.uMorph.value = 0;
      u.uWobble.value = 0;
      u.uScale.value = 1;
      u.uRingProgress.value = 0;
      u.uRingAlpha.value = 0;
      WebGLIntro.start();

      const circumference = 2 * Math.PI * 116;
      if (orbitalStroke) {
        orbitalStroke.style.strokeDasharray = `${circumference}`;
        orbitalStroke.style.strokeDashoffset = `${circumference}`;
      }

      gsap.set(hud, { visibility: 'visible', opacity: 1 });
      gsap.set('.hud-corner', { yPercent: 115, opacity: 0 });
      gsap.set('.hud-center-wrap', { yPercent: 0, opacity: 1 });
      gsap.set('.orbital-stage', { scale: 0.94, opacity: 0 });
      gsap.set('.hud-status-wrap', { opacity: 1 });
      gsap.set('#status-0', { yPercent: 110, opacity: 0 });
      gsap.set('#status-1', { yPercent: 110, opacity: 0 });
      gsap.set('#status-2', { yPercent: 110, opacity: 0 });

      const progressObj = { val: 0 };
      updateOdometer(0);

      loaderTL = gsap.timeline();

      /* PHASE 1: Living Red Canvas + Odometer (0% -> 100%) */
      loaderTL
        .to('.hud-corner', {
          yPercent: 0,
          opacity: 1,
          duration: 0.72,
          stagger: 0.08,
          ease: EASE_EDITORIAL,
        })
        .to(
          '.orbital-stage',
          {
            scale: 1,
            opacity: 1,
            duration: 0.78,
            ease: EASE_EDITORIAL,
          },
          '-=0.52'
        )
        // Status 1: CALIBRATING GRID
        .to(
          '#status-0',
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.45,
            ease: EASE_EDITORIAL,
          },
          '-=0.55'
        )
        .addLabel('loadStart', '-=0.35')
        .to(
          progressObj,
          {
            val: 100,
            duration: 1.85,
            ease: 'power2.inOut',
            onUpdate: () => {
              updateOdometer(progressObj.val);
            },
          },
          'loadStart'
        )
        .to(
          orbitalStroke,
          {
            strokeDashoffset: 0,
            duration: 1.85,
            ease: 'power2.inOut',
          },
          'loadStart'
        )
        // Status 2: LOADING SHADERS
        .to(
          '#status-0',
          {
            yPercent: -115,
            opacity: 0,
            duration: 0.36,
            ease: 'power3.in',
          },
          'loadStart+=0.65'
        )
        .to(
          '#status-1',
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.42,
            ease: EASE_EDITORIAL,
          },
          'loadStart+=0.78'
        )
        // Status 3: READY
        .to(
          '#status-1',
          {
            yPercent: -115,
            opacity: 0,
            duration: 0.34,
            ease: 'power3.in',
          },
          'loadStart+=1.42'
        )
        .to(
          '#status-2',
          {
            yPercent: 0,
            opacity: 1,
            duration: 0.42,
            ease: EASE_EDITORIAL,
          },
          'loadStart+=1.56'
        )

        /* PHASE 2: Liquid Pull into Circle */
        .addLabel('hudExit', '+=0.15')
        .to(
          '.hud-corner',
          {
            yPercent: -115,
            opacity: 0,
            duration: 0.48,
            stagger: 0.04,
            ease: 'power3.in',
          },
          'hudExit'
        )
        .to(
          '#status-2',
          {
            yPercent: -115,
            opacity: 0,
            duration: 0.42,
            ease: 'power3.in',
          },
          'hudExit'
        )
        .to(
          '.orbital-stage',
          {
            scale: 0.84,
            opacity: 0,
            duration: 0.48,
            ease: 'power3.in',
            onComplete: () => {
              gsap.set(hud, { visibility: 'hidden' });
            },
          },
          'hudExit+=0.04'
        )
        .addLabel('liquidMorph', 'hudExit+=0.24')
        .to(
          u.uMorph,
          {
            value: 1,
            duration: 1.15,
            ease: EASE_LIQUID,
          },
          'liquidMorph'
        )
        .to(
          u.uWobble,
          {
            value: 1,
            duration: 0.52,
            ease: 'sine.out',
          },
          'liquidMorph'
        )
        .to(
          u.uWobble,
          {
            value: 0,
            duration: 0.63,
            ease: 'power3.out',
          },
          'liquidMorph+=0.52'
        )

        /* PHASE 3: Elastic Inhale & Shockwave Implosion */
        .to(
          u.uScale,
          {
            value: 1.15,
            duration: 0.28,
            ease: 'power2.out',
          },
          '+=0.06'
        )
        .to(u.uScale, {
          value: 1.0,
          duration: 0.26,
          ease: 'power2.inOut',
        })
        .addLabel('implode', '+=0.02')
        .to(
          u.uScale,
          {
            value: 0,
            duration: 0.56,
            ease: EASE_IMPLODE,
          },
          'implode'
        )
        .fromTo(
          u.uRingProgress,
          { value: 0 },
          {
            value: 1,
            duration: 0.92,
            ease: 'power3.out',
          },
          'implode+=0.06'
        )
        .fromTo(
          u.uRingAlpha,
          { value: 0 },
          {
            value: 0.95,
            duration: 0.14,
            ease: 'power1.out',
          },
          'implode+=0.06'
        )
        .to(
          u.uRingAlpha,
          {
            value: 0,
            duration: 0.78,
            ease: 'power2.out',
            onComplete: () => {
              // Finish loader: release scroll and pause WebGL
              WebGLIntro.pause();
              document.body.classList.remove('intro-locked');
              if (hud) hud.style.display = 'none';

              // Sync ScrollTrigger if loaded
              if (window.ScrollTrigger) {
                window.ScrollTrigger.refresh();
              }
            },
          },
          'implode+=0.2'
        );
    } catch (err) {
      console.error('Loader timeline error:', err);
      document.body.classList.remove('intro-locked');
      WebGLIntro.pause();
      const hud = document.getElementById('loader-hud');
      if (hud) hud.style.display = 'none';
    }
  }

  /* ----------------------------------------------------------------------
   * 5. Bootstrap Loader
   * ---------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initOdometerTracks();
    const ready = WebGLIntro.init();
    if (ready) {
      runSwissLoader();
    }
  });
})();
