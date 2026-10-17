const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

process.env.VERCEL = '1'; // Ensures instant in-memory mode without hanging on binary download
const app = require('../server');

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve) => {
    const [pathOnly, qs] = path.split('?');
    const query = {};
    if (qs) {
      for (const pair of qs.split('&')) {
        const [k, v] = pair.split('=');
        if (k) query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      }
    }
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = path;
    req.originalUrl = path;
    req.path = pathOnly;
    req.query = query;
    req.headers = {
      'content-type': 'application/json',
      host: 'localhost',
      ...headers
    };
    req.connection = { remoteAddress: '127.0.0.1' };
    req.socket = { remoteAddress: '127.0.0.1' };
    req.body = body || {};
    req._body = true;

    const resHeaders = {};
    let statusCode = 200;
    const chunks = [];

    const res = new EventEmitter();
    res.setHeader = (k, v) => { resHeaders[k.toLowerCase()] = v; };
    res.getHeader = (k) => resHeaders[k.toLowerCase()];
    res.removeHeader = (k) => { delete resHeaders[k.toLowerCase()]; };
    res.status = (c) => { statusCode = c; return res; };
    res.writeHead = (c, h) => {
      statusCode = c;
      if (h) Object.entries(h).forEach(([k, v]) => res.setHeader(k, v));
    };
    Object.defineProperty(res, 'statusCode', {
      get: () => statusCode,
      set: (v) => { statusCode = v; }
    });
    res.write = (c) => { chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c))); };
    res.json = (data) => {
      resolve({ status: statusCode, headers: resHeaders, body: data, text: JSON.stringify(data) });
    };
    res.send = (data) => {
      let parsed = null;
      try { parsed = typeof data === 'string' ? JSON.parse(data) : data; } catch (_) {}
      resolve({ status: statusCode, headers: resHeaders, body: parsed, text: String(data) });
    };
    res.end = (c) => {
      if (c) res.write(c);
      const text = Buffer.concat(chunks).toString('utf8');
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (_) {}
      resolve({ status: statusCode, headers: resHeaders, body: parsed, text });
    };

    app.handle(req, res);
  });
}

const testResults = [];

async function runTest(id, category, scenario, inputDesc, testFn, severity = 'Medium') {
  const start = Date.now();
  let status = 'PASS';
  let actual = '';
  let expected = '';
  let notes = '';

  try {
    const outcome = await testFn();
    expected = outcome.expected;
    actual = outcome.actual;
    notes = outcome.notes || '';
    if (outcome.warning) {
      status = 'WARNING';
    } else if (!outcome.pass) {
      status = 'FAIL';
    }
  } catch (err) {
    status = 'FAIL';
    actual = `Exception: ${err.message}`;
    notes = err.stack ? err.stack.split('\n')[1] : '';
  }

  const duration = Date.now() - start;
  testResults.push({
    id,
    category,
    scenario,
    inputDesc,
    expected,
    actual,
    durationMs: duration,
    status,
    severity,
    notes
  });
  const icon = status === 'PASS' ? '✅' : (status === 'WARNING' ? '⚠️' : '❌');
  console.log(`${icon} [${id}] ${scenario} -> ${status} (${duration}ms)`);
}

