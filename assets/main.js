const canvas = document.querySelector('#particles');
const ctx = canvas.getContext('2d');
const photo = document.querySelector('.ceramic-photo');
const _ceramicCanvas = document.querySelector('.ceramic-video');
const video = new FrameSequence(_ceramicCanvas, _ceramicCanvas.dataset.seq, +_ceramicCanvas.dataset.frames);
const themeRed = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
const motion = { resolve: 1, burst: 0, fill: 0 };
const gridSize = 112;
const blackPoint = .09;
let particles = [];

function samplePhoto() {
  if (!ctx || !photo.naturalWidth) return;
  const source = document.createElement('canvas');
  source.width = source.height = gridSize;
  const sample = source.getContext('2d');
  if (!sample) return;

  const scale = gridSize / Math.max(photo.naturalWidth, photo.naturalHeight);
  const w = photo.naturalWidth * scale;
  const h = photo.naturalHeight * scale;
  sample.drawImage(photo, (gridSize - w) / 2, (gridSize - h) / 2, w, h);
  let pixels;
  try {
    pixels = sample.getImageData(0, 0, gridSize, gridSize).data;
  } catch (error) {
    if (error.name !== 'SecurityError') throw error;
    return;
  }

  const dots = [];
  for (let i = 0; i < pixels.length; i += 4) {
    const light = (pixels[i] * .2126 + pixels[i + 1] * .7152 + pixels[i + 2] * .0722) * pixels[i + 3] / 65025;
    if (light <= blackPoint) continue;
    const cell = i / 4;
    const x = (cell % gridSize + .5) / gridSize - .5;
    const y = (Math.floor(cell / gridSize) + .5) / gridSize - .5;
    const tone = (light - blackPoint) / (1 - blackPoint);
    const angle = Math.atan2(y, x) + (Math.random() - .5) * .75;
    const speed = .3 + Math.random() * .95;
    dots.push({
      x, y, tone, assembleAt: .55 * (y + .5) + .12 * Math.random(),
      dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed,
      delay: Math.random() * .16, curl: (Math.random() - .5) * .3
    });
  }
  particles = dots;
  photo.style.opacity = '0';
  draw();
}

