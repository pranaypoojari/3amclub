(function() {
  let sessionId = localStorage.getItem('3am_session_id') || null;
  let accessToken = localStorage.getItem('3am_access_token') || null;
  let refreshToken = localStorage.getItem('3am_refresh_token') || null;
  let refreshTimer = null;
  let myOwl = null;
  let allOwls = [];
  let allRides = [];
  let allHangouts = [];
  let allConfessions = [];
  let allMessages = [];
  let clinkedSet = new Set();
  let mutualSet = new Set();
  let followingSet = new Set();
  let pendingSet = new Set();

  let currentPageIndex = 0; // 0: Home, 1: Search Map, 2: Dive In, 3: Messages, 4: Profile
  let currentHomeFilter = 'all'; // all | rides | hangouts | wall
  let currentLegendFilter = 'all';
  let activeChatOwl = null;
  let inRequestsView = false;
  let dmSearchQuery = '';

  let audioContext = null;
  let brownNoiseNode = null;
  let rainGain = null;
  const lofiAudio = new Audio('https://streams.ilovemusic.de/iloveradio17.mp3');
  lofiAudio.loop = true;

  const screens = {
    landing: document.getElementById('landing-screen'),
    vault: document.getElementById('vault-screen'),
    club: document.getElementById('club-screen')
  };

  function trackEvent(eventName, props = {}) {
    try {
      if (typeof window.va === 'function') {
        window.va('event', { name: eventName, ...props });
      }
    } catch (_) {}
  }

  const cityCoords = {
    'thane': { lat: 19.2183, lng: 72.9781 },
    'navi mumbai': { lat: 19.0330, lng: 73.0297 },
    'mumbai': { lat: 19.0760, lng: 72.8777 },
    'pune': { lat: 18.5204, lng: 73.8567 },
    'bangalore': { lat: 12.9716, lng: 77.5946 },
    'bengaluru': { lat: 12.9716, lng: 77.5946 },
    'delhi': { lat: 28.6139, lng: 77.2090 },
    'hyderabad': { lat: 17.3850, lng: 78.4867 },
    'chennai': { lat: 13.0827, lng: 80.2707 },
    'kolkata': { lat: 22.5726, lng: 88.3639 }
  };

  function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }
  window.__showToast = showToast;

  function updateHeaderUserBadge() {
    const badge = document.getElementById('header-user-badge');
    const logoutBtn = document.getElementById('btn-header-logout');
    const stripBtn = document.getElementById('strip-create-profile-btn');
    const navExploreBtn = document.getElementById('nav-explore-app');

    if (myOwl && myOwl.alias) {
      if (badge) {
        badge.textContent = `👤 @${myOwl.alias}`;
        badge.style.borderColor = 'rgba(16,185,129,0.42)';
        badge.style.color = '#6ee7b7';
      }
      if (logoutBtn) logoutBtn.classList.remove('hidden');
      if (stripBtn) {
        stripBtn.textContent = `✓ Profile Ready (@${myOwl.alias})`;
      }
      if (navExploreBtn) {
        navExploreBtn.textContent = `⚡ Back to Radar (@${myOwl.alias})`;
      }
    } else {
      if (badge) {
        badge.textContent = '⚡ Create Profile';
        badge.style.borderColor = 'rgba(139,92,246,0.45)';
        badge.style.color = '#ddd6fe';
      }
      if (logoutBtn) logoutBtn.classList.add('hidden');
      if (stripBtn) {
        stripBtn.textContent = '🦉 Create Profile / Log In';
      }
      if (navExploreBtn) {
        navExploreBtn.textContent = '🔍 Explore App';
      }
    }
  }

  function openLandingAuthPortal(mode = 'register') {
    if (screens.club) screens.club.classList.remove('active');
    if (screens.vault) screens.vault.classList.remove('active');
    if (screens.landing) screens.landing.classList.add('active');
    const tabRegister = document.getElementById('tab-auth-register');
    const tabLogin = document.getElementById('tab-auth-login');
    if (mode === 'login' && tabLogin) {
      tabLogin.click();
    } else if (tabRegister) {
      tabRegister.click();
    }
    const authCard = document.getElementById('auth-portal-card');
    if (authCard) {
      setTimeout(() => authCard.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
    }
  }
  window.__openCreateProfilePortal = openLandingAuthPortal;

  function saveAuthSession(data) {
    if (data.accessToken) {
      accessToken = data.accessToken;
      localStorage.setItem('3am_access_token', accessToken);
    }
    if (data.refreshToken) {
      refreshToken = data.refreshToken;
      localStorage.setItem('3am_refresh_token', refreshToken);
    }
    if (data.user) {
      myOwl = data.user;
      if (data.user.sessionId) {
        sessionId = data.user.sessionId;
        localStorage.setItem('3am_session_id', sessionId);
      }
      updateHeaderUserBadge();
    }
    scheduleTokenRefresh();
  }

  function clearAuthSession() {
    accessToken = null;
    refreshToken = null;
    sessionId = null;
    myOwl = null;
    localStorage.removeItem('3am_access_token');
    localStorage.removeItem('3am_refresh_token');
    localStorage.removeItem('3am_session_id');
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    updateHeaderUserBadge();
  }

  async function attemptSilentRefresh() {
    if (!refreshToken) return false;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data && data.accessToken) {
        saveAuthSession(data);
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  function scheduleTokenRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    // Rotate Access + Refresh tokens every 12 minutes (before 15-min access token expiry)
    refreshTimer = setInterval(() => {
      attemptSilentRefresh();
    }, 12 * 60 * 1000);
  }

  async function logoutAndReturnToLanding() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, sessionId })
      });
    } catch (_) {}
    clearAuthSession();
    openLandingAuthPortal('register');
    showToast('👋 Logged out safely. Create a profile or log in anytime!');
    trackEvent('user_logout');
  }
  window.__logout3AM = logoutAndReturnToLanding;
  window.__manualRefreshJWT = async function() {
    const ok = await attemptSilentRefresh();
    if (ok) {
      showToast('🔄 JWT Access Token + Refresh Token rotated!');
    } else {
      showToast('⚠️ Please log in with an account to rotate JWT tokens.');
    }
  };

  function setupLandingAndAuth() {
    const tabRegister = document.getElementById('tab-auth-register');
    const tabLogin = document.getElementById('tab-auth-login');
    const formRegister = document.getElementById('landing-register-form');
    const formLogin = document.getElementById('landing-login-form');
    const errorBanner = document.getElementById('auth-error-banner');
    const navGoLogin = document.getElementById('nav-go-login');
    const navGoSignup = document.getElementById('nav-go-signup');
    const navExploreApp = document.getElementById('nav-explore-app');
    const btnExploreRadar = document.getElementById('btn-explore-radar');
    const authCard = document.getElementById('auth-portal-card');

    function setAuthError(msg) {
      if (!errorBanner) return;
      if (!msg) {
        errorBanner.classList.add('hidden');
        errorBanner.textContent = '';
      } else {
        errorBanner.textContent = msg;
        errorBanner.classList.remove('hidden');
      }
    }

    function switchAuthMode(mode) {
      setAuthError('');
      const isLogin = mode === 'login';
      if (tabRegister) tabRegister.classList.toggle('active', !isLogin);
      if (tabLogin) tabLogin.classList.toggle('active', isLogin);
      if (formRegister) formRegister.classList.toggle('hidden', isLogin);
      if (formLogin) formLogin.classList.toggle('hidden', !isLogin);
      const heading = document.getElementById('auth-portal-heading');
      if (heading) {
        heading.textContent = isLogin ? 'Welcome Back, Night Owl 🔑' : 'Create Your 3AM Profile 🦉';
      }
    }

    if (tabRegister) tabRegister.addEventListener('click', () => switchAuthMode('register'));
    if (tabLogin) tabLogin.addEventListener('click', () => switchAuthMode('login'));

    if (navGoLogin) {
      navGoLogin.addEventListener('click', () => {
        switchAuthMode('login');
        if (authCard) authCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
    if (navGoSignup) {
      navGoSignup.addEventListener('click', () => {
        switchAuthMode('register');
        if (authCard) authCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }

    // Explore App buttons (lets user browse the radar anytime; hunting starts at 11 PM)
    const handleExploreClick = async () => {
      trackEvent('explore_app_clicked');
      await openGates();
      if (!myOwl) {
        showToast('🔍 Exploring the 3AM Radar — Tap "⚡ Create Profile" anytime to claim your @alias!');
      }
    };
    if (navExploreApp) navExploreApp.addEventListener('click', handleExploreClick);
    if (btnExploreRadar) btnExploreRadar.addEventListener('click', handleExploreClick);

    // Emoji selector strip
    const emojiStrip = document.getElementById('reg-emoji-strip');
    const avatarInput = document.getElementById('reg-avatar');
    if (emojiStrip && avatarInput) {
      emojiStrip.querySelectorAll('.auth-emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          emojiStrip.querySelectorAll('.auth-emoji-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          avatarInput.value = btn.dataset.emoji || '🦉';
        });
      });
    }

    // Register form submit
    if (formRegister) {
      formRegister.addEventListener('submit', async (e) => {
        e.preventDefault();
        setAuthError('');
        const submitBtn = document.getElementById('reg-submit-btn');
        const origText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = '🦉 Creating Profile & Minting JWT...';
        }
        try {
          const alias = document.getElementById('reg-alias').value.trim();
          const city = document.getElementById('reg-city').value;
          const email = document.getElementById('reg-email').value.trim();
          const password = document.getElementById('reg-password').value;
          const avatarEmoji = document.getElementById('reg-avatar').value || '🦉';
          const bio = document.getElementById('reg-bio').value.trim();

          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              alias,
              city,
              email,
              password,
              avatarEmoji,
              bio,
              auraType: 'vibe',
              interests: ['late-drives', 'music', 'coding']
            })
          });
          const data = await res.json();
          if (!res.ok) {
            setAuthError(data.error || 'Could not create profile.');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = origText;
            }
            return;
          }
          saveAuthSession(data);
          trackEvent('signup_success', { city });
          showToast(`🦉 Profile created for @${data.user.alias}! JWT Access + Refresh Token active.`);
          await openGates();
        } catch (err) {
          setAuthError('Network error. Please try again.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = origText;
          }
        }
      });
    }

    // Login form submit
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        setAuthError('');
        const submitBtn = document.getElementById('login-submit-btn');
        const origText = submitBtn ? submitBtn.textContent : '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = '⚡ Verifying Credentials...';
        }
        try {
          const identifier = document.getElementById('login-identifier').value.trim();
          const password = document.getElementById('login-password').value;

          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
          });
          const data = await res.json();
          if (!res.ok) {
            setAuthError(data.error || 'Login failed.');
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = origText;
            }
            return;
          }
          saveAuthSession(data);
          trackEvent('login_success');
          showToast(`⚡ Welcome back @${data.user.alias}! Profile unlocked.`);
          await openGates();
        } catch (err) {
          setAuthError('Network error. Please try again.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = origText;
          }
        }
      });
    }

    // 1-Click Demo Profile (creates a JWT-backed NightOwl profile immediately)
    const guestBtn = document.getElementById('btn-instant-demo-hunt');
    if (guestBtn) {
      guestBtn.addEventListener('click', async () => {
        setAuthError('');
        const origText = guestBtn.textContent;
        guestBtn.disabled = true;
        guestBtn.textContent = '⚡ Creating Demo Profile...';
        try {
          const randTag = Math.floor(100 + Math.random() * 899);
          const guestAlias = `Hunter_${randTag}`;
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              alias: guestAlias,
              city: 'Thane',
              email: `hunter${randTag}@3amclub.in`,
              password: `guestpass_${randTag}`,
              avatarEmoji: '⚡',
              bio: 'Down for a 3 AM drive & cold coffee ☕',
              auraType: 'vibe',
              interests: ['late-drives', 'music', 'coffee']
            })
          });
          const data = await res.json();
          if (res.ok && data.accessToken) {
            saveAuthSession(data);
            trackEvent('guest_hunt_started');
            showToast(`⚡ Profile created as @${data.user.alias} with JWT Session!`);
            await openGates();
          }
        } catch (_) {
          setAuthError('Could not start demo session.');
        } finally {
          guestBtn.disabled = false;
          guestBtn.textContent = origText;
        }
      });
    }

    // Header buttons: Landing button, Create Profile/Account badge, and Log Out button
    const headerLandingBtn = document.getElementById('btn-header-landing');
    const brandHomeTrigger = document.getElementById('brand-home-trigger');
    const headerUserBadge = document.getElementById('header-user-badge');
    const stripCreateProfileBtn = document.getElementById('strip-create-profile-btn');
    const logoutBtn = document.getElementById('btn-header-logout');

    if (headerLandingBtn) {
      headerLandingBtn.addEventListener('click', () => openLandingAuthPortal('register'));
    }
    if (brandHomeTrigger) {
      brandHomeTrigger.addEventListener('click', () => openLandingAuthPortal('register'));
    }
    if (headerUserBadge) {
      headerUserBadge.addEventListener('click', () => {
        if (myOwl) {
          navigateToPage(4);
        } else {
          openLandingAuthPortal('register');
        }
      });
    }
    if (stripCreateProfileBtn) {
      stripCreateProfileBtn.addEventListener('click', () => {
        if (myOwl) {
          navigateToPage(4);
        } else {
          openLandingAuthPortal('register');
        }
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        logoutAndReturnToLanding();
      });
    }
  }

  function init() {
    initVaultParticles();
    startClocks();
    setupLandingAndAuth();
    setupNavigationAndSwipe();
    setupSearchAndLegend();
    setupDiveInTabs();
    setupMessagesUI();
    setupFormPickers();
    checkTimeAndGate();
  }

  async function checkTimeAndGate() {
    // Update live online count on Landing Page
    try {
      const sRes = await fetch('/api/status');
      const sData = await sRes.json();
      const landingCounter = document.getElementById('landing-online-count');
      if (landingCounter && sData.activeOwls) {
        landingCounter.textContent = `${sData.activeOwls}+ Owls Ready`;
      }
    } catch (_) {}

    // Check if user already has a valid JWT Access Token or Refresh Token
    if (accessToken) {
      try {
        const meRes = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.authenticated && meData.user) {
            myOwl = meData.user;
            sessionId = meData.user.sessionId || sessionId;
            if (sessionId) localStorage.setItem('3am_session_id', sessionId);
            updateHeaderUserBadge();
            scheduleTokenRefresh();
            await openGates();
            return;
          }
        }
      } catch (_) {}
    }

    // Try silent refresh if refreshToken exists
    if (refreshToken) {
      const refreshed = await attemptSilentRefresh();
      if (refreshed) {
        await openGates();
        return;
      }
    }

    // If user has NO profile/account yet, ALWAYS show the ReactBits Interactive GenZ Landing Page!
    updateHeaderUserBadge();
    if (screens.landing) screens.landing.classList.add('active');
    if (screens.club) screens.club.classList.remove('active');
  }

  function handleUrlDeepLinks() {
    const params = new URLSearchParams(window.location.search);
    const tabParam = (params.get('tab') || '').toLowerCase();
    const cityParam = params.get('city');

    if (tabParam === 'map' || tabParam === 'search') {
      navigateToPage(1);
      document.title = 'Live Midnight Radar Map — The 3AM Club';
    } else if (tabParam === 'dive') {
      navigateToPage(2);
      document.title = 'Dive In & Broadcast Your Vibe — The 3AM Club';
    } else if (tabParam === 'messages') {
      navigateToPage(3);
      document.title = 'Midnight Whispers DM — The 3AM Club';
    } else if (tabParam === 'profile') {
      navigateToPage(4);
      document.title = 'Night Owl Profile — The 3AM Club';
    } else if (tabParam === 'rides') {
      navigateToPage(0);
      currentHomeFilter = 'rides';
      document.querySelectorAll('.story-ring[data-feed-mode]').forEach(r => r.classList.toggle('active', r.dataset.feedMode === 'rides'));
      renderHomeFeed();
      document.title = 'Late Night Rides & Drives — The 3AM Club';
    } else if (tabParam === 'hangouts') {
      navigateToPage(0);
      currentHomeFilter = 'hangouts';
      document.querySelectorAll('.story-ring[data-feed-mode]').forEach(r => r.classList.toggle('active', r.dataset.feedMode === 'hangouts'));
      renderHomeFeed();
      document.title = 'Spontaneous 3AM Hangouts — The 3AM Club';
    }

    if (cityParam) {
      document.title = `${cityParam} Night Owls & Late Night Drives — The 3AM Club`;
      const searchInput = document.getElementById('map-user-search');
      if (searchInput) {
        searchInput.value = cityParam;
        searchInput.dispatchEvent(new Event('input'));
      }
    }
  }

  async function openGates() {
    if (screens.landing) screens.landing.classList.remove('active');
    if (screens.vault) screens.vault.classList.remove('active');
    if (screens.club) screens.club.classList.add('active');
    updateHeaderUserBadge();
    NightMap.init('map', () => {
      applyFilterAndRender();
    });
    await fetchAllData();
    handleUrlDeepLinks();
    setupSSE();
  }

  // ═══════════════════════════════════════════════════════════════
  //  5-TAB INSTAGRAM NAVIGATION & HORIZONTAL SWIPE ENGINE
  // ═══════════════════════════════════════════════════════════════
  function navigateToPage(index, skipAutoProfile = false) {
    const clamped = Math.max(0, Math.min(4, Number(index)));
    currentPageIndex = clamped;

    const track = document.getElementById('swipe-track');
    if (track) {
      track.style.transform = `translateX(-${clamped * 20}%)`;
    }

    document.querySelectorAll('.insta-tab').forEach(btn => {
      btn.classList.toggle('active', Number(btn.dataset.pageIndex) === clamped);
    });

    if (clamped === 1) {
      // Search & Map Radar tab active — refresh map size so tiles fill 100%
      setTimeout(() => NightMap.invalidate(), 220);
    } else if (clamped === 3) {
      renderMessagesInbox();
      renderActiveChat();
    } else if (clamped === 4 && !skipAutoProfile) {
      renderProfileTab(null);
    }
  }
  window.__navigateToPage = navigateToPage;

  function setupNavigationAndSwipe() {
    document.querySelectorAll('.insta-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        navigateToPage(Number(btn.dataset.pageIndex));
      });
    });

    // Horizontal Swipe Gesture across sections (ignores direct drags on #map canvas or .insta-stories-bar)
    const viewport = document.getElementById('swipe-viewport');
    let touchStartX = 0;
    let touchStartY = 0;
    let ignoreSwipe = false;

    viewport.addEventListener('touchstart', (e) => {
      if (e.target.closest('#map') || e.target.closest('.insta-stories-bar') || e.target.closest('.dm-icebreakers')) {
        ignoreSwipe = true;
        return;
      }
      ignoreSwipe = false;
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }, { passive: true });

    viewport.addEventListener('touchend', (e) => {
      if (ignoreSwipe) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      // Trigger horizontal tab swipe if horizontal swipe exceeds 65px and is stronger than vertical scroll
      if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        if (dx < 0 && currentPageIndex < 4) {
          navigateToPage(currentPageIndex + 1);
        } else if (dx > 0 && currentPageIndex > 0) {
          navigateToPage(currentPageIndex - 1);
        }
      }
    }, { passive: true });

    // Story Ring Mode Switcher on Home Page
    document.querySelectorAll('.story-ring[data-feed-mode]').forEach(ring => {
      ring.addEventListener('click', () => {
        document.querySelectorAll('.story-ring[data-feed-mode]').forEach(r => r.classList.remove('active'));
        ring.classList.add('active');
        currentHomeFilter = ring.dataset.feedMode;
        renderHomeFeed();
      });
    });

    // Header Controls
    const lockBtn = document.getElementById('lock-btn');
    if (lockBtn) {
      lockBtn.addEventListener('click', () => openLandingAuthPortal('register'));
    }
    const locateMeBtn = document.getElementById('locate-me-btn');
    if (locateMeBtn) {
      locateMeBtn.addEventListener('click', () => {
        navigateToPage(1);
        setTimeout(() => NightMap.locateUser(true), 250);
      });
    }
    const btnRain = document.getElementById('btn-rain');
    if (btnRain) btnRain.addEventListener('click', toggleRain);
    const btnLofi = document.getElementById('btn-lofi');
    if (btnLofi) btnLofi.addEventListener('click', toggleLofi);

    // Forms
    document.getElementById('checkin-form').addEventListener('submit', handleCheckIn);
    document.getElementById('checkout-btn').addEventListener('click', handleCheckOut);
    document.getElementById('wall-form').addEventListener('submit', handleWallPost);
    document.getElementById('ride-form').addEventListener('submit', handleRidePost);
    document.getElementById('hangout-form').addEventListener('submit', handleHangoutPost);

    // Custom events from Map & Cards
    document.addEventListener('clink-action', async (e) => {
      await sendClink(e.detail.owlId, e.detail.reaction);
    });
    document.addEventListener('view-profile', async (e) => {
      navigateToPage(4, true);
      await renderProfileTab(e.detail.owlId);
    });
    document.addEventListener('follow-owl', async (e) => {
      await followOwl(e.detail.owlId);
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  SECTION 1: SEARCH BAR + MAP RADAR + EXPANDABLE LEGEND
  // ═══════════════════════════════════════════════════════════════
  function setupSearchAndLegend() {
    const searchInput = document.getElementById('map-user-search');
    const clearBtn = document.getElementById('clear-search-btn');
    const resultsBox = document.getElementById('search-results-dropdown');
    const gpsPill = document.getElementById('map-gps-pill');

    if (gpsPill) {
      gpsPill.addEventListener('click', () => NightMap.locateUser(true));
    }

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      clearBtn.classList.toggle('hidden', !q);

      if (!q) {
        resultsBox.classList.add('hidden');
        applyFilterAndRender();
        return;
      }

      const matches = getFilteredOwls().filter(o => {
        const hay = `${o.alias} ${o.city} ${o.neighborhood || ''} ${(o.interests || []).join(' ')} ${o.bio || ''}`.toLowerCase();
        return hay.includes(q);
      });

      const myInterests = myOwl && Array.isArray(myOwl.interests) ? myOwl.interests : [];
      NightMap.update(matches, myInterests);

      resultsBox.classList.remove('hidden');
      if (matches.length === 0) {
        resultsBox.innerHTML = `<div style="padding:10px;text-align:center;color:var(--text-muted);font-size:0.8rem;">No Night Owls matching "${q}"</div>`;
      } else {
        resultsBox.innerHTML = matches.slice(0, 8).map(o => {
          const id = o._id || o.id;
          const dist = o.distKm < 1 ? `${Math.round(o.distKm * 1000)}m` : `${o.distKm.toFixed(1)} km`;
          return `
            <div class="search-result-item" onclick="window.__selectSearchOwl('${id}')">
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:1.3rem;">${o.avatarEmoji || '🦉'}</span>
                <div>
                  <div style="font-weight:700;font-size:0.84rem;color:var(--aura-${o.auraType || 'vibe'});">@${o.alias}</div>
                  <div style="font-size:0.72rem;color:var(--text-secondary);">📍 ${o.neighborhood ? o.neighborhood + ', ' : ''}${o.city} • <b style="color:#00e5ff;">${dist}</b></div>
                </div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn-outline" style="padding:4px 8px;font-size:0.7rem;" onclick="event.stopPropagation(); window.__openDMWith('${id}')">💬 DM</button>
                <button class="btn-primary" style="padding:4px 8px;font-size:0.7rem;">📍 Pin</button>
              </div>
            </div>
          `;
        }).join('');
      }
    });

    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      clearBtn.classList.add('hidden');
      resultsBox.classList.add('hidden');
      applyFilterAndRender();
    });

    // Expandable Legend Dropdown
    const toggleBtn = document.getElementById('legend-toggle-btn');
    const dropdown = document.getElementById('legend-dropdown');
    const chevron = document.getElementById('legend-chevron');
    const activeLabel = document.getElementById('active-legend-label');

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = dropdown.classList.toggle('hidden');
      chevron.textContent = isHidden ? '▾' : '▴';
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#map-legend-wrapper')) {
        dropdown.classList.add('hidden');
        chevron.textContent = '▾';
      }
      if (!e.target.closest('.map-top-search-overlay')) {
        resultsBox.classList.add('hidden');
      }
    });

    dropdown.querySelectorAll('.legend-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        dropdown.querySelectorAll('.legend-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentLegendFilter = btn.dataset.filter;
        activeLabel.textContent = btn.textContent.trim();
        dropdown.classList.add('hidden');
        chevron.textContent = '▾';
        applyFilterAndRender();
        showToast(`🎯 Radar filtered: ${btn.textContent.trim()}`);
      });
    });
  }

  window.__selectSearchOwl = function(owlId) {
    document.getElementById('search-results-dropdown').classList.add('hidden');
    NightMap.focus(owlId);
  };

  // ═══════════════════════════════════════════════════════════════
  //  SECTION 2: 🌊 DIVE IN SUB-TABS
  // ═══════════════════════════════════════════════════════════════
  function setupDiveInTabs() {
    document.querySelectorAll('.dive-sub-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dive-sub-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.dive-sub-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const target = document.getElementById(`dive-${btn.dataset.dive}`);
        if (target) target.classList.add('active');
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════
  //  SECTION 3: 💬 MESSAGES (MUTUAL INBOX + REQUESTS + 1-MSG LIMIT)
  // ═══════════════════════════════════════════════════════════════
  function setupMessagesUI() {
    const sendForm = document.getElementById('dm-send-form');
    const input = document.getElementById('dm-input');
    const backBtn = document.getElementById('btn-back-dm');
    const viewProfBtn = document.getElementById('dm-view-profile-btn');
    const reqToggleBtn = document.getElementById('dm-requests-toggle-btn');
    const mutualSearchInput = document.getElementById('dm-mutual-search');

    backBtn.addEventListener('click', () => {
      document.querySelector('.messages-layout').classList.remove('chat-open');
    });

    viewProfBtn.addEventListener('click', () => {
      if (activeChatOwl) {
        navigateToPage(4, true);
        renderProfileTab(activeChatOwl._id || activeChatOwl.id);
      }
    });

    if (reqToggleBtn) {
      reqToggleBtn.addEventListener('click', () => {
        inRequestsView = !inRequestsView;
        activeChatOwl = null;
        renderMessagesInbox();
        renderActiveChat();
      });
    }

    if (mutualSearchInput) {
      mutualSearchInput.addEventListener('input', () => {
        dmSearchQuery = mutualSearchInput.value.trim().toLowerCase();
        renderMessagesInbox();
      });
    }

    document.querySelectorAll('.icebreaker-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        if (!input.disabled) {
          input.value = pill.dataset.ice;
          input.focus();
        }
      });
    });

    sendForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (input.disabled) return;
      const text = input.value.trim();
      if (!text || !activeChatOwl) return;

      const partnerId = String(activeChatOwl._id || activeChatOwl.id);
      const myId = myOwl ? String(myOwl._id) : '';
      const myAlias = myOwl ? myOwl.alias : 'Dead';
      const myAvatar = myOwl ? myOwl.avatarEmoji : '🦉';

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          fromOwlId: myId,
          fromAlias: myAlias,
          fromAvatar: myAvatar,
          toOwlId: partnerId,
          toAlias: activeChatOwl.alias,
          text
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || '🔒 1 message request limit reached until they accept.');
        renderActiveChat();
        return;
      }

      input.value = '';
      if (!mutualSet.has(partnerId)) {
        showToast(`📨 Message request sent to @${activeChatOwl.alias} (1/1 limit)`);
      }
      await fetchAllData();
      renderActiveChat();
    });
  }

  window.__openDMWith = async function(owlId) {
    const target = allOwls.find(o => String(o._id || o.id) === String(owlId));
    if (!target) return;

    const targetId = String(target._id || target.id);
    const isMutual = mutualSet.has(targetId);

    // Switch to Requests view automatically if opening a non-mutual thread
    inRequestsView = !isMutual;
    activeChatOwl = target;
    navigateToPage(3);
    document.querySelector('.messages-layout').classList.add('chat-open');

    // Mark incoming messages from this partner as read to clear unread dot
    if (myOwl) {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ myOwlId: String(myOwl._id), partnerOwlId: targetId })
      });
      allMessages.forEach(m => {
        if (String(m.fromOwlId) === targetId && String(m.toOwlId) === String(myOwl._id)) {
          m.isRead = true;
        }
      });
    }

    updateUnreadIndicators();
    renderMessagesInbox();
    renderActiveChat();
  };

  window.__acceptMsgRequest = async function(partnerOwlId) {
    if (!sessionId) return;
    const res = await fetch('/api/messages/accept-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, partnerOwlId })
    });
    if (res.ok) {
      mutualSet.add(String(partnerOwlId));
      followingSet.add(String(partnerOwlId));
      inRequestsView = false;
      showToast('✓ Request accepted! Moved to Inbox & Map Pin unlocked.');
      await fetchAllData();
      renderMessagesInbox();
      renderActiveChat();
    }
  };

  window.__declineMsgRequest = async function(partnerOwlId) {
    if (!sessionId) return;
    const res = await fetch('/api/messages/decline-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, partnerOwlId })
    });
    if (res.ok) {
      allMessages = allMessages.filter(m =>
        String(m.fromOwlId) !== String(partnerOwlId) && String(m.toOwlId) !== String(partnerOwlId)
      );
      activeChatOwl = null;
      const layout = document.querySelector('.messages-layout');
      if (layout) layout.classList.remove('chat-open');
      showToast('✕ Message request declined & removed.');
      await fetchAllData();
      renderMessagesInbox();
      renderActiveChat();
    }
  };

  window.__blockOwl = async function(targetOwlId) {
    if (!sessionId || !targetOwlId) return;
    const res = await fetch('/api/block', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, targetOwlId })
    });
    if (res.ok) {
      mutualSet.delete(String(targetOwlId));
      followingSet.delete(String(targetOwlId));
      if (activeChatOwl && String(activeChatOwl._id || activeChatOwl.id) === String(targetOwlId)) {
        activeChatOwl = null;
      }
      showToast('🚫 User blocked. Hidden from your feed, map, and messages.');
      await fetchAllData();
      if (currentPageIndex === 4) renderProfileTab(null);
    }
  };

  function updateUnreadIndicators() {
    const myId = myOwl ? String(myOwl._id) : '';
    const unreadRequests = allMessages.filter(m =>
      String(m.toOwlId) === myId && !m.isRead && !mutualSet.has(String(m.fromOwlId))
    );
    const unreadTotal = allMessages.filter(m =>
      String(m.toOwlId) === myId && !m.isRead
    );

    const reqDot = document.getElementById('dm-requests-dot');
    const navDot = document.getElementById('nav-msg-dot');
    if (reqDot) reqDot.classList.toggle('hidden', unreadRequests.length === 0);
    if (navDot) navDot.classList.toggle('hidden', unreadTotal.length === 0);
  }

  function renderMessagesInbox() {
    const list = document.getElementById('dm-thread-list');
    const inboxTitle = document.getElementById('dm-inbox-title');
    const reqLabel = document.getElementById('dm-requests-label');
    const reqCountEl = document.getElementById('dm-requests-count');
    const searchWrapper = document.getElementById('dm-search-wrapper');
    if (!list) return;

    const myId = myOwl ? String(myOwl._id) : '';
    const otherOwls = getFilteredOwls();

    // Build Request Threads (non-mutuals who have messaged us or whom we messaged)
    const requestOwlIds = new Set();
    allMessages.forEach(m => {
      if (String(m.toOwlId) === myId && m.fromOwlId && !mutualSet.has(String(m.fromOwlId))) {
        requestOwlIds.add(String(m.fromOwlId));
      } else if (String(m.fromOwlId) === myId && m.toOwlId && !mutualSet.has(String(m.toOwlId))) {
        requestOwlIds.add(String(m.toOwlId));
      }
    });
    if (activeChatOwl && !mutualSet.has(String(activeChatOwl._id || activeChatOwl.id))) {
      requestOwlIds.add(String(activeChatOwl._id || activeChatOwl.id));
    }

    const requestOwls = otherOwls.filter(o => requestOwlIds.has(String(o._id || o.id)));
    if (reqCountEl) reqCountEl.textContent = requestOwls.length;
    updateUnreadIndicators();

    if (inRequestsView) {
      if (inboxTitle) inboxTitle.textContent = 'Message Requests';
      if (reqLabel) reqLabel.textContent = '← Inbox';
      if (searchWrapper) searchWrapper.classList.add('hidden');
    } else {
      if (inboxTitle) inboxTitle.textContent = 'Messages';
      if (reqLabel) reqLabel.textContent = 'Requests';
      if (searchWrapper) searchWrapper.classList.remove('hidden');
    }

    // Primary Inbox shows ONLY mutual followers (and filters strictly by #dm-mutual-search)
    let threadsToShow = [];
    if (inRequestsView) {
      threadsToShow = requestOwls;
    } else {
      threadsToShow = otherOwls.filter(o => mutualSet.has(String(o._id || o.id)));
      if (dmSearchQuery) {
        threadsToShow = threadsToShow.filter(o => {
          const hay = `${o.alias} ${o.city || ''} ${o.neighborhood || ''}`.toLowerCase();
          return hay.includes(dmSearchQuery);
        });
      }
    }

    if (!activeChatOwl && threadsToShow.length > 0) {
      activeChatOwl = threadsToShow[0];
    }

    if (threadsToShow.length === 0) {
      list.innerHTML = `
        <div style="padding:24px 14px;text-align:center;color:var(--text-muted);font-size:0.78rem;">
          ${inRequestsView
            ? 'No pending message requests.'
            : (dmSearchQuery
                ? `No mutual followers matching "${dmSearchQuery}".`
                : 'Only people who follow each other appear here. Follow someone from the feed to chat freely!')}
        </div>
      `;
      return;
    }

    list.innerHTML = threadsToShow.map(o => {
      const id = String(o._id || o.id);
      const isActive = activeChatOwl && String(activeChatOwl._id || activeChatOwl.id) === id;
      const dist = o.distKm < 1 ? `${Math.round(o.distKm * 1000)}m` : `${o.distKm.toFixed(1)} km`;
      const threadMsgs = allMessages.filter(m =>
        (String(m.toOwlId) === id && (String(m.fromOwlId) === myId || m.fromAlias === myOwl?.alias)) ||
        (String(m.fromOwlId) === id && String(m.toOwlId) === myId) ||
        m.fromAlias === o.alias
      );
      const lastMsg = threadMsgs[threadMsgs.length - 1];
      const hasUnread = threadMsgs.some(m => String(m.fromOwlId) === id && String(m.toOwlId) === myId && !m.isRead);

      return `
        <div class="dm-thread-item ${isActive ? 'active' : ''}" onclick="window.__openDMWith('${id}')">
          <div class="dm-avatar-circle">${o.avatarEmoji || '🦉'}</div>
          <div style="flex:1;min-width:0;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-weight:600;font-size:0.82rem;color:var(--text-primary);">@${o.alias}</span>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:0.66rem;color:var(--text-muted);">${dist}</span>
                ${hasUnread ? '<span class="unread-dot"></span>' : ''}
              </div>
            </div>
            <div style="font-size:0.73rem;color:${hasUnread ? 'var(--text-primary)' : 'var(--text-secondary)'};font-weight:${hasUnread ? '600' : '400'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${lastMsg ? lastMsg.text : (o.statusText || `${o.neighborhood || o.city} • Mutual`)}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderActiveChat() {
    const partnerHeader = document.getElementById('dm-active-partner-info');
    const scrollBox = document.getElementById('dm-messages-scroll');
    const reqBanner = document.getElementById('dm-request-banner');
    const input = document.getElementById('dm-input');
    const sendBtn = document.getElementById('dm-send-btn');
    const iceBar = document.getElementById('dm-icebreakers-bar');
    if (!partnerHeader || !scrollBox) return;

    if (!activeChatOwl) {
      partnerHeader.innerHTML = `<span style="font-size:0.8rem;color:var(--text-secondary);">Select a conversation</span>`;
      scrollBox.innerHTML = `<div style="margin:auto;text-align:center;color:var(--text-muted);font-size:0.78rem;">Select a mutual follower or message request to view messages.</div>`;
      if (reqBanner) reqBanner.classList.add('hidden');
      return;
    }

    const partnerId = String(activeChatOwl._id || activeChatOwl.id);
    const myId = myOwl ? String(myOwl._id) : '';
    const isMutual = mutualSet.has(partnerId);

    partnerHeader.innerHTML = `
      <span style="font-size:1.25rem;">${activeChatOwl.avatarEmoji || '🦉'}</span>
      <div>
        <div style="font-weight:600;font-size:0.84rem;color:var(--text-primary);">
          @${activeChatOwl.alias}
          <span style="font-size:0.66rem;color:${isMutual ? 'var(--text-secondary)' : '#f59e0b'};margin-left:4px;">
            ${isMutual ? '• Mutual' : '• Request'}
          </span>
        </div>
        <div style="font-size:0.68rem;color:var(--text-muted);">${activeChatOwl.neighborhood ? activeChatOwl.neighborhood + ', ' : ''}${activeChatOwl.city}</div>
      </div>
    `;

    const threadMsgs = allMessages.filter(m =>
      (String(m.toOwlId) === partnerId && (String(m.fromOwlId) === myId || m.fromAlias === myOwl?.alias)) ||
      (String(m.fromOwlId) === partnerId && String(m.toOwlId) === myId) ||
      (m.fromAlias === activeChatOwl.alias && String(m.toOwlId) === myId)
    );

    const mySentMsgs = threadMsgs.filter(m => String(m.fromOwlId) === myId || (myOwl && m.fromAlias === myOwl.alias));
    const theirSentMsgs = threadMsgs.filter(m => String(m.fromOwlId) === partnerId || m.fromAlias === activeChatOwl.alias);

    const starterBubble = isMutual && threadMsgs.length === 0
      ? `<div class="dm-bubble theirs">
           <div style="font-size:0.68rem;color:var(--text-secondary);margin-bottom:2px;">@${activeChatOwl.alias}</div>
           Hey! We follow each other in ${activeChatOwl.neighborhood || activeChatOwl.city}. "${activeChatOwl.statusText || activeChatOwl.bio}" 🌙
         </div>`
      : '';

    scrollBox.innerHTML = starterBubble + threadMsgs.map(m => {
      const isMine = String(m.fromOwlId) === myId || (myOwl && m.fromAlias === myOwl.alias);
      return `
        <div class="dm-bubble ${isMine ? 'mine' : 'theirs'}">
          <div style="font-size:0.66rem;color:var(--text-secondary);margin-bottom:2px;">${isMine ? 'You' : '@' + m.fromAlias}</div>
          ${m.text}
        </div>
      `;
    }).join('');

    // Configure Instagram-style Request Banner & 1-Message Limit
    if (reqBanner && input && sendBtn) {
      if (isMutual) {
        reqBanner.classList.add('hidden');
        input.disabled = false;
        sendBtn.disabled = false;
        input.placeholder = `Message @${activeChatOwl.alias}...`;
        if (iceBar) iceBar.classList.remove('hidden');
      } else if (theirSentMsgs.length > 0) {
        // Incoming request from non-mutual: let user Accept, Decline, or Block
        reqBanner.classList.remove('hidden');
        reqBanner.innerHTML = `
          <span style="flex:1;">👋 <b>@${activeChatOwl.alias}</b> sent a request.</span>
          <div style="display:flex;gap:5px;flex-shrink:0;">
            <button type="button" class="btn-primary" style="padding:4px 10px;font-size:0.72rem;" onclick="window.__acceptMsgRequest('${partnerId}')">✓ Accept</button>
            <button type="button" class="btn-outline" style="padding:4px 9px;font-size:0.72rem;color:#fda4af;" onclick="window.__declineMsgRequest('${partnerId}')">✕ Decline</button>
            <button type="button" class="btn-outline" style="padding:4px 8px;font-size:0.72rem;color:#f43f5e;" onclick="window.__blockOwl('${partnerId}')" title="Block User">🚫</button>
          </div>
        `;
        input.disabled = true;
        sendBtn.disabled = true;
        input.placeholder = 'Accept request to reply...';
        if (iceBar) iceBar.classList.add('hidden');
      } else if (mySentMsgs.length >= 1) {
        // User already sent their 1 allowed message request
        reqBanner.classList.remove('hidden');
        reqBanner.innerHTML = `
          <span>🔒 <b>Request sent (1/1 limit)</b> — You can send more messages once @${activeChatOwl.alias} accepts.</span>
        `;
        input.disabled = true;
        sendBtn.disabled = true;
        input.placeholder = 'Waiting for @' + activeChatOwl.alias + ' to accept...';
        if (iceBar) iceBar.classList.add('hidden');
      } else {
        // User has 0 messages sent to this non-mutual: allow 1 message attempt
        reqBanner.classList.remove('hidden');
        reqBanner.innerHTML = `
          <span>🔒 You don't follow each other. You can send <b>1 message request</b>.</span>
        `;
        input.disabled = false;
        sendBtn.disabled = false;
        input.placeholder = `Send 1 message request to @${activeChatOwl.alias}...`;
        if (iceBar) iceBar.classList.remove('hidden');
      }
    }

    scrollBox.scrollTop = scrollBox.scrollHeight;
  }

  // ═══════════════════════════════════════════════════════════════
  //  DATA FETCHING & CALM DARK-MODE HOME FEED
  // ═══════════════════════════════════════════════════════════════
  function getFilteredOwls() {
    const uCoords = NightMap.getUserCoords();
    const myId = myOwl ? String(myOwl._id) : null;

    // Exclude current user (myOwl) from public feed & DM lists
    const others = allOwls.filter(o => {
      if (myId && String(o._id || o.id) === myId) return false;
      if (sessionId && o.sessionId === sessionId) return false;
      return true;
    });

    const enriched = others.map(o => {
      const lat = o.coordinates ? o.coordinates.lat : o.lat;
      const lng = o.coordinates ? o.coordinates.lng : o.lng;
      const distKm = NightMap.haversineKm(uCoords.lat, uCoords.lng, lat, lng);
      return { ...o, distKm };
    });

    let filtered = enriched;
    if (currentLegendFilter === 'nearby') {
      filtered = enriched.filter(o => o.distKm <= 18);
    } else if (['grind', 'exam', 'vibe', 'gaming'].includes(currentLegendFilter)) {
      filtered = enriched.filter(o => o.auraType === currentLegendFilter);
    } else if (currentLegendFilter === 'ride') {
      filtered = enriched.filter(o => (o.lookingFor || []).includes('late-night-ride'));
    }

    return filtered.sort((a, b) => a.distKm - b.distKm);
  }

  function applyFilterAndRender() {
    const filtered = getFilteredOwls();
    const myInterests = myOwl && Array.isArray(myOwl.interests) ? myOwl.interests : [];
    NightMap.update(filtered, myInterests, mutualSet, clinkedSet);
    renderDynamicStoryRings(filtered.slice(0, 10));
    renderHomeFeed();
    renderRidesList();
    renderHangoutsList();
  }

  function renderDynamicStoryRings(closestOwls) {
    const container = document.getElementById('dynamic-story-rings');
    if (!container) return;
    container.innerHTML = closestOwls.map(o => {
      const id = o._id || o.id;
      return `
        <div class="story-ring" onclick="window.__viewProfile('${id}')">
          <div class="story-avatar-wrap"><span class="story-emoji">${o.avatarEmoji || '🦉'}</span></div>
          <span class="story-label">@${o.alias.split('_')[0]}</span>
        </div>
      `;
    }).join('');
  }

  function renderHomeFeed() {
    const feed = document.getElementById('home-unified-feed');
    if (!feed) return;

    if (currentHomeFilter === 'rides') {
      feed.innerHTML = buildRidesHtml();
      return;
    }
    if (currentHomeFilter === 'hangouts') {
      feed.innerHTML = buildHangoutsHtml();
      return;
    }
    if (currentHomeFilter === 'wall') {
      feed.innerHTML = buildWallHtml();
      return;
    }

    const owls = getFilteredOwls();
    const myInterests = myOwl && Array.isArray(myOwl.interests) ? myOwl.interests : [];

    // Render user's own latest posted thoughts & live broadcast card at the top of the Home feed
    const myRecentPosts = myOwl
      ? allConfessions.filter(c => String(c.authorOwlId) === String(myOwl._id) || c.authorAlias === myOwl.alias).slice(0, 3)
      : [];

    const myPostsHtml = myRecentPosts.map(c => {
      const r = c.reactions || {};
      return `
        <div class="feed-card my-live-post-card">
          <div class="feed-card-header" style="justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="window.__navigateToPage(4)">
              <div class="dm-avatar-circle">${myOwl?.avatarEmoji || '🦉'}</div>
              <div>
                <div style="display:flex;align-items:center;gap:5px;">
                  <span class="card-alias">@${c.authorAlias}</span>
                  <span class="mutual-pill">You • Just Posted</span>
                </div>
                <div class="card-meta">${c.city || myOwl?.city || 'Thane'} • 3AM Thought</div>
              </div>
            </div>
            <button class="btn-outline" style="padding:3px 8px;font-size:0.68rem;" onclick="window.__editMyProfile()">✏️ Edit</button>
          </div>
          <div class="card-body" style="font-size:0.86rem;margin-top:4px;">"${c.content}"</div>
          <div class="clink-row" style="margin-top:6px;">
            <button class="clink-btn" onclick="window.__reactConfession('${c._id}', 'fire')">🔥 ${r.fire || 0}</button>
            <button class="clink-btn" onclick="window.__reactConfession('${c._id}', 'heart')">💜 ${r.heart || 0}</button>
            <button class="clink-btn" onclick="window.__reactConfession('${c._id}', 'ghost')">👻 ${r.ghost || 0}</button>
          </div>
        </div>
      `;
    }).join('');

    const myBroadcastCardHtml = myOwl ? `
      <div class="feed-card my-live-post-card">
        <div class="feed-card-header" style="justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="window.__navigateToPage(4)">
            <div class="dm-avatar-circle">${myOwl.avatarEmoji || '🦉'}</div>
            <div>
              <div style="display:flex;align-items:center;gap:5px;">
                <span class="card-alias">@${myOwl.alias}</span>
                <span class="mutual-pill">You • Live</span>
              </div>
              <div class="card-meta">${myOwl.neighborhood ? myOwl.neighborhood + ', ' : ''}${myOwl.city || 'Thane'} • ${myOwl.beverage || '☕ Coffee'}</div>
            </div>
          </div>
          <div style="display:flex;gap:5px;">
            <button class="btn-outline" style="padding:4px 9px;font-size:0.7rem;" onclick="window.__locateOnMap('${myOwl._id}')">📍 My Pin</button>
            <button class="btn-outline" style="padding:4px 9px;font-size:0.7rem;" onclick="window.__editMyProfile()">✏️ Edit</button>
          </div>
        </div>
        ${myOwl.statusText ? `<div class="card-body">"${myOwl.statusText}"</div>` : ''}
        ${myOwl.currentTrack ? `<div class="track-minimal-line">♪ ${myOwl.currentTrack}</div>` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:4px;">
          ${(myOwl.interests || []).slice(0, 5).map(tag => `<span class="tag-pill">#${tag}</span>`).join('')}
        </div>
      </div>
    ` : '';

    const owlCardsHtml = owls.map(o => {
      const id = String(o._id || o.id);
      const shared = (o.interests || []).filter(i => myInterests.includes(i));
      const isClosed = o.profileType === 'closed';
      const isMutual = mutualSet.has(id);
      const isFollowing = followingSet.has(id);
      const isPending = pendingSet.has(id);
      const hasClinked = clinkedSet.has(id);
      const distBadge = o.distKm < 1 ? `${Math.round(o.distKm * 1000)}m` : `${o.distKm.toFixed(1)} km`;

      const areaDisplay = isMutual
        ? `${o.neighborhood ? o.neighborhood + ', ' : ''}${o.city || 'Thane'} • ${distBadge}`
        : `${o.city || 'Thane'} (~${distBadge}) • 🔒 Exact pin hidden`;

      const followBtnLabel = isMutual
        ? '✓ Mutual'
        : (isFollowing ? '✓ Following' : (isPending ? 'Requested' : (isClosed ? 'Request' : 'Follow')));

      return `
        <div class="feed-card">
          <div class="feed-card-header" style="justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;cursor:pointer;" onclick="window.__viewProfile('${id}')">
              <div class="dm-avatar-circle">${o.avatarEmoji || '🦉'}</div>
              <div>
                <div style="display:flex;align-items:center;gap:5px;">
                  <span class="card-alias">@${o.alias}</span>
                  <span style="font-size:0.68rem;color:var(--text-muted);">${isClosed ? '🔒' : ''}</span>
                  ${isMutual ? '<span class="mutual-pill">Mutual</span>' : ''}
                </div>
                <div class="card-meta">${areaDisplay}</div>
              </div>
            </div>
            <div style="display:flex;gap:5px;">
              <button class="btn-outline ${isMutual ? '' : 'btn-locked-pin'}" style="padding:4px 9px;font-size:0.7rem;" onclick="window.__locateOnMap('${id}')">
                ${isMutual ? '📍 Pin' : '🔒 Pin'}
              </button>
              <button class="btn-outline" style="padding:4px 9px;font-size:0.7rem;" onclick="window.__openDMWith('${id}')">
                💬 ${isMutual ? 'DM' : 'Req'}
              </button>
            </div>
          </div>

          ${shared.length > 0 ? `<div class="shared-minimal-line">✦ ${shared.length} shared interest${shared.length > 1 ? 's' : ''}: ${shared.join(', ')}</div>` : ''}

          ${o.bio ? `<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;">${o.bio}</div>` : ''}
          ${o.statusText ? `<div class="card-body">"${o.statusText}"</div>` : ''}
          ${o.currentTrack ? `<div class="track-minimal-line">♪ ${o.currentTrack}</div>` : ''}

          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
            ${(o.interests || []).slice(0, 5).map(tag => `<span class="tag-pill">#${tag}</span>`).join('')}
            ${(o.lookingFor || []).slice(0, 2).map(lf => `<span class="tag-pill">${lf.replace(/-/g, ' ')}</span>`).join('')}
          </div>

          <div class="clink-row" style="justify-content:space-between;align-items:center;">
            <button class="clink-btn ${hasClinked ? 'clinked' : ''}" onclick="window.__clinkOwl('${id}', '☕')">
              ${hasClinked ? `☕ Cheered ✓ (${o.clinksReceived || 0})` : `☕ Cheers (${o.clinksReceived || 0})`}
            </button>
            <button class="${isFollowing || isMutual ? 'btn-outline' : 'btn-primary'}" style="padding:5px 12px;font-size:0.72rem;" onclick="window.__followOwl('${id}')">
              ${followBtnLabel}
            </button>
          </div>
        </div>
      `;
    }).join('');

    feed.innerHTML = myPostsHtml + myBroadcastCardHtml + owlCardsHtml;
  }

  window.__locateOnMap = function(owlId) {
    const id = String(owlId);
    const isMe = myOwl && String(myOwl._id) === id;
    if (!isMe && !mutualSet.has(id)) {
      const target = allOwls.find(o => String(o._id || o.id) === id);
      showToast(`🔒 Follow @${target ? target.alias : 'them'} mutually to unlock their exact live Map Pin!`);
      return;
    }
    navigateToPage(1);
    setTimeout(() => NightMap.focus(owlId), 260);
  };

  function buildRidesHtml() {
    return allRides.map(r => {
      const isOffering = r.rideType === 'offering';
      const joinedNames = (r.joinedOwls || []).map(j => j.alias).join(', ');
      return `
        <div class="feed-card">
          <div class="feed-card-header" style="justify-content:space-between;">
            <div onclick="window.__viewProfile('${r.ownerOwlId}')" style="cursor:pointer;display:flex;align-items:center;gap:8px;">
              <div class="dm-avatar-circle">${r.ownerAvatarEmoji || '🚗'}</div>
              <div>
                <span class="card-alias">@${r.ownerAlias}</span>
                <div class="card-meta">${r.city}</div>
              </div>
            </div>
            <span class="popup-badge" style="color:${isOffering ? '#a78bfa' : '#9ca3af'};">
              ${isOffering ? 'Offering Ride' : 'Looking for Ride'}
            </span>
          </div>
          <div style="font-weight:600;font-size:0.86rem;margin:5px 0;color:var(--text-primary);">${r.fromArea} ➔ ${r.toArea}</div>
          <div class="card-meta" style="margin-bottom:5px;">Departure: ${r.departureTime || '2:30 AM'} • ${r.seatsAvailable} seats left</div>
          ${r.note ? `<div class="card-body">"${r.note}"</div>` : ''}
          ${joinedNames ? `<div style="font-size:0.72rem;color:var(--text-secondary);margin-bottom:6px;">✓ Joined: ${joinedNames}</div>` : ''}
          <div style="display:flex;gap:6px;">
            <button class="btn-primary w-100" onclick="window.__joinRide('${r._id}')">Join Ride</button>
            <button class="btn-outline" onclick="window.__openDMWith('${r.ownerOwlId}')">💬</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function buildHangoutsHtml() {
    return allHangouts.map(h => {
      const joinedCount = (h.joinedOwls || []).length;
      return `
        <div class="feed-card">
          <div class="feed-card-header" style="justify-content:space-between;">
            <div onclick="window.__viewProfile('${h.ownerOwlId}')" style="cursor:pointer;display:flex;align-items:center;gap:8px;">
              <div class="dm-avatar-circle">${h.ownerAvatarEmoji || '🎯'}</div>
              <div>
                <span class="card-alias">@${h.ownerAlias}</span>
                <div class="card-meta">${h.city}</div>
              </div>
            </div>
            <span class="popup-badge" style="color:var(--text-secondary);">${(h.activity || 'chill').toUpperCase()}</span>
          </div>
          <div style="font-weight:600;font-size:0.86rem;margin:5px 0;color:var(--text-primary);">📍 ${h.spot}</div>
          ${h.description ? `<div class="card-body">"${h.description}"</div>` : ''}
          <div class="card-meta" style="margin-bottom:6px;">Starts: ${h.startsAt || '2:00 AM'} • ${joinedCount}/${h.maxPeople} joined</div>
          <div style="display:flex;gap:6px;">
            <button class="btn-primary w-100" onclick="window.__joinHangout('${h._id}')">Join Hangout</button>
            <button class="btn-outline" onclick="window.__openDMWith('${h.ownerOwlId}')">💬</button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.__submitReply = async function(confId) {
    const input = document.getElementById(`reply-input-${confId}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    if (!sessionId) {
      showToast('🌊 Dive In first to reply!');
      navigateToPage(2);
      return;
    }
    const res = await fetch(`/api/confessions/${confId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, text })
    });
    if (res.ok) {
      input.value = '';
      showToast('💬 Reply posted!');
      await fetchAllData();
    }
  };

  function buildWallHtml() {
    return allConfessions.map(c => {
      const replies = Array.isArray(c.replies) ? c.replies : [];
      const repliesHtml = replies.length > 0
        ? `<div style="margin-top:8px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);display:flex;flex-direction:column;gap:4px;">
            ${replies.slice(-4).map(rep => `
              <div style="font-size:0.74rem;color:var(--text-secondary);">
                <b style="color:var(--text-primary);">@${rep.authorAlias}:</b> ${rep.text}
              </div>
            `).join('')}
           </div>`
        : '';

      return `
        <div class="feed-card">
          <div class="feed-card-header" style="justify-content:space-between;">
            <div>
              <span class="card-alias">@${c.authorAlias}</span>
              <span class="card-meta"> • ${c.city || ''}</span>
            </div>
            <span class="card-meta">${new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div class="card-body">${c.content}</div>
          <div class="clink-row">
            <button class="clink-btn" onclick="window.__reactConfession('${c._id}', 'fire')">🔥 (${(c.reactions && c.reactions.fire) || 0})</button>
            <button class="clink-btn" onclick="window.__reactConfession('${c._id}', 'clink')">☕ (${(c.reactions && c.reactions.clink) || 0})</button>
            <button class="clink-btn" onclick="window.__reactConfession('${c._id}', 'skull')">💀 (${(c.reactions && c.reactions.skull) || 0})</button>
            <button class="clink-btn" onclick="window.__reactConfession('${c._id}', 'hug')">🫂 (${(c.reactions && c.reactions.hug) || 0})</button>
          </div>
          ${repliesHtml}
          <div style="display:flex;gap:6px;margin-top:7px;">
            <input type="text" id="reply-input-${c._id}" placeholder="Reply to @${c.authorAlias}..." maxlength="140" style="margin-bottom:0;padding:5px 9px;font-size:0.74rem;height:30px;">
            <button type="button" class="btn-outline" style="padding:4px 10px;font-size:0.72rem;height:30px;white-space:nowrap;" onclick="window.__submitReply('${c._id}')">💬 Reply</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderRidesList() {
    const el = document.getElementById('rides-list');
    if (el) el.innerHTML = buildRidesHtml();
  }
  function renderHangoutsList() {
    const el = document.getElementById('hangouts-list');
    if (el) el.innerHTML = buildHangoutsHtml();
  }

  async function fetchAllData() {
    try {
      const qs = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : '';
      const [owlsRes, ridesRes, hangoutsRes, confRes] = await Promise.all([
        fetch(`/api/owls${qs}`),
        fetch('/api/rides'),
        fetch('/api/hangouts'),
        fetch(`/api/confessions${qs}`)
      ]);
      allOwls = await owlsRes.json();
      allRides = await ridesRes.json();
      allHangouts = await hangoutsRes.json();
      allConfessions = await confRes.json();

      let found = sessionId ? allOwls.find(o => o.sessionId === sessionId) : null;

      // Auto-restore saved user profile if server re-seeded or first load
      if (!found) {
        const cachedProfileRaw = localStorage.getItem('3am_my_profile');
        const defaultPayload = cachedProfileRaw ? JSON.parse(cachedProfileRaw) : {
          sessionId: sessionId || ('owl_me_' + Math.random().toString(36).substring(2, 10)),
          alias: 'Dead',
          pronouns: 'he/him',
          bio: 'Up at 3 AM exploring the radar 🌙',
          city: 'Thane',
          neighborhood: 'Hiranandani Estate',
          auraType: 'vibe',
          beverage: '☕ Coffee',
          interests: ['coding', 'music', 'gaming'],
          lookingFor: ['late-night-ride', 'just-vibing'],
          socialLinks: {
            instagram: { handle: 'dead.3am', isPublic: true },
            spotify: { handle: 'dead_vibes', isPublic: true }
          },
          profileType: 'open',
          avatarEmoji: '🦉',
          statusText: 'Wide awake in Thane ⚡',
          currentTrack: 'After Hours - The Weeknd',
          lat: 19.2183,
          lng: 72.9781
        };
        const restoreRes = await fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(defaultPayload)
        });
        if (restoreRes.ok) {
          found = await restoreRes.json();
          sessionId = found.sessionId;
          localStorage.setItem('3am_session_id', sessionId);
          localStorage.setItem('3am_my_profile', JSON.stringify(defaultPayload));
          allOwls.unshift(found);
        }
      }

      if (found) {
        myOwl = found;
        prefillCheckInForm(myOwl);
      }

      // Fetch user's social state (clinked IDs, mutual IDs, following IDs) + scoped private messages
      const [socialRes, msgsRes] = await Promise.all([
        fetch(`/api/my-social-state?sessionId=${encodeURIComponent(sessionId || '')}`),
        fetch(`/api/messages?sessionId=${encodeURIComponent(sessionId || '')}`)
      ]);
      if (socialRes.ok) {
        const socialData = await socialRes.json();
        clinkedSet = new Set((socialData.clinkedOwlIds || []).map(String));
        mutualSet = new Set((socialData.mutualOwlIds || []).map(String));
        followingSet = new Set((socialData.followingOwlIds || []).map(String));
        pendingSet = new Set((socialData.pendingOwlIds || []).map(String));
      }
      allMessages = await msgsRes.json();

      document.getElementById('online-count-val').textContent = allOwls.length;
      updateUnreadIndicators();
      applyFilterAndRender();
      if (currentPageIndex === 3) {
        renderMessagesInbox();
        renderActiveChat();
      } else if (currentPageIndex === 4) {
        renderProfileTab(null);
      }
    } catch (err) {
      console.error('Error loading data:', err);
    }
  }

  let selectedInterestsList = ['coding', 'music', 'gaming'];
  const ALL_INTERESTS = ['coding', 'music', 'anime', 'gaming', 'photography', 'fitness', 'travel', 'reading', 'art', 'cooking', 'movies', 'crypto', 'startups', 'poetry', 'fashion', 'sports', 'design'];

  function updateInterestsDropdownUI() {
    const labelEl = document.getElementById('interests-dropdown-label');
    const menuEl = document.getElementById('interests-dropdown-menu');
    if (labelEl) {
      if (selectedInterestsList.length === 0) {
        labelEl.textContent = '✨ Match Interests (Select up to 5)';
      } else {
        labelEl.textContent = `✨ Interests (${selectedInterestsList.length}/5): ${selectedInterestsList.map(i => '#' + i).join(', ')}`;
      }
    }
    if (menuEl) {
      menuEl.querySelectorAll('.multi-select-item').forEach(item => {
        const val = item.dataset.val;
        const isChecked = selectedInterestsList.includes(val);
        item.classList.toggle('checked', isChecked);
        const box = item.querySelector('.ms-checkbox');
        if (box) box.textContent = isChecked ? '✓' : '';
      });
    }
  }

  function prefillCheckInForm(owl) {
    if (!owl) return;
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el && val != null) el.value = val;
    };
    setVal('checkin-alias', owl.alias);
    setVal('checkin-pronouns', owl.pronouns);
    setVal('checkin-bio', owl.bio);
    setVal('checkin-city', owl.city || 'Thane');
    setVal('checkin-neighborhood', owl.neighborhood);
    setVal('checkin-avatar', owl.avatarEmoji || '🦉');
    setVal('checkin-status', owl.statusText);
    setVal('checkin-track', owl.currentTrack);
    setVal('checkin-profile-type', owl.profileType || 'open');
    if (owl.beverage) setVal('checkin-beverage', owl.beverage);
    if (Array.isArray(owl.lookingFor) && owl.lookingFor[0]) {
      setVal('checkin-looking-for', owl.lookingFor[0]);
    }
    if (Array.isArray(owl.interests) && owl.interests.length > 0) {
      selectedInterestsList = owl.interests.slice(0, 5);
      updateInterestsDropdownUI();
    }
    if (owl.avatarEmoji) {
      document.querySelectorAll('#avatar-picker .avatar-opt').forEach(opt => {
        opt.classList.toggle('selected', opt.textContent === owl.avatarEmoji);
      });
    }
    if (owl.socialLinks) {
      setVal('soc-ig', owl.socialLinks.instagram?.handle || '');
      setVal('soc-snap', owl.socialLinks.snapchat?.handle || '');
      setVal('soc-spot', owl.socialLinks.spotify?.handle || '');
      setVal('soc-disc', owl.socialLinks.discord?.handle || '');
      setVal('soc-twit', owl.socialLinks.twitter?.handle || '');
    }
  }

  window.__editMyProfile = function() {
    if (myOwl) prefillCheckInForm(myOwl);
    const formContainer = document.getElementById('checkin-form-container');
    const checkedContainer = document.getElementById('checked-in-container');
    if (formContainer) formContainer.style.display = 'block';
    if (checkedContainer) checkedContainer.classList.add('hidden');
    navigateToPage(2);
    document.querySelectorAll('.dive-sub-btn').forEach(b => b.classList.toggle('active', b.dataset.dive === 'broadcast'));
    document.querySelectorAll('.dive-sub-pane').forEach(p => p.classList.toggle('active', p.id === 'dive-broadcast'));
    showToast('✏️ Update your broadcast & tap Dive In!');
  };

  // Form Pickers & Multi-Select Dropdown (Max 5)
  function setupFormPickers() {
    const emojis = ['🦉','🐺','🌙','🔮','👻','🎃','🦇','💀','🐱','🦊','🐸','🍄','🌸','⚡','🔥','🎵','🎮','📚','💻','🧃'];
    const avatarPicker = document.getElementById('avatar-picker');
    const avatarInput = document.getElementById('checkin-avatar');
    emojis.forEach(e => {
      const div = document.createElement('div');
      div.className = 'avatar-opt';
      div.textContent = e;
      div.onclick = () => {
        document.querySelectorAll('.avatar-opt').forEach(opt => opt.classList.remove('selected'));
        div.classList.add('selected');
        avatarInput.value = e;
      };
      avatarPicker.appendChild(div);
    });
    if (avatarPicker.children[0]) avatarPicker.children[0].classList.add('selected');

    // Multi-Select Dropdown (Max 5 Interests)
    const dropdownBtn = document.getElementById('interests-dropdown-btn');
    const dropdownMenu = document.getElementById('interests-dropdown-menu');
    const dropdownWrap = document.getElementById('interests-dropdown-wrap');

    if (dropdownMenu && dropdownBtn) {
      dropdownMenu.innerHTML = `
        <div class="multi-select-header">
          <span>Select up to 5 interests</span>
          <button type="button" class="ms-done-btn" id="ms-done-btn">Done ✓</button>
        </div>
        <div class="multi-select-grid">
          ${ALL_INTERESTS.map(interest => `
            <div class="multi-select-item" data-val="${interest}">
              <span class="ms-checkbox"></span>
              <span>#${interest}</span>
            </div>
          `).join('')}
        </div>
      `;

      dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
      });

      const doneBtn = document.getElementById('ms-done-btn');
      if (doneBtn) {
        doneBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdownMenu.classList.add('hidden');
        });
      }

      dropdownMenu.querySelectorAll('.multi-select-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = item.dataset.val;
          if (selectedInterestsList.includes(val)) {
            selectedInterestsList = selectedInterestsList.filter(i => i !== val);
          } else {
            if (selectedInterestsList.length >= 5) {
              showToast('⚠️ Maximum 5 interests allowed!');
              return;
            }
            selectedInterestsList.push(val);
          }
          updateInterestsDropdownUI();
        });
      });

      document.addEventListener('click', (e) => {
        if (dropdownWrap && !dropdownWrap.contains(e.target)) {
          dropdownMenu.classList.add('hidden');
        }
      });

      updateInterestsDropdownUI();
    }

    const activities = [
      { label: '☕ Coffee', val: 'coffee' },
      { label: '📚 Study', val: 'study' },
      { label: '🚶 Walk', val: 'walk' },
      { label: '🍕 Food', val: 'food' },
      { label: '🎮 Gaming', val: 'gaming' },
      { label: '🎵 Music', val: 'music' },
      { label: '🚗 Drive', val: 'drive' },
      { label: '📸 Photo', val: 'photography' },
      { label: '😌 Chill', val: 'just-chill' }
    ];
    const actPicker = document.getElementById('activity-picker');
    const actInput = document.getElementById('hangout-activity');
    if (actPicker) {
      activities.forEach((a, idx) => {
        const pill = document.createElement('span');
        pill.className = 'tag-pill' + (idx === 0 ? ' selected' : '');
        pill.textContent = a.label;
        pill.onclick = () => {
          actPicker.querySelectorAll('.tag-pill').forEach(p => p.classList.remove('selected'));
          pill.classList.add('selected');
          actInput.value = a.val;
        };
        actPicker.appendChild(pill);
      });
    }
  }

  async function handleCheckIn(e) {
    e.preventDefault();
    const rawCity = document.getElementById('checkin-city').value.trim() || 'Thane';
    const cityKey = rawCity.toLowerCase();
    let lat = cityCoords[cityKey] ? cityCoords[cityKey].lat : 19.2183 + (Math.random() - 0.5) * 0.02;
    let lng = cityCoords[cityKey] ? cityCoords[cityKey].lng : 72.9781 + (Math.random() - 0.5) * 0.02;

    const statusTextVal = document.getElementById('checkin-status').value.trim();
    const lookingForEl = document.getElementById('checkin-looking-for');
    const profileTypeEl = document.getElementById('checkin-profile-type');
    const beverageEl = document.getElementById('checkin-beverage');

    const payload = {
      sessionId,
      alias: document.getElementById('checkin-alias').value.trim() || 'Dead',
      pronouns: document.getElementById('checkin-pronouns').value.trim(),
      bio: document.getElementById('checkin-bio')?.value.trim() || statusTextVal || 'Up at 3 AM exploring the radar 🌙',
      city: rawCity,
      neighborhood: document.getElementById('checkin-neighborhood').value.trim(),
      auraType: document.querySelector('input[name="aura"]:checked')?.value || 'vibe',
      beverage: beverageEl ? beverageEl.value : '☕ Coffee',
      interests: selectedInterestsList.slice(0, 5),
      lookingFor: lookingForEl ? [lookingForEl.value] : (myOwl?.lookingFor || ['late-night-ride']),
      socialLinks: myOwl?.socialLinks || {
        instagram: { handle: document.getElementById('soc-ig')?.value.trim() || 'dead.3am', isPublic: true },
        spotify: { handle: document.getElementById('soc-spot')?.value.trim() || 'dead_vibes', isPublic: true }
      },
      profileType: profileTypeEl ? profileTypeEl.value : 'open',
      avatarEmoji: document.getElementById('checkin-avatar').value || '🦉',
      statusText: statusTextVal,
      currentTrack: document.getElementById('checkin-track').value.trim(),
      lat,
      lng
    };

    const res = await fetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const savedOwl = await res.json();
    sessionId = savedOwl.sessionId;
    localStorage.setItem('3am_session_id', sessionId);
    localStorage.setItem('3am_my_profile', JSON.stringify(payload));
    myOwl = savedOwl;

    // Also post statusText to the 3AM Feed if entered so it appears at the top of the Home feed
    if (statusTextVal) {
      await fetch('/api/confessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, content: statusTextVal })
      });
    }

    // Keep #checkin-form-container visible so Dive In button is always accessible on 1 screen
    document.getElementById('checkin-form-container').style.display = 'block';
    showToast(`🌊 Broadcast live as @${savedOwl.alias}!`);
    await fetchAllData();
    navigateToPage(0);
    const homeScroll = document.querySelector('#page-home .page-scroll-inner');
    if (homeScroll) homeScroll.scrollTop = 0;
  }

  async function handleCheckOut() {
    if (sessionId) {
      await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
    }
    showToast('👻 Went ghost.');
    await fetchAllData();
  }

  async function sendClink(toOwlId, reactionType) {
    if (!sessionId) {
      showToast('🌊 Dive In first to send a Cheers!');
      navigateToPage(2);
      return;
    }
    const idStr = String(toOwlId);
    if (clinkedSet.has(idStr)) {
      showToast('☕ You already sent Cheers to this Night Owl!');
      return;
    }

    const res = await fetch('/api/clink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromSessionId: sessionId, toOwlId: idStr, reactionType: reactionType || '☕' })
    });
    const data = await res.json();
    if (res.ok) {
      clinkedSet.add(idStr);
      const target = allOwls.find(o => String(o._id || o.id) === idStr);
      if (target) target.clinksReceived = (target.clinksReceived || 0) + 1;
      showToast('☕ Cheers sent!');
      applyFilterAndRender();
    } else if (data.alreadyClinked) {
      clinkedSet.add(idStr);
      showToast('☕ Already sent Cheers to this Night Owl!');
      applyFilterAndRender();
    }
  }

  async function followOwl(targetOwlId) {
    if (!sessionId) {
      showToast('🌊 Dive In first to follow!');
      navigateToPage(2);
      return;
    }
    const idStr = String(targetOwlId);
    const res = await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, targetOwlId: idStr })
    });
    const data = await res.json();
    if (res.ok) {
      if (data.status === 'pending') {
        pendingSet.add(idStr);
        showToast('🔒 Follow request sent! Once accepted, Map Pin & Inbox unlock.');
      } else {
        followingSet.add(idStr);
        mutualSet.add(idStr);
        showToast('✓ Connected! Mutual DM Inbox & Live Map Pin unlocked.');
      }
      await fetchAllData();
    }
  }

  async function handleWallPost(e) {
    e.preventDefault();
    const input = document.getElementById('wall-input');
    const content = input.value.trim();
    if (!content) return;
    if (!sessionId) {
      showToast('🌊 Dive In first to post to the feed!');
      navigateToPage(2);
      return;
    }
    const res = await fetch('/api/confessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, content })
    });
    if (res.ok) {
      const created = await res.json();
      input.value = '';
      if (myOwl) {
        myOwl.statusText = content;
      }
      allConfessions.unshift(created);
      renderHomeFeed();
      const homeScroll = document.querySelector('#page-home .page-scroll-inner');
      if (homeScroll) homeScroll.scrollTop = 0;
      showToast('💭 Live on the 3AM Feed!');
    }
  }

  window.__reactConfession = async function(confessionId, reaction) {
    await fetch(`/api/confessions/${confessionId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction })
    });
    await fetchAllData();
  };

  async function handleRidePost(e) {
    e.preventDefault();
    if (!sessionId) {
      showToast('🌊 Dive In first to post a ride!');
      return;
    }
    const payload = {
      sessionId,
      city: myOwl ? myOwl.city : 'Thane',
      rideType: document.querySelector('input[name="rideType"]:checked').value,
      fromArea: document.getElementById('ride-from').value.trim(),
      toArea: document.getElementById('ride-to').value.trim(),
      departureTime: document.getElementById('ride-time').value.trim(),
      seatsAvailable: Number(document.getElementById('ride-seats').value) || 2,
      note: document.getElementById('ride-note').value.trim()
    };
    const res = await fetch('/api/rides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      document.getElementById('ride-form').reset();
      showToast('🚗 Late Night Ride dropped!');
      await fetchAllData();
    }
  }

  window.__joinRide = async function(rideId) {
    if (!sessionId) {
      showToast('🌊 Dive In first to join a ride!');
      navigateToPage(2);
      return;
    }
    const res = await fetch(`/api/rides/${rideId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    if (res.ok) {
      showToast('🚗 Joined the Late Night Ride!');
      await fetchAllData();
    }
  };

  async function handleHangoutPost(e) {
    e.preventDefault();
    if (!sessionId) {
      showToast('🌊 Dive In first to start a hangout!');
      return;
    }
    const payload = {
      sessionId,
      city: myOwl ? myOwl.city : 'Thane',
      spot: document.getElementById('hangout-spot').value.trim(),
      activity: document.getElementById('hangout-activity').value || 'coffee',
      description: document.getElementById('hangout-desc').value.trim(),
      maxPeople: Number(document.getElementById('hangout-max').value) || 4,
      startsAt: document.getElementById('hangout-time').value.trim()
    };
    const res = await fetch('/api/hangouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      document.getElementById('hangout-form').reset();
      showToast('🎯 Night Hangout launched!');
      await fetchAllData();
    }
  }

  window.__joinHangout = async function(hangoutId) {
    if (!sessionId) {
      showToast('🌊 Dive In first to join a hangout!');
      navigateToPage(2);
      return;
    }
    const res = await fetch(`/api/hangouts/${hangoutId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    if (res.ok) {
      showToast('🎯 Joined the Night Hangout!');
      await fetchAllData();
    }
  };

  // SECTION 4: COMPACT INSTAGRAM-STYLE PROFILE VIEW (MY PROFILE vs OTHER PROFILE)
  window.__renderMyProfile = function() {
    renderProfileTab(null);
  };

  async function renderProfileTab(targetOwlId) {
    const container = document.getElementById('my-profile-view');
    if (!container) return;

    // Never fall back to a random stranger! Null targetOwlId always means MY OWN PROFILE.
    const isViewingSelf = !targetOwlId || (myOwl && String(targetOwlId) === String(myOwl._id));
    const idToLoad = isViewingSelf ? (myOwl && myOwl._id) : targetOwlId;

    if (!idToLoad) {
      container.innerHTML = `
        <div class="feed-card text-center" style="padding:18px 16px;">
          <div style="font-size:2.2rem;margin-bottom:6px;">🦉</div>
          <h4 style="color:var(--accent);margin-bottom:4px;font-size:1rem;">Set Up Your 3AM Profile</h4>
          <p class="text-muted" style="font-size:0.79rem;margin-bottom:12px;">Create your permanent Night Owl account (with JWT session) to unlock mutual pins, socials &amp; 11 PM hunting.</p>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn-primary w-100" onclick="window.__openCreateProfilePortal('register')">🦉 Create Profile / Log In (Landing Portal)</button>
            <button class="btn-outline w-100" onclick="window.__editMyProfile()">🌊 Or Quick Broadcast in Dive In</button>
          </div>
        </div>
      `;
      return;
    }

    try {
      const res = await fetch(`/api/profile/${idToLoad}${sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : ''}`);
      const profile = await res.json();
      const isMe = isViewingSelf || (myOwl && String(myOwl._id) === String(profile._id));

      const socials = profile.socialLinks || {};
      const socialChips = Object.entries(socials).map(([platform, data]) => {
        if (!data || (!data.handle && !data.locked)) return '';
        if (data.locked) {
          return `<div class="compact-social-chip locked">
            <span class="soc-name">${platform}</span>
            <span class="soc-val" style="color:#ffab00;">🔒 Follow</span>
          </div>`;
        }
        return `<div class="compact-social-chip">
          <span class="soc-name">${platform}</span>
          <span class="soc-val">@${data.handle}</span>
        </div>`;
      }).filter(Boolean).join('');

      const topContextBar = isMe
        ? `<div class="profile-context-bar">
             <span style="color:var(--eerie-green);font-weight:700;font-size:0.74rem;">👤 MY 3AM PROFILE</span>
             <span style="font-size:0.72rem;color:var(--text-secondary);">${profile.profileType === 'closed' ? '🔒 Private' : '🔓 Public'}</span>
           </div>`
        : `<div class="profile-context-bar">
             <button type="button" class="btn-outline" style="padding:3px 9px;font-size:0.7rem;" onclick="window.__renderMyProfile()">← Back to My Profile</button>
             <span style="font-size:0.72rem;color:var(--text-secondary);">Viewing @${profile.alias}</span>
           </div>`;

      const actionButtonsHtml = isMe
        ? `<div style="display:flex;gap:6px;margin-top:8px;">
             <button class="btn-primary w-100" style="padding:6px 10px;font-size:0.76rem;" onclick="window.__editMyProfile()">🌊 Edit Broadcast</button>
             <button class="btn-outline w-100" style="padding:6px 10px;font-size:0.76rem;" onclick="window.__toggleSocialsEditor()">🔗 Edit Socials & Bio</button>
             <button class="btn-outline" style="padding:6px 10px;font-size:0.76rem;white-space:nowrap;" onclick="window.__locateOnMap('${profile._id}')">📍 Pin</button>
           </div>`
        : `<div style="display:flex;gap:6px;margin-top:8px;">
             <button class="btn-primary w-100" style="padding:6px 10px;font-size:0.76rem;" onclick="window.__followOwl('${profile._id}')">
               ${profile.profileType === 'closed' ? '🔒 Request' : '➕ Follow'}
             </button>
             <button class="btn-outline w-100" style="padding:6px 10px;font-size:0.76rem;" onclick="window.__openDMWith('${profile._id}')">💬 Message</button>
             <button class="btn-outline" style="padding:6px 10px;font-size:0.76rem;" onclick="window.__locateOnMap('${profile._id}')">🗺️</button>
             <button class="btn-outline" style="padding:6px 10px;font-size:0.76rem;color:#fda4af;" onclick="window.__blockOwl('${profile._id}')" title="Block User">🚫</button>
           </div>`;

      const socialsEditorHtml = isMe ? `
        <div id="profile-socials-editor" class="feed-card compact-profile-card mt-1 hidden">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:0.76rem;font-weight:700;color:var(--text-primary);">🔗 Edit Bio & Social Handles</span>
            <button type="button" class="btn-outline" style="padding:2px 8px;font-size:0.68rem;" onclick="window.__toggleSocialsEditor()">✕</button>
          </div>
          <input type="text" id="prof-edit-bio" value="${(profile.bio || '').replace(/"/g, '&quot;')}" placeholder="Your 3 AM bio..." maxlength="160" style="margin-bottom:6px;padding:6px 9px;font-size:0.76rem;">
          <div class="compact-grid-2" style="margin-bottom:6px;">
            <input type="text" id="prof-edit-ig" value="${(socials.instagram?.handle || '').replace(/"/g, '&quot;')}" placeholder="Instagram @handle" style="margin-bottom:0;padding:6px 9px;font-size:0.75rem;">
            <input type="text" id="prof-edit-spot" value="${(socials.spotify?.handle || '').replace(/"/g, '&quot;')}" placeholder="Spotify handle" style="margin-bottom:0;padding:6px 9px;font-size:0.75rem;">
          </div>
          <div class="compact-grid-2" style="margin-bottom:6px;">
            <input type="text" id="prof-edit-snap" value="${(socials.snapchat?.handle || '').replace(/"/g, '&quot;')}" placeholder="Snapchat @handle" style="margin-bottom:0;padding:6px 9px;font-size:0.75rem;">
            <input type="text" id="prof-edit-disc" value="${(socials.discord?.handle || '').replace(/"/g, '&quot;')}" placeholder="Discord tag" style="margin-bottom:0;padding:6px 9px;font-size:0.75rem;">
          </div>
          <button type="button" class="btn-primary w-100" style="padding:7px 10px;font-size:0.76rem;" onclick="window.__saveMySocials()">✓ Save Bio & Social Handles</button>
        </div>
      ` : '';

      container.innerHTML = `
        ${topContextBar}
        <div class="feed-card compact-profile-card">
          <!-- Instagram-Style Compact Top Row: Avatar Left + Stats Right -->
          <div class="ig-profile-top-row">
            <div class="ig-avatar-ring">
              <div class="ig-avatar-inner">${profile.avatarEmoji || '🦉'}</div>
            </div>
            <div class="ig-stats-row">
              <div class="ig-stat-box"><b>${profile.followersCount || 0}</b><span>Followers</span></div>
              <div class="ig-stat-box"><b>${profile.followingCount || 0}</b><span>Following</span></div>
              <div class="ig-stat-box"><b>${profile.clinksReceived || 0}</b><span>☕ Cheers</span></div>
            </div>
          </div>

          <!-- Compact Bio & Location -->
          <div class="ig-bio-block">
            <div class="ig-alias-line">
              <span style="color:var(--accent);font-weight:700;font-size:0.92rem;">@${profile.alias}</span>
              ${profile.pronouns ? `<span style="font-size:0.72rem;color:var(--text-secondary);">(${profile.pronouns})</span>` : ''}
              <span style="font-size:0.7rem;color:var(--aura-${profile.auraType || 'vibe'});margin-left:4px;">• ${(profile.auraType || 'vibe').toUpperCase()}</span>
            </div>
            <div style="font-size:0.74rem;color:var(--text-secondary);margin:2px 0;">
              📍 ${profile.neighborhood ? profile.neighborhood + ', ' : ''}${profile.city || 'Thane'}
            </div>
            ${profile.bio ? `<div style="font-size:0.8rem;color:var(--text-primary);margin-top:3px;">"${profile.bio}"</div>` : ''}
            ${profile.currentTrack ? `<div style="font-size:0.72rem;color:#c44dff;margin-top:2px;">🎵 ${profile.currentTrack}</div>` : ''}
          </div>

          ${actionButtonsHtml}
        </div>

        ${socialsEditorHtml}

        <!-- Compact Combined Vibe, Interests & Socials Card -->
        <div class="feed-card compact-profile-card mt-1">
          <div style="font-size:0.74rem;font-weight:700;color:var(--text-secondary);margin-bottom:5px;">🔥 Interests & Tonight's Vibe</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">
            ${(profile.interests || []).map(i => `<span class="tag-pill compact-pill">#${i}</span>`).join('')}
            ${(profile.lookingFor || []).map(l => `<span class="tag-pill selected compact-pill">✨ ${l.replace(/-/g, ' ')}</span>`).join('')}
          </div>

          <div style="font-size:0.74rem;font-weight:700;color:var(--text-secondary);margin-bottom:5px;">🔗 Socials ${profile.profileType === 'closed' ? '(Followers Only 🔒)' : ''}</div>
          <div class="compact-socials-grid">
            ${socialChips || '<span class="text-muted" style="font-size:0.74rem;">No socials linked yet. Tap Edit Socials to add!</span>'}
          </div>
        </div>

        ${isMe ? `
        <div class="feed-card compact-profile-card mt-1" style="border-color:rgba(16,185,129,0.28);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:0.74rem;font-weight:700;color:#6ee7b7;">🔐 JWT Auth Session (By GenZ • For GenZ)</span>
            <span style="font-size:0.68rem;color:#a7f3d0;font-family:'JetBrains Mono',monospace;">ACTIVE • 15m / 30d</span>
          </div>
          <div style="font-size:0.73rem;color:var(--text-secondary);margin-bottom:8px;">
            Signed in as <b>@${profile.alias}</b> • Access Token &amp; Refresh Token rotation enabled.
          </div>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn-outline w-100" style="padding:6px 10px;font-size:0.74rem;" onclick="window.__manualRefreshJWT()">🔄 Rotate Refresh Token</button>
            <button type="button" class="btn-outline w-100" style="padding:6px 10px;font-size:0.74rem;color:#fda4af;border-color:rgba(244,63,94,0.35);" onclick="window.__logout3AM()">🚪 Log Out</button>
          </div>
        </div>
        ` : ''}
      `;
    } catch (err) {
      console.error(err);
    }
  }

  window.__toggleSocialsEditor = function() {
    const el = document.getElementById('profile-socials-editor');
    if (el) el.classList.toggle('hidden');
  };

  window.__saveMySocials = async function() {
    if (!sessionId || !myOwl) return;
    const bio = document.getElementById('prof-edit-bio')?.value.trim() || '';
    const socialLinks = {
      instagram: { handle: document.getElementById('prof-edit-ig')?.value.trim().replace(/^@/, '') || '', isPublic: true },
      spotify: { handle: document.getElementById('prof-edit-spot')?.value.trim().replace(/^@/, '') || '', isPublic: true },
      snapchat: { handle: document.getElementById('prof-edit-snap')?.value.trim().replace(/^@/, '') || '', isPublic: true },
      discord: { handle: document.getElementById('prof-edit-disc')?.value.trim() || '', isPublic: true },
      twitter: { handle: myOwl.socialLinks?.twitter?.handle || '', isPublic: true }
    };

    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        bio,
        pronouns: myOwl.pronouns,
        avatarEmoji: myOwl.avatarEmoji,
        profileType: myOwl.profileType,
        interests: myOwl.interests,
        lookingFor: myOwl.lookingFor,
        socialLinks,
        statusText: myOwl.statusText,
        currentTrack: myOwl.currentTrack
      })
    });
    if (res.ok) {
      myOwl = await res.json();
      showToast('✓ Bio & Social Handles saved!');
      await renderProfileTab(null);
      await fetchAllData();
    }
  };

  // Audio & Clocks
  function toggleRain() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const btn = document.getElementById('btn-rain');
    if (brownNoiseNode) {
      brownNoiseNode.stop();
      brownNoiseNode.disconnect();
      brownNoiseNode = null;
      btn.classList.remove('active');
    } else {
      const bufferSize = 2 * audioContext.sampleRate;
      const noiseBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }
      brownNoiseNode = audioContext.createBufferSource();
      brownNoiseNode.buffer = noiseBuffer;
      brownNoiseNode.loop = true;
      const filter = audioContext.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      rainGain = audioContext.createGain();
      rainGain.gain.value = 0.06;
      brownNoiseNode.connect(filter);
      filter.connect(rainGain);
      rainGain.connect(audioContext.destination);
      brownNoiseNode.start();
      btn.classList.add('active');
      showToast('🌧️ Midnight rain ambience playing...');
    }
  }

  function toggleLofi() {
    const btn = document.getElementById('btn-lofi');
    if (lofiAudio.paused) {
      lofiAudio.play().catch(() => showToast('Tap anywhere first to start Lofi Radio'));
      btn.classList.add('active');
      showToast('🎵 3AM Lofi Radio streaming...');
    } else {
      lofiAudio.pause();
      btn.classList.remove('active');
    }
  }

  function initVaultParticles() {
    const canvas = document.getElementById('ghost-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const particles = [];
    const colors = ['#ff8c00', '#c44dff', '#00ff9d', '#ff2442'];
    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 3 + 1,
        dx: (Math.random() - 0.5) * 0.6,
        dy: (Math.random() - 0.5) * 0.6,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }
    function animate() {
      requestAnimationFrame(animate);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width) p.dx = -p.dx;
        if (p.y < 0 || p.y > canvas.height) p.dy = -p.dy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.6;
        ctx.fill();
      });
    }
    animate();
  }

  function startClocks() {
    function tickClock() {
      const now = new Date();
      const clockEl = document.getElementById('live-clock');
      if (clockEl) clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });

      const hr = now.getHours();
      const isNightHuntOpen = (hr === 23 || hr < 5);
      const timingStrip = document.getElementById('daytime-timing-strip');
      if (timingStrip) {
        timingStrip.style.display = isNightHuntOpen ? 'none' : 'flex';
      }

      const headingEl = document.getElementById('landing-countdown-heading');
      if (headingEl) {
        headingEl.textContent = isNightHuntOpen
          ? '🟢 3AM GATES ARE OPEN NOW • SUNRISE WIPE IN'
          : '⏳ NEXT 11:00 PM HUNT STARTS IN';
      }

      const targetTime = new Date(now);
      if (isNightHuntOpen) {
        if (hr === 23) targetTime.setDate(targetTime.getDate() + 1);
        targetTime.setHours(5, 0, 0, 0);
      } else {
        targetTime.setHours(23, 0, 0, 0);
      }

      const diff = Math.max(0, targetTime - now);
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      const formatted = `${h}:${m}:${s}`;

      const vaultCd = document.getElementById('vault-countdown');
      if (vaultCd) vaultCd.textContent = formatted;
      const inlineCd = document.getElementById('club-countdown-inline');
      if (inlineCd) inlineCd.textContent = formatted;
    }
    tickClock();
    setInterval(tickClock, 1000);
  }

  function setupSSE() {
    const evtSource = new EventSource('/api/stream');
    ['owl-joined', 'owl-left', 'clink', 'confession', 'ride-created', 'ride-joined', 'hangout-created', 'hangout-joined', 'follow', 'whisper'].forEach(evName => {
      evtSource.addEventListener(evName, () => fetchAllData());
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
