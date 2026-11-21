import {
  AdditiveBlending, AmbientLight, AnimationMixer, Box3, CanvasTexture, DirectionalLight, Group,
  LoopOnce, OrthographicCamera, PerspectiveCamera, PointLight, Scene,
  Sprite, SpriteMaterial, SRGBColorSpace, Vector3, WebGLRenderer
} from './three/three.module.js';
import { GLTFLoader } from './three/GLTFLoader.js';
import { clone } from './three/SkeletonUtils.js';

const loader = new GLTFLoader();
let sharedCharacter;

function loadSharedCharacter() {
  sharedCharacter ??= loader.loadAsync(new URL('./3d/character.glb', import.meta.url).href).catch(error => {
    sharedCharacter = undefined;
    throw error;
  });
  return sharedCharacter;
}

export async function loadBlackHoleCharacter(canvas, { projects = false } = {}) {
  const renderer = new WebGLRenderer({ canvas, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
  const scene = new Scene();
  const camera = projects ? new OrthographicCamera(-1, 1, 1, -1, .1, 30)
    : new PerspectiveCamera(38, 1, .1, 30);
  camera.position.z = 5;
  const key = new DirectionalLight(0xffe2c0, 2.4);
  key.position.set(-3, 3, 5);
  const rim = new DirectionalLight(0xff7952, 1.7);
  rim.position.set(2, 1, -3);
  scene.add(new AmbientLight(0xd0ddff, 1.45), key, rim);

  let model, animations;
  try {
    const character = await loadSharedCharacter();
    model = clone(character.scene);
    animations = character.animations;
  } catch (error) {
    renderer.dispose();
    throw error;
  }

  const projectsClip = animations.find(clip => clip.name === 'Projects gesture');
  const fallClips = animations.filter(clip => clip !== projectsClip && !clip.name.startsWith('Skills '));
  const clip = projects ? projectsClip : fallClips.find(clip => /fall|drop/i.test(clip.name))
    ?? fallClips.reduce((longest, clip) => !longest || clip.duration > longest.duration ? clip : longest, null);
  const mixer = new AnimationMixer(model);
  const action = clip && mixer.clipAction(clip).play();
  if (action) {
    if (projects) {
      action.setLoop(LoopOnce, 0);
      action.clampWhenFinished = true;
    }
    action.paused = true;
  }
  mixer.update(0);
  const bounds = action ? measureAnimationBounds(model, mixer, action, clip.duration)
    : new Box3().setFromObject(model);
  if (action && !projects) action.paused = false;
  model.traverse(object => {
    if (object.isSkinnedMesh) object.frustumCulled = false;
  });
  const size = bounds.getSize(new Vector3());
  const subject = new Group();
  const pivot = new Group();
  pivot.position.copy(bounds.getCenter(new Vector3()).negate());
  pivot.add(model);
  subject.add(pivot);
  scene.add(subject);
  const modelSize = Math.max(size.x, size.y, size.z) || 1;
  const leftHand = projects && model.getObjectByName('mixamorigLeftHand');
  const rightHand = projects && model.getObjectByName('mixamorigRightHand');
  const red = getComputedStyle(document.documentElement).getPropertyValue('--red').trim();
  const spell = leftHand && rightHand ? createSpellGlow(red) : null;
  const spellLight = spell ? new PointLight(red, 0, modelSize * 1.1) : null;
  const handPosition = new Vector3();
  const screenPosition = new Vector3();
  if (spell) scene.add(spell, spellLight);
  let progress = 0;
  let frame = 0;
  let previousTime = 0;

  function resize() {
    const { clientWidth: width, clientHeight: height } = canvas;
    if (!width || !height) return;
    const aspect = width / height;
    if (projects) {
      const halfHeight = Math.max(size.y * .72, Math.hypot(size.x, size.z) * .68 / aspect);
      camera.left = -halfHeight * aspect;
      camera.right = halfHeight * aspect;
      camera.bottom = -halfHeight;
      camera.top = halfHeight;
    } else {
      camera.aspect = aspect;
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    placeCharacter();
    if (projects) renderProjects();
    else renderer.render(scene, camera);
  }

  function placeCharacter() {
    if (projects) {
      subject.rotation.y = -.40;
      return;
    }
    const fall = Math.max(0, Math.min(1, (progress - .04) / .89));
    const distance = fall ** 1.2;
    const viewHeight = camera.position.z * Math.tan(camera.fov * Math.PI / 360);
    const viewWidth = viewHeight * camera.aspect;
    subject.position.set(viewWidth * .08, viewHeight * (1.25 - 2.53 * distance), 0);
    subject.rotation.set(.04, -.31, -.13 + .40 * fall);
    const fallWidth = Math.hypot(size.x, size.z) || modelSize;
    subject.scale.setScalar(Math.min(viewHeight * .9 / (size.y || 1), viewWidth * 1.38 / fallWidth));
  }

  function tick(now) {
    if (previousTime) mixer.update(Math.min(.05, (now - previousTime) / 1000));
    previousTime = now;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(tick);
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
  }

  function draw(nextProgress) {
    progress = nextProgress;
    if (projects) {
      renderProjects();
      return;
    }
    const opacity = Math.max(0, Math.min(1, (progress - .035) / .13, (1 - progress) / .13));
    canvas.style.opacity = opacity;
    if (!opacity) {
      stop();
      if (progress <= .035) action?.reset().play();
      return;
    }
    placeCharacter();
    if (!frame) {
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    }
  }

  function renderProjects() {
    if (action) {
      action.time = progress * clip.duration;
      mixer.update(0);
    }
    if (spell) {
      leftHand.getWorldPosition(spell.position);
      rightHand.getWorldPosition(handPosition);
      spell.position.lerp(handPosition, .5);
      spell.position.z += modelSize * .16;
      const buildup = Math.max(0, Math.min(1, (progress - .04) / .51));
      const charge = buildup * buildup * (3 - 2 * buildup);
      const glowSize = modelSize * charge * (.65 + charge * .36);
      spell.visible = charge > 0;
      spell.scale.set(glowSize, glowSize, 1);
      spell.material.opacity = charge;
      spellLight.position.copy(spell.position);
      spellLight.intensity = charge * modelSize ** 2 * .75;
    }
    renderer.render(scene, camera);
  }

  return {
    duration: clip?.duration ?? 0,
    getSpellScreenPoint() {
      if (!spell) return null;
      screenPosition.copy(spell.position).project(camera);
      return { x: (screenPosition.x + 1) / 2, y: (1 - screenPosition.y) / 2 };
    },
    resize,
    draw,
    dispose() {
      stop();
      spell?.material.map.dispose();
      spell?.material.dispose();
      spellLight?.dispose();
      mixer.stopAllAction();
      mixer.uncacheRoot(model);
      // Clones own their bone state. The source model keeps the shared mesh and textures.
      const skeletons = new Set();
      model.traverse(object => {
        if (object.skeleton) skeletons.add(object.skeleton);
      });
      for (const skeleton of skeletons) skeleton.dispose();
      renderer.dispose();
      canvas.style.removeProperty('opacity');
    }
  };
}

function createSpellGlow(red) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const ink = canvas.getContext('2d');
  const center = 96;
  ink.translate(center, center);
  const glow = ink.createRadialGradient(0, 0, 0, 0, 0, center);
  glow.addColorStop(0, '#fff');
  glow.addColorStop(.045, '#fff8eb');
  glow.addColorStop(.105, '#ffbdab');
  glow.addColorStop(.19, '#ff4f39');
  glow.addColorStop(.32, red);
  glow.addColorStop(.57, `color-mix(in srgb, ${red} 28%, transparent)`);
  glow.addColorStop(1, 'transparent');
  ink.fillStyle = glow;
  ink.fillRect(-center, -center, center * 2, center * 2);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return new Sprite(new SpriteMaterial({
    map: texture, blending: AdditiveBlending, transparent: true, depthWrite: false
  }));
}

function measureAnimationBounds(model, mixer, action, duration, poses = Array.from({ length: 25 }, (_, i) => i / 24)) {
  const bounds = new Box3();
  const point = new Vector3();
  for (const pose of poses) {
    action.time = duration * pose;
    mixer.update(0);
    model.updateMatrixWorld(true);
    model.traverse(object => {
      if (!object.isMesh) return;
      const count = object.geometry.attributes.position.count;
      const step = Math.max(1, Math.floor(count / 4000));
      for (let i = 0; i < count; i += step) {
        object.getVertexPosition(i, point);
        bounds.expandByPoint(point.applyMatrix4(object.matrixWorld));
      }
    });
  }
  action.time = 0;
  mixer.update(0);
  return bounds;
}
