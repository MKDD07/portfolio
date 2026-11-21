function createForceBalls(page) {
  if (!window.Matter) return null;

  const { Bodies, Body, Composite, Engine, Events, Runner, Sleeping } = Matter;
  const lane = page.querySelector('.force-balls');
  const content = page.querySelectorAll('.force-intro, .force-track li');
  const engine = Engine.create({ enableSleeping: true });
  const runner = Runner.create();
  const sprites = [1, 'Research', 2, 'Prototypes', 3, 'Systems', 4].map(item => {
    if (typeof item === 'string') {
      const card = document.createElement('span');
      card.className = 'force-ball-card';
      card.textContent = item;
      return card;
    }
    const image = new Image();
    image.src = 'assets/balls/balls_00' + item + '.png';
    image.alt = '';
    image.draggable = false;
    return image;
  });
  const balls = [];
  const floorCategory = 0x0002;
  const allCategories = 0xFFFFFFFF;
  let width = 0;
  let height = 0;
  let requested = 0;
  let lastLaunch = -Infinity;
  let running = false;

  function stop() {
    Runner.stop(runner);
    running = false;
  }

  function reset() {
    stop();
    for (const { body } of balls) Composite.remove(engine.world, body);
    lane.replaceChildren();
    balls.length = 0;
    lastLaunch = -Infinity;
  }

  function start() {
    if (running || height < 24) return;
    if (balls.length >= requested && !balls.some(ball => ball.exiting)) return;
    running = true;
    Runner.run(runner, engine);
  }

  function resize() {
    const frame = page.getBoundingClientRect();
    const contentBottom = Math.max(...Array.from(content, item => item.getBoundingClientRect().bottom));
    const nextWidth = page.clientWidth;
    const nextHeight = Math.max(0, Math.floor(frame.bottom - contentBottom - 8));
    if (width === nextWidth && height === nextHeight) return;
    reset();
    Composite.clear(engine.world, false);
    Engine.clear(engine);
    width = nextWidth;
    height = nextHeight;
    lane.style.height = height + 'px';
    const wall = { isStatic: true, friction: .025 };
    Composite.add(engine.world, [
      Bodies.rectangle(width / 2, height + 32, width + 128, 64, {
        ...wall, collisionFilter: { category: floorCategory, mask: allCategories, group: 0 }
      }),
      Bodies.rectangle(-32, height / 2, 64, height * 2 + 128, wall),
      Bodies.rectangle(width + 32, height / 2, 64, height * 2 + 128, wall)
    ]);
    start();
  }

  function roll(body, radius, x, y) {
    Body.setVelocity(body, { x, y });
    Body.setAngularVelocity(body, x / radius);
  }

  function render({ timestamp }) {
    const index = sprites.findIndex((_, index) => !balls.some(ball => ball.index === index));
    const radius = Math.min(width / 23, height * .27, 82);
    const entryX = width - radius - 1;
    const entryClear = balls.every(ball => Math.hypot(entryX - ball.body.position.x,
      radius - ball.body.position.y) >= radius + ball.radius);
    const sinceLaunch = timestamp - lastLaunch;

    if (index >= 0 && index < requested && sinceLaunch >= (entryClear ? 220 : 450)) {
      const body = Bodies.circle(entryX, radius, radius, {
        restitution: .94, friction: .015, frictionAir: .016
      });
      const sprite = sprites[index];
      sprite.style.setProperty('--ball-size', radius * 2 + 'px');
      Composite.add(engine.world, body);
      roll(body, radius, -width * (.020 - index * .0031), 2);
      balls.push({ body, sprite, radius, index, exiting: false });
      lane.append(sprite);
      lastLaunch = timestamp;
    }

    for (let i = balls.length - 1; i >= 0; i--) {
      const { body, sprite, radius, exiting } = balls[i];
      if (exiting && body.position.x - radius >= width) {
        Composite.remove(engine.world, body);
        sprite.remove();
        balls.splice(i, 1);
        continue;
      }
      sprite.style.transform = `translate3d(${body.position.x - radius}px, ${body.position.y - radius}px, 0) rotate(${body.angle}rad)`;
    }

    if (!balls.some(ball => ball.exiting) && balls.length >= requested &&
        (!balls.length || timestamp - lastLaunch > 5500)) stop();
  }

  Events.on(engine, 'afterUpdate', render);
  resize();

  return {
    resize,
    update(time) {
      const count = Math.max(0, Math.min(sprites.length, 1 + Math.floor((time - .3) / .92)));
      if (count === requested) return;
      requested = count;
      for (const ball of balls) {
        const exiting = ball.index >= requested;
        if (ball.exiting === exiting) continue;
        const { body, radius } = ball;
        ball.exiting = exiting;
        Sleeping.set(body, false);
        body.collisionFilter.mask = exiting ? floorCategory : allCategories;
        if (!exiting && body.position.x > width - radius - 1) {
          Body.setPosition(body, { x: width - radius - 1, y: body.position.y });
        }
        roll(body, radius, exiting ? Math.max(8, width * .028) : -width * .012,
          -Math.sqrt(height) * .42);
        lastLaunch = engine.timing.timestamp;
      }
      start();
    },
    destroy() {
      reset();
      Events.off(engine, 'afterUpdate', render);
      lane.style.removeProperty('height');
    }
  };
}