let artSize, cx, cy, width, height;
function draw() {
  if (!ctx || !width) return;
  ctx.clearRect(0,0,width,height);
  const spacing = artSize / gridSize;
  if (motion.resolve > 0 && motion.fill < 1) {
    ctx.fillStyle = themeRed;
    for (const p of particles) {
      const assembled = Math.min(1, Math.max(0, (motion.resolve-p.assembleAt)/.33));
      if (!assembled) continue;
      const approach = (1-assembled)**2 * artSize * .16;
      const flight = Math.max(0,(motion.burst-p.delay)/(1-p.delay));
      const travel = flight**1.35 * Math.max(width,height);
      const twist = p.curl * Math.sin(flight*Math.PI) * artSize;
      const x = cx+p.x*artSize+p.dx*(travel+approach)-p.dy*twist;
      const y = cy+p.y*artSize+p.dy*travel+p.dx*twist-approach;
      ctx.globalAlpha = assembled * (1-flight*.85) * (.55 + .45 * p.tone);
      ctx.beginPath();
      ctx.arc(x, y, spacing * (.17 + .28 * Math.sqrt(p.tone)), 0, 2 * Math.PI);
      ctx.fill();
    }
  }
  ctx.globalAlpha = motion.fill;
  ctx.fillStyle = themeRed;
  ctx.fillRect(0,0,width,height);
  ctx.globalAlpha = 1;
}
function resizeArt() {
  if (!ctx) return;
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  const frame = canvas.getBoundingClientRect();
  const art = photo.getBoundingClientRect();
  artSize = art.width;
  cx = art.left-frame.left+artSize/2;
  cy = art.top-frame.top+artSize/2;
  const dpr = Math.min(window.devicePixelRatio || 1,2);
  canvas.width = Math.round(width*dpr);
  canvas.height = Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
new ResizeObserver(resizeArt).observe(canvas);
resizeArt();
photo.addEventListener('load', samplePhoto);
if (photo.complete) samplePhoto();

function animateForcePanels(chapter, followingChapter) {
  const page = chapter.querySelector('.force-page');
  const track = page.querySelector('.force-track');
  const cards = Array.from(track.children);
  const last = cards[cards.length - 1];
  const _cardCanvas = last.querySelector('.parahar-video');
  const cardVideo = _cardCanvas ? new FrameSequence(_cardCanvas, _cardCanvas.dataset.seq, +_cardCanvas.dataset.frames) : null;
  const title = last.querySelector('strong');
  const field = page.querySelector('.force-collapse');
  const fieldCanvas = field.querySelector('.force-collapse-field');
  const characterCanvas = field.querySelector('.force-character');
  const collapseCopy = Array.from(field.querySelectorAll('.force-collapse-copy'));
  const leftCopy = field.querySelector('.force-collapse-copy-left');
  const rightCopy = collapseCopy.find(copy => copy !== leftCopy);
  const copyHeadlines = field.querySelectorAll('.force-collapse-copy h3');
  const copyParagraphs = field.querySelectorAll('.force-collapse-copy p');
  const brush = fieldCanvas.getContext('2d');
  let character;
  let loadingCharacter = false;
  let disposed = false;
  const mask = document.createElement('canvas');
  const sample = mask.getContext('2d', {willReadFrequently:true});
  const stars = [];
  const style = getComputedStyle(document.documentElement);
  const paper = style.getPropertyValue('--paper').trim();
  const ink = style.getPropertyValue('--ink').trim();
  const starColors = ['#aaa09a', '#d7c9bc', paper, '#ffc9bf'];
  const sky = Array.from({ length: 720 }, (_, index) => {
    const fraction = value => value - Math.floor(value);
    const seed = index + 1;
    const light = fraction(seed * .414213562);
    return {
      x: fraction(seed * .754877666) - .5,
      y: fraction(seed * .569840291) - .5,
      light,
      color: starColors[Math.floor(fraction(seed * .618033989) * starColors.length)],
      foreground: light > .94
    };
  });
  const collapse = { progress:0 };
  let w, h;

  function drawSmoke(progress, core) {
    const opacity = Math.min(1, Math.max(0, (progress - .12) / .24)) *
      Math.min(1, (1 - progress) / .22);
    if (opacity <= 0) return;
    const span = Math.min(w, h);
    for (let i = 0; i < 18; i++) {
      const spread = (i % 9) / 8;
      const angle = (i < 9 ? .62 : Math.PI + .2) + spread * 1.8 + progress * 2.25;
      const distance = core * 1.2 + spread * span * (.40 - progress * .19);
      const size = span * (.055 + spread * .067);
      brush.save();
      brush.translate(w / 2 + Math.cos(angle) * distance, h / 2 + Math.sin(angle) * distance);
      brush.rotate(angle + Math.PI / 2);
      brush.scale(1.68, .55 + spread * .23);
      const cloud = brush.createRadialGradient(0, 0, 0, 0, 0, size);
      cloud.addColorStop(0, i % 6 === 0 ? paper : themeRed);
      cloud.addColorStop(1, 'transparent');
      brush.fillStyle = cloud;
      brush.globalAlpha = opacity * (.045 + (1 - spread) * .047) * (i < 9 ? 1 : .68);
      brush.fillRect(-size, -size, size * 2, size * 2);
      brush.restore();
    }
  }

  function drawField() {
    if (!brush || !w) return;
    const p = collapse.progress;
    character?.draw(p);
    const scatter = Math.min(1,p*2.7);
    const pull = Math.max(0,(p-.37)/.63);
    const core = Math.min(w,h)*(.018+.15*pull);
    brush.fillStyle = ink;
    brush.fillRect(0,0,w,h);
    drawSmoke(p, core);
    const skyOpacity = Math.min(1, p * 5) * Math.min(1, (1 - p) / .19);
    if (skyOpacity > 0) {
      const density = Math.min(sky.length, Math.max(220, Math.round(w * h / 1900)));
      for (let i = 0; i < density; i++) {
        const star = sky[i];
        const dx = star.x * w * 1.15;
        const dy = star.y * h * 1.15;
        const distance = Math.hypot(dx, dy);
        const radius = distance * (1 - pull * (star.foreground ? .32 : .53));
        if (radius <= core) continue;
        const angle = Math.atan2(dy, dx) + pull * (star.foreground ? .48 : .87);
        const x = w / 2 + radius * Math.cos(angle);
        const y = h / 2 + radius * Math.sin(angle);
        const size = .52 + star.light ** 3 * 1.62;
        brush.fillStyle = star.color;
        brush.globalAlpha = skyOpacity * (.18 + star.light ** 2 * .79);
        brush.fillRect(x - size / 2, y - size / 2, size, size);
        if (star.foreground) {
          const flare = size * (1.7 + pull * 1.3);
          brush.globalAlpha *= .46;
          brush.fillRect(x - flare, y - .4, flare * 2, .8);
          brush.fillRect(x - .4, y - flare * .72, .8, flare * 1.44);
        }
      }
    }
    brush.globalAlpha = 1;
    const titleFade = Math.min(1, p * 3);
    for (const star of stars) {
      const initialX = star.x - w/2, initialY = star.y - h/2;
      const dx = initialX + (star.dx-initialX)*scatter;
      const dy = initialY + (star.dy-initialY)*scatter;
      const angle = Math.atan2(dy,dx) + pull*pull*(3+star.seed*4);
      const r = Math.hypot(dx,dy)*(1-pull);
      const x = w / 2 + r * Math.cos(angle);
      const y = h / 2 + r * Math.sin(angle);
      if (titleFade < 1) {
        brush.globalAlpha = 1 - titleFade;
        brush.fillStyle = star.color;
        brush.fillText(star.char, x, y);
      }
      if (titleFade && r > core) {
        const size = .9 + star.seed * 1.8;
        brush.globalAlpha = titleFade * (.48 + star.seed * .52);
        brush.fillStyle = starColors[star.seed > .64 ? 2 : 1];
        brush.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    brush.globalAlpha = scatter;
    const glow = brush.createRadialGradient(w/2,h/2,0,w/2,h/2,core*1.8);
    glow.addColorStop(0,'#050505'); glow.addColorStop(.53,'#050505');
    glow.addColorStop(.56, paper);
    glow.addColorStop(.63, 'transparent');
    glow.addColorStop(1,'transparent');
    brush.fillStyle=glow; brush.fillRect(w/2-core*2,h/2-core*2,core*4,core*4);
    const spacing = Math.max(3, Math.min(6, core * .044));
    const extent = Math.ceil(core * 1.75 / spacing);
    brush.fillStyle = themeRed;
    brush.globalAlpha = scatter;
    brush.beginPath();
    for (let row = -extent; row <= extent; row++) {
      for (let col = -extent; col <= extent; col++) {
        const distance = Math.hypot(row, col) * spacing / core;
        if (distance <= 1.04 || distance >= 1.75) continue;
        const density = Math.min(1, (distance - 1.04) / .13) * ((1.75 - distance) / .71) ** 1.35;
        const radius = spacing * .46 * density;
        if (radius < .38) continue;
        const x = w / 2 + col * spacing;
        const y = h / 2 + row * spacing;
        brush.moveTo(x + radius, y);
        brush.arc(x, y, radius, 0, Math.PI * 2);
      }
    }
    brush.fill();
    brush.globalAlpha=1;
  }
  function sizeField() {
    w=page.clientWidth; h=page.clientHeight;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    fieldCanvas.width=Math.round(w*dpr); fieldCanvas.height=Math.round(h*dpr);
    brush.setTransform(dpr,0,0,dpr,0,0);
    character?.resize();
    const rect=title.getBoundingClientRect();
    const style=getComputedStyle(title);
    mask.width=Math.ceil(rect.width)+2; mask.height=Math.ceil(rect.height)+4;
    sample.font=style.fontWeight+' '+style.fontSize+' '+style.fontFamily;
    sample.letterSpacing=style.letterSpacing;
    sample.fillText(title.textContent,0,Math.round(parseFloat(style.fontSize)*.85));
    const pixels=sample.getImageData(0,0,mask.width,mask.height).data;
    const left=track.parentElement.offsetLeft+rect.left-last.getBoundingClientRect().left;
    const top=rect.top-page.getBoundingClientRect().top;
    const step=Math.max(2,Math.round(parseFloat(style.fontSize)/19));
    stars.length=0;
    for(let y=0;y<mask.height;y+=step) for(let x=0;x<mask.width;x+=step) {
      if(pixels[(y*mask.width+x)*4+3]<60) continue;
      const hash=Math.sin(x*12.9898+y*78.233)*43758.5453;
      const seed=hash-Math.floor(hash), angle=(x+y*mask.width)*2.39996;
      stars.push({x:left+x,y:top+y,dx:Math.cos(angle)*Math.sqrt(seed)*w*.58,
        dy:Math.sin(angle)*Math.sqrt(seed)*h*.58,seed,char:'.:+*#@'[Math.floor(seed*6)],
        color:'rgb('+Math.round(125+130*seed)+' '+Math.round(120+125*seed)+' '+Math.round(115+125*seed)+')'});
    }
    brush.font=step*1.6+'px monospace';
    drawField();
  }
  sizeField();
  const playhead = { time: 0 };
  const videoStart = cards.length - 2 + .98;
  const collapseStart = videoStart + 1.15;
  const videoEnd = collapseStart + .22;
  const collapseScrollDuration = 2.3;
  const balls = createForceBalls(page);
  const frameRate = 24;
  const clamp = gsap.utils.clamp;
  gsap.set(field, { opacity: 0 });
  gsap.set(collapseCopy, { autoAlpha: 0 });
  const dark = gsap.timeline({ paused: true });
  dark.to(field, { opacity: 1, duration: .48 })
    .fromTo(collapse, { progress: 0 }, { progress: 1, duration: 2.2, ease: 'none', onUpdate: drawField })
    .set(collapseCopy, { autoAlpha: 1 }, .58)
    .fromTo(rightCopy, { y: 34 }, { y: -54, duration: 1.23, ease: 'none' }, .58)
    .fromTo(leftCopy, { y: 74 }, { y: -78, duration: 1.88, ease: 'none' }, .58)
    .fromTo(copyHeadlines, { opacity: 0, filter: 'blur(10px)' },
      { opacity: 1, filter: 'blur(0px)', duration: .42, ease: 'power3.out' }, .58)
    .fromTo(copyParagraphs, { opacity: 0, filter: 'blur(10px)' },
      { opacity: 1, filter: 'blur(0px)', duration: .42, ease: 'power3.out' }, .69)
    .to(rightCopy, { autoAlpha: 0, filter: 'blur(9px)', duration: .26, ease: 'power2.in' }, 1.55)
    .to(leftCopy, { autoAlpha: 0, filter: 'blur(9px)', duration: .28, ease: 'power2.in' }, 2.18);

  function seekCardVideo() {
    if (!cardVideo || cardVideo.seeking || !Number.isFinite(cardVideo.duration) || cardVideo.error) return;
    const progress = clamp(0, 1, (playhead.time - videoStart) / (videoEnd - videoStart));
    const lastFrame = Math.max(0, Math.round(cardVideo.duration * frameRate) - 1);
    const frame = Math.round(progress * lastFrame);
    if (Math.floor(cardVideo.currentTime * frameRate + .001) !== frame) {
      cardVideo.currentTime = (frame + .25) / frameRate;
    }
  }
  cardVideo?.addEventListener('loadedmetadata', seekCardVideo);
  cardVideo?.addEventListener('seeked', seekCardVideo);

  const movePlayhead = gsap.quickTo(playhead, 'time', {
    duration: .34,
    ease: 'power2.out',
    onUpdate() {
      seekCardVideo();
      const progress = clamp(0, 1, (playhead.time - collapseStart) / collapseScrollDuration);
      if (dark.progress() !== progress) dark.progress(progress, false);
    }
  });

  function prepareCharacter() {
    if (loadingCharacter || disposed) return;
    loadingCharacter = true;
    import('./black-hole-character.js')
      .then(module => disposed ? null : module.loadBlackHoleCharacter(characterCanvas))
      .then(preview => {
        if (disposed) {
          preview?.dispose();
          return;
        }
        character = preview;
        character?.resize();
        character?.draw(collapse.progress);
      })
      .catch(error => console.warn('Could not load the animated character.', error));
  }

  const characterPreload = ScrollTrigger.create({
    trigger: chapter.previousElementSibling,
    start: 'top center',
    once: true,
    onEnter: prepareCharacter
  });
  const sequence = gsap.timeline({
    onUpdate() {
      movePlayhead(this.time());
      balls?.update(this.time());
      if (this.time() > 0) prepareCharacter();
    },
    scrollTrigger: {
      trigger: chapter,
      start: () => 'top ' + parseFloat(page.style.getPropertyValue('--pin-top')),
      endTrigger: followingChapter, end: 'top bottom', scrub: true, invalidateOnRefresh: true,
      onRefresh() {
        sizeField();
        balls?.resize();
      }
    }
  });
  cards.slice(1).forEach((card,i)=>{
    sequence.to(track,{x:()=>cards[0].offsetLeft-card.offsetLeft,duration:.62,ease:'sine.inOut'},i+.36);
  });
  sequence.to({}, { duration: collapseScrollDuration }, collapseStart);
  return () => {
    disposed = true;
    characterPreload.kill();
    character?.dispose();
    balls?.destroy();
    movePlayhead.tween.kill();
    cardVideo?.removeEventListener('loadedmetadata', seekCardVideo);
    cardVideo?.removeEventListener('seeked', seekCardVideo);
    dark.kill();
  };
}

function createSkillsZipper(page) {
  const surface = page.querySelector('.skills-surface');
  let w, h;

  function draw(progress) {
    if (!w || !h) return;
    if (progress >= 1) {
      surface.style.clipPath = 'none';
      return;
    }

    const center = h / 2;
    const travel = Math.min(1, progress / .86);
    const release = Math.max(0, (progress - .78) / .22);
    const pull = w * (1.025 - 1.085 * travel);
    const right = w + Math.max(24, w * .025);
    const bend = Math.max(1, (right - pull) * .3);
    const gap = Math.max(1, center * Math.min(1.10, travel * 1.75));
    const tip = 1 + gap * release;
    surface.style.clipPath = `path("M ${pull} ${center - tip} C ${pull + bend} ${center - tip}, ${right - bend} ${center - gap}, ${right} ${center - gap} L ${right} ${center + gap} C ${right - bend} ${center + gap}, ${pull + bend} ${center + tip}, ${pull} ${center + tip} Z")`;
  }

  return {
    draw,
    resize(progress) {
      w = page.clientWidth;
      h = page.clientHeight;
      draw(progress);
    },
    dispose() { surface.style.removeProperty('clip-path'); }
  };
}

function animateOperationsMark(canvas, chapter, followingChapter) {
  const brush = canvas.getContext('2d');
  if (!brush) return;
  const theme = getComputedStyle(document.documentElement);
  const paper = theme.getPropertyValue('--paper').trim();
  const ink = theme.getPropertyValue('--ink').trim();
  let width = 0;
  let height = 0;

  function mark(x, y, size, angle, color, opacity) {
    brush.save();
    brush.translate(x, y);
    brush.rotate(angle);
    brush.scale(size, size);
    brush.lineWidth = .048;
    brush.strokeStyle = brush.fillStyle = color;
    brush.globalAlpha = opacity;
    for (let i = 0; i < 3; i++) {
      brush.beginPath();
      brush.moveTo(.10, -.04);
      brush.lineTo(.21, -.16);
      brush.lineTo(.21, -.34);
      brush.lineTo(.40, -.34);
      brush.moveTo(.16, .035);
      brush.lineTo(.30, -.10);
      brush.lineTo(.30, -.24);
      brush.lineTo(.43, -.24);
      brush.stroke();
      brush.rotate(Math.PI * 2 / 3);
    }
    brush.beginPath();
    brush.arc(0, 0, .041, 0, Math.PI * 2);
    brush.fill();
    brush.restore();
  }

  function draw(progress) {
    if (!width || !height) return;
    const stamp = Math.min(width, height);
    const cx = width / 2;
    const cy = height / 2;
    const reveal = Math.max(0, (progress - .14) / .86);
    const pitch = Math.max(56, stamp * .145);
    brush.clearRect(0, 0, width, height);

    const columns = Math.ceil(width / (pitch * 2)) + 1;
    const rows = Math.ceil(height / (pitch * 2)) + 1;
    for (let row = -rows; row <= rows; row++) {
      for (let col = -columns; col <= columns; col++) {
        if (!row && !col) continue;
        const edge = Math.min(1, Math.hypot(row / rows, col / columns));
        const wave = Math.max(0, Math.min(1, reveal * 1.8 - edge * .70));
        if (!wave) continue;
        mark(cx + col * pitch + (row % 2 ? pitch / 2 : 0), cy + row * pitch,
          pitch * (.45 + wave * .19), (row + col) % 2 * Math.PI / 3, ink, wave * (.10 + edge * .34));
      }
    }
    const zoom = 1 - (1 - progress) ** 2;
    mark(cx, cy, stamp * (1.35 - 1.255 * zoom), progress * Math.PI * .56, paper, .17 + progress * .13);
  }

  function resize(progress) {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    brush.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(progress);
  }

  const scene = ScrollTrigger.create({
    trigger: chapter,
    start: () => 'top ' + parseFloat(chapter.querySelector('.page').style.getPropertyValue('--pin-top')),
    endTrigger: followingChapter,
    end: 'top bottom',
    onRefresh: trigger => resize(trigger.progress),
    onUpdate: trigger => draw(trigger.progress)
  });
  resize(scene.progress);
  return () => scene.kill();
}

function addEnvelopeBounce(timeline, art) {
  if (!window.Matter) {
    return timeline.to(art, { x: -75, y: -28, rotation: -12, duration: .6, ease: 'power2.out' })
      .to(art, { x: 0, y: 0, rotation: 0, duration: 1.4, ease: 'bounce.out' });
  }
  const { Bodies, Body, Composite, Engine } = Matter;
  const clock = { time: 0 };
  let engine;
  let body;
  let elapsed = 0;

  function launch() {
    const travel = Math.min(window.innerWidth * .28, 175);
    const width = art.offsetWidth * .74;
    const height = art.offsetHeight * .72;
    engine = Engine.create({ gravity: { x: 0, y: 1 } });
    const ground = Bodies.rectangle(-travel / 2, height / 2 + 23, travel * 3, 44,
      { isStatic: true, friction: .045 });
    const wall = Bodies.rectangle(-travel - width / 2 - 16, 0, 30, 240, { isStatic: true });
    body = Bodies.rectangle(0, 0, width, height,
      { restitution: .70, friction: .047, frictionAir: .019, chamfer: { radius: 8 } });
    Composite.add(engine.world, [ground, wall, body]);
    Body.setVelocity(body, { x: -travel / 23, y: -9 });
    Body.setAngularVelocity(body, -.023);
    elapsed = 0;
  }

  return timeline.fromTo(clock, { time: 0 }, {
    time: 2, duration: 2, ease: 'none',
    onStart: launch,
    onUpdate() {
      if (clock.time === 0) {
        gsap.set(art, { x: 0, y: 0, rotation: 0 });
        return;
      }
      if (!engine || clock.time < elapsed) launch();
      while (elapsed + 1 / 120 <= clock.time) {
        Engine.update(engine, 1000 / 120);
        elapsed += 1 / 120;
      }
      const close = Math.max(0, (clock.time - 1.32) / .68);
      const weight = 1 - close * close * (3 - 2 * close);
      gsap.set(art, {
        x: body.position.x * weight,
        y: body.position.y * weight,
        rotation: Math.max(-28, Math.min(28, body.angle * 180 / Math.PI)) * weight
      });
    }
  });
}

function animatePortfolioEnvelope(animated) {
  const envelope = document.querySelector('.portfolio-envelope');
  const art = envelope.querySelector('img');
  const note = envelope.querySelector('.portfolio-envelope-note');
  let visible = false;
  let active;
  let last;
  const shuffle = [];

  const entrance = animated ? gsap.fromTo(envelope,
    { autoAlpha: 0, y: 38, scale: .55, rotation: 16 },
    { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: .52, ease: 'back.out(1.8)',
      paused: true, onComplete: playNext }) : null;
  function idleTimeline() {
    return gsap.timeline({ paused: true, onComplete() {
      active = null;
      playNext();
    } });
  }

  const animations = animated ? [
    addEnvelopeBounce(idleTimeline(), art),
    idleTimeline()
      .to(art, { y: 4, rotation: 5, duration: .31, ease: 'power2.out' }, 0)
      .fromTo(note, { autoAlpha: 0, yPercent: 5, rotation: -4 },
        { autoAlpha: 1, yPercent: -56, rotation: -9, duration: .40, ease: 'power3.out' }, 0)
      .to(note, { autoAlpha: 0, yPercent: 5, rotation: -4, duration: .36, ease: 'power2.in' }, .74)
      .to(art, { y: 0, rotation: 0, duration: .39, ease: 'back.out(1.4)' }, .74),
    idleTimeline()
      .to(art, { x: -8, y: -5, rotation: -13, duration: .3, ease: 'sine.inOut' })
      .to(art, { x: 5, y: -2, rotation: 8, duration: .35, ease: 'sine.inOut' })
      .to(art, { x: 0, y: 0, rotation: 0, duration: .32, ease: 'power3.out' }),
    idleTimeline()
      .to(art, { y: 4, scaleX: 1.13, scaleY: .78, duration: .13, ease: 'power2.in' })
      .to(art, { y: -6, scaleX: .95, scaleY: 1.09, duration: .22, ease: 'power2.out' })
      .to(art, { y: 0, scaleX: 1, scaleY: 1, duration: .44, ease: 'elastic.out(1, .48)' }),
    idleTimeline()
      .to(art, { x: -11, y: -15, rotation: 12, duration: .34, ease: 'sine.inOut' })
      .to(art, { x: -17, y: -9, rotation: -8, duration: .24, ease: 'sine.inOut' })
      .to(art, { x: 0, y: 0, rotation: 0, duration: .46, ease: 'power3.out' })
  ].map(animation => animation.duration(2)) : [];

  function nextAnimation() {
    if (!shuffle.length) {
      shuffle.push(...animations);
      for (let i = shuffle.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffle[i], shuffle[j]] = [shuffle[j], shuffle[i]];
      }
      const end = shuffle.length - 1;
      if (shuffle[end] === last) [shuffle[end], shuffle[0]] = [shuffle[0], shuffle[end]];
    }
    last = shuffle.pop();
    return last;
  }

  function playNext() {
    if (!entrance || !visible || document.hidden || active || entrance.progress() < 1) return;
    active = nextAnimation();
    active.restart();
  }

  function handleVisibility() {
    if (document.hidden) active?.pause();
    else if (active) active.resume();
    else playNext();
  }

  function setVisible(value) {
    if (value === visible) return;
    visible = value;
    envelope.inert = !visible;
    if (entrance) {
      if (visible) entrance.play();
      else {
        entrance.reverse();
        active?.pause(0);
        active = null;
        gsap.set(art, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
        gsap.set(note, { autoAlpha: 0, yPercent: 5, rotation: -4 });
      }
    } else {
      gsap.set(envelope, { autoAlpha: Number(visible) });
    }
  }

  const trigger = ScrollTrigger.create({
    trigger: '#profile',
    start: 'top top',
    end: 'max',
    onEnter: () => setVisible(true),
    onLeaveBack: () => setVisible(false),
    onRefresh: self => setVisible(self.scroll() >= self.start)
  });
  document.addEventListener('visibilitychange', handleVisibility);
  return () => {
    trigger.kill();
    document.removeEventListener('visibilitychange', handleVisibility);
    entrance?.kill();
    animations.forEach(animation => animation.kill());
    envelope.inert = true;
  };
}

function animateFluidPointer() {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const root = document.documentElement;
  const pointer = document.createElement('div');
  const drop = document.createElement('span');
  const trail = document.createElement('span');
  pointer.className = 'pointer-fluid';
  drop.className = 'pointer-fluid-drop';
  trail.className = 'pointer-fluid-trail';
  pointer.setAttribute('aria-hidden', 'true');
  pointer.append(trail, drop);
  document.body.append(pointer);

  const events = new AbortController();
  const options = { passive: true, signal: events.signal };
  const x = gsap.quickTo(drop, 'x', { duration: .16, ease: 'power3.out' });
  const y = gsap.quickTo(drop, 'y', { duration: .16, ease: 'power3.out' });
  const trailX = gsap.quickTo(trail, 'x', { duration: .34, ease: 'power2.out' });
  const trailY = gsap.quickTo(trail, 'y', { duration: .34, ease: 'power2.out' });
  const opacity = gsap.quickTo(pointer, 'opacity', { duration: .16 });
  let visible = false;
  let lastX = 0;
  let lastY = 0;
  let settle;

  function hide() {
    visible = false;
    clearTimeout(settle);
    root.classList.remove('pointer-fluid-active');
    pointer.classList.remove('is-pressed', 'is-targeting');
    opacity(0);
  }

  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') {
      if (visible) hide();
      return;
    }
    const px = event.clientX;
    const py = event.clientY;
    const dx = visible ? px - lastX : 0;
    const dy = visible ? py - lastY : 0;
    if (!visible) {
      visible = true;
      root.classList.add('pointer-fluid-active');
      x(px, px);
      y(py, py);
      trailX(px, px);
      trailY(py, py);
      opacity(1);
    } else {
      x(px + Math.max(-8, Math.min(8, dy * .15)));
      y(py - Math.max(-8, Math.min(8, dx * .15)));
      trailX(px - dx * .18);
      trailY(py - dy * .18);
    }
    const speed = Math.min(1, Math.hypot(dx, dy) / 27);
    pointer.style.setProperty('--fluid-speed', speed);
    if (speed > .03) pointer.style.setProperty('--fluid-angle', Math.atan2(dy, dx) + 'rad');
    lastX = px;
    lastY = py;
    clearTimeout(settle);
    settle = setTimeout(() => {
      pointer.style.setProperty('--fluid-speed', 0);
      x(px); y(py); trailX(px); trailY(py);
    }, 94);
    pointer.classList.toggle('is-targeting', Boolean(event.target.closest?.('a, button, [tabindex="0"]')));
  }, options);
  window.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') pointer.classList.add('is-pressed');
  }, options);
  window.addEventListener('pointerup', () => pointer.classList.remove('is-pressed'), options);
  root.addEventListener('pointerleave', hide, options);
  window.addEventListener('blur', hide, options);

  return () => {
    events.abort();
    clearTimeout(settle);
    root.classList.remove('pointer-fluid-active');
    for (const tween of [x, y, trailX, trailY, opacity]) tween.tween.kill();
    pointer.remove();
  };
}

