(() => {
  const stage = document.querySelector('#kalakriti .work-gallery .stage');
  if (!stage) return;
  const camera = stage.querySelector('.camera');
  const parallaxWrap = stage.querySelector('.parallax-wrap');
  const ring = stage.querySelector('.ring');

  const POSTERS = [
    {
      tag: '01 / NØR',
      title: 'Less Noise',
      img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80'
    },
    {
      tag: '02 / AURA',
      title: 'Modern Form',
      img: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=600&q=80'
    },
    {
      tag: '03 / MONO',
      title: 'Concrete Light',
      img: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=600&q=80'
    },
    {
      tag: '04 / ARCHV',
      title: 'Red Study',
      img: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80'
    },
    {
      tag: '05 / HORIZON',
      title: 'Open Air',
      img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80'
    },
    {
      tag: '06 / STUDIO',
      title: 'Shadow Line',
      img: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=600&q=80'
    },
    {
      tag: '07 / EDITION',
      title: 'Glass Facade',
      img: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80'
    },
    {
      tag: '08 / ATELIER',
      title: 'Still Motion',
      img: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80'
    },
    {
      tag: '09 / FORMA',
      title: 'Brutalist Sky',
      img: 'https://images.unsplash.com/photo-1511818966892-d7d671e672a2?auto=format&fit=crop&w=600&q=80'
    },
    {
      tag: '10 / VOGUE',
      title: 'Silhouette',
      img: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=600&q=80'
    }
  ];


  const COUNT = POSTERS.length * 2;
  const COLS = 5;
  const ROWS = Math.ceil(COUNT / COLS);
  const STEP = 360 / COUNT;

  ring.innerHTML = Array.from({ length: COUNT }, (_, i) => {
    const item = POSTERS[i % POSTERS.length];
    return `
      <div class="card">
        <div class="card-face">
          <img src="${item.img}" alt="${item.title}" loading="lazy" decoding="async">
          <div class="card-meta">
            <small>${item.tag}</small>
            <h2>${item.title}</h2>
          </div>
        </div>
        <div class="card-back" aria-hidden="true">
          <img src="${item.img}" alt="" loading="lazy" decoding="async">
          <div class="card-meta">
            <small>${item.tag}</small>
            <h2>${item.title}</h2>
          </div>
        </div>
      </div>
    `;
  }).join('');


  const cards = Array.from(ring.children);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

  stage.addEventListener('pointermove', event => {
    if (reduceMotion.matches || !window.gsap) return;
    const box = stage.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - .5;
    const y = (event.clientY - box.top) / box.height - .5;
    gsap.to(parallaxWrap, { rotationY: x * 12, rotationX: -y * 10, duration: .3, overwrite: true });
  });
  stage.addEventListener('pointerleave', () => {
    if (window.gsap) gsap.to(parallaxWrap, { rotationY: 0, rotationX: 0, duration: .3, overwrite: true });
  });
  reduceMotion.addEventListener('change', () => {
    if (!reduceMotion.matches || !window.gsap) return;
    gsap.killTweensOf(parallaxWrap);
    gsap.set(parallaxWrap, { clearProps: 'transform' });
  });

  window.createPosterTimeline = () => {
    function geometry() {
      const width = stage.clientWidth || 1;
      const height = stage.clientHeight || 1;
      const cardWidth = ring.offsetWidth || 1;
      const cardHeight = ring.offsetHeight || cardWidth * 4 / 3;
      const radius = cardWidth * COUNT * 1.08 / (2 * Math.PI);
      const perspective = Math.max(700, radius * 2.1);
      stage.style.perspective = perspective + 'px';
      const gapX = cardWidth * 1.16;
      const gapY = cardHeight * 1.10;
      const gridScale = Math.min(width * .96 / (gapX * COLS), height * .94 / (gapY * ROWS));
      const gridDepth = Math.max(0, perspective * (1 / gridScale - 1));
      const ringDepth = Math.max(radius * 1.1,
        perspective * ((radius + cardWidth * .58) / (width * .48) - 1),
        radius + perspective * (cardHeight / (height * .76) - 1));
      const exitX = width * .6 * (perspective + ringDepth + radius) / perspective + cardWidth * 1.8;
      const ringTilt = -Math.min(27, 11 + height * .023);
      return { height, radius, gapX, gapY, gridDepth, ringDepth, ringTilt, exitX };
    }

    const entrance = gsap.timeline();
    const gridOffsetY = () => -geometry().height * .055;
    entrance.set(camera, { z: () => -geometry().gridDepth, y: gridOffsetY }, 0);
    entrance.set(ring, { rotationX: 48, rotationZ: -20, rotationY: 0 }, 0);
    const timeline = gsap.timeline({ defaults: { ease: 'none' } });
    timeline.fromTo(camera, { z: () => -geometry().gridDepth, y: gridOffsetY },
      { z: () => -geometry().ringDepth, y: () => -geometry().height * .04,
        duration: .25, ease: 'power2.inOut', immediateRender: false }, 0);
    timeline.fromTo(ring, { rotationX: 48, rotationZ: -20, rotationY: 0 },
      { rotationX: () => geometry().ringTilt, rotationZ: 0,
        duration: .25, ease: 'power2.inOut', immediateRender: false }, 0);
    timeline.to(ring, { rotationY: -360, duration: .43 }, .25);
    timeline.to(ring, { rotationX: () => geometry().ringTilt - 3, rotationZ: -6,
      duration: .32, ease: 'power1.inOut' }, .68);

    cards.forEach((card, i) => {
      const angle = i * STEP * Math.PI / 180;
      const column = i % COLS;
      const row = Math.floor(i / COLS);
      const gridX = () => (column - (COLS - 1) / 2) * geometry().gapX;
      const gridY = () => (row - (ROWS - 1) / 2) * geometry().gapY;
      entrance.fromTo(card, {
        x: gridX, y: () => gridY() - geometry().height * 3,
        z: 0, rotationY: 0, rotationX: 0, rotationZ: 0, opacity: 0
      }, {
        y: gridY, opacity: 1, duration: .16, ease: 'power2.out'
      }, row * .028 + column * .012);
      timeline.fromTo(card, {
        x: gridX, y: gridY,
        z: 0, rotationY: 0, rotationX: 0, rotationZ: 0, opacity: 1
      }, {
        x: () => Math.sin(angle) * geometry().radius,
        y: 0, z: () => Math.cos(angle) * geometry().radius,
        rotationY: i * STEP, rotationX: [1.4, -1, .6, -1.2, .8][i % 5],
        rotationZ: [-1.2, .8, -.5, 1.1, .2][i % 5],
        duration: .23, ease: 'power2.inOut', immediateRender: false
      }, i * .002);

      const order = (Math.floor(COUNT / 4) - i + COUNT) % COUNT;
      const start = .68 + order * .0095;
      timeline.to(card, {
        x: () => geometry().exitX,
        y: () => geometry().height * (-.32 + Math.sin(order * .55) * .18 - order * .012),
        z: () => geometry().radius * (-.25 + Math.cos(order * .5) * .45),
        rotationX: 52 + (order % 4) * 7, rotationY: 18 - (order % 5) * 9,
        rotationZ: -26 + (order % 3) * 10, duration: .14, ease: 'power2.in'
      }, start);
      timeline.to(card, { opacity: 0, duration: .049, ease: 'power1.in' }, start + .091);
    });
    return { entrance, timeline };
  };
})();
