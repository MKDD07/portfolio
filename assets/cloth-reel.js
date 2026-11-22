/**
 * KALAKRITI WORK — Interactive 3D Cloth Reel Section
 * Three.js + Custom GLSL Shaders + GSAP Outro Scene
 */
(() => {
  'use strict';

  function initClothReel() {
    if (!window.THREE) {
      window.addEventListener('load', initClothReel, { once: true });
      return;
    }

    const section = document.getElementById('cloth-reel');
    if (!section) return;

    const OUTRO_THRESHOLD = 7.2;

    const state = {
      scrollTarget: 0,
      scrollCurrent: 0,
      smoothedVelocity: 0,
      mouseX: 0,
      mouseY: 0,
      targetMouseX: 0,
      targetMouseY: 0,
      isDragging: false,
      dragLastX: 0,
      dragLastY: 0,
      bendMultiplier: 1.0,
      waveMultiplier: 1.0,
      autoScroll: false,
      wireframe: false,
      outroActive: false,
      time: 0
    };

    // DOM References inside section
    const container = section.querySelector('.cloth-webgl-container');
    const stripEl = section.querySelector('.cloth-work-strip');
    const trackEl = section.querySelector('.profile-work-track');
    const cardEls = Array.from(section.querySelectorAll('.profile-work-card'));
    const wordWork = section.querySelector('#word-work');
    const wordReel = section.querySelector('#word-reel');
    const reelTitleLayer = section.querySelector('.cloth-reel-title-layer');
    const scrollProgressBar = section.querySelector('#cloth-scroll-progress-bar');

    // Outro DOM References
    const outroScene = section.querySelector('#cloth-outro-scene');
    const btnReplay = section.querySelector('#btn-replay');

    // Drawer Controls
    const infoPanel = section.querySelector('#cloth-info-panel');
    const panelTitle = section.querySelector('#panel-title');
    const panelDesc = section.querySelector('#panel-desc');
    const btnTogglePanel = section.querySelector('#btn-toggle-panel');
    const btnClosePanel = section.querySelector('#btn-close-panel');
    const sliderBend = section.querySelector('#slider-bend');
    const sliderWave = section.querySelector('#slider-wave');
    const bendVal = section.querySelector('#bend-val');
    const waveVal = section.querySelector('#wave-val');
    const btnAutoScroll = section.querySelector('#btn-autoscroll');
    const dotAutoScroll = section.querySelector('#dot-autoscroll');
    const btnWireframe = section.querySelector('#btn-wireframe');
    const dotWireframe = section.querySelector('#dot-wireframe');
    const btnImpulse = section.querySelector('#btn-impulse');
    const btnPreviewOutro = section.querySelector('#btn-preview-outro');

    let panelOpen = false;
    function setPanelOpen(open, title, desc) {
      panelOpen = open;
      btnTogglePanel?.setAttribute('aria-expanded', String(open));
      if (title && panelTitle) panelTitle.textContent = title;
      if (desc && panelDesc) panelDesc.textContent = desc;
      if (infoPanel) {
        infoPanel.classList.toggle('is-open', panelOpen);
      }
    }

    btnTogglePanel?.addEventListener('click', () => {
      setPanelOpen(
        !panelOpen,
        'Cloth Physics',
        'Scroll, swipe, or drag horizontally to bend the vermilion cloth strip. Real-time surface normals catch warm peach highlights and deep ink fold shadows.'
      );
    });

    btnClosePanel?.addEventListener('click', () => setPanelOpen(false));

    sliderBend?.addEventListener('input', (e) => {
      state.bendMultiplier = parseFloat(e.target.value);
      if (bendVal) bendVal.textContent = state.bendMultiplier.toFixed(1) + 'x';
    });

    sliderWave?.addEventListener('input', (e) => {
      state.waveMultiplier = parseFloat(e.target.value);
      if (waveVal) waveVal.textContent = state.waveMultiplier.toFixed(1) + 'x';
    });

    btnAutoScroll?.addEventListener('click', () => {
      state.autoScroll = !state.autoScroll;
      btnAutoScroll.setAttribute('aria-pressed', String(state.autoScroll));
      if (state.autoScroll) {
        btnAutoScroll.style.backgroundColor = 'var(--ink, #101010)';
        btnAutoScroll.style.color = 'var(--paper, #f3f0e9)';
        if (dotAutoScroll) dotAutoScroll.style.backgroundColor = 'var(--red, #FF482F)';
      } else {
        btnAutoScroll.style.backgroundColor = 'var(--profile-backdrop, #fbdac7)';
        btnAutoScroll.style.color = 'var(--ink, #101010)';
        if (dotAutoScroll) dotAutoScroll.style.backgroundColor = 'rgba(16, 16, 16, 0.35)';
      }
    });

    btnWireframe?.addEventListener('click', () => {
      state.wireframe = !state.wireframe;
      btnWireframe.setAttribute('aria-pressed', String(state.wireframe));
      if (clothMaterial) {
        clothMaterial.wireframe = state.wireframe;
      }
      if (state.wireframe) {
        btnWireframe.style.backgroundColor = 'var(--ink, #101010)';
        btnWireframe.style.color = 'var(--paper, #f3f0e9)';
        if (dotWireframe) dotWireframe.style.backgroundColor = 'var(--red, #FF482F)';
      } else {
        btnWireframe.style.backgroundColor = 'var(--profile-backdrop, #fbdac7)';
        btnWireframe.style.color = 'var(--ink, #101010)';
        if (dotWireframe) dotWireframe.style.backgroundColor = 'rgba(16, 16, 16, 0.35)';
      }
    });

    btnImpulse?.addEventListener('click', () => {
      if (!state.outroActive) {
        state.scrollTarget = Math.min(OUTRO_THRESHOLD + 0.5, state.scrollTarget + 2.4);
      }
    });

    btnPreviewOutro?.addEventListener('click', () => {
      setPanelOpen(false);
      triggerOutro();
    });

    btnReplay?.addEventListener('click', () => {
      exitOutro(true);
    });

    /* -------------------------------------------------------------------
       2. EXTRACT CARD DATA FROM PRESERVED DOM MARKUP
       ------------------------------------------------------------------- */
    const cardsData = cardEls.map((el, idx) => {
      const imgEl = el.querySelector('img');
      const fallbackTitles = ['KALAKRITI CATALOGUE', 'PACKAGING', 'EXHIBITION'];
      const fallbackCaptions = [
        'Traditional Indian motifs, art, and editorial typography',
        'Block-printed textile inspired artisan box design',
        'Exhibition design, spatial curation, and crafts'
      ];
      return {
        index: idx,
        src: imgEl ? (imgEl.getAttribute('src') || imgEl.src) : '',
        title: el.dataset.title || fallbackTitles[idx % 3],
        caption: el.dataset.caption || fallbackCaptions[idx % 3],
        themeType: idx % 3,
        image: null,
        loaded: false
      };
    });

    /* -------------------------------------------------------------------
       3. HIGH-DPI OFFSCREEN CANVAS FOR CARDS & EDITORIAL CAPTIONS
       ------------------------------------------------------------------- */
    const CARD_COUNT = cardsData.length || 8;
    const CARD_SLOT_W = 512;
    const TEX_WIDTH = CARD_SLOT_W * CARD_COUNT;
    const TEX_HEIGHT = 768;

    const offscreenCanvas = document.createElement('canvas');
    offscreenCanvas.width = TEX_WIDTH;
    offscreenCanvas.height = TEX_HEIGHT;
    const ctx = offscreenCanvas.getContext('2d');

    function roundRectPath(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.lineTo(x + w - r, y);
      c.quadraticCurveTo(x + w, y, x + w, y + r);
      c.lineTo(x + w, y + h - r);
      c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      c.lineTo(x + r, y + h);
      c.quadraticCurveTo(x, y + h, x, y + h - r);
      c.lineTo(x, y + r);
      c.quadraticCurveTo(x, y, x + r, y);
      c.closePath();
    }

    function drawCardFallbackArt(c, x, y, w, h, themeType) {
      const grad = c.createLinearGradient(x, y, x + w, y + h);
      if (themeType === 0) {
        grad.addColorStop(0, '#f3f0e9');
        grad.addColorStop(1, '#e5d4c2');
        c.fillStyle = grad;
        c.fillRect(x, y, w, h);

        c.save();
        c.translate(x + w * 0.5, y + h * 0.5);
        c.rotate(-0.14);
        c.fillStyle = '#ffffff';
        c.shadowColor = 'rgba(16, 16, 16, 0.22)';
        c.shadowBlur = 24;
        c.fillRect(-w * 0.28, -h * 0.34, w * 0.56, h * 0.68);
        c.shadowBlur = 0;
        c.strokeStyle = '#FF482F';
        c.lineWidth = 5;
        c.strokeRect(-w * 0.22, -h * 0.26, w * 0.44, h * 0.52);
        c.fillStyle = '#101010';
        c.fillRect(-w * 0.14, -h * 0.08, w * 0.28, h * 0.22);
        c.restore();
      } else if (themeType === 1) {
        grad.addColorStop(0, '#fbdac7');
        grad.addColorStop(1, '#d9a487');
        c.fillStyle = grad;
        c.fillRect(x, y, w, h);

        c.strokeStyle = 'rgba(16, 16, 16, 0.16)';
        c.lineWidth = 2;
        for (let gx = x + 32; gx < x + w; gx += 48) {
          for (let gy = y + 32; gy < y + h; gy += 48) {
            c.beginPath();
            c.arc(gx, gy, 13, 0, Math.PI * 2);
            c.stroke();
          }
        }
        c.save();
        c.translate(x + w * 0.5, y + h * 0.5);
        c.rotate(0.12);
        c.fillStyle = '#f3f0e9';
        c.fillRect(-w * 0.24, -h * 0.28, w * 0.48, h * 0.56);
        c.strokeStyle = '#101010';
        c.lineWidth = 5;
        c.strokeRect(-w * 0.18, -h * 0.22, w * 0.36, h * 0.44);
        c.fillStyle = '#FF482F';
        c.beginPath();
        c.arc(0, 0, 26, 0, Math.PI * 2);
        c.fill();
        c.restore();
      } else {
        grad.addColorStop(0, '#2a2624');
        grad.addColorStop(1, '#101010');
        c.fillStyle = grad;
        c.fillRect(x, y, w, h);

        c.fillStyle = '#f3f0e9';
        c.fillRect(x + w * 0.15, y + h * 0.18, w * 0.70, h * 0.56);
        c.fillStyle = '#FF482F';
        c.fillRect(x + w * 0.22, y + h * 0.28, w * 0.24, h * 0.34);
        c.fillStyle = '#fbdac7';
        c.fillRect(x + w * 0.54, y + h * 0.28, w * 0.24, h * 0.34);
      }
    }

    function drawWrappedText(c, text, x, y, maxWidth, lineHeight) {
      const words = text.split(' ');
      let line = '';
      let currentY = y;
      let lineCount = 0;

      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        if (c.measureText(testLine).width > maxWidth && i > 0) {
          c.fillText(line.trim(), x, currentY);
          line = words[i] + ' ';
          currentY += lineHeight;
          lineCount++;
          if (lineCount >= 2) break;
        } else {
          line = testLine;
        }
      }
      if (lineCount < 2 && line.trim()) {
        c.fillText(line.trim(), x, currentY);
      }
    }

    let cardsTexture = null;

    function renderCardsCanvas() {
      ctx.clearRect(0, 0, TEX_WIDTH, TEX_HEIGHT);

      const padX = 34;
      const cardW = CARD_SLOT_W - padX * 2;
      const cardH = 440;
      const cardTop = 94;
      const cornerRadius = 24;

      cardsData.forEach((card, i) => {
        const x = i * CARD_SLOT_W + padX;
        const y = cardTop;

        // Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(16, 16, 16, 0.34)';
        ctx.shadowBlur = 26;
        ctx.shadowOffsetY = 14;
        roundRectPath(ctx, x, y, cardW, cardH, cornerRadius);
        ctx.fillStyle = '#101010';
        ctx.fill();
        ctx.restore();

        // Image / fallback
        ctx.save();
        roundRectPath(ctx, x, y, cardW, cardH, cornerRadius);
        ctx.clip();

        if (card.loaded && card.image) {
          const imgW = card.image.naturalWidth || card.image.width;
          const imgH = card.image.naturalHeight || card.image.height;
          const imgAspect = imgW / imgH;
          const boxAspect = cardW / cardH;
          let drawW, drawH, offsetX, offsetY;

          if (imgAspect > boxAspect) {
            drawH = cardH;
            drawW = cardH * imgAspect;
            offsetX = x - (drawW - cardW) * 0.5;
            offsetY = y;
          } else {
            drawW = cardW;
            drawH = cardW / imgAspect;
            offsetX = x;
            offsetY = y - (drawH - cardH) * 0.5;
          }
          ctx.drawImage(card.image, offsetX, offsetY, drawW, drawH);

          const vig = ctx.createLinearGradient(x, y + cardH * 0.65, x, y + cardH);
          vig.addColorStop(0, 'rgba(16, 16, 16, 0)');
          vig.addColorStop(1, 'rgba(16, 16, 16, 0.22)');
          ctx.fillStyle = vig;
          ctx.fillRect(x, y, cardW, cardH);
        } else {
          drawCardFallbackArt(ctx, x, y, cardW, cardH, card.themeType);
        }

        // Rim border
        ctx.strokeStyle = 'rgba(243, 240, 233, 0.32)';
        ctx.lineWidth = 2.5;
        roundRectPath(ctx, x + 1, y + 1, cardW - 2, cardH - 2, cornerRadius - 1);
        ctx.stroke();
        ctx.restore();

        // Title
        ctx.fillStyle = '#f3f0e9';
        ctx.font = 'bold 26px Arial, Helvetica, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillText(card.title, x + 4, y + cardH + 26);

        // Caption
        ctx.fillStyle = '#fbdac7';
        ctx.font = '400 20px Arial, Helvetica, sans-serif';
        drawWrappedText(ctx, card.caption, x + 4, y + cardH + 62, cardW - 8, 27);
      });

      if (cardsTexture) {
        cardsTexture.needsUpdate = true;
      }
    }

    function loadCardImages() {
      const uniqueUrls = [...new Set(cardsData.map((c) => c.src).filter(Boolean))];
      uniqueUrls.forEach((url) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          cardsData.forEach((card) => {
            if (card.src === url) {
              card.image = img;
              card.loaded = true;
            }
          });
          renderCardsCanvas();
        };
        img.onerror = () => {
          renderCardsCanvas();
        };
        img.src = url;
      });
    }

    /* -------------------------------------------------------------------
       4. CUSTOM GLSL SHADERS
       ------------------------------------------------------------------- */
    const vertexShader = `
      uniform float uTime;
      uniform float uVelocity;
      uniform vec2 uMouse;
      uniform float uBendMult;
      uniform float uWaveMult;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vElevation;

      vec3 displaceCloth(vec3 p) {
        vec3 pos = p;

        float nx = pos.x / 9.5;
        float ny = pos.y / 2.65;

        float vel = clamp(uVelocity, -2.6, 2.6) * uBendMult;
        float absVel = abs(vel);

        // 1. Idle silk wave
        float idleWave1 = sin(pos.x * 0.56 - uTime * 0.65 + pos.y * 0.42) * 0.24;
        float idleWave2 = cos(pos.x * 1.12 - uTime * 0.48 - pos.y * 0.62) * 0.11;
        float idleLiftY = sin(pos.x * 0.40 - uTime * 0.52) * 0.17;

        pos.z += (idleWave1 + idleWave2) * uWaveMult;
        pos.y += idleLiftY * uWaveMult;

        // 2. Velocity arching
        float arch = (1.0 - nx * nx);
        pos.z += vel * arch * 0.88;
        pos.y += sin(nx * 1.68) * vel * 0.64;

        // Corner pinching
        float pinch = 1.0 - clamp(vel * nx * 0.15, -0.22, 0.28);
        pos.y *= pinch;
        pos.x += ny * vel * 0.40;

        // 3. Velocity ripples
        float scrollRipple = sin(pos.x * 1.48 - uTime * 2.2 + pos.y * 0.85) * absVel * 0.16;
        float fineCrease   = cos(pos.x * 2.40 + uTime * 1.6 - pos.y * 1.15) * absVel * 0.055;
        pos.z += scrollRipple + fineCrease;
        pos.y += sin(pos.x * 1.12 - uTime * 1.6) * absVel * 0.09;

        // 4. Mouse hover ripple
        vec2 mousePos = vec2(uMouse.x * 8.5, uMouse.y * 3.0);
        float dist = distance(pos.xy, mousePos);
        float hoverInfluence = exp(-dist * dist * 0.14);
        pos.z += hoverInfluence * 0.42 * sin(uTime * 1.5 - dist * 1.5);
        pos.y += uMouse.y * 0.12 * (1.0 - abs(nx) * 0.5);

        return pos;
      }

      void main() {
        vUv = uv;

        float eps = 0.075;
        vec3 posC = displaceCloth(position);
        vec3 posR = displaceCloth(position + vec3(eps, 0.0, 0.0));
        vec3 posU = displaceCloth(position + vec3(0.0, eps, 0.0));

        vec3 tangent = normalize(posR - posC);
        vec3 bitangent = normalize(posU - posC);
        vec3 smoothNormal = normalize(cross(tangent, bitangent));

        vec4 worldPosition = modelMatrix * vec4(posC, 1.0);
        vWorldPos = worldPosition.xyz;
        vNormal = normalize(normalMatrix * smoothNormal);
        vElevation = posC.z;

        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `;

    const fragmentShader = `
      uniform sampler2D uCardsTex;
      uniform float uScrollOffset;
      uniform float uVelocity;
      uniform float uCardsRepeat;

      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec3 vNormal;
      varying float vElevation;

      void main() {
        vec3 redDeep   = vec3(0.84, 0.18, 0.11);
        vec3 redCore   = vec3(1.00, 0.282, 0.184);
        vec3 redBright = vec3(1.00, 0.37, 0.26);

        vec3 baseFabric = mix(redDeep, redCore, smoothstep(0.0, 0.50, vUv.x));
        baseFabric = mix(baseFabric, redBright, smoothstep(0.55, 1.0, vUv.x));
        baseFabric *= mix(0.92, 1.05, vUv.y);

        vec2 cardUv = vec2(vUv.x * uCardsRepeat + uScrollOffset, vUv.y);
        float chromaShift = clamp(uVelocity * 0.0012, -0.0035, 0.0035);
        vec4 sampleR = texture2D(uCardsTex, cardUv + vec2(chromaShift, 0.0));
        vec4 sampleG = texture2D(uCardsTex, cardUv);
        vec4 sampleB = texture2D(uCardsTex, cardUv - vec2(chromaShift, 0.0));

        vec3 cardColor = vec3(sampleR.r, sampleG.g, sampleB.b);
        float cardAlpha = sampleG.a;

        vec3 albedo = mix(baseFabric, cardColor, cardAlpha);

        // Finite-difference normals
        vec3 fdx = dFdx(vWorldPos);
        vec3 fdy = dFdy(vWorldPos);
        vec3 derivNormal = normalize(cross(fdx, fdy));
        vec3 N = normalize(mix(normalize(vNormal), derivNormal, 0.32));

        vec3 keyLight  = normalize(vec3(-0.35, 0.55, 1.0));
        vec3 fillLight = normalize(vec3(0.60, -0.25, 0.80));
        vec3 viewDir   = vec3(0.0, 0.0, 1.0);

        float diffKey  = max(dot(N, keyLight), 0.0);
        float diffFill = max(dot(N, fillLight), 0.0);

        vec3 halfVec = normalize(keyLight + viewDir);
        float crestSpec = pow(max(dot(N, halfVec), 0.0), 18.0);

        vec3 inkTint   = vec3(0.063, 0.063, 0.063);
        vec3 peachGlow = vec3(0.984, 0.855, 0.780);

        float troughFactor = clamp(-vElevation * 0.45 + (1.0 - diffKey) * 0.55, 0.0, 0.48);
        vec3 shaded = mix(albedo, inkTint, troughFactor * mix(0.48, 0.24, cardAlpha));

        shaded *= (0.88 + diffKey * 0.20 + diffFill * 0.08);

        float crestMask = clamp(crestSpec + max(vElevation, 0.0) * 0.22, 0.0, 1.0);
        float highlightAmt = mix(0.28, 0.10, cardAlpha);
        shaded = mix(shaded, peachGlow, crestMask * highlightAmt);

        float rim = pow(1.0 - max(dot(N, viewDir), 0.0), 2.8);
        shaded += peachGlow * rim * mix(0.16, 0.06, cardAlpha);

        gl_FragColor = vec4(shaded, 1.0);
      }
    `;

    /* -------------------------------------------------------------------
       5. THREE.JS SCENE SETUP & RESPONSIVE CAMERA
       ------------------------------------------------------------------- */
    let renderer, scene, camera, clothMesh, clothMaterial;

    function initWebGL() {
      try {
        renderCardsCanvas();

        scene = new THREE.Scene();

        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;

        camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
        updateCameraForViewport();

        renderer = new THREE.WebGLRenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance'
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h);
        renderer.setClearColor(0x000000, 0);
        container.appendChild(renderer.domElement);

        cardsTexture = new THREE.CanvasTexture(offscreenCanvas);
        cardsTexture.wrapS = THREE.RepeatWrapping;
        cardsTexture.wrapT = THREE.ClampToEdgeWrapping;
        cardsTexture.minFilter = THREE.LinearFilter;
        cardsTexture.magFilter = THREE.LinearFilter;
        cardsTexture.anisotropy = renderer.capabilities.getMaxAnisotropy
          ? Math.min(8, renderer.capabilities.getMaxAnisotropy())
          : 4;
        cardsTexture.needsUpdate = true;

        const geometry = new THREE.PlaneGeometry(19.0, 5.3, 128, 48);

        clothMaterial = new THREE.ShaderMaterial({
          vertexShader,
          fragmentShader,
          extensions: { derivatives: true },
          uniforms: {
            uTime: { value: 0 },
            uVelocity: { value: 0 },
            uScrollOffset: { value: 0 },
            uCardsTex: { value: cardsTexture },
            uCardsRepeat: { value: 0.62 },
            uMouse: { value: new THREE.Vector2(0, 0) },
            uBendMult: { value: state.bendMultiplier },
            uWaveMult: { value: state.waveMultiplier }
          },
          side: THREE.DoubleSide,
          transparent: false,
          wireframe: state.wireframe
        });

        clothMesh = new THREE.Mesh(geometry, clothMaterial);
        clothMesh.position.set(0, 0.16, 0);
        scene.add(clothMesh);

        loadCardImages();
        return true;
      } catch (err) {
        console.error('Cloth reel WebGL unavailable:', err);
        if (stripEl) {
          stripEl.classList.remove('webgl-active');
          stripEl.classList.add('webgl-fallback');
        }
        return false;
      }
    }

    function updateCameraForViewport() {
      if (!camera || !container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      const aspect = w / h;
      camera.aspect = aspect;

      if (aspect < 0.75) {
        camera.position.set(0, 0, 15.8);
        if (clothMaterial) clothMaterial.uniforms.uCardsRepeat.value = 0.52;
      } else if (aspect < 1.25) {
        camera.position.set(0, 0, 12.6);
        if (clothMaterial) clothMaterial.uniforms.uCardsRepeat.value = 0.58;
      } else {
        camera.position.set(0, 0, 10.6);
        if (clothMaterial) clothMaterial.uniforms.uCardsRepeat.value = 0.64;
      }
      camera.updateProjectionMatrix();
    }

    /* -------------------------------------------------------------------
       6. INPUT HANDLERS & SCROLL INTEGRATION
       ------------------------------------------------------------------- */
    function clampScrollTarget(val) {
      return Math.max(0, Math.min(OUTRO_THRESHOLD + 0.4, val));
    }

    function setupInteractions() {
      // Local wheel inside container allows fast scrubbing
      container.addEventListener('wheel', (e) => {
        const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        if (state.outroActive) {
          if (delta < -20) exitOutro(false);
          return;
        }
        state.scrollTarget = clampScrollTarget(state.scrollTarget + delta * 0.0012);
      }, { passive: true });

      // Dragging on cloth
      container.addEventListener('mousedown', (e) => {
        if (state.outroActive) return;
        state.isDragging = true;
        state.dragLastX = e.clientX;
        container.classList.add('is-dragging');
      });

      window.addEventListener('mousemove', (e) => {
        const rect = container.getBoundingClientRect();
        state.targetMouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        state.targetMouseY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

        if (state.isDragging && !state.outroActive) {
          const dx = e.clientX - state.dragLastX;
          state.dragLastX = e.clientX;
          state.scrollTarget = clampScrollTarget(state.scrollTarget - dx * 0.0024);
        }
      });

      window.addEventListener('mouseup', () => {
        state.isDragging = false;
        container.classList.remove('is-dragging');
      });

      container.addEventListener('touchstart', (e) => {
        if (state.outroActive) return;
        if (e.touches.length === 1) {
          state.isDragging = true;
          state.dragLastX = e.touches[0].clientX;
          state.dragLastY = e.touches[0].clientY;
        }
      }, { passive: true });

      container.addEventListener('touchmove', (e) => {
        if (!state.isDragging || e.touches.length !== 1 || state.outroActive) return;
        const t = e.touches[0];
        const dx = t.clientX - state.dragLastX;
        const dy = t.clientY - state.dragLastY;
        state.dragLastX = t.clientX;
        state.dragLastY = t.clientY;

        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        state.scrollTarget = clampScrollTarget(state.scrollTarget - delta * 0.0030);

        const rect = container.getBoundingClientRect();
        state.targetMouseX = ((t.clientX - rect.left) / rect.width) * 2 - 1;
        state.targetMouseY = -(((t.clientY - rect.top) / rect.height) * 2 - 1);
      }, { passive: true });

      container.addEventListener('touchend', () => {
        state.isDragging = false;
      });

      window.addEventListener('resize', () => {
        if (!renderer || !camera) return;
        const w = container.clientWidth || window.innerWidth;
        const h = container.clientHeight || window.innerHeight;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(w, h);
        updateCameraForViewport();
      });

      // Hook with ScrollTrigger: when scrolling the whole page through #cloth-reel
      if (window.ScrollTrigger) {
        ScrollTrigger.create({
          trigger: section,
          start: 'top top',
          endTrigger: section.nextElementSibling || '#contact',
          end: 'top bottom',
          onUpdate(trigger) {
            if (!state.isDragging) {
              state.scrollTarget = clampScrollTarget(trigger.progress * OUTRO_THRESHOLD);
            }
          }
        });
      }
    }

    /* -------------------------------------------------------------------
       7. GSAP OUTRO SCENE
       ------------------------------------------------------------------- */
    function triggerOutro() {
      if (state.outroActive || !outroScene) return;
      state.outroActive = true;
      state.isDragging = false;
      setPanelOpen(false);

      if (typeof gsap === 'undefined') {
        outroScene.style.opacity = '1';
        outroScene.style.pointerEvents = 'auto';
        return;
      }

      outroScene.setAttribute('aria-hidden', 'false');
      outroScene.classList.remove('pointer-events-none');
      outroScene.classList.add('pointer-events-auto');

      const tl = gsap.timeline();

      if (clothMesh) {
        tl.to(clothMesh.position, { y: 2.2, duration: 0.85, ease: 'power3.in' }, 0)
          .to(clothMesh.scale, { x: 0.88, y: 0.88, z: 0.88, duration: 0.85, ease: 'power3.in' }, 0);
      }
      if (reelTitleLayer) {
        tl.to(reelTitleLayer, { opacity: 0, y: -30, duration: 0.5, ease: 'power2.in' }, 0);
      }

      tl.set(outroScene, { opacity: 1 }, 0.1)
        .fromTo(outroScene.querySelector('.cloth-curtain-top'), { yPercent: -100 }, { yPercent: 0, duration: 0.85, ease: 'expo.inOut' }, 0.15)
        .fromTo(outroScene.querySelector('.cloth-curtain-bottom'), { yPercent: 100 }, { yPercent: 0, duration: 0.85, ease: 'expo.inOut' }, 0.15)
        .fromTo(outroScene.querySelector('.cloth-outro-kicker'), { y: '110%' }, { y: '0%', duration: 0.6, ease: 'power3.out' }, 0.72)
        .fromTo(outroScene.querySelector('.cloth-outro-title'), { y: '110%' }, { y: '0%', duration: 0.8, ease: 'power4.out' }, 0.82)
        .fromTo(outroScene.querySelector('.cloth-outro-divider'), { scaleX: 0 }, { scaleX: 1, duration: 0.65, ease: 'power2.out' }, 0.95)
        .fromTo(outroScene.querySelector('.cloth-outro-sub'), { y: '110%' }, { y: '0%', duration: 0.65, ease: 'power3.out' }, 1.0)
        .fromTo(btnReplay, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 1.12);
    }

    function exitOutro(resetToStart) {
      if (!state.outroActive || !outroScene) return;

      if (typeof gsap === 'undefined') {
        state.outroActive = false;
        outroScene.style.opacity = '0';
        outroScene.style.pointerEvents = 'none';
        return;
      }

      const tl = gsap.timeline({
        onComplete: () => {
          state.outroActive = false;
          outroScene.setAttribute('aria-hidden', 'true');
          outroScene.classList.add('pointer-events-none');
          outroScene.classList.remove('pointer-events-auto');
        }
      });

      tl.to(btnReplay, { opacity: 0, y: 12, duration: 0.3, ease: 'power2.in' }, 0)
        .to(outroScene.querySelectorAll('.cloth-outro-kicker, .cloth-outro-title, .cloth-outro-sub'), { y: '-110%', duration: 0.45, ease: 'power2.in' }, 0.05)
        .to(outroScene.querySelector('.cloth-outro-divider'), { scaleX: 0, duration: 0.35, ease: 'power2.in' }, 0.05)
        .to(outroScene.querySelector('.cloth-curtain-top'), { yPercent: -105, duration: 0.85, ease: 'expo.inOut' }, 0.25)
        .to(outroScene.querySelector('.cloth-curtain-bottom'), { yPercent: 105, duration: 0.85, ease: 'expo.inOut' }, 0.25)
        .set(outroScene, { opacity: 0 }, 1.1);

      if (resetToStart) {
        state.scrollTarget = 0.7;
        state.scrollCurrent = 0;
      } else {
        state.scrollTarget = OUTRO_THRESHOLD - 1.4;
      }

      if (clothMesh) {
        tl.to(clothMesh.position, { y: 0.16, duration: 1.0, ease: 'expo.out' }, 0.4)
          .to(clothMesh.scale, { x: 1, y: 1, z: 1, duration: 1.0, ease: 'expo.out' }, 0.4);
      }
      if (reelTitleLayer) {
        tl.to(reelTitleLayer, { opacity: 1, y: 0, duration: 0.75, ease: 'power3.out' }, 0.55);
      }
    }

    /* -------------------------------------------------------------------
       8. 60FPS ANIMATION LOOP & VISIBILITY
       ------------------------------------------------------------------- */
    let lastTimestamp = 0;
    let isVisible = true;

    const io = new IntersectionObserver((entries) => {
      isVisible = entries[0]?.isIntersecting ?? true;
    }, { rootMargin: '150px 0px' });
    io.observe(section);

    function animate(timestamp) {
      requestAnimationFrame(animate);
      if (!isVisible) return;

      const dt = lastTimestamp ? Math.min((timestamp - lastTimestamp) / 1000, 0.05) : 0.016;
      lastTimestamp = timestamp;
      state.time += dt * 0.55;

      if (state.autoScroll && !state.isDragging && !state.outroActive) {
        state.scrollTarget = clampScrollTarget(state.scrollTarget + dt * 0.35);
      }

      const prevScroll = state.scrollCurrent;
      const lerpFactor = 1.0 - Math.pow(0.006, dt);
      state.scrollCurrent += (state.scrollTarget - state.scrollCurrent) * lerpFactor;

      if (!state.outroActive && state.scrollCurrent >= OUTRO_THRESHOLD) {
        triggerOutro();
      }

      if (scrollProgressBar) {
        const pct = Math.max(0, Math.min(100, (state.scrollCurrent / OUTRO_THRESHOLD) * 100));
        scrollProgressBar.style.width = pct.toFixed(2) + '%';
      }

      const rawVelocity = (state.scrollCurrent - prevScroll) / Math.max(dt, 0.001);
      const velLerp = 1.0 - Math.pow(0.004, dt);
      state.smoothedVelocity += (rawVelocity - state.smoothedVelocity) * velLerp;

      state.mouseX += (state.targetMouseX - state.mouseX) * 0.06;
      state.mouseY += (state.targetMouseY - state.mouseY) * 0.06;

      if (clothMaterial && renderer && scene && camera) {
        clothMaterial.uniforms.uTime.value = state.time;
        clothMaterial.uniforms.uVelocity.value = state.smoothedVelocity * 0.22;
        clothMaterial.uniforms.uScrollOffset.value = state.scrollCurrent * 0.08;
        clothMaterial.uniforms.uMouse.value.set(state.mouseX, state.mouseY);
        clothMaterial.uniforms.uBendMult.value = state.bendMultiplier;
        clothMaterial.uniforms.uWaveMult.value = state.waveMultiplier;

        clothMesh.rotation.y =
          state.mouseX * 0.035 +
          Math.max(-0.12, Math.min(0.12, state.smoothedVelocity * 0.015));
        clothMesh.rotation.x = -state.mouseY * 0.03;

        renderer.render(scene, camera);
      }

      if (trackEl) {
        const domX = 18.4648 + ((state.scrollCurrent * -140) % 1600);
        const domScale = Math.max(
          0.822021,
          1.0 - Math.min(Math.abs(state.smoothedVelocity) * 0.032, 0.177979)
        );
        trackEl.style.transform = `translateX(${domX.toFixed(4)}px) scale(${domScale.toFixed(6)})`;
      }

      if (wordWork && wordReel) {
        const textShift = Math.max(-28, Math.min(28, -state.smoothedVelocity * 4.5));
        wordWork.style.transform = `translate3d(${textShift.toFixed(1)}px, 0, 0)`;
        wordReel.style.transform = `translate3d(${(textShift * 1.25).toFixed(1)}px, 0, 0)`;
      }
    }

    initWebGL();
    setupInteractions();
    requestAnimationFrame(animate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClothReel);
  } else {
    initClothReel();
  }
})();