function animateIdleOpening(hero) {
  const overlay = hero.querySelector('.opening-idle');
  const sides = Array.from(overlay.children);
  const pairs = [
    ['Interface', 'in motion.'],
    ['Typography', 'with rhythm.'],
    ['Materials', 'in focus.'],
    ['Packaging', 'on the shelf.'],
    ['Catalogues', 'with order.'],
    ['Storefronts', 'built to browse.'],
    ['Research', 'before design.'],
    ['Systems', 'across screens.'],
    ['Details', 'worth a look.'],
    ['Design', 'for everyday use.']
  ];
  let index = 0;
  let idleTimer;
  let visible = false;
  let visibilityTween;

  function showPair() {
    sides.forEach((side, i) => { side.textContent = pairs[index][i]; });
  }

  const cycle = gsap.timeline({ paused: true, repeat: -1 });
  cycle.fromTo(sides, { opacity: 0, y: 6, filter: 'blur(4px)' },
    { opacity: 1, y: 0, filter: 'blur(0px)', duration: .25, stagger: .035, ease: 'power3.out' }, 0)
    .to(sides, { opacity: 0, y: -5, filter: 'blur(4px)', duration: .18,
      stagger: .025, ease: 'power2.in' }, .90)
    .call(() => {
      index = (index + 1) % pairs.length;
      showPair();
    });

  function handleActivity() {
    clearTimeout(idleTimer);
    if (visible) {
      visible = false;
      cycle.pause();
      visibilityTween?.kill();
      visibilityTween = gsap.to(overlay, { autoAlpha: 0, duration: .18, ease: 'power1.out' });
    }
    if (window.scrollY > 3 || document.hidden) return;
    idleTimer = setTimeout(() => {
      if (window.scrollY > 3 || document.hidden) return;
      visible = true;
      index = 0;
      showPair();
      visibilityTween?.kill();
      visibilityTween = gsap.to(overlay, { autoAlpha: 1, duration: .20 });
      cycle.restart();
    }, 850);
  }

  window.addEventListener('scroll', handleActivity, { passive: true });
  document.addEventListener('visibilitychange', handleActivity);
  handleActivity();
  return () => {
    clearTimeout(idleTimer);
    visibilityTween?.kill();
    cycle.kill();
    overlay.style.removeProperty('opacity');
    overlay.style.removeProperty('visibility');
    window.removeEventListener('scroll', handleActivity);
    document.removeEventListener('visibilitychange', handleActivity);
  };
}

