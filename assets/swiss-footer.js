/**
 * Swiss Editorial Portfolio Footer Interactivity & GSAP Choreography
 */
(function () {
  'use strict';

  /* ----------------------------------------------------------------------
   * 1. LIVE GURGAON LOCAL TIME (IST — Asia/Kolkata)
   * ---------------------------------------------------------------------- */
  function initFooterClock() {
    const clockEl = document.getElementById('footerLiveClock');
    if (!clockEl) return;

    const updateClock = () => {
      try {
        const now = new Date();
        const formatted = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }).format(now);
        clockEl.textContent = `${formatted.toUpperCase()} IST`;
      } catch (e) {
        const now = new Date();
        clockEl.textContent = `${now.toLocaleTimeString()} IST`;
      }
    };

    updateClock();
    setInterval(updateClock, 1000);
  }

  /* ----------------------------------------------------------------------
   * 2. GSAP-ANIMATED TOAST NOTIFICATION
   * ---------------------------------------------------------------------- */
  let toastTimeout = null;
  function showToast(message) {
    const container = document.getElementById('toastContainer');
    const msgEl = document.getElementById('toastMessage');
    if (!container || !msgEl) return;

    msgEl.textContent = message;

    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }

    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf(container);
      gsap.fromTo(
        container,
        { y: 18, opacity: 0, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.42,
          ease: 'power3.out',
        }
      );

      toastTimeout = setTimeout(() => {
        gsap.to(container, {
          y: 12,
          opacity: 0,
          scale: 0.96,
          duration: 0.35,
          ease: 'power2.in',
        });
      }, 2400);
    } else {
      container.style.opacity = '1';
      toastTimeout = setTimeout(() => {
        container.style.opacity = '0';
      }, 2400);
    }
  }

  /* ----------------------------------------------------------------------
   * 3. RELIABLE CLIPBOARD HELPER
   * ---------------------------------------------------------------------- */
  function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) {}

    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      textArea.style.left = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      return copied;
    } catch (err) {
      console.warn('Clipboard copy fallback failed:', err);
      return false;
    }
  }

  /* ----------------------------------------------------------------------
   * 4. GSAP ENTRANCE CHOREOGRAPHY TIMELINE
   * ---------------------------------------------------------------------- */
  let entranceTimeline = null;

  function playEntranceChoreography() {
    if (typeof gsap === 'undefined') return;

    try {
      if (entranceTimeline) {
        entranceTimeline.kill();
      }

      gsap.set('.gsap-top-item', { y: -14, opacity: 0 });
      gsap.set('.gsap-hero-word', { yPercent: 115, opacity: 0 });
      gsap.set('.gsap-contact-item', { y: 26, opacity: 0 });
      gsap.set('.gsap-right-item', { y: 22, opacity: 0 });
      gsap.set('.gsap-social-item', { y: 18, opacity: 0 });
      gsap.set('#footerDivider', { scaleX: 0, transformOrigin: 'left center' });
      gsap.set('.gsap-bottom-item', { y: 18, opacity: 0 });

      entranceTimeline = gsap.timeline({
        defaults: { ease: 'power4.out' },
      });

      // 1. Top eyebrow & metadata
      entranceTimeline.to('.gsap-top-item', {
        y: 0,
        opacity: 1,
        duration: 0.75,
        stagger: 0.08,
        ease: 'power3.out',
      });

      // 2. Masked headline reveal ("Get in" & "touch.")
      entranceTimeline.to(
        '.gsap-hero-word',
        {
          yPercent: 0,
          opacity: 1,
          duration: 1.05,
          stagger: 0.12,
          ease: 'power4.out',
        },
        '-=0.45'
      );

      // 3. Email CTA & Phone number
      entranceTimeline.to(
        '.gsap-contact-item',
        {
          y: 0,
          opacity: 1,
          duration: 0.85,
          stagger: 0.1,
          ease: 'power3.out',
        },
        '-=0.65'
      );

      // 4. Right column studio note & social links
      entranceTimeline.to(
        '.gsap-right-item',
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          ease: 'power3.out',
        },
        '-=0.72'
      );

      entranceTimeline.to(
        '.gsap-social-item',
        {
          y: 0,
          opacity: 1,
          duration: 0.72,
          stagger: 0.07,
          ease: 'power3.out',
        },
        '-=0.58'
      );

      // 5. Full-width hairline divider draws left-to-right
      entranceTimeline.to(
        '#footerDivider',
        {
          scaleX: 1,
          duration: 0.95,
          ease: 'power3.inOut',
        },
        '-=0.55'
      );

      // 6. Bottom utility bar items
      entranceTimeline.to(
        '.gsap-bottom-item',
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.08,
          ease: 'power3.out',
        },
        '-=0.52'
      );
    } catch (err) {
      console.error('GSAP footer entrance error:', err);
    }
  }

  /* ----------------------------------------------------------------------
   * 5. MAGNETIC BUTTON PHYSICS (Powered by GSAP quickTo)
   * ---------------------------------------------------------------------- */
  function initMagneticButtons() {
    if (typeof gsap === 'undefined') return;
    const isTouchDevice = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    if (isTouchDevice) return;

    const footer = document.getElementById('contact');
    if (!footer) return;

    const magnets = footer.querySelectorAll('.magnetic-btn');
    magnets.forEach((btn) => {
      const xTo = gsap.quickTo(btn, 'x', { duration: 0.55, ease: 'elastic.out(1, 0.45)' });
      const yTo = gsap.quickTo(btn, 'y', { duration: 0.55, ease: 'elastic.out(1, 0.45)' });

      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const relX = e.clientX - (rect.left + rect.width / 2);
        const relY = e.clientY - (rect.top + rect.height / 2);
        const strength = 0.28;
        xTo(relX * strength);
        yTo(relY * strength);
      });

      btn.addEventListener('mouseleave', () => {
        xTo(0);
        yTo(0);
      });
    });
  }

  /* ----------------------------------------------------------------------
   * 6. INTERACTIVE BUTTONS & FEEDBACK
   * ---------------------------------------------------------------------- */
  function initFooterInteractions() {
    // Replay GSAP button
    const replayBtn = document.getElementById('footerReplayBtn');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        playEntranceChoreography();
      });
    }

    // Copy Email Pill button
    const copyEmailBtn = document.getElementById('footerCopyEmailBtn');
    const copyEmailLabel = document.getElementById('footerCopyEmailLabel');
    if (copyEmailBtn) {
      copyEmailBtn.addEventListener('click', () => {
        const email = copyEmailBtn.getAttribute('data-copy') || 'mkmkataria@gmail.com';
        copyTextToClipboard(email);
        showToast('Email copied — ' + email);

        if (copyEmailLabel) {
          copyEmailLabel.textContent = 'Copied ✓';
          setTimeout(() => {
            copyEmailLabel.textContent = 'Copy';
          }, 2000);
        }
      });
    }

    // Phone link click (copies number & shows feedback while allowing tel:)
    const phoneLink = document.getElementById('footerPhoneLink');
    if (phoneLink) {
      phoneLink.addEventListener('click', () => {
        const phone = phoneLink.getAttribute('data-copy') || '+91 78272 32156';
        copyTextToClipboard(phone);
        showToast('Phone copied — ' + phone);
      });
    }

    // Download Résumé button
    const resumeBtn = document.getElementById('footerResumeBtn');
    if (resumeBtn) {
      resumeBtn.addEventListener('click', () => {
        showToast('Downloading Mohit_Resume.pdf...');
      });
    }

    // Back to Top button
    const backToTopBtn = document.getElementById('footerBackToTopBtn');
    if (backToTopBtn) {
      backToTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const topEl = document.getElementById('intro') || document.body;
        topEl.scrollIntoView({ behavior: 'smooth' });
        showToast('Back at top');
      });
    }
  }

  /* ----------------------------------------------------------------------
   * 7. SCROLLTRIGGER HOOK
   * ---------------------------------------------------------------------- */
  function initScrollTriggerHook() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      playEntranceChoreography();
      return;
    }

    ScrollTrigger.create({
      trigger: '#contact',
      start: 'top 75%',
      onEnter: () => playEntranceChoreography(),
      once: false,
    });
  }

  /* ----------------------------------------------------------------------
   * 8. 3D CHARACTER (BOTTOM LEFT, LOOKING ANIMATION FROM LOOKING.FBX)
   * ---------------------------------------------------------------------- */
  function initFooterCharacter() {
    const canvas = document.querySelector('.footer-character');
    if (!canvas) return;

    import('./black-hole-character.js')
      .then((module) => {
        module.loadFooterCharacter(canvas, { useLooking: true });
      })
      .catch((err) => console.warn('Could not load footer character:', err));
  }

  /* ----------------------------------------------------------------------
   * 9. BOOTSTRAP
   * ---------------------------------------------------------------------- */
  document.addEventListener('DOMContentLoaded', () => {
    initFooterClock();
    initFooterInteractions();
    initMagneticButtons();
    initScrollTriggerHook();
    initFooterCharacter();
  });
})();
