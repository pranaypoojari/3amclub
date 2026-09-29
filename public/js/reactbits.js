/**
 * ═══════════════════════════════════════════════════════════════════
 *  REACTBITS INTERACTIVE ENGINE (reactbits.dev signature animations)
 *  1. ClickSpark     — Radial neon spark burst on every click/tap
 *  2. SpotlightCard  — Cursor-tracking radial spotlight glow on cards
 *  3. TiltedCard     — 3D perspective tilt + glare on interactive cards
 *  4. DecryptedText  — Cyber/Matrix text scramble reveal on hover/load
 *  5. MagnetButton   — Spring magnetic pull on primary action buttons
 *  6. AuroraCursor   — Subtle ambient glow trailing the cursor
 * ═══════════════════════════════════════════════════════════════════
 */

const ReactBits = (function() {
  const SPARK_COLORS = ['#ff8c00', '#00ff9d', '#c44dff', '#ff2442', '#ffab00'];
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+<>?';

  // 1. ClickSpark — Burst 10 neon sparks at every click/tap point
  function initClickSpark() {
    const canvas = document.createElement('canvas');
    canvas.id = 'reactbits-clickspark-canvas';
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    let sparks = [];

    window.addEventListener('pointerdown', (e) => {
      const count = 10;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = 2.5 + Math.random() * 4.5;
        sparks.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          len: 8 + Math.random() * 10,
          alpha: 1,
          color: SPARK_COLORS[i % SPARK_COLORS.length]
        });
      }
    });

    function animateSparks() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      sparks = sparks.filter(s => s.alpha > 0.02);
      sparks.forEach(s => {
        ctx.save();
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = s.alpha;
        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 8;
        ctx.shadowColor = s.color;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x - s.vx * (s.len * 0.25), s.y - s.vy * (s.len * 0.25));
        ctx.stroke();
        ctx.restore();

        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.92;
        s.vy *= 0.92;
        s.alpha *= 0.88;
      });
      requestAnimationFrame(animateSparks);
    }
    animateSparks();
  }

  // 2. SpotlightCard & 3. TiltedCard — Mouse tracking spotlight + 3D perspective tilt
  function initSpotlightAndTilt() {
    document.addEventListener('pointermove', (e) => {
      // Update global aurora cursor follower
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);

      const card = e.target.closest('.feed-card, .rsvp-card, .vault-content, .checked-in-card');
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);

      // Subtle 3D tilt for feed cards on desktop
      if (window.innerWidth > 768 && card.classList.contains('feed-card')) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -4.5;
        const rotateY = ((x - centerX) / centerX) * 4.5;
        card.style.transform = `perspective(700px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`;
      }
    });

    document.addEventListener('pointerout', (e) => {
      const card = e.target.closest('.feed-card');
      if (card && !card.contains(e.relatedTarget)) {
        card.style.transform = '';
      }
    });
  }

  // 4. DecryptedText — Cyber scramble text reveal
  function scrambleElement(el) {
    if (!el || el.dataset.scrambling === 'true') return;
    const original = el.dataset.originalText || el.textContent;
    el.dataset.originalText = original;
    el.dataset.scrambling = 'true';

    let iteration = 0;
    const interval = setInterval(() => {
      el.textContent = original
        .split('')
        .map((char, index) => {
          if (char === ' ' || char.codePointAt(0) > 255) return char; // Keep spaces & emojis intact
          if (index < iteration) return original[index];
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        })
        .join('');

      if (iteration >= original.length) {
        clearInterval(interval);
        el.textContent = original;
        el.dataset.scrambling = 'false';
      }
      iteration += 1 / 2;
    }, 28);
  }

  function initDecryptedText() {
    // Scramble main logos & titles on load
    document.querySelectorAll('.logo, .logo-small, .subtitle, #panel-current-title').forEach(el => {
      scrambleElement(el);
      el.addEventListener('pointerenter', () => scrambleElement(el));
    });
  }

  // 5. MagnetButton — Magnetic pull on key CTA buttons
  function initMagnetButtons() {
    const selector = '.btn-override, .btn-primary, .legend-toggle-btn, #locate-me-btn';
    document.addEventListener('pointermove', (e) => {
      if (window.innerWidth <= 768) return;
      const btn = e.target.closest(selector);
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const dx = (e.clientX - (rect.left + rect.width / 2)) * 0.22;
      const dy = (e.clientY - (rect.top + rect.height / 2)) * 0.22;
      btn.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    });

    document.addEventListener('pointerout', (e) => {
      const btn = e.target.closest(selector);
      if (btn && !btn.contains(e.relatedTarget)) {
        btn.style.transform = '';
      }
    });
  }

  function refresh() {
    initDecryptedText();
  }

  function init() {
    initClickSpark();
    initSpotlightAndTilt();
    initDecryptedText();
    initMagnetButtons();
  }

  return { init, refresh, scrambleElement };
})();

document.addEventListener('DOMContentLoaded', () => ReactBits.init());