if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add({
    animated: '(prefers-reduced-motion: no-preference)',
    reduced: '(prefers-reduced-motion: reduce)'
  }, ({ conditions }) => animatePortfolioEnvelope(conditions.animated));
  const root = document.documentElement;
  const mast = document.querySelector('.mast');
  const chapters = Array.from(document.querySelectorAll('.chapter'));

  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const disposePointer = animateFluidPointer();
    const ink = document.createElement('canvas').getContext('2d');
    const profile = document.querySelector('#profile .page');
    const smooth = window.Lenis && new Lenis({ smoothWheel: true, lerp: .12 });
    let updatePosterImages;
    let disposeKalakritiVideo;
    let disposeProjectsCharacter;
    let disposeOperationsMark;
    let disposeSkillsZipper;
    let drawProjectsCharacter;
    const projectExit = { progress: 0 };
    let pauseForceVideo;
    const walkStage = profile.querySelector('.profile-walk');
    const workTrack = profile.querySelector('.profile-work-track');
    const workStrip = workTrack.parentElement;
    const walker = walkStage.querySelector('.profile-walker');
    const _walkCanvas = walker.querySelector('canvas.seq-canvas');
    const walkVideo = new FrameSequence(_walkCanvas, _walkCanvas.dataset.seq, +_walkCanvas.dataset.frames);
    const finishPose = walker.querySelector('.profile-walk-finish img');
    const finishCanvas = walker.querySelector('.profile-walk-finish canvas');
    const finishInk = finishCanvas.getContext('2d');
    let walkFinish;
    const profileClock = { seconds: 0 };
    const profileSequenceSeconds = 6;
    const spotSeconds = .4;
    const spotHoldSeconds = .15;
    const bodyDotSeconds = .8;
    const finishSeconds = spotSeconds + spotHoldSeconds + bodyDotSeconds;
    const walkPlaybackSeconds = profileSequenceSeconds - finishSeconds;
    function resetWalkFinish() {
      walkFinish?.kill();
      walkFinish = undefined;
      walker.classList.remove('is-finishing');
      finishPose.style.opacity = '';
    }

    function prepareFinish() {
      if (!finishInk || !finishPose.naturalWidth) return;
      const sample = document.createElement('canvas');
      sample.width = 54;
      sample.height = 96;
      const pixels = sample.getContext('2d');
      pixels.drawImage(finishPose, 0, 0, sample.width, sample.height);
      let data;
      try {
        data = pixels.getImageData(0, 0, sample.width, sample.height).data;
      } catch (error) {
        if (error.name === 'SecurityError') {
          return;
        }
        throw error;
      }

      // Skin regions in the final side-profile pose, from head to ankles.
      const skin = new Path2D('M31 5.5 34 6.2 36 11.7 34.5 15.6 32 16 30 19.3 25.5 15.4 26 10 28 9 29.5 11Z M36.3 45 41.7 50 41.2 53.7 36.8 52.7 33.7 47Z M9.2 81.7 12.7 83.7 11.2 85.8 8.1 84.2Z M37.4 86 42 84.7 41 87.8 37.7 88Z');
      const dots = [];
      for (let y = 0; y < sample.height; y++) {
        for (let x = 0; x < sample.width; x++) {
          const offset = (y * sample.width + x) * 4;
          const shade = 1 - (data[offset] * .2126 + data[offset + 1] * .7152 + data[offset + 2] * .0722) / 255;
          if (!data[offset + 3] || shade < .07) continue;
          dots.push({ x, y, shade, skin: pixels.isPointInPath(skin, x + .5, y + .5) });
        }
      }
      const fade = { skin: 0, body: 0 };

      walkFinish = gsap.timeline({ paused: true, onUpdate() {
          finishPose.style.opacity = 1 - fade.body;
          finishInk.clearRect(0, 0, finishCanvas.width, finishCanvas.height);
          finishInk.fillStyle = themeRed;
          for (const dot of dots) {
            finishInk.globalAlpha = dot.skin ? fade.skin : fade.body;
            finishInk.beginPath();
            finishInk.arc(dot.x * 8 + 4, dot.y * 8 + 4, 1.15 + 2.5 * dot.shade, 0, Math.PI * 2);
            finishInk.fill();
          }
          finishInk.globalAlpha = 1;
        }
      });
      walkFinish.to(fade, { skin: 1, duration: spotSeconds, ease: 'sine.out' })
        .to(fade, { body: 1, duration: bodyDotSeconds, ease: 'sine.inOut' }, '+=' + spotHoldSeconds);
    }

    function positionWorkCards(progress) {
      const start = root.clientWidth - workStrip.getBoundingClientRect().left;
      const end = Math.min(0, workStrip.clientWidth - workTrack.offsetWidth - 8);
      const offset = start + (end - start) * progress;
      workTrack.style.transform = 'translateX(' + offset + 'px) scale(' + (.72 + .28 * progress) + ')';
    }

    let forward = false;
    let idlePause;
    let finishTween;
    let reverseTime = 0;
    let reversing = false;
    let previousProfileProgress = 0;

    function renderVideoTime() {
      if (!Number.isFinite(walkVideo.duration)) return;
      profileClock.seconds = walkPlaybackSeconds * walkVideo.currentTime / walkVideo.duration;
      renderProfile();
    }

    function pauseWalk() {
      forward = false;
      walkVideo.pause();
      gsap.ticker.remove(renderVideoTime);
    }

    function finishPlayback() {
      pauseWalk();
      profileClock.seconds = Math.max(profileClock.seconds, walkPlaybackSeconds);
      finishTween?.kill();
      finishTween = gsap.to(profileClock, { seconds: profileSequenceSeconds,
        duration: profileSequenceSeconds - profileClock.seconds, ease: 'none', onUpdate: renderProfile });
    }

    function applyReverseFrame() {
      if (!reversing || walkVideo.seeking || !Number.isFinite(walkVideo.duration) || walkVideo.error) return;
      if (Math.abs(walkVideo.currentTime - reverseTime) > .008) walkVideo.currentTime = reverseTime;
    }

    function scrollProfile(trigger) {
      const distanceBack = Math.max(0, previousProfileProgress - trigger.progress);
      previousProfileProgress = trigger.progress;
      idlePause?.kill();
      if (trigger.direction < 0 || trigger.progress === 0) {
        if (forward) renderVideoTime();
        reversing = true;
        pauseWalk();
        finishTween?.kill();
        profileClock.seconds = trigger.progress === 0
          ? 0 : Math.max(0, profileClock.seconds - distanceBack * profileSequenceSeconds);
        const duration = walkVideo.duration;
        if (Number.isFinite(duration)) {
          const frame = profileClock.seconds / walkPlaybackSeconds * duration;
          reverseTime = Math.min(frame, Math.max(0, duration - 1 / 60));
        }
        applyReverseFrame();
        renderProfile();
        return;
      }
      const resumeFromReverse = reversing && Number.isFinite(walkVideo.duration) && !walkVideo.error;
      reversing = false;
      if (finishTween?.isActive() || profileClock.seconds >= profileSequenceSeconds) return;
      if (resumeFromReverse && profileClock.seconds >= walkPlaybackSeconds) {
        finishPlayback();
        return;
      }
      if (resumeFromReverse && Math.abs(walkVideo.currentTime - reverseTime) > .008) {
        walkVideo.currentTime = reverseTime;
      }
      if (!forward) {
        if (walkVideo.ended || walkVideo.error) { finishPlayback(); return; }
        forward = true;
        if (Number.isFinite(walkVideo.duration)) walkVideo.playbackRate = walkVideo.duration / walkPlaybackSeconds;
        gsap.ticker.add(renderVideoTime);
        walkVideo.play().catch(error => { if (forward && error.name !== 'AbortError') finishPlayback(); });
      }
      if (trigger.progress < 1) idlePause = gsap.delayedCall(.35, pauseWalk);
    }

    function setWalkRate() {
      if (Number.isFinite(walkVideo.duration)) walkVideo.playbackRate = walkVideo.duration / walkPlaybackSeconds;
    }

    function renderProfile() {
      const progress = profileClock.seconds / profileSequenceSeconds;
      const walk = Math.min(1, profileClock.seconds / walkPlaybackSeconds);
      const finish = Math.max(0, (profileClock.seconds - walkPlaybackSeconds) / finishSeconds);
      walker.style.transform = 'translateX(' + (walkStage.clientWidth - walker.offsetWidth) * walk + 'px)';
      positionWorkCards(progress);
      emphasis.style.setProperty('--red-fill', progress * 100 + '%');
      walker.classList.toggle('is-playing', walk > 0 && walkVideo.readyState >= 2 && !walkVideo.error);
      walker.classList.toggle('is-finishing', !!walkFinish && finish > 0);
      walkFinish?.progress(finish);

    }

    function loadFinish() {
      prepareFinish();
      renderProfile();
    }

    const catalogue = document.querySelector('#kalakriti .page');
    const posterRing = catalogue.querySelector('.work-gallery .ring');
    const airForce = document.querySelector('#air-force .page');
    const emphasis = profile.querySelector('h2 em');
    const punctuation = document.createRange();
    const titleText = emphasis.firstChild;
    punctuation.setStart(titleText, titleText.length - 1);
    punctuation.setEnd(titleText, titleText.length);
    let inkTravel;
    function measure() {
      const stageHeight = root.clientHeight - mast.offsetHeight;
      root.style.setProperty('--stage-height', stageHeight + 'px');
      for (const chapter of chapters) {
        const panel = chapter.querySelector('.page');
        // A tall chapter scrolls to its last line before it holds for the handoff.
        const pinTop = Math.min(mast.offsetHeight, root.clientHeight - panel.offsetHeight);
        panel.style.setProperty('--pin-top', pinTop + 'px');
      }
      // A Range follows the period when the title wraps, without changing the text fill.
      const dot = punctuation.getBoundingClientRect();
      const box = profile.getBoundingClientRect();
      const font = getComputedStyle(emphasis);
      ink.save();
      ink.font = font.fontStyle + ' ' + font.fontSize + ' ' + font.fontFamily;
      ink.textAlign = 'left';
      ink.textBaseline = 'alphabetic';
      const glyph = ink.measureText('.');
      ink.restore();
      const baseline = Number.isFinite(glyph.fontBoundingBoxAscent)
        ? (dot.height + glyph.fontBoundingBoxAscent - glyph.fontBoundingBoxDescent) / 2 : dot.height * .8;
      const x = dot.left - box.left + (glyph.actualBoundingBoxRight - glyph.actualBoundingBoxLeft) / 2;
      const y = dot.top - box.top + baseline - (glyph.actualBoundingBoxAscent - glyph.actualBoundingBoxDescent) / 2
        + parseFloat(profile.style.getPropertyValue('--pin-top')) - mast.offsetHeight;
      catalogue.style.setProperty('--ink-origin', x + 'px ' + y + 'px');
      inkTravel = Math.hypot(Math.max(x, catalogue.offsetWidth - x), Math.max(y, catalogue.offsetHeight - y)) / .84;
    }
    root.classList.add('sequenced');
    measure();
    ScrollTrigger.addEventListener('refreshInit', measure);
    const profileChapter = profile.closest('.chapter');
    if (finishPose.complete) prepareFinish();
    finishPose.addEventListener('load', loadFinish);
    walkVideo.addEventListener('loadeddata', renderProfile);
    walkVideo.addEventListener('loadedmetadata', setWalkRate);
    walkVideo.addEventListener('ended', finishPlayback);
    walkVideo.addEventListener('seeked', applyReverseFrame);
    ScrollTrigger.create({
      trigger: profileChapter, start: () => 'top ' + parseFloat(profile.style.getPropertyValue('--pin-top')),
      endTrigger: profileChapter.nextElementSibling, end: 'top bottom',
      onUpdate: scrollProfile, onRefresh: renderProfile
    });

    const hero = document.querySelector('.hero');
    const dot = hero.querySelector('.opening-dot');
    const nameDot = hero.querySelector('.name-dot');
    const label = dot.querySelector('span');
    const smallCircle = () => 20 / dot.offsetWidth;
    const disciplines = ['Interface', 'Graphics', 'Branding', 'Shopify', 'Design'];
    const titles = { frame: 0 };
    const ceramic = { reveal: 0, still: 0, dissolve: 0 };
    let started = false;
    let handoff;
    let earlyReveal;
    let videoHasFrame = video.readyState >= 2;
    let ceramicComplete = false;
    let holdingScroll = false;
    let playbackTimeout;
    const dotRevealDuration = 2;
    motion.resolve = 0;
    draw();

    function renderCeramic() {
      videoHasFrame ||= video.readyState >= 2;
      const showVideo = videoHasFrame && !ceramic.still;
      const dotFade = particles.length ? ceramic.dissolve : 0;
      const secondsLeft = (video.duration - video.currentTime) / video.playbackRate;
      const videoFade = earlyReveal || (video.ended && particles.length)
        ? gsap.utils.clamp(0, 1, secondsLeft) : 1;
      const videoWeight = showVideo ? videoFade : 0;
      video.canvas.style.opacity = ceramic.reveal * videoWeight;
      photo.style.opacity = showVideo ? '0' : ceramic.reveal * (1 - dotFade);
      motion.resolve = ceramic.dissolve;
      draw();
    }

    function finishCeramic() {
      if (!started || handoff) return;
      clearTimeout(playbackTimeout);
      earlyReveal?.kill();
      video.pause();
      handoff = gsap.timeline({
        onUpdate: renderCeramic,
        onComplete() {
          ceramicComplete = true;
          releaseCeramicHold();
        }
      });
      if (!video.ended) ceramic.still = 1;
      handoff.to(ceramic, {
        dissolve: 1, duration: dotRevealDuration * (1 - ceramic.dissolve), ease: 'none'
      })
        .to({}, { duration: .45 });
    }

    function revealDotsBeforeEnd() {
      if (!started || earlyReveal || handoff || !particles.length) return;
      const secondsLeft = (video.duration - video.currentTime) / video.playbackRate;
      if (!Number.isFinite(secondsLeft) || secondsLeft > 1) return;
      earlyReveal = gsap.to(ceramic, {
        dissolve: 1, duration: dotRevealDuration, ease: 'none', onUpdate: renderCeramic
      });
    }

    function releaseCeramicHold() {
      if (!holdingScroll) return;
      holdingScroll = false;
      smooth.start();
    }

    function holdCeramicScene(trigger) {
      if (!started || handoff) return;
      const holdAt = .67;
      const revealStart = opening.labels.ceramicStart / opening.duration();
      const advance = gsap.utils.clamp(0, 1, (trigger.progress - revealStart) / (holdAt - revealStart));
      video.playbackRate = 1 + 2 * advance;
      if (!smooth || holdingScroll || ceramicComplete || trigger.direction < 0 || trigger.progress < holdAt) return;
      holdingScroll = true;
      const stop = Math.ceil(trigger.start + (trigger.end - trigger.start) * holdAt);
      smooth.scrollTo(stop, { immediate: true, force: true });
      smooth.stop();
    }

    function updateCeramicReveal() {
      if (ceramic.reveal > 0 && !started) {
        started = true;
        playbackTimeout = setTimeout(finishCeramic, 15000);
        if (video.error) finishCeramic();
        else {
          video.playbackRate = 1;
          video.play().catch(error => {
            if (error.name !== 'AbortError') finishCeramic();
          });
        }
      } else if (ceramic.reveal <= 0 && started) {
        started = false;
        clearTimeout(playbackTimeout);
        ceramicComplete = false;
        releaseCeramicHold();
        handoff?.kill();
        handoff = undefined;
        earlyReveal?.kill();
        earlyReveal = undefined;
        ceramic.still = ceramic.dissolve = 0;
        video.pause();
        if (video.currentTime !== 0) video.currentTime = 0;
      }
      renderCeramic();
    }

    video.addEventListener('loadeddata', renderCeramic);
    video.addEventListener('timeupdate', revealDotsBeforeEnd);
    video.addEventListener('ended', finishCeramic);
    video.addEventListener('error', finishCeramic);
    photo.addEventListener('load', renderCeramic);
    const opening = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: { trigger: '#intro', start: () => 'top ' + mast.offsetHeight,
        end: () => '+=' + 1.5 * (root.clientHeight - mast.offsetHeight), scrub: true, invalidateOnRefresh: true,
        onUpdate: holdCeramicScene }
    });
    gsap.set(nameDot, { clipPath: 'circle(0% at 50% 50%)' });
    opening.to(titles, { frame: disciplines.length-1, duration: .39, onUpdate() {
      label.textContent = disciplines[Math.round(titles.frame)];
    } }, 0)
      .to(label, { opacity: 0, duration: .11 }, .39)
      .fromTo('.opening-orbit', { rotation: -65, scale: .94 }, { rotation: 140, scale: 1.08, duration: .49, ease: 'sine.inOut' }, 0)
      .to('.opening-orbit', { opacity: .85, duration: .10 }, .02)
      .to('.opening-orbit', { opacity: 0, duration: .13 }, .36)
      .to(dot, {
        x: () => nameDot.getBoundingClientRect().left + nameDot.offsetWidth/2 - hero.getBoundingClientRect().left - hero.clientWidth/2,
        y: () => nameDot.getBoundingClientRect().top + nameDot.offsetHeight/2 - hero.getBoundingClientRect().top - hero.clientHeight/2 - gsap.getProperty('.hero-copy','y'),
        scale: () => nameDot.offsetWidth / dot.offsetWidth, duration: .48, ease: 'power3.inOut'
      }, .39)
      .fromTo('.hero-copy > *', { opacity: 0 }, { opacity: 1, duration: .22, stagger: .045 }, .56)
      .addLabel('ceramicStart', .50)
      .to(ceramic, { reveal: 1, duration: .19, onUpdate: updateCeramicReveal }, 'ceramicStart')
      .fromTo('.hero-foot', { autoAlpha: 0 }, { autoAlpha: 1, duration: .12 }, 1.41)
      .to(nameDot, { clipPath: 'circle(50% at 50% 50%)', duration: .05, ease: 'none' }, .88)
      .to(dot, { autoAlpha: 0, duration: .05 }, .88);
    opening.shiftChildren(.42, true);
    root.classList.remove('intro-loading');
    opening.fromTo(dot, {
      x: 0, y: () => -mast.offsetHeight / 2, scale: smallCircle, '--opening-hole': '88%'
    }, {
      scale: 1, '--opening-hole': '0%', duration: .28, ease: 'power2.inOut'
    }, 0)
      .to(label, { opacity: 1, duration: .10 }, .25);
    const disposeIdleOpening = animateIdleOpening(hero);

    for (let index = 1; index < chapters.length; index++) {
      const chapter = chapters[index];
      const next = chapter.querySelector('.page');
      const previous = chapters[index - 1].querySelector('.page');
      const previousContent = previous.querySelectorAll('.content, figure, .hero-copy, .hero-foot');
      const anchorPanel = next === profile || next === catalogue ? gsap.quickSetter(next, 'y', 'px') : null;
      function holdPanelPosition() {
        // Cancel the chapter's movement until the incoming panel reaches the sticky boundary.
        const chapterTop = chapter.getBoundingClientRect().top;
        anchorPanel(Math.min(0, mast.offsetHeight - chapterTop));
      }
      const handoff = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: chapter, start: 'top bottom', end: () => 'top ' + mast.offsetHeight,
          scrub: true, invalidateOnRefresh: true,
          onUpdate: anchorPanel ? holdPanelPosition : undefined,
          onRefresh: anchorPanel ? holdPanelPosition : undefined
        }
      });
      // Offset the incoming panel by exactly the distance its wrapper travels.
      // Both backgrounds occupy the same viewport during the transition.
      if (chapter.id === 'projects') {
        const orbit = next.querySelector('.project-orbit');
        const modelCanvas = next.querySelector('.project-character');
        const operationsPage = chapters[index + 1].querySelector('.page');
        let model;
        let modelProgress = 0;
        let loading = false;
        let disposed = false;
        drawProjectsCharacter = () => {
          if (!model) return;
          const tail = model.duration ? Math.min(1, 1.5 / model.duration) : 0;
          model.draw(modelProgress * (1 - tail) + projectExit.progress * tail);
          const point = model.getSpellScreenPoint();
          if (!point || !next.clientWidth || !next.clientHeight) return;
          const x = (modelCanvas.offsetLeft + modelCanvas.clientWidth * point.x) / next.clientWidth;
          const y = (modelCanvas.offsetTop + modelCanvas.clientHeight * point.y) / next.clientHeight;
          operationsPage.style.setProperty('--project-paper-x', 100 * gsap.utils.clamp(0, 1, x) + '%');
          operationsPage.style.setProperty('--project-paper-y', 100 * gsap.utils.clamp(0, 1, y) + '%');
        };
        function loadModel() {
          if (loading || disposed) return;
          loading = true;
          import('./black-hole-character.js')
            .then(module => disposed ? null : module.loadBlackHoleCharacter(modelCanvas, { projects: true }))
            .then(preview => {
              if (disposed) {
                preview?.dispose();
                return;
              }
              model = preview;
              model?.resize();
              drawProjectsCharacter();
            })
            .catch(error => console.warn('Could not load the Projects character.', error));
        }
        const preload = ScrollTrigger.create({
          trigger: previous.closest('.chapter'), start: 'top center', once: true, onEnter: loadModel
        });
        const characterScroll = ScrollTrigger.create({
          trigger: chapter,
          start: () => 'top ' + parseFloat(next.style.getPropertyValue('--pin-top')),
          endTrigger: chapters[index + 1],
          end: 'top bottom',
          onEnter: loadModel,
          onRefresh(trigger) {
            modelProgress = trigger.progress;
            model?.resize();
            drawProjectsCharacter();
          },
          onUpdate(trigger) {
            modelProgress = trigger.progress;
            drawProjectsCharacter();
          }
        });
        disposeProjectsCharacter = () => {
          disposed = true;
          preload.kill();
          characterScroll.kill();
          model?.dispose();
          operationsPage.style.removeProperty('--project-paper-x');
          operationsPage.style.removeProperty('--project-paper-y');
        };
        const heading = next.querySelector('h2');
        const letter = heading.querySelector('.project-o');
        const field = previous.querySelector('.force-collapse');
        // Match the final canvas gradient exactly, including its outer halo.
        const diameter = () => Math.min(field.clientWidth, field.clientHeight) * .168 * 3.6;
        function glyphBounds() {
          const box = letter.getBoundingClientRect(), panel = next.getBoundingClientRect();
          const font = getComputedStyle(letter);
          ink.save();
          ink.font = font.fontStyle + ' ' + font.fontSize + ' ' + font.fontFamily;
          ink.textAlign = 'left'; ink.textBaseline = 'alphabetic';
          const m = ink.measureText('o');
          ink.restore();
          const baseline = Number.isFinite(m.fontBoundingBoxAscent)
            ? (box.height+m.fontBoundingBoxAscent-m.fontBoundingBoxDescent)/2 : box.height*.8;
          return {
            x: box.left-panel.left+(m.actualBoundingBoxRight-m.actualBoundingBoxLeft)/2,
            y: box.top-panel.top+baseline-(m.actualBoundingBoxAscent-m.actualBoundingBoxDescent)/2-gsap.getProperty(heading,'y'),
            width: (m.actualBoundingBoxLeft+m.actualBoundingBoxRight)/.56,
            height: (m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)/.56
          };
        }
        handoff.fromTo(next, { '--project-shift': -1 }, { '--project-shift': 0, duration:1 }, 0)
          .fromTo(next, { autoAlpha:0 }, { autoAlpha:1, duration:.04 }, 0)
          .fromTo(orbit, { xPercent:-50, yPercent:-50, x:()=>field.clientWidth/2,
            y:()=>field.clientHeight/2+parseFloat(previous.style.getPropertyValue('--pin-top'))-mast.offsetHeight,
            width:diameter, height:diameter, rotation:0 },
          { x:()=>glyphBounds().x, y:()=>glyphBounds().y, width:()=>glyphBounds().width,
            height:()=>glyphBounds().height, rotation:12, duration:.74, ease:'power2.inOut' }, .04)
          .fromTo(heading, { y:44, opacity:0 }, { y:0, opacity:1, duration:.42, ease:'power2.out' }, .36)
          .fromTo(letter, { opacity:0 }, { opacity:1, duration:.14 }, .76)
          .fromTo(orbit, { opacity:1 }, { opacity:0, duration:.14 }, .76)
          .fromTo(next.querySelector('.kicker'), { opacity:0 }, { opacity:1, duration:.2 }, .63)
          .fromTo(next.querySelectorAll('.rows > div'), { opacity:0, x:()=>Math.min(130,root.clientWidth*.18) },
            { opacity:1, x:0, stagger:.045, duration:.25, ease:'power2.out' }, .615)
          .fromTo(modelCanvas, { autoAlpha: 0, filter: 'blur(12px)' },
            { autoAlpha: 1, filter: 'blur(0px)', duration: .29, ease: 'power2.out' }, .70);
        continue;
      }
      if (chapter.id === 'operations') {
        next.classList.add('project-paper-reveal');
        disposeOperationsMark = animateOperationsMark(next.querySelector('.operations-pattern'), chapter, chapters[index + 1]);
        const heading = next.querySelector('h2');
        let titleParts = [heading];
        if (window.SplitText) {
          gsap.registerPlugin(SplitText);
          titleParts = SplitText.create(heading, { type: 'words,chars', tag: 'span' }).chars;
        }
        const circleStart = .10;
        handoff.fromTo(next, {'--type-shift':-1}, {'--type-shift':0,duration:1}, 0)
          .fromTo(next, {autoAlpha:0}, {autoAlpha:1,duration:.03}, 0)
          .fromTo(next, {'--paper-opacity':0},
            {'--paper-opacity':1, duration:.23, ease:'power2.out'}, circleStart)
          .fromTo(next, {'--project-paper-radius':'0%' },
            {'--project-paper-radius':'140%', duration:.79, ease:'power3.inOut'}, circleStart)
          .fromTo(projectExit, { progress: 0 },
            { progress: 1, duration: .49, ease: 'none', onUpdate: drawProjectsCharacter }, 0)
          .to(previous.querySelector('.project-character'),
            {autoAlpha:0, scale:.98, filter:'blur(9px)', duration:.34, ease:'sine.inOut'}, circleStart)
          .to(previous.querySelector('.content'), {
            x: () => -previous.clientWidth - 24, autoAlpha: 0, filter: 'blur(5px)',
            duration: .48, ease: 'power2.in'
          }, circleStart)
          .fromTo(titleParts, { autoAlpha: 0, x: 26, filter: 'blur(7px)' },
            { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: .23,
              stagger: { amount: .13 }, ease: 'power3.out' }, .61)
          .fromTo(next.querySelectorAll('.kicker,h3,.lead'), {opacity:0,y:12},
            {opacity:1,y:0,duration:.18,stagger:.03}, .75);
        continue;
      }
      if (chapter.id === 'skills') {
        const zipper = createSkillsZipper(next);
        const opening = { progress: 0 };
        const top = next.querySelector('.skills-climb-top');
        const bottom = next.querySelector('.skills-climb-bottom');
        const skillContent = next.querySelector('.content');
        const skillHeading = skillContent.querySelector('h2');
        let headingSplit;
        if (window.SplitText) {
          gsap.registerPlugin(SplitText);
          headingSplit = SplitText.create(skillHeading, {
            type: 'words,chars', tag: 'span', charsClass: 'skill-letter', mask: 'chars'
          });
        }
        const cards = Array.from(skillContent.querySelectorAll('.skills-grid > div'));
        const previewEvents = new AbortController();
        const previews = cards.map(card => {
          const image = card.querySelector('.skill-preview');
          const reveal = gsap.fromTo(image,
            { autoAlpha: 0, clipPath: 'inset(0 0 100% 0)', scale: 1.045 },
            { paused: true, autoAlpha: 1, clipPath: 'inset(0 0 0% 0)', scale: 1, duration: .37, ease: 'power3.out' });
          function updatePreview() {
            if (card.matches(':hover, :focus-within')) reveal.play();
            else reveal.reverse();
          }
          for (const event of ['pointerenter', 'pointerleave', 'focus', 'blur']) {
            card.addEventListener(event, updatePreview, { signal: previewEvents.signal });
          }
          return reveal;
        });
        const player = document.createElement('canvas');
        const picture = top.getContext('2d');
        const mirror = bottom.getContext('2d');
        const frameCount = Number(top.dataset.frames);
        const fps = 24;
        let climbing;
        let currentFrame = 0;
        let targetFrame = 0;
        let animationFrame = 0;
        let lastFrameTime = -Infinity;
        let travel = 0;
        const dotImage = new Image();
        const finish = { progress: 0 };
        const finishTween = gsap.to(finish, {
          progress: 1, paused: true, duration: .55, ease: 'power2.out', onUpdate: drawClimbingFrame
        });
        dotImage.onload = () => {
          if (currentFrame === frameCount - 1) finishTween.play();
        };
        dotImage.src = 'assets/person-climbing-final-dots.png';
        function drawClimbingFrame() {
          if (!picture || !mirror) return;
          picture.clearRect(0, 0, top.width, top.height);
          picture.drawImage(player, 0, 0, top.width, top.height);
          if (finish.progress > 0 && dotImage.naturalWidth) {
            const radius = Math.hypot(top.width, top.height) * .56 * finish.progress;
            picture.save();
            picture.beginPath();
            picture.arc(top.width / 2, top.height / 2, radius, 0, Math.PI * 2);
            picture.clip();
            picture.clearRect(0, 0, top.width, top.height);
            picture.drawImage(dotImage, 0, 0, top.width, top.height);
            picture.restore();
          }
          mirror.clearRect(0, 0, bottom.width, bottom.height);
          mirror.drawImage(top, 0, 0, bottom.width, bottom.height);
        }
        function prepareClimbing() {
          if (climbing) return;
          player.addEventListener('frame', drawClimbingFrame);
          climbing = new FrameSequence(player, top.dataset.seq, frameCount, fps,
            frame => 'Person_climbing_' + String(frame).padStart(5, '0') + '.webp');
          scheduleFrame();
        }
        function moveClimbing(progress) {
          top.style.translate = travel * progress + 'px 0';
          bottom.style.translate = -travel * progress + 'px 0';
        }
        function sizeClimbing() {
          const contentRight = skillContent.offsetLeft + skillContent.offsetWidth;
          travel = next.clientWidth <= 850 ? Math.min(next.clientWidth * .32, 230) : Math.max(0, Math.min(
            skillContent.offsetLeft - top.offsetLeft - top.offsetWidth - 14,
            bottom.offsetLeft - contentRight - 14
          ));
          moveClimbing(currentFrame / (frameCount - 1));
        }
        function scheduleFrame() {
          if (!climbing || climbing.error || animationFrame || currentFrame === targetFrame) return;
          animationFrame = requestAnimationFrame(showNextFrame);
        }
        function showNextFrame(now) {
          animationFrame = 0;
          if (currentFrame === targetFrame) return;
          const nextFrame = currentFrame + Math.sign(targetFrame - currentFrame);
          if (now - lastFrameTime >= 1000 / fps - 1 &&
              climbing.isFrameReady(currentFrame) && climbing.isFrameReady(nextFrame)) {
            if (currentFrame === frameCount - 1) finishTween.pause(0);
            currentFrame = nextFrame;
            lastFrameTime = now;
            climbing.currentTime = currentFrame / fps;
            moveClimbing(currentFrame / (frameCount - 1));
            if (currentFrame === frameCount - 1 && dotImage.naturalWidth) finishTween.play();
          }
          scheduleFrame();
        }
        function queueClimbingFrames(progress) {
          targetFrame = Math.round(progress * (frameCount - 1));
          scheduleFrame();
        }
        const preload = ScrollTrigger.create({
          trigger: previous.closest('.chapter'), start: 'top center', once: true, onEnter: prepareClimbing
        });
        const playhead = { progress: 0 };
        const motion = gsap.to(playhead, {
          progress: 1,
          ease: 'none',
          onUpdate: () => queueClimbingFrames(playhead.progress),
          scrollTrigger: {
            trigger: chapter,
            start: () => 'top ' + parseFloat(next.style.getPropertyValue('--pin-top')),
            endTrigger: chapters[index + 1],
            end: 'top 110%',
            scrub: .82,
            onEnter: prepareClimbing,
            onRefresh: sizeClimbing
          },
        });
        zipper.resize(0);
        sizeClimbing();
        handoff.scrollTrigger.vars.onRefresh = () => zipper.resize(opening.progress);
        disposeSkillsZipper = () => {
          preload.kill();
          motion.scrollTrigger?.kill();
          motion.kill();
          cancelAnimationFrame(animationFrame);
          previewEvents.abort();
          previews.forEach(preview => preview.kill());
          headingSplit?.revert();
          finishTween.kill();
          dotImage.onload = null;
          player.removeEventListener('frame', drawClimbingFrame);
          top.style.removeProperty('translate');
          bottom.style.removeProperty('translate');
          zipper.dispose();
        };
        handoff.fromTo(next, { y: () => mast.offsetHeight - root.clientHeight }, { y: 0, duration: 1 }, 0)
          .fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: .035 }, 0)
          .to(previous.querySelector('.content'), {
            autoAlpha: 0, y: -18, filter: 'blur(5px)', duration: .32, ease: 'power1.in'
          }, .11)
          .to(opening, {
            progress: 1, duration: .94, ease: 'sine.inOut', onUpdate: () => zipper.draw(opening.progress)
          }, .03)
          .fromTo(next.querySelector('.skills-heading'), { autoAlpha: 0, y: 22 },
            { autoAlpha: 1, y: 0, duration: .31, ease: 'power3.out' }, .52)
          .fromTo(headingSplit?.chars ?? [skillHeading], { yPercent: 105, opacity: 0 },
            { yPercent: 0, opacity: 1, duration: .34, stagger: { amount: .12 }, ease: 'power3.out' }, .53)
          .fromTo(next.querySelectorAll('.skills-grid > div'),
            { autoAlpha: 0, y: 17, '--skill-rule': 0 },
            { autoAlpha: 1, y: 0, '--skill-rule': 1, duration: .27,
              stagger: .045, ease: 'power3.out' }, .58)
          .fromTo([top, bottom], { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: .28, ease: 'power2.out' }, .62);
        continue;
      }
      if (next === catalogue) {
        handoff.fromTo([profile.querySelector('.content'), walkStage], { y: 0 },
            { y: () => -Math.min(120, root.clientHeight * .14), duration: .7, ease: 'sine.inOut' }, 0)
          .fromTo(workStrip, { clipPath: 'inset(0% 0% 0% 0%)', yPercent: 0 },
            { clipPath: 'inset(100% 0% 0% 0%)', yPercent: 18, duration: .55, ease: 'sine.inOut' }, .08)
          .fromTo(next, { '--ink-radius': '0px' },
          { '--ink-radius': () => inkTravel + 'px', duration: .95, ease: 'power2.inOut' }, 0)
          .fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: .035 }, 0)
          .fromTo(next.querySelector('h2'), { y: 22 },
            { y: 0, duration: .38, ease: 'power2.out' }, .55);
        const notes = next.querySelectorAll('.work-notes li');
        gsap.set(Array.from(notes).slice(1), { autoAlpha: 0, y: 8 });
        let updateWalkClip;
        const gallery = gsap.timeline({ defaults: { duration: .75, ease: 'sine.inOut' }, scrollTrigger: {
          trigger: chapter, start: () => 'top ' + parseFloat(next.style.getPropertyValue('--pin-top')),
          endTrigger: chapters[index + 1], end: 'top bottom', scrub: true, invalidateOnRefresh: true,
          onUpdate: trigger => updateWalkClip?.(trigger)
        } });
        for (let slide = 1; slide < notes.length; slide++) {
          const start = slide - .8;
          gallery.to(notes[slide - 1], { autoAlpha: 0, y: -8, duration: .23 }, start + .10)
            .to(notes[slide], { autoAlpha: 1, y: 0, duration: .27 }, start + .34);
        }
        gallery.to({}, { duration: .25 });
        const posters = window.createPosterTimeline?.();
        if (posters) {
          handoff.add(posters.entrance.duration(.75), .25);
          gallery.add(posters.timeline.duration(gallery.duration()), 0);
        }
        const trail = catalogue.querySelector('.work-trail');
        const path = trail.querySelector('path');
        const tip = trail.querySelector('.trail-tip');
        const pen = { progress: 0, retract: 0 };
        const tailLength = 300;
        const tailSegments = Array.from({ length: tailLength / 10 }, () => {
          const segment = path.cloneNode();
          segment.classList.add('trail-tail-segment');
          trail.querySelector('.trail-line').insertBefore(segment, tip);
          return segment;
        });
        path.style.visibility = 'hidden';
        let length;
        function trace() {
          const head = length * pen.progress;
          const point = path.getPointAtLength(head);
          const segmentLength = tailLength / tailSegments.length;
          tailSegments.forEach((segment, index) => {
            const end = Math.max(0, head - index * segmentLength);
            const start = Math.max(0, end - segmentLength);
            segment.style.strokeDasharray = (end - start) + ' ' + length;
            segment.style.strokeDashoffset = -start;
            segment.style.opacity = (1 - index / tailSegments.length) * (1 - pen.retract);
          });
          tip.style.opacity = Math.max(0, 1 - pen.retract * 5);
          tip.setAttribute('cx', point.x);
          tip.setAttribute('cy', point.y);
        }
        function sizeTrail() {
          const dot = catalogue.querySelector('h2 span').getBoundingClientRect();
          const frame = trail.getBoundingClientRect();
          const x = dot.left + dot.width / 2 - frame.left;
          const y = dot.top + dot.height / 2 - frame.top - gsap.getProperty(catalogue.querySelector('h2'), 'y');
          const w = frame.width, h = frame.height;
          const endX = w / 2, endY = h - tip.r.baseVal.value;
          airForce.style.setProperty('--trail-origin', endX + 'px ' + endY + 'px');
          const curve = `M ${x} ${y} C ${x+w*.08} ${y}, ${w*.55} ${h*.13}, ${w*.50} ${h*.30} S ${w*.41} ${h*.48}, ${w*.50} ${h*.56} S ${w*.61} ${h*.72}, ${w*.50} ${h*.81} S ${w*.48} ${h*.94}, ${endX} ${endY}`;
          path.setAttribute('d', curve);
          tailSegments.forEach(segment => segment.setAttribute('d', curve));
          length = path.getTotalLength();
          trace();
        }
        sizeTrail();
        gallery.scrollTrigger.vars.onRefresh = sizeTrail;
        const departure = gallery.duration();
        const _kalaCanvas = next.querySelector('.kalakriti-video');
        const walkClip = _kalaCanvas ? new FrameSequence(_kalaCanvas, _kalaCanvas.dataset.seq, +_kalaCanvas.dataset.frames) : null;
        if (walkClip) {
          const finalDots = next.querySelector('.kalakriti-video-dots');
          const finalFrameAt = departure - .58;
          const frameDuration = walkClip.duration / Number(_kalaCanvas.dataset.frames);
          let idle;
          let previousTime = 0;
          let reverseTarget;

          function applyWalkClipSeek() {
            if (reverseTarget === undefined || walkClip.seeking) return;
            const target = Math.min(walkClip.duration - frameDuration,
              Math.round(reverseTarget / frameDuration) * frameDuration);
            if (Math.abs(walkClip.currentTime - target) > .008) walkClip.currentTime = target;
          }

          walkClip.addEventListener('seeked', applyWalkClipSeek);
          updateWalkClip = ({ direction }) => {
            const time = Math.min(departure, gallery.time());
            const distanceBack = Math.max(0, previousTime - time);
            previousTime = time;
            idle?.kill();
            if (time >= finalFrameAt) {
              walkClip.pause();
              reverseTarget = walkClip.duration - frameDuration;
              applyWalkClipSeek();
              return;
            }
            if (time === 0 || direction < 0) {
              walkClip.pause();
              if (Number.isFinite(walkClip.duration) && (time === 0 || distanceBack > 0)) {
                const current = reverseTarget ?? walkClip.currentTime;
                reverseTarget = time === 0 ? 0 : Math.max(0, current - distanceBack * walkClip.duration / departure);
                applyWalkClipSeek();
              }
              return;
            }
            reverseTarget = undefined;
            if (!walkClip.ended && walkClip.paused) walkClip.play().catch(() => {});
            idle = gsap.delayedCall(.35, () => walkClip.pause());
          };
          gallery.to(_kalaCanvas, { autoAlpha: 0, duration: .32 }, finalFrameAt + .16)
            .fromTo(finalDots, { autoAlpha: 0, clipPath: 'circle(0% at 35% 50%)' },
              { autoAlpha: 1, clipPath: 'circle(100% at 35% 50%)', duration: .38, ease: 'power2.out' }, finalFrameAt + .1)
            .to(finalDots, { autoAlpha: 0, duration: .24 }, departure);
          disposeKalakritiVideo = () => {
            idle?.kill();
            walkClip.removeEventListener('seeked', applyWalkClipSeek);
            walkClip.pause();
            if (walkClip.currentTime !== 0) walkClip.currentTime = 0;
          };
        }
        if (posterRing && posters) {
          let imageOffset = 0;
          updatePosterImages = (velocity, deltaMs) => {
            const postersVisible = gallery.scrollTrigger.isActive && gallery.time() < departure;
            const target = postersVisible ? gsap.utils.clamp(-6, 6, -velocity * .85) : 0;
            const ease = 1 - Math.exp(-deltaMs / 95);
            const offset = imageOffset + (target - imageOffset) * ease;
            const nextOffset = Math.abs(offset) < .02 ? 0 : offset;
            if (nextOffset === imageOffset) return;
            imageOffset = nextOffset;
            posterRing.style.setProperty('--img-y', imageOffset.toFixed(2) + '%');
          };
        }
        const trailDuration = 3.3;
        const bottomAt = departure + trailDuration;
        const endingDuration = 1.25;
        gallery.fromTo(trail, { autoAlpha: 0 }, { autoAlpha: 1, duration: .24 }, departure)
          .to(pen, { progress: 1, duration: trailDuration, ease: 'none', onUpdate: trace }, departure);
        const stops = trail.querySelectorAll('.trail-stop');
        const summary = catalogue.querySelector('.trail-summary');
        const headline = catalogue.querySelector('.trail-headline');
        stops.forEach((stop, i) => {
          const cue = departure + .20 + i;
          const art = stop.querySelector('.trail-art');
          const image = art.querySelector('img');
          const dots = art.querySelector('.trail-dots');
          const caption = stop.querySelector('span');
          gallery.fromTo(stop, { autoAlpha: 0 }, { autoAlpha: 1, duration: .32, ease: 'sine.inOut' }, cue)
            .fromTo(caption, { autoAlpha: 0, filter: 'blur(12px)', xPercent: i % 2 ? 15 : -15 },
              { autoAlpha: 1, filter: 'blur(0px)', xPercent: 0, duration: .44, ease: 'sine.inOut' }, cue)
            .fromTo(art, { yPercent: 8 }, { yPercent: 0, duration: .44, ease: 'sine.out' }, cue)
            .to(image, { opacity: 0, duration: .32, ease: 'sine.inOut' }, cue + .48)
            .to(dots, { opacity: 1, scale: .48, yPercent: -14, duration: .32, ease: 'sine.inOut' }, cue + .48)
            .to(dots, { yPercent: -38, duration: bottomAt - cue - .80, ease: 'sine.inOut' }, cue + .80)
            .to(caption, { autoAlpha: 0, duration: .22 }, cue + .78);
        });
        // Gather the illustrations beside the closing paragraph before they disappear.
        const summaryBounds = () => summary.getBoundingClientRect();
        const artLayers = Array.from(stops, stop => stop.querySelector('.trail-art'));
        gallery.to(pen, { retract: 1, duration: endingDuration, ease: 'sine.out', onUpdate: trace }, bottomAt)
          .to(artLayers, {
            x: (_, art) => summaryBounds().left - art.offsetParent.getBoundingClientRect().left
              - art.offsetLeft - art.offsetWidth / 2,
            y: (_, art) => summaryBounds().top - gsap.getProperty(summary, 'y')
              - art.offsetParent.getBoundingClientRect().top - art.offsetTop - art.offsetHeight / 2,
            autoAlpha: 0, duration: .86, stagger: .06, ease: 'power2.inOut'
          }, bottomAt)
          .fromTo([headline, summary], { autoAlpha: 0, y: 12 },
            { autoAlpha: 1, y: 0, duration: .39, ease: 'power2.out' }, bottomAt + .62);
        continue;
      }
      if (next === airForce) {
        pauseForceVideo = animateForcePanels(chapter, chapters[index+1]);
        // The new panel and the pinned trail share the same viewport coordinates.
        handoff.fromTo(next, { '--arrival-shift': -1 }, { '--arrival-shift': 0, duration: 1 }, 0)
          .fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: .025 }, 0)
          .fromTo(next, { '--arrival-radius': '5px' },
            { '--arrival-radius': () => Math.ceil(Math.hypot(next.offsetWidth, next.offsetHeight)) + 'px',
              duration: .94, ease: 'power2.inOut' }, .025)
          .fromTo(previous, { '--trail-exit-blur': '0px', '--trail-exit-opacity': 1 },
            { '--trail-exit-blur': '12px', '--trail-exit-opacity': 0, duration: .32, ease: 'power2.in' }, .025)
          .fromTo(next.querySelector('.force-intro'), { autoAlpha: 0 },
            { autoAlpha: 1, duration: .34, ease: 'sine.inOut' }, .62)
          .fromTo(next.querySelector('.force-window'), { autoAlpha: 0 },
            { autoAlpha: 1, duration: .23, ease: 'sine.inOut' }, .76);
        continue;
      }
      if (!anchorPanel) {
        handoff.fromTo(next, { y: () => mast.offsetHeight - root.clientHeight }, { y: 0, duration: 1 }, 0);
      }
      handoff.fromTo(previousContent, { opacity: 1, y: 0 },
          { opacity: 0, y: -22, duration: .38, immediateRender: false }, 0)
        .fromTo(next, { autoAlpha: 0 }, { autoAlpha: 1, duration: .28 }, .32);
      if (index === 1) {
        const outline = chapter.querySelector('#profile-curtain path');
        const expanded = outline.getAttribute('d');
        // Straight outer runs keep the corners square. Only the centre fifth bows.
        const halfOpen = 'M 0 110 H 400 C 450 110 460 66 500 66 S 550 110 600 110 H 1000 V 290 H 600 C 550 290 540 334 500 334 S 450 290 400 290 H 0 Z';
        const line = 'M 0 199 H 400 C 450 199 460 199 500 199 S 550 199 600 199 H 1000 V 201 H 600 C 550 201 540 201 500 201 S 450 201 400 201 H 0 Z';
        handoff.to(motion, { burst: 1, duration: .4, onUpdate: draw }, 0)
          .to(motion, { fill: 1, duration: .26, onUpdate: draw }, .14)
          .fromTo(outline, { attr: { transform: 'scale(0 .0025)' } },
            { attr: { transform: 'scale(.001 .0025)' }, duration: .14, ease: 'sine.inOut' }, .40)
          .fromTo(outline, { attr: { d: line } },
            { attr: { d: halfOpen }, duration: .20, ease: 'sine.in' }, .50)
          .to(outline, { attr: { d: expanded }, duration: .30, ease: 'sine.out' }, .70)
          .fromTo(next.querySelector('.curtain .content'), { autoAlpha: 0 },
            { autoAlpha: 1, duration: .19, ease: 'sine.out' }, .74);
      } else {
        handoff.fromTo(next, { clipPath: 'inset(49.9% 0 49.9%)' },
          { clipPath: 'inset(0% 0 0%)', duration: .61, ease: 'power2.inOut' }, .34);
      }
    }

    const tick = (seconds, deltaMs) => {
      smooth.raf(seconds * 1000);
      updatePosterImages?.(smooth.velocity, deltaMs);
    };
    const envelopeWipe = document.querySelector('.envelope-contact-wipe');
    let envelopeTransition;
    function navigate(event) {
      const link = event.target.closest('a[href^="#"]');
      if (!link || event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const target = document.getElementById(link.hash.slice(1));
      if (!target) return;
      const opensEnvelope = link.matches('.portfolio-envelope');
      if (!smooth && !opensEnvelope) return;
      event.preventDefault();
      if (envelopeTransition) return;
      function setHash() {
        if (location.hash !== link.hash) history.pushState(null, '', link.hash);
      }
      function focusTarget() {
        target.tabIndex = -1;
        target.focus({ preventScroll: true });
      }
      if (opensEnvelope) {
        const art = link.querySelector('img').getBoundingClientRect();
        const x = gsap.utils.clamp(0, root.clientWidth, art.left + art.width / 2);
        const y = gsap.utils.clamp(0, root.clientHeight, art.top + art.height / 2);
        const radius = Math.ceil(Math.hypot(Math.max(x, root.clientWidth - x), Math.max(y, root.clientHeight - y))) + 3;
        const dot = `circle(0px at ${x}px ${y}px)`;
        const cover = `circle(${radius}px at ${x}px ${y}px)`;
        envelopeTransition = gsap.timeline({ onComplete() {
          envelopeTransition = null;
          focusTarget();
        } });
        envelopeTransition.fromTo(envelopeWipe, { autoAlpha: 1, clipPath: dot },
          { autoAlpha: 1, clipPath: cover, duration: .52, ease: 'power3.inOut' })
          .call(() => {
            setHash();
            if (smooth) smooth.scrollTo(target, { offset: -mast.offsetHeight, immediate: true, force: true });
            else target.scrollIntoView({ behavior: 'instant' });
            ScrollTrigger.update();
          })
          .to(envelopeWipe, { clipPath: dot, duration: .48, ease: 'power3.inOut' })
          .set(envelopeWipe, { autoAlpha: 0 });
        return;
      }
      setHash();
      smooth.scrollTo(target, { offset: -mast.offsetHeight, duration: .85, onComplete: focusTarget });
    }
    if (smooth) {
      smooth.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(tick);
    }
    document.addEventListener('click', navigate);
    ScrollTrigger.refresh();
    return () => {
      disposePointer?.();
      disposeIdleOpening();
      disposeKalakritiVideo?.();
      disposeProjectsCharacter?.();
      disposeOperationsMark?.();
      disposeSkillsZipper?.();
      document.querySelector('#operations .page')?.classList.remove('project-paper-reveal');
      pauseForceVideo?.();
      catalogue.querySelectorAll('.trail-tail-segment').forEach(segment => segment.remove());
      catalogue.querySelector('.trail-line path')?.style.removeProperty('visibility');
      finishPose.removeEventListener('load', loadFinish);
      walkVideo.removeEventListener('loadeddata', renderProfile);
      walkVideo.removeEventListener('seeked', applyReverseFrame);
      walkVideo.removeEventListener('loadedmetadata', setWalkRate);
      walkVideo.removeEventListener('ended', finishPlayback);
      idlePause?.kill();
      finishTween?.kill();
      pauseWalk();
      emphasis.style.removeProperty('--red-fill');
      resetWalkFinish();
      walkVideo.pause();
      if (walkVideo.currentTime !== 0) walkVideo.currentTime = 0;
      walker.classList.remove('is-playing');
      walker.style.transform = '';
      workTrack.style.transform = '';
      posterRing?.style.removeProperty('--img-y');
      gsap.set([profile, catalogue], { clearProps: 'transform' });
      started = false;
      clearTimeout(playbackTimeout);
      releaseCeramicHold();
      handoff?.kill();
      earlyReveal?.kill();
      video.pause();
      if (video.currentTime !== 0) video.currentTime = 0;
      video.removeEventListener('loadeddata', renderCeramic);
      video.removeEventListener('timeupdate', revealDotsBeforeEnd);
      video.removeEventListener('ended', finishCeramic);
      video.removeEventListener('error', finishCeramic);
      photo.removeEventListener('load', renderCeramic);
      video.canvas.style.opacity = '';
      photo.style.opacity = particles.length ? '0' : '';
      document.removeEventListener('click', navigate);
      envelopeTransition?.kill();
      gsap.set(envelopeWipe, { clearProps: 'opacity,visibility,clipPath' });
      gsap.ticker.remove(tick);
      if (smooth) smooth.destroy();
      ScrollTrigger.removeEventListener('refreshInit', measure);
      root.classList.remove('sequenced');
      motion.resolve = 1;
      motion.burst = 0;
      motion.fill = 0;
      draw();
    };
  });

  /* ── Lenis-style scroll parallax ── */
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    // Sections safe for parallax (no competing scroll animations)
    const targets = [
      { sel: '#operations .kicker',        speed: 0.9  },
      { sel: '#operations h2',             speed: 0.85 },
      { sel: '#operations h3',             speed: 0.92 },
      { sel: '#operations .lead',          speed: 1.1  },
      { sel: '#skills .kicker',            speed: 0.9  },
      { sel: '#skills h2',                 speed: 0.85 },
      { sel: '#skills .rows > div',        speed: [1.08, 0.94, 1.1, 0.92] },
      { sel: '#education .kicker',         speed: 0.9  },
      { sel: '#education h2',              speed: 0.85 },
      { sel: '#education .rows > div',     speed: [1.08, 0.94, 1.1] },
      { sel: '#engineering .content',      speed: 0.92 },
      { sel: '#engineering figure',        speed: 1.14 },
      { sel: '#contact .kicker',           speed: 0.9  },
      { sel: '#contact h2',               speed: 0.85 },
      { sel: '#contact .email',            speed: 1.08 },
      { sel: '#contact footer',            speed: 0.94 },
    ];

    const triggers = [];
    targets.forEach(({ sel, speed }) => {
      document.querySelectorAll(sel).forEach((el, i) => {
        const s = Array.isArray(speed) ? speed[i % speed.length] : speed;
        const offset = (s - 1) * 120; // px of travel relative to normal scroll
        triggers.push(
          gsap.fromTo(el, { y: -offset }, {
            y: offset,
            ease: 'none',
            scrollTrigger: {
              trigger: el,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            }
          })
        );
      });
    });

    return () => triggers.forEach(t => t.scrollTrigger?.kill());
  });
}