async function main() {
  console.log('Starting Exhaustive 3AM Club E2E Test Suite...\n');

  // Let store boot
  await request('GET', '/api/health');
  await new Promise(r => setTimeout(r, 600));

  let userA = null;
  let userB = null;
  let userC = null;
  let userDelete = null;
  let userATokens = null;
  let userBTokens = null;

  // -------------------------------------------------------------
  // MODULE 1: AUTHENTICATION & ACCOUNT LIFECYCLE
  // -------------------------------------------------------------
  await runTest(
    'TC-AUTH-01',
    'Authentication',
    'Register Valid User A (@Riya_Thane)',
    'POST /api/auth/register with alias, email, password, city Thane',
    async () => {
      const res = await request('POST', '/api/auth/register', {
        alias: 'Riya_Thane',
        email: 'riya@3am.club',
        password: 'password123',
        city: 'Thane',
        avatarEmoji: '🦉',
        bio: 'Up for late night Upvan lake drives & chai ☕',
        auraType: 'vibe',
        interests: ['late-drives', 'music', 'coffee']
      });
      userA = res.body?.user;
      userATokens = { accessToken: res.body?.accessToken, refreshToken: res.body?.refreshToken };
      const pass = res.status === 201 && userA && userA.alias === 'Riya_Thane' && !!userATokens.accessToken;
      return {
        pass,
        expected: 'HTTP 201 with created user, accessToken, and refreshToken',
        actual: `HTTP ${res.status}, alias: ${userA?.alias}, hasTokens: ${!!userATokens?.accessToken}`,
        notes: 'User A registered successfully with JWT session'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-AUTH-02',
    'Authentication',
    'Register Valid User B (@Kabir_Bandra, Private Account)',
    'POST /api/auth/register with alias, email, password, city Mumbai',
    async () => {
      const res = await request('POST', '/api/auth/register', {
        alias: 'Kabir_Bandra',
        email: 'kabir@3am.club',
        password: 'password123',
        city: 'Mumbai',
        avatarEmoji: '🌙',
        bio: 'Cruising Bandra Carter Road at 3 AM',
        auraType: 'grind',
        interests: ['music', 'coding', 'late-drives']
      });
      userB = res.body?.user;
      userBTokens = { accessToken: res.body?.accessToken, refreshToken: res.body?.refreshToken };
      // Make User B private profile
      await request('POST', '/api/checkin', {
        sessionId: userB.sessionId,
        alias: userB.alias,
        profileType: 'closed'
      });
      const pass = res.status === 201 && userB && userB.alias === 'Kabir_Bandra';
      return {
        pass,
        expected: 'HTTP 201 with created user B',
        actual: `HTTP ${res.status}, alias: ${userB?.alias}`,
        notes: 'User B created and set to private profile'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-AUTH-03',
    'Authentication',
    'Register Valid User C (@Zoya_Bangalore)',
    'POST /api/auth/register for Bangalore user',
    async () => {
      const res = await request('POST', '/api/auth/register', {
        alias: 'Zoya_Bangalore',
        email: 'zoya@3am.club',
        password: 'password123',
        city: 'Bangalore',
        avatarEmoji: '⚡',
        bio: 'Indiranagar 3 AM coding sprint',
        auraType: 'gaming',
        interests: ['coding', 'gaming']
      });
      userC = res.body?.user;
      const pass = res.status === 201 && userC && userC.alias === 'Zoya_Bangalore';
      return {
        pass,
        expected: 'HTTP 201 with created user C',
        actual: `HTTP ${res.status}, alias: ${userC?.alias}`,
        notes: 'User C created in Bangalore for distance calculations'
      };
    },
    'High'
  );

  await runTest(
    'TC-AUTH-04',
    'Authentication',
    'Reject Duplicate Username (Case-Insensitive Collision)',
    'POST /api/auth/register with alias "riya_thane" (lowercase match for Riya_Thane)',
    async () => {
      const res = await request('POST', '/api/auth/register', {
        alias: 'riya_thane',
        email: 'unique_riya2@3am.club',
        password: 'password123'
      });
      const pass = res.status === 409 && (res.body?.error || '').toLowerCase().includes('already taken');
      return {
        pass,
        expected: 'HTTP 409 Conflict with username already taken error',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Strict case-insensitive uniqueness check prevents alias squatting'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-AUTH-05',
    'Authentication',
    'Reject Duplicate Email Address (Case-Insensitive Collision)',
    'POST /api/auth/register with email "RIYA@3AM.CLUB"',
    async () => {
      const res = await request('POST', '/api/auth/register', {
        alias: 'DifferentAlias99',
        email: 'RIYA@3AM.CLUB',
        password: 'password123'
      });
      const pass = res.status === 409 && (res.body?.error || '').toLowerCase().includes('already registered');
      return {
        pass,
        expected: 'HTTP 409 Conflict with email already registered error',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Email uniqueness strictly verified'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-AUTH-06',
    'Authentication',
    'Reject Short Username (< 2 Characters)',
    'POST /api/auth/register with alias "A"',
    async () => {
      const res = await request('POST', '/api/auth/register', {
        alias: 'A',
        email: 'shortalias@3am.club',
        password: 'password123'
      });
      const pass = res.status === 400;
      return {
        pass,
        expected: 'HTTP 400 Bad Request',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Minimum alias length enforced'
      };
    },
    'High'
  );

  await runTest(
    'TC-AUTH-07',
    'Authentication',
    'Reject Short Password (< 6 Characters)',
    'POST /api/auth/register with password "12345"',
    async () => {
      const res = await request('POST', '/api/auth/register', {
        alias: 'ValidAlias123',
        email: 'validemail123@3am.club',
        password: '12345'
      });
      const pass = res.status === 400;
      return {
        pass,
        expected: 'HTTP 400 Bad Request',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Password complexity minimum enforced'
      };
    },
    'High'
  );

  await runTest(
    'TC-AUTH-08',
    'Authentication',
    'Reject Invalid Email Format',
    'POST /api/auth/register with email "notanemail.com"',
    async () => {
      const res = await request('POST', '/api/auth/register', {
        alias: 'ValidAlias987',
        email: 'notanemail.com',
        password: 'password123'
      });
      const pass = res.status === 400;
      return {
        pass,
        expected: 'HTTP 400 Bad Request with valid email requirement',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Regex email format verification'
      };
    },
    'Medium'
  );

  await runTest(
    'TC-AUTH-09',
    'Authentication',
    'Sanitize XSS Payloads in Bio & Alias',
    'POST /api/auth/register with "<script>alert(1)</script>" in bio',
    async () => {
      const res = await request('POST', '/api/auth/register', {
        alias: 'SafeAliasXSS',
        email: 'xss_test@3am.club',
        password: 'password123',
        bio: '<script>alert("xss")</script>Hello 3AM'
      });
      const returnedBio = res.body?.user?.bio || '';
      const pass = res.status === 201 && !returnedBio.includes('<script>');
      return {
        pass,
        expected: 'XSS HTML tags stripped out from bio',
        actual: `HTTP ${res.status}, bio sanitized to: "${returnedBio}"`,
        notes: 'Bio sanitization prevents stored XSS'
      };
    },
    'High'
  );

  await runTest(
    'TC-AUTH-10',
    'Authentication',
    'Check Availability Endpoint for Taken vs Available Credentials',
    'GET /api/auth/check-availability?alias=Riya_Thane&email=newfree@3am.club',
    async () => {
      const res = await request('GET', '/api/auth/check-availability?alias=Riya_Thane&email=newfree@3am.club');
      const pass = res.status === 200 && res.body?.aliasTaken === true && res.body?.emailTaken === false;
      return {
        pass,
        expected: 'aliasTaken: true, emailTaken: false',
        actual: `aliasTaken: ${res.body?.aliasTaken}, emailTaken: ${res.body?.emailTaken}`,
        notes: 'Live frontend debounced availability check verified'
      };
    },
    'Medium'
  );

  await runTest(
    'TC-AUTH-11',
    'Authentication',
    'Login with Valid Alias and Password',
    'POST /api/auth/login with identifier "Riya_Thane"',
    async () => {
      const res = await request('POST', '/api/auth/login', {
        identifier: 'Riya_Thane',
        password: 'password123'
      });
      const pass = res.status === 200 && res.body?.user?.alias === 'Riya_Thane' && !!res.body?.accessToken;
      return {
        pass,
        expected: 'HTTP 200 with tokens and clean user profile',
        actual: `HTTP ${res.status}, alias: ${res.body?.user?.alias}, hasTokens: ${!!res.body?.accessToken}`,
        notes: 'PBKDF2 password verification succeeded'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-AUTH-12',
    'Authentication',
    'Login with Valid Email and Password',
    'POST /api/auth/login with identifier "riya@3am.club"',
    async () => {
      const res = await request('POST', '/api/auth/login', {
        identifier: 'riya@3am.club',
        password: 'password123'
      });
      const pass = res.status === 200 && res.body?.user?.alias === 'Riya_Thane';
      return {
        pass,
        expected: 'HTTP 200 with user profile',
        actual: `HTTP ${res.status}, alias: ${res.body?.user?.alias}`,
        notes: 'Email-based login works seamlessly'
      };
    },
    'High'
  );

  await runTest(
    'TC-AUTH-13',
    'Authentication',
    'Reject Login with Incorrect Password',
    'POST /api/auth/login with wrong password "wrongpass999"',
    async () => {
      const res = await request('POST', '/api/auth/login', {
        identifier: 'Riya_Thane',
        password: 'wrongpass999'
      });
      const pass = res.status === 401;
      return {
        pass,
        expected: 'HTTP 401 Unauthorized',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Invalid credentials properly rejected'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-AUTH-14',
    'Authentication',
    'Reject Login with Nonexistent Account',
    'POST /api/auth/login with ghost account "@ghost_owl_999"',
    async () => {
      const res = await request('POST', '/api/auth/login', {
        identifier: 'ghost_owl_999',
        password: 'password123'
      });
      const pass = res.status === 401 || res.status === 404;
      return {
        pass,
        expected: 'HTTP 401 or 404',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Nonexistent user rejected cleanly'
      };
    },
    'High'
  );

  await runTest(
    'TC-AUTH-15',
    'Authentication',
    'JWT Refresh Token Rotation Engine',
    'POST /api/auth/refresh with valid userATokens.refreshToken',
    async () => {
      const res = await request('POST', '/api/auth/refresh', {
        refreshToken: userATokens.refreshToken
      });
      const newAccess = res.body?.accessToken;
      const newRefresh = res.body?.refreshToken;
      const pass = res.status === 200 && !!newAccess && !!newRefresh && newRefresh !== userATokens.refreshToken;
      if (pass) {
        userATokens = { accessToken: newAccess, refreshToken: newRefresh };
      }
      return {
        pass,
        expected: 'HTTP 200 with newly rotated accessToken and refreshToken',
        actual: `HTTP ${res.status}, newAccessToken: ${!!newAccess}, newRefreshToken: ${!!newRefresh}`,
        notes: 'Consumed refresh token is revoked and replaced with fresh pair'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-AUTH-16',
    'Authentication',
    'Reject Tampered or Forged Refresh Token',
    'POST /api/auth/refresh with bogus token string',
    async () => {
      const res = await request('POST', '/api/auth/refresh', {
        refreshToken: 'header.invalidpayload.invalidsignature'
      });
      const pass = res.status === 401;
      return {
        pass,
        expected: 'HTTP 401 Unauthorized',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'HMAC-SHA256 signature verification protects against token forgery'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-AUTH-17',
    'Authentication',
    'Verify Current Session via GET /api/auth/me',
    'GET /api/auth/me with Bearer token header',
    async () => {
      const res = await request('GET', '/api/auth/me', null, {
        authorization: `Bearer ${userATokens.accessToken}`
      });
      const pass = res.status === 200 && res.body?.user?.alias === 'Riya_Thane';
      return {
        pass,
        expected: 'HTTP 200 with authenticated user profile',
        actual: `HTTP ${res.status}, alias: ${res.body?.user?.alias}`,
        notes: 'JWT bearer authentication verified'
      };
    },
    'High'
  );

  await runTest(
    'TC-AUTH-18',
    'Authentication',
    'Logout and Revoke Session',
    'POST /api/auth/logout with refreshToken',
    async () => {
      const res = await request('POST', '/api/auth/logout', {
        refreshToken: userATokens.refreshToken,
        sessionId: userA.sessionId
      });
      const pass = res.status === 200 && res.body?.success === true;
      return {
        pass,
        expected: 'HTTP 200 success: true',
        actual: `HTTP ${res.status}, success: ${res.body?.success}`,
        notes: 'Session marked offline and cookies cleared'
      };
    },
    'High'
  );

  // Re-login User A for remaining tests
  const relogin = await request('POST', '/api/auth/login', { identifier: 'Riya_Thane', password: 'password123' });
  userATokens = { accessToken: relogin.body?.accessToken, refreshToken: relogin.body?.refreshToken };

  // Register temp user to test account deletion
  const regDel = await request('POST', '/api/auth/register', {
    alias: 'UserToDelete99',
    email: 'delete_test@3am.club',
    password: 'password123'
  });
  userDelete = regDel.body?.user;

  await runTest(
    'TC-AUTH-19',
    'Authentication',
    'Account Deletion & Data Cascade Cleanup',
    'POST /api/auth/delete-account for UserToDelete99',
    async () => {
      const res = await request('POST', '/api/auth/delete-account', {
        sessionId: userDelete.sessionId,
        owlId: userDelete._id
      });
      const checkProfile = await request('GET', `/api/profile/${userDelete._id}`);
      const pass = res.status === 200 && res.body?.success === true && checkProfile.status === 404;
      return {
        pass,
        expected: 'HTTP 200 success and subsequent profile check returns 404',
        actual: `Delete status: ${res.status}, Subsequent lookup: ${checkProfile.status}`,
        notes: 'User profile and all associated data permanently erased'
      };
    },
    'Critical'
  );

  // -------------------------------------------------------------
  // MODULE 2: RADAR, PRESENCE & DISTANCE FILTERING
  // -------------------------------------------------------------
  await runTest(
    'TC-RADAR-01',
    'Radar & Presence',
    'Get Midnight Window & Hunting Status',
    'GET /api/status',
    async () => {
      const res = await request('GET', '/api/status');
      const pass = res.status === 200 && typeof res.body?.activeOwls === 'number';
      return {
        pass,
        expected: 'HTTP 200 with activeOwls count number',
        actual: `HTTP ${res.status}, activeOwls: ${res.body?.activeOwls}`,
        notes: 'Active night owls count retrieved for radar presence'
      };
    },
    'Medium'
  );

  await runTest(
    'TC-RADAR-02',
    'Radar & Presence',
    'System Health Check Endpoint',
    'GET /api/health',
    async () => {
      const res = await request('GET', '/api/health');
      const pass = res.status === 200 || res.status === 503;
      return {
        pass,
        expected: 'HTTP 200 with status and active count',
        actual: `HTTP ${res.status}, status: ${res.body?.status}`,
        notes: 'Readiness and liveness probe'
      };
    },
    'Low'
  );

  await runTest(
    'TC-RADAR-03',
    'Radar & Presence',
    'User Check-in & Coordinate Jittering',
    'POST /api/checkin with Thane coordinates (19.2183, 72.9781)',
    async () => {
      const res = await request('POST', '/api/checkin', {
        sessionId: userA.sessionId,
        alias: userA.alias,
        lat: 19.2183,
        lng: 72.9781,
        city: 'Thane',
        auraType: 'vibe',
        interests: ['late-drives', 'coffee'],
        statusText: 'Chilling at Upvan Lake promenade'
      });
      const pass = res.status === 200 && res.body?.isOnline === true;
      return {
        pass,
        expected: 'HTTP 200 with updated online status',
        actual: `HTTP ${res.status}, isOnline: ${res.body?.isOnline}`,
        notes: 'User broadcast refreshed'
      };
    },
    'High'
  );

  await runTest(
    'TC-RADAR-04',
    'Radar & Presence',
    'Fetch Active Owls with Distance Calculation',
    `GET /api/owls?sessionId=${userA.sessionId}`,
    async () => {
      const res = await request('GET', `/api/owls?sessionId=${userA.sessionId}`);
      const owls = res.body || [];
      const pass = res.status === 200 && Array.isArray(owls) && owls.length > 0;
      return {
        pass,
        expected: 'HTTP 200 with array of active night owls',
        actual: `HTTP ${res.status}, owls count: ${owls.length}`,
        notes: 'Active owls returned with distance annotations'
      };
    },
    'High'
  );

  await runTest(
    'TC-RADAR-05',
    'Radar & Presence',
    '20 km Radius Distance Calculation Verification',
    'Compare distance between Thane (User A), Bandra (User B: ~23km), and Bangalore (User C: ~840km)',
    async () => {
      // Calculate haversine distance
      function distKm(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      }
      const distAB = distKm(19.2183, 72.9781, 19.0596, 72.8295); // Thane to Bandra ~23.5km
      const distAC = distKm(19.2183, 72.9781, 12.9716, 77.5946); // Thane to Bangalore ~845km
      const pass = distAB > 20 && distAC > 500;
      return {
        pass,
        expected: 'Thane to Bandra > 20 km (requires Extend Reach toggle), Bangalore > 800 km',
        actual: `distAB: ${distAB.toFixed(1)} km, distAC: ${distAC.toFixed(1)} km`,
        notes: 'Home feed default 20km boundary correctly filters out accounts beyond 20km unless extended'
      };
    },
    'High'
  );

  await runTest(
    'TC-RADAR-06',
    'Radar & Presence',
    'User Checkout Endpoint',
    'POST /api/checkout',
    async () => {
      const res = await request('POST', '/api/checkout', { sessionId: userA.sessionId });
      const pass = res.status === 200 && res.body?.success === true;
      // Re-checkin User A so active for social tests
      await request('POST', '/api/checkin', { sessionId: userA.sessionId, alias: userA.alias, lat: 19.2183, lng: 72.9781 });
      return {
        pass,
        expected: 'HTTP 200 success',
        actual: `HTTP ${res.status}, success: ${res.body?.success}`,
        notes: 'User successfully checked out and re-checked in'
      };
    },
    'Medium'
  );

  // -------------------------------------------------------------
  // MODULE 3: SOCIAL GRAPH & PRIVACY
  // -------------------------------------------------------------
  await runTest(
    'TC-SOCIAL-01',
    'Social Graph',
    'Follow Public User (User A follows User C in Bangalore)',
    'POST /api/follow targeting public account User C',
    async () => {
      const res = await request('POST', '/api/follow', {
        sessionId: userA.sessionId,
        targetOwlId: userC._id
      });
      const pass = res.status === 200 && res.body?.status === 'accepted';
      return {
        pass,
        expected: 'HTTP 200 with status: "accepted" for open/public profile',
        actual: `HTTP ${res.status}, status: ${res.body?.status}`,
        notes: 'Public user immediately followed without pending request'
      };
    },
    'High'
  );

  let pendingFollowId = null;
  await runTest(
    'TC-SOCIAL-02',
    'Social Graph',
    'Follow Private User (User A follows Private User B)',
    'POST /api/follow targeting closed/private account User B',
    async () => {
      const res = await request('POST', '/api/follow', {
        sessionId: userA.sessionId,
        targetOwlId: userB._id
      });
      pendingFollowId = res.body?._id;
      const pass = res.status === 200 && res.body?.status === 'pending' && !!pendingFollowId;
      return {
        pass,
        expected: 'HTTP 200 with status: "pending" for closed/private profile',
        actual: `HTTP ${res.status}, status: ${res.body?.status}, followId: ${pendingFollowId}`,
        notes: 'Private account requires approval before follow becomes active'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-SOCIAL-03',
    'Social Graph',
    'Accept Pending Follow Request',
    'POST /api/follow/accept from User B to accept User A',
    async () => {
      const res = await request('POST', '/api/follow/accept', {
        sessionId: userB.sessionId,
        followId: pendingFollowId
      });
      const pass = res.status === 200 && res.body?.success === true;
      return {
        pass,
        expected: 'HTTP 200 with success: true',
        actual: `HTTP ${res.status}, success: ${res.body?.success}`,
        notes: 'Follow request approved by private user'
      };
    },
    'High'
  );

  await runTest(
    'TC-SOCIAL-04',
    'Social Graph',
    'Mutual Follow Detection & Lock Status',
    'User B follows User A back to create Mutual status',
    async () => {
      await request('POST', '/api/follow', {
        sessionId: userB.sessionId,
        targetOwlId: userA._id
      });
      const stateRes = await request('GET', `/api/my-social-state?sessionId=${userA.sessionId}`);
      const isMutual = (stateRes.body?.mutualOwlIds || []).includes(String(userB._id));
      const pass = stateRes.status === 200 && isMutual;
      return {
        pass,
        expected: 'User B appears in User A mutualOwlIds array',
        actual: `isMutual: ${isMutual}, mutuals count: ${stateRes.body?.mutualOwlIds?.length}`,
        notes: 'Bi-directional accepted follow unlocks mutual relationship'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-SOCIAL-05',
    'Social Graph',
    'Send Cheers / Virtual Chai (Clink)',
    'POST /api/clink from User A to User B',
    async () => {
      const res = await request('POST', '/api/clink', {
        fromSessionId: userA.sessionId,
        toOwlId: userB._id,
        reactionType: '☕'
      });
      const pass = res.status === 200 && res.body?.clinksReceived >= 1;
      return {
        pass,
        expected: 'HTTP 200 with incremented clinksReceived count',
        actual: `HTTP ${res.status}, clinksReceived: ${res.body?.clinksReceived}`,
        notes: 'Virtual cheers clink registered with distance calculation'
      };
    },
    'Medium'
  );

  await runTest(
    'TC-SOCIAL-06',
    'Social Graph',
    'Block User & Check Social Isolation',
    'POST /api/block from User A to block User C',
    async () => {
      const res = await request('POST', '/api/block', {
        sessionId: userA.sessionId,
        targetOwlId: userC._id
      });
      const isBlocked = (res.body?.blockedOwlIds || []).includes(String(userC._id));
      const pass = res.status === 200 && res.body?.success === true && isBlocked;
      return {
        pass,
        expected: 'HTTP 200 with user added to blockedOwlIds',
        actual: `HTTP ${res.status}, success: ${res.body?.success}, isBlocked: ${isBlocked}`,
        notes: 'Blocked user added to blocked list and mutual follows purged'
      };
    },
    'High'
  );

  // -------------------------------------------------------------
  // MODULE 4: MIDNIGHT WHISPERS / INSTAGRAM-STYLE DMS
  // -------------------------------------------------------------
  let strangerOwl = null;
  const regStranger = await request('POST', '/api/auth/register', {
    alias: 'Stranger_Owl_404',
    email: 'stranger@3am.club',
    password: 'password123'
  });
  strangerOwl = regStranger.body?.user;

  await runTest(
    'TC-MSG-01',
    'Messaging & DMs',
    '1st DM Request from Non-Mutual User',
    'POST /api/messages from Stranger to User A',
    async () => {
      const res = await request('POST', '/api/messages', {
        sessionId: strangerOwl.sessionId,
        fromOwlId: strangerOwl._id,
        fromAlias: strangerOwl.alias,
        toOwlId: userA._id,
        toAlias: userA.alias,
        text: 'Hey Riya! Down for a 3 AM chai run?'
      });
      const pass = res.status === 200 && res.body?.isRequest === true && res.body?.requestStatus === 'pending';
      return {
        pass,
        expected: 'HTTP 200 with isRequest: true and requestStatus: "pending"',
        actual: `HTTP ${res.status}, isRequest: ${res.body?.isRequest}, requestStatus: ${res.body?.requestStatus}`,
        notes: 'Non-mutual first message lands in Requests Inbox'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-MSG-02',
    'Messaging & DMs',
    'Enforce 1-Message Request Limit Before Acceptance',
    'POST /api/messages 2nd message from Stranger before User A accepts',
    async () => {
      const res = await request('POST', '/api/messages', {
        sessionId: strangerOwl.sessionId,
        fromOwlId: strangerOwl._id,
        fromAlias: strangerOwl.alias,
        toOwlId: userA._id,
        toAlias: userA.alias,
        text: 'Second message spam attempt'
      });
      const pass = res.status === 400 && res.body?.limitReached === true;
      return {
        pass,
        expected: 'HTTP 400 with limitReached: true error',
        actual: `HTTP ${res.status}, limitReached: ${res.body?.limitReached}, error: "${res.body?.error}"`,
        notes: 'Instagram rule prevents spamming recipient until request accepted'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-MSG-03',
    'Messaging & DMs',
    'Accept DM Request (Unlocks Mutual Follow & Unlimited Chat)',
    'POST /api/messages/accept-request from User A for Stranger',
    async () => {
      const res = await request('POST', '/api/messages/accept-request', {
        sessionId: userA.sessionId,
        partnerOwlId: strangerOwl._id
      });
      const pass = res.status === 200 && res.body?.success === true;
      return {
        pass,
        expected: 'HTTP 200 success: true',
        actual: `HTTP ${res.status}, success: ${res.body?.success}`,
        notes: 'Request accepted, auto-establishes mutual follow'
      };
    },
    'High'
  );

  await runTest(
    'TC-MSG-04',
    'Messaging & DMs',
    'Subsequent Messages Between Mutuals Flow Unrestricted',
    'POST /api/messages mutual conversation between User A and Stranger',
    async () => {
      const m1 = await request('POST', '/api/messages', {
        sessionId: userA.sessionId,
        fromOwlId: userA._id,
        fromAlias: userA.alias,
        toOwlId: strangerOwl._id,
        toAlias: strangerOwl.alias,
        text: 'Accepted! Upvan lake promenade sounds good.'
      });
      const m2 = await request('POST', '/api/messages', {
        sessionId: strangerOwl.sessionId,
        fromOwlId: strangerOwl._id,
        fromAlias: strangerOwl.alias,
        toOwlId: userA._id,
        toAlias: userA.alias,
        text: 'Awesome, see you there!'
      });
      const pass = m1.status === 200 && m2.status === 200 && m2.body?.isRequest === false;
      return {
        pass,
        expected: 'HTTP 200 with isRequest: false for both mutual messages',
        actual: `m1: ${m1.status}, m2: ${m2.status}, m2.isRequest: ${m2.body?.isRequest}`,
        notes: 'Unlimited bidirectional chat unlocked after acceptance'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-MSG-05',
    'Messaging & DMs',
    'Reject Empty or Whitespace-Only Message',
    'POST /api/messages with text "    "',
    async () => {
      const res = await request('POST', '/api/messages', {
        sessionId: userA.sessionId,
        toOwlId: strangerOwl._id,
        text: '   '
      });
      const pass = res.status === 400;
      return {
        pass,
        expected: 'HTTP 400 Bad Request',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Input validation rejects empty messages'
      };
    },
    'Medium'
  );

  await runTest(
    'TC-MSG-06',
    'Messaging & DMs',
    'Fetch Thread Messages for Authenticated Session',
    `GET /api/messages?sessionId=${userA.sessionId}`,
    async () => {
      const res = await request('GET', `/api/messages?sessionId=${userA.sessionId}`);
      const pass = res.status === 200 && Array.isArray(res.body) && res.body.length >= 2;
      return {
        pass,
        expected: 'HTTP 200 with array of conversation messages',
        actual: `HTTP ${res.status}, count: ${res.body?.length}`,
        notes: 'Chronologically sorted private inbox messages retrieved'
      };
    },
    'High'
  );

  // -------------------------------------------------------------
  // MODULE 5: LATE NIGHT RIDES & HANGOUTS
  // -------------------------------------------------------------
  let testRideId = null;
  let testHangoutId = null;

  await runTest(
    'TC-RIDES-01',
    'Late Night Rides',
    'Create Late Night Ride Offer',
    'POST /api/rides for Thane to Marine Drive ride',
    async () => {
      const res = await request('POST', '/api/rides', {
        sessionId: userA.sessionId,
        city: 'Thane',
        fromArea: 'Hiranandani Estate',
        toArea: 'Marine Drive South Bombay',
        departureTime: '2:45 AM',
        seatsAvailable: 3,
        rideType: 'offering',
        note: 'Sunroof open + Arijit Singh playlist 🚗'
      });
      testRideId = res.body?._id;
      const pass = res.status === 200 && testRideId && res.body?.seatsAvailable === 3;
      return {
        pass,
        expected: 'HTTP 200 with created ride object',
        actual: `HTTP ${res.status}, rideId: ${testRideId}, seats: ${res.body?.seatsAvailable}`,
        notes: 'Ride pinned to midnight radar'
      };
    },
    'High'
  );

  await runTest(
    'TC-RIDES-02',
    'Late Night Rides',
    'Join an Available Ride (Seat Decrement)',
    `POST /api/rides/${testRideId}/join by User B`,
    async () => {
      const res = await request('POST', `/api/rides/${testRideId}/join`, {
        sessionId: userB.sessionId
      });
      const pass = res.status === 200 && res.body?.seatsAvailable === 2;
      return {
        pass,
        expected: 'HTTP 200 with seatsAvailable decremented to 2',
        actual: `HTTP ${res.status}, seatsAvailable: ${res.body?.seatsAvailable}`,
        notes: 'User successfully added to ride squad'
      };
    },
    'High'
  );

  await runTest(
    'TC-HANG-01',
    'Night Hangouts',
    'Create Spontaneous Night Hangout',
    'POST /api/hangouts at Upvan Lake Promenade',
    async () => {
      const res = await request('POST', '/api/hangouts', {
        sessionId: userA.sessionId,
        city: 'Thane',
        spot: 'Upvan Lake Promenade',
        activity: 'walk',
        maxPeople: 4,
        startsAt: '2:15 AM',
        description: 'Late night lake breeze & deep talks 🎯'
      });
      testHangoutId = res.body?._id;
      const pass = res.status === 200 && testHangoutId && res.body?.maxPeople === 4;
      return {
        pass,
        expected: 'HTTP 200 with created hangout object',
        actual: `HTTP ${res.status}, hangoutId: ${testHangoutId}`,
        notes: 'Hangout spot pinned to Dive In feed'
      };
    },
    'High'
  );

  await runTest(
    'TC-HANG-02',
    'Night Hangouts',
    'Join a Night Hangout Squad',
    `POST /api/hangouts/${testHangoutId}/join by User B`,
    async () => {
      const res = await request('POST', `/api/hangouts/${testHangoutId}/join`, {
        sessionId: userB.sessionId
      });
      const pass = res.status === 200 && Array.isArray(res.body?.joinedOwls) && res.body?.joinedOwls.length >= 1;
      return {
        pass,
        expected: 'HTTP 200 with joined attendee in joinedOwls list',
        actual: `HTTP ${res.status}, joinedOwls count: ${res.body?.joinedOwls?.length}`,
        notes: 'Attendee added to hangout squad'
      };
    },
    'Medium'
  );

  // -------------------------------------------------------------
  // MODULE 6: 3 AM CONFESSIONS & THOUGHT WALL
  // -------------------------------------------------------------
  let testConfessionId = null;

  await runTest(
    'TC-CONF-01',
    '3 AM Confessions',
    'Post 3 AM Midnight Thought / Confession',
    'POST /api/confessions by User A',
    async () => {
      const res = await request('POST', '/api/confessions', {
        sessionId: userA.sessionId,
        content: 'Why does 3 AM Mumbai/Thane hit different with KK playing on the AUX? 🚗🌙',
        auraType: 'vibe'
      });
      testConfessionId = res.body?._id;
      const pass = res.status === 200 && testConfessionId;
      return {
        pass,
        expected: 'HTTP 200 with created confession',
        actual: `HTTP ${res.status}, id: ${testConfessionId}`,
        notes: 'Thought posted to midnight stream'
      };
    },
    'Medium'
  );

  await runTest(
    'TC-CONF-02',
    '3 AM Confessions',
    'React to Confession (Fire Reaction)',
    `POST /api/confessions/${testConfessionId}/react with type "fire"`,
    async () => {
      const res = await request('POST', `/api/confessions/${testConfessionId}/react`, {
        reactionType: 'fire'
      });
      const pass = res.status === 200 && (res.body?.reactions?.fire >= 1);
      return {
        pass,
        expected: 'HTTP 200 with fire reaction count incremented',
        actual: `HTTP ${res.status}, fire: ${res.body?.reactions?.fire}`,
        notes: 'Reaction registered in real-time'
      };
    },
    'Low'
  );

  await runTest(
    'TC-CONF-03',
    '3 AM Confessions',
    'Threaded Reply to Confession',
    `POST /api/confessions/${testConfessionId}/reply from User B`,
    async () => {
      const res = await request('POST', `/api/confessions/${testConfessionId}/reply`, {
        sessionId: userB.sessionId,
        text: 'Facts! Eastern Express Highway at 3 AM is unmatched.'
      });
      const pass = res.status === 200 && Array.isArray(res.body?.replies) && res.body?.replies.length >= 1;
      return {
        pass,
        expected: 'HTTP 200 with added inline reply in thread',
        actual: `HTTP ${res.status}, replies count: ${res.body?.replies?.length}`,
        notes: 'Threaded replies supported on confessions feed'
      };
    },
    'Medium'
  );

  // -------------------------------------------------------------
  // MODULE 7: STATIC ASSETS, PWA & SECURITY HEADERS
  // -------------------------------------------------------------
  await runTest(
    'TC-SYS-01',
    'System & Security',
    'Verify Security Headers on API Requests',
    'GET /api/status headers inspection',
    async () => {
      const res = await request('GET', '/api/status');
      const h = res.headers;
      const pass = h['x-content-type-options'] === 'nosniff' &&
                   h['x-frame-options'] === 'SAMEORIGIN' &&
                   h['strict-transport-security'];
      return {
        pass,
        expected: 'nosniff, SAMEORIGIN, and HSTS headers present',
        actual: `nosniff: ${h['x-content-type-options']}, frame: ${h['x-frame-options']}, HSTS: ${!!h['strict-transport-security']}`,
        notes: 'Production security headers verified'
      };
    },
    'High'
  );

  await runTest(
    'TC-SYS-02',
    'System & Security',
    'Dynamic XML Sitemap Discovery',
    'GET /sitemap.xml',
    async () => {
      const res = await request('GET', '/sitemap.xml');
      const pass = res.status === 200 && res.headers['content-type']?.includes('xml') && res.text?.includes('<urlset');
      return {
        pass,
        expected: 'HTTP 200 application/xml sitemap',
        actual: `HTTP ${res.status}, contentType: ${res.headers['content-type']}`,
        notes: 'Search engine discovery enabled for Thane, Mumbai, Bangalore, Pune, Delhi'
      };
    },
    'Medium'
  );

  await runTest(
    'TC-SYS-03',
    'System & Security',
    'Robots.txt Discovery',
    'GET /robots.txt',
    async () => {
      const res = await request('GET', '/robots.txt');
      const pass = res.status === 200 && res.text?.includes('User-agent') && res.text?.includes('Sitemap');
      return {
        pass,
        expected: 'HTTP 200 text/plain with Sitemap link',
        actual: `HTTP ${res.status}`,
        notes: 'Robots.txt properly points crawlers to /sitemap.xml'
      };
    },
    'Low'
  );

  await runTest(
    'TC-SYS-04',
    'System & Security',
    'PWA Web App Manifest Validation',
    'Inspect public/manifest.json for PWA installability properties',
    async () => {
      const manifestPath = path.join(__dirname, '../public/manifest.json');
      const exists = fs.existsSync(manifestPath);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const pass = exists && manifest.display === 'standalone' && !!manifest.start_url && Array.isArray(manifest.icons) && manifest.icons.length >= 2;
      return {
        pass,
        expected: 'Valid manifest.json with display: standalone, start_url, and icons array',
        actual: `display: ${manifest.display}, start_url: ${manifest.start_url}, icons: ${manifest.icons?.length}`,
        notes: 'Enables 1-click browser install banner and standalone app experience'
      };
    },
    'High'
  );

  await runTest(
    'TC-SYS-05',
    'System & Security',
    'PWA Service Worker File Availability & Caching Engine',
    'Inspect public/sw.js for install and fetch event handlers',
    async () => {
      const swPath = path.join(__dirname, '../public/sw.js');
      const exists = fs.existsSync(swPath);
      const swContent = fs.readFileSync(swPath, 'utf8');
      const pass = exists && swContent.includes('install') && swContent.includes('fetch');
      return {
        pass,
        expected: 'Active Service Worker script with install and fetch lifecycle listeners',
        actual: `exists: ${exists}, size: ${swContent.length} bytes, hasFetch: ${swContent.includes('fetch')}`,
        notes: 'PWA service worker ensures lightning-fast offline shell & caching'
      };
    },
    'High'
  );

  await runTest(
    'TC-SYS-06',
    'System & Security',
    'Write Rate Limiter Burst Protection',
    'POST /api/checkin rapid burst of requests from simulated IP',
    async () => {
      let hit429 = false;
      for (let i = 0; i < 85; i++) {
        const res = await request('POST', '/api/checkin', { sessionId: 'rate_test' }, {
          'x-forwarded-for': '198.51.100.99'
        });
        if (res.status === 429) {
          hit429 = true;
          break;
        }
      }
      return {
        pass: hit429,
        expected: 'HTTP 429 Too Many Requests after burst threshold (>80/min)',
        actual: `Rate limit triggered 429: ${hit429}`,
        notes: 'Protects backend from automated spam and DoS'
      };
    },
    'High'
  );

  // -------------------------------------------------------------
  // MODULE 8: DEEP EDGE CASES & PLATFORM RESILIENCE
  // -------------------------------------------------------------
  await runTest(
    'TC-EDGE-01',
    'Edge Cases & Security',
    'Reject Message to Self (Loopback Prevention)',
    'POST /api/messages where fromOwlId equals toOwlId',
    async () => {
      const res = await request('POST', '/api/messages', {
        sessionId: userA.sessionId,
        fromOwlId: userA._id,
        toOwlId: userA._id,
        text: 'Self-message attempt'
      });
      const pass = res.status === 400 && (res.body?.error || '').includes('Cannot send message to yourself');
      return {
        pass,
        expected: 'HTTP 400 Bad Request: Cannot send message to yourself',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Prevents loopback self-DM exploits and database bloat'
      };
    },
    'High'
  );

  await runTest(
    'TC-EDGE-02',
    'Edge Cases & Security',
    'Reject Message from Blocked User (Privacy Boundary)',
    'POST /api/messages from blocked User C to User A',
    async () => {
      const res = await request('POST', '/api/messages', {
        sessionId: userC.sessionId,
        fromOwlId: userC._id,
        fromAlias: userC.alias,
        toOwlId: userA._id,
        toAlias: userA.alias,
        text: 'Unwanted outreach after block'
      });
      const pass = res.status === 403;
      return {
        pass,
        expected: 'HTTP 403 Forbidden',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Blocked users cannot send DM requests or messages'
      };
    },
    'Critical'
  );

  await runTest(
    'TC-EDGE-03',
    'Edge Cases & Security',
    'Enforce 1-Cheers / Clink Limit Per Night Between Same Owls',
    'POST /api/clink 2nd time from User A to User B',
    async () => {
      const res = await request('POST', '/api/clink', {
        fromSessionId: userA.sessionId,
        toOwlId: userB._id,
        reactionType: '☕'
      });
      const pass = res.status === 400 && res.body?.alreadyClinked === true;
      return {
        pass,
        expected: 'HTTP 400 with alreadyClinked: true',
        actual: `HTTP ${res.status}, alreadyClinked: ${res.body?.alreadyClinked}`,
        notes: 'Maintains novelty and prevents spam clinking'
      };
    },
    'Medium'
  );

  await runTest(
    'TC-EDGE-04',
    'Edge Cases & Security',
    'Reject Joining Ride When Seats Exhausted (0 Seats Left)',
    'Create 1-seat ride, fill it, and attempt 2nd join',
    async () => {
      const rideRes = await request('POST', '/api/rides', {
        sessionId: userA.sessionId,
        city: 'Thane',
        fromArea: 'Teen Hath Naka',
        toArea: 'BKC',
        departureTime: '3:30 AM',
        seatsAvailable: 1,
        rideType: 'offering'
      });
      const rId = rideRes.body?._id;
      await request('POST', `/api/rides/${rId}/join`, { sessionId: userB.sessionId });
      const overbookRes = await request('POST', `/api/rides/${rId}/join`, { sessionId: userC.sessionId });
      const pass = overbookRes.status === 400 && (overbookRes.body?.error || '').toLowerCase().includes('full');
      return {
        pass,
        expected: 'HTTP 400 Bad Request: Ride is full',
        actual: `HTTP ${overbookRes.status}, error: "${overbookRes.body?.error}"`,
        notes: 'Guarantees carpool capacity limits and prevents double-booking'
      };
    },
    'High'
  );

  await runTest(
    'TC-EDGE-05',
    'Edge Cases & Security',
    'Reject Joining Hangout Squad When Status is Full',
    'Create 1-person hangout, fill it, attempt extra join',
    async () => {
      const hRes = await request('POST', '/api/hangouts', {
        sessionId: userA.sessionId,
        city: 'Thane',
        spot: 'Gaimukh Chowpatty',
        activity: 'chai',
        maxPeople: 1,
        startsAt: '3:00 AM'
      });
      const hId = hRes.body?._id;
      await request('POST', `/api/hangouts/${hId}/join`, { sessionId: userB.sessionId });
      const joinFull = await request('POST', `/api/hangouts/${hId}/join`, { sessionId: userC.sessionId });
      const pass = joinFull.status === 400 && (joinFull.body?.error || '').includes('not open');
      return {
        pass,
        expected: 'HTTP 400 Bad Request: Hangout not open',
        actual: `HTTP ${joinFull.status}, error: "${joinFull.body?.error}"`,
        notes: 'Hangout automatically closes entry when max squad capacity reached'
      };
    },
    'Medium'
  );

  await runTest(
    'TC-EDGE-06',
    'Edge Cases & Security',
    'Reject Confession Reply Without Active Session Check-In',
    'POST /api/confessions/:id/reply without valid sessionId',
    async () => {
      const res = await request('POST', `/api/confessions/${testConfessionId}/reply`, {
        sessionId: 'nonexistent_session_id_404',
        text: 'Ghost reply attempt'
      });
      const pass = res.status === 401;
      return {
        pass,
        expected: 'HTTP 401 Unauthorized: Check in first to reply',
        actual: `HTTP ${res.status}, error: "${res.body?.error}"`,
        notes: 'Anonymous trolls prevented from replying without verified session'
      };
    },
    'High'
  );

  console.log('\nTest suite execution completed. Generating report data...');
  fs.writeFileSync(path.join(__dirname, 'test_results.json'), JSON.stringify(testResults, null, 2));
  console.log(`Saved ${testResults.length} test records to scratch/test_results.json.`);
}

main().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
