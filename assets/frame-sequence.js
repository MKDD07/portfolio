/**
 * FrameSequence – drop-in video-like API backed by a WebP image sequence.
 * Wraps a <canvas> element and preloads frames from a folder.
 *
 * Usage:
 *   const seq = new FrameSequence(canvas, 'assets/webp-video/ceramic-study', 240);
 *   seq.play();              // auto-advance at playbackRate
 *   seq.currentTime = 1.5;   // seek
 *
 * Emits the same events the codebase already listens for:
 *   loadeddata, loadedmetadata, ended, seeked, timeupdate, error
 */
class FrameSequence {
  constructor(canvas, folder, totalFrames, fps = 24, filename = frame => 'frame_' + String(frame).padStart(4, '0') + '.webp', loop = false) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this._folder = folder;
    this._totalFrames = totalFrames;
    this._fps = fps;
    this._filename = filename;
    this.loop = loop;
    this._images = new Array(totalFrames);
    this._loaded = 0;
    this._frame = 0;
    this._playing = false;
    this._rafId = 0;
    this._lastTick = 0;
    this.playbackRate = 1;
    this.error = null;
    this.seeking = false;
    this.ended = false;
    this.paused = true;
    this._preload();
  }

  get duration() { return this._totalFrames / this._fps; }
  get readyState() { return this._loaded > 0 ? 4 : 0; }

  isFrameReady(frame) {
    const image = this._images[frame];
    return Boolean(image?.complete && image.naturalWidth);
  }

  get currentTime() { return this._frame / this._fps; }
  set currentTime(t) {
    const frame = Math.max(0, Math.min(this._totalFrames - 1, Math.round(t * this._fps)));
    if (frame === this._frame) { this._emit('seeked'); return; }
    this.seeking = true;
    this._frame = frame;
    this.ended = false;
    this._drawCurrent();
    this.seeking = false;
    this._emit('seeked');
  }

  play() {
    if (this._playing) return Promise.resolve();
    this._playing = true;
    this.paused = false;
    this.ended = false;
    this._lastTick = performance.now();
    this._rafId = requestAnimationFrame(t => this._tick(t));
    return Promise.resolve();
  }

  pause() {
    this._playing = false;
    this.paused = true;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = 0; }
  }

  _tick(now) {
    if (!this._playing) return;
    const delta = (now - this._lastTick) / 1000;
    this._lastTick = now;
    const advance = delta * this.playbackRate * this._fps;
    const next = this._frame + advance;
    if (next >= this._totalFrames - 1) {
      if (this.loop) {
        this._frame = next % (this._totalFrames - 1);
        this._drawCurrent();
        this._emit('timeupdate');
        this._rafId = requestAnimationFrame(t => this._tick(t));
        return;
      }
      this._frame = this._totalFrames - 1;
      this._drawCurrent();
      this.pause();
      this.ended = true;
      this._emit('ended');
      return;
    }
    this._frame = next;
    this._drawCurrent();
    this._emit('timeupdate');
    this._rafId = requestAnimationFrame(t => this._tick(t));
  }

  _drawCurrent() {
    const idx = Math.round(this._frame);
    const img = this._images[idx];
    if (!img || !img.complete || !img.naturalWidth) return;
    const c = this.canvas;
    if (c.width !== img.naturalWidth || c.height !== img.naturalHeight) {
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
    }
    this.ctx.drawImage(img, 0, 0);
    this._emit('frame');
  }

  _preload() {
    // Preload in small batches to avoid hammering the browser
    let i = 0;
    const batch = 8;
    const loadBatch = () => {
      const end = Math.min(i + batch, this._totalFrames);
      for (; i < end; i++) {
        const img = new Image();
        const idx = i;
        img.onload = () => {
          this._loaded++;
          if (this._loaded === 1 || this._loaded === this._totalFrames ||
              idx === Math.round(this._frame)) this._drawCurrent();
          if (this._loaded === 1) {
            this._emit('loadeddata');
            this._emit('loadedmetadata');
          }
        };
        img.onerror = () => { this.error = true; this._emit('error'); };
        this._images[idx] = img;
        img.src = this._folder + '/' + this._filename(idx + 1);
      }
      if (i < this._totalFrames) setTimeout(loadBatch, 16);
    };
    loadBatch();
  }

  _emit(type) {
    this.canvas.dispatchEvent(new Event(type, { bubbles: false }));
  }

  addEventListener(type, fn) { this.canvas.addEventListener(type, fn); }
  removeEventListener(type, fn) { this.canvas.removeEventListener(type, fn); }
}
