const NightMap = (function() {
  let map = null;
  let markers = {};
  let userMarker = null;
  // Default user location set to Thane West (19.2183, 72.9781) so opening from Thane immediately shows nearby Thane owls!
  let lastUserCoords = { lat: 19.2183, lng: 72.9781, label: 'Thane / Your Location' };

  const auraColors = {
    grind: '#00ff9d',
    exam: '#ff6a00',
    vibe: '#c44dff',
    gaming: '#ff2442'
  };

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function initMap(containerId, onLocationReady) {
    if (map) {
      setTimeout(() => map.invalidateSize(), 150);
      return map;
    }

    // Start centered on Thane / Mumbai MMR at zoom 12 so nearby pins are immediately visible!
    map = L.map(containerId, { zoomControl: false }).setView([lastUserCoords.lat, lastUserCoords.lng], 12);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap • 🎃 The 3AM Club',
      className: 'dark-tiles'
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    const locateBtn = document.getElementById('locate-me-btn');
    if (locateBtn) {
      locateBtn.onclick = () => locateUser(true, onLocationReady);
    }

    // Automatically detect live GPS on open (or default to Thane)
    locateUser(false, onLocationReady);

    setTimeout(() => map.invalidateSize(), 200);
    return map;
  }

  function placeUserPin(lat, lng, label, zoomLevel = 12) {
    lastUserCoords = { lat, lng, label: label || 'Your Location' };
    if (!map) return;

    map.flyTo([lat, lng], zoomLevel, { duration: 1.2 });

    const youAreHereIcon = L.divIcon({
      className: 'user-location-marker',
      html: `
        <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(0,229,255,0.35);animation:pulseRing 1.6s infinite;"></div>
          <div style="width:15px;height:15px;background:#00e5ff;border-radius:50%;border:2.5px solid #fff;box-shadow:0 0 18px #00e5ff;"></div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    if (userMarker) {
      userMarker.setLatLng([lat, lng]);
    } else {
      userMarker = L.marker([lat, lng], { icon: youAreHereIcon }).addTo(map);
    }
    userMarker.bindPopup(`<div class="popup-content"><b>📍 ${lastUserCoords.label}</b><div style="font-size:0.72rem;color:#00ff9d;">Showing nearby Night Owls</div></div>`);
  }

  function locateUser(showFeedback, callback) {
    if (!map) return;
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          placeUserPin(position.coords.latitude, position.coords.longitude, 'Your Live GPS Location', 12);
          if (showFeedback && window.__showToast) {
            window.__showToast('📍 Locked onto your live GPS! Showing nearby Night Owls.');
          }
          if (callback) callback(lastUserCoords);
        },
        () => {
          // Default to Thane West so nearby Thane & Mumbai MMR users show immediately
          placeUserPin(lastUserCoords.lat, lastUserCoords.lng, 'Thane West (Default Geo)', 12);
          if (showFeedback && window.__showToast) {
            window.__showToast('📍 Centered on Thane / MMR nearby Night Owls!');
          }
          if (callback) callback(lastUserCoords);
        },
        { timeout: 4000 }
      );
    } else {
      placeUserPin(lastUserCoords.lat, lastUserCoords.lng, 'Thane West', 12);
      if (callback) callback(lastUserCoords);
    }
  }

  function updateOwls(owls, myInterests = [], mutualSet = new Set(), clinkedSet = new Set()) {
    if (!map) return;

    // Only show exact location pins for people who follow each other (mutuals)
    const mutualOwls = owls.filter(o => mutualSet.has(String(o._id || o.id)));

    const normalized = mutualOwls.map(o => {
      const lat = o.coordinates ? o.coordinates.lat : o.lat;
      const lng = o.coordinates ? o.coordinates.lng : o.lng;
      const distKm = (lat != null && lng != null)
        ? haversineKm(lastUserCoords.lat, lastUserCoords.lng, lat, lng)
        : 999;
      return {
        ...o,
        id: String(o._id || o.id),
        lat,
        lng,
        distKm
      };
    }).filter(o => o.lat != null && o.lng != null);

    const currentIds = normalized.map(o => String(o.id));
    for (let id in markers) {
      if (!currentIds.includes(String(id))) {
        map.removeLayer(markers[id]);
        delete markers[id];
      }
    }

    normalized.forEach(owl => {
      const color = '#a78bfa';
      const shared = (owl.interests || []).filter(i => myInterests.includes(i));
      const hasClinked = clinkedSet.has(owl.id);

      if (!markers[owl.id]) {
        const iconHtml = `
          <div style="position:relative;width:26px;height:26px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:26px;height:26px;border-radius:50%;background:rgba(167,139,250,0.28);animation:pulseRing 2.4s infinite;"></div>
            <div style="width:13px;height:13px;background:${color};border-radius:50%;box-shadow:0 0 12px ${color};border:1.5px solid #fff;"></div>
          </div>
        `;
        const icon = L.divIcon({ className: 'owl-marker', html: iconHtml, iconSize: [26, 26], iconAnchor: [13, 13] });
        const marker = L.marker([owl.lat, owl.lng], { icon }).addTo(map);
        markers[owl.id] = marker;
      } else {
        markers[owl.id].setLatLng([owl.lat, owl.lng]);
      }

      const distBadge = owl.distKm < 1 ? `${Math.round(owl.distKm * 1000)}m` : `${owl.distKm.toFixed(1)} km`;

      const popupContent = `
        <div class="popup-content" style="min-width:195px;">
          <div class="popup-avatar">${owl.avatarEmoji || '🦉'}</div>
          <div class="popup-alias" style="color:#f3f1f8;">@${owl.alias}</div>
          <div class="popup-meta" style="color:#9ca3af;font-size:0.72rem;">📍 ${owl.neighborhood ? owl.neighborhood + ', ' : ''}${owl.city || ''} • ${distBadge}</div>
          ${shared.length > 0 ? `<div style="margin-top:4px;font-size:0.7rem;color:#a78bfa;">✦ ${shared.length} shared interest${shared.length > 1 ? 's' : ''}</div>` : ''}
          ${owl.statusText ? `<p style="margin:6px 0;font-size:0.78rem;color:#d1cfe0;">"${owl.statusText}"</p>` : ''}
          <div style="display:flex;gap:6px;margin-top:8px;">
            <button class="clink-btn ${hasClinked ? 'clinked' : ''} w-100" onclick="window.__clinkOwl('${owl.id}', '☕')">
              ${hasClinked ? `☕ Cheered ✓` : `☕ Cheers`}
            </button>
            <button class="btn-outline w-100" style="padding:4px 8px;font-size:0.72rem;" onclick="window.__viewProfile('${owl.id}')">Profile</button>
          </div>
        </div>
      `;
      markers[owl.id].bindPopup(popupContent);
    });
  }

  function focusOwl(owlId) {
    const marker = markers[String(owlId)];
    if (marker && map) {
      map.flyTo(marker.getLatLng(), 14, { duration: 1.0 });
      marker.openPopup();
    } else if (window.__showToast) {
      window.__showToast('🔒 Exact map pin is hidden until you follow each other.');
    }
  }

  function getUserCoords() {
    return lastUserCoords;
  }

  function setLastUserCoords(lat, lng, label) {
    lastUserCoords = { lat, lng, label: label || 'Your Location' };
  }

  function invalidate() {
    if (map) setTimeout(() => map.invalidateSize(), 150);
  }

  return {
    init: initMap,
    update: updateOwls,
    focus: focusOwl,
    locateUser: locateUser,
    placeUserPin: placeUserPin,
    getUserCoords: getUserCoords,
    setLastUserCoords: setLastUserCoords,
    haversineKm: haversineKm,
    invalidate: invalidate
  };
})();

window.__clinkOwl = function(owlId, reaction) {
  document.dispatchEvent(new CustomEvent('clink-action', { detail: { owlId, reaction } }));
};
window.__viewProfile = function(owlId) {
  document.dispatchEvent(new CustomEvent('view-profile', { detail: { owlId } }));
};
window.__followOwl = function(owlId) {
  document.dispatchEvent(new CustomEvent('follow-owl', { detail: { owlId } }));
};
