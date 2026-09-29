/**
 * ═══════════════════════════════════════════════════════════════════
 *  REACTBITS INTERACTIVE ENGINE (reactbits.dev signature animations)
 *  1. ClickSpark     — Radial neon spark burst on every click/tap
 *  2. AuroraHero     — Interactive Midnight Aurora + Constellation Canvas
 *  3. SpotlightCard  — Cursor-tracking radial spotlight glow on cards
 *  4. TiltedCard     — 3D perspective tilt + glare on Bento & Feed cards
 *  5. DecryptedText  — Cyber/Matrix text scramble reveal on hover/load
 *  6. MagnetButton   — Spring magnetic pull on primary action buttons
 *  7. CountUp        — Animated number counter for live hero metrics
 * ═══════════════════════════════════════════════════════════════════
 */

const ReactBits = (function() {
  const SPARK_COLORS = ['#8b5cf6', '#10b981', '#a78bfa', '#f59e0b', '#ec4899'];
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+<>?';

  // 1. ClickSpark — Burst 12 neon sparks at every click/tap point
  function initClickSpark() {
    if (document.getElementById('reactbits-clickspark-canvas')) return;
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
      const count = 12;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = 2.8 + Math.random() * 5.0;
        sparks.push({
          x: e.clientX,
          y: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          len: 9 + Math.random() * 11,
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
        ctx.shadowBlur = 10;
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

  // 2. AuroraHero — Interactive Midnight Aurora + Constellation Background Canvas
  function initAuroraHero() {
    const canvas = document.getElementById('landing-aurora-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    let mouse = { x: width / 2, y: height / 3 };

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    window.addEventListener('pointermove', (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });

    const orbs = [
      { x: width * 0.25, y: height * 0.25, r: 320, color: 'rgba(139, 92, 246, 0.16)', vx: 0.4, vy: 0.25 },
      { x: width * 0.75, y: height * 0.35, r: 290, color: 'rgba(16, 185, 129, 0.11)', vx: -0.35, vy: 0.3 },
      { x: width * 0.5, y: height * 0.7, r: 350, color: 'rgba(168, 85, 247, 0.12)', vx: 0.25, vy: -0.35 }
    ];

    const stars = Array.from({ length: 64 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.38,
      vy: (Math.random() - 0.5) * 0.38,
      size: Math.random() * 1.9 + 0.6,
      alpha: Math.random() * 0.65 + 0.2
    }));

    function renderAurora() {
      const landingScreen = document.getElementById('landing-screen');
      if (!landingScreen || !landingScreen.classList.contains('active')) {
        requestAnimationFrame(renderAurora);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      // Draw drifting aurora nebula orbs
      orbs.forEach((orb) => {
        orb.x += orb.vx;
        orb.y += orb.vy;
        if (orb.x < 0 || orb.x > width) orb.vx *= -1;
        if (orb.y < 0 || orb.y > height) orb.vy *= -1;

        const grad = ctx.createRadialGradient(orb.x, orb.y, 10, orb.x, orb.y, orb.r);
        grad.addColorStop(0, orb.color);
        grad.addColorStop(1, 'rgba(9, 9, 13, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw cursor spotlight aura
      const cursorGrad = ctx.createRadialGradient(mouse.x, mouse.y, 5, mouse.x, mouse.y, 240);
      cursorGrad.addColorStop(0, 'rgba(139, 92, 246, 0.13)');
      cursorGrad.addColorStop(1, 'rgba(9, 9, 13, 0)');
      ctx.fillStyle = cursorGrad;
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, 240, 0, Math.PI * 2);
      ctx.fill();

      // Draw interactive constellation nodes
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.x += s.vx;
        s.y += s.vy;
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;
        if (s.y < 0) s.y = height;
        if (s.y > height) s.y = 0;

        ctx.fillStyle = `rgba(216, 180, 254, ${s.alpha})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        ctx.fill();

        // Connect nearby stars & cursor
        const dxMouse = s.x - mouse.x;
        const dyMouse = s.y - mouse.y;
        const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);
        if (distMouse < 135) {
          ctx.strokeStyle = `rgba(139, 92, 246, ${(1 - distMouse / 135) * 0.35})`;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }

      requestAnimationFrame(renderAurora);
    }

    renderAurora();
  }

  // 3. SpotlightCard & 4. TiltedCard — Mouse tracking spotlight + 3D perspective tilt
  function initSpotlightAndTilt() {
    document.addEventListener('pointermove', (e) => {
      document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
      document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);

      const card = e.target.closest('.bento-card, .auth-portal-card, .feed-card, .rsvp-card, .vault-content, .checked-in-card');
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);

      if (window.innerWidth > 768 && (card.classList.contains('bento-card') || card.classList.contains('feed-card'))) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const maxTilt = card.classList.contains('bento-card') ? 6.0 : 4.2;
        const rotateX = ((y - centerY) / centerY) * -maxTilt;
        const rotateY = ((x - centerX) / centerX) * maxTilt;
        card.style.transform = `perspective(800px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-3px)`;
      }
    });

    document.addEventListener('pointerout', (e) => {
      const card = e.target.closest('.bento-card, .feed-card');
      if (card && !card.contains(e.relatedTarget)) {
        card.style.transform = '';
      }
    });
  }

  // 5. DecryptedText — Cyber scramble text reveal
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
          if (char === ' ' || char.codePointAt(0) > 255) return char;
          if (index < iteration) return original[index];
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        })
        .join('');

      if (iteration >= original.length) {
        clearInterval(interval);
        el.textContent = original;
        el.dataset.scrambling = 'false';
      }
      iteration += 0.6;
    }, 24);
  }

  function initDecryptedText() {
    document.querySelectorAll('.decrypted-text, .logo, .logo-small, .subtitle').forEach(el => {
      scrambleElement(el);
      el.addEventListener('pointerenter', () => scrambleElement(el));
    });
  }

  // 6. MagnetButton — Magnetic pull on key CTA buttons
  function initMagnetButtons() {
    const selector = '.btn-magnet, .btn-override, .btn-primary, .legend-toggle-btn, #locate-me-btn';
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

  // 7. CountUp — Smooth count-up animation for hero stats
  function initCountUp() {
    document.querySelectorAll('[data-countup]').forEach(el => {
      const target = parseInt(el.dataset.countup, 10) || 100;
      const suffix = el.dataset.suffix || '';
      let current = 0;
      const step = Math.max(1, Math.ceil(target / 36));
      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        el.textContent = current + suffix;
      }, 28);
    });
  }

  function refresh() {
    initDecryptedText();
    initCountUp();
  }

  function init() {
    initClickSpark();
    initAuroraHero();
    initSpotlightAndTilt();
    initDecryptedText();
    initMagnetButtons();
    initCountUp();
  }

  return { init, refresh, scrambleElement };
})();

document.addEventListener('DOMContentLoaded', () => ReactBits.init());
