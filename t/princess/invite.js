/* ==========================================================================
   PRINCESS BIRTHDAY PARTY INVITATION - INTERACTIVE SCRIPT
   UtsavLink Kid's Birthday Collection
   ========================================================================== */

(function() {
  'use strict';

  // --- AUDIO SYNTHESIZER & SOUND EFFECTS (Web Audio API) ---
  let audioCtx = null;
  let isPlayingMusic = false;
  let melodyTimeout = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  // Play a sparkling bell tone (Music Box effect)
  function playMusicBoxNote(freq, startTime, duration = 0.8) {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    // Bell chime harmonic
    const oscHarmonic = ctx.createOscillator();
    oscHarmonic.type = 'triangle';
    oscHarmonic.frequency.setValueAtTime(freq * 2, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.15, startTime + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    oscHarmonic.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    oscHarmonic.start(startTime);
    osc.stop(startTime + duration);
    oscHarmonic.stop(startTime + duration);
  }

  // Sweet music box birthday waltz melody
  const MELODY_NOTES = [
    // Happy birthday waltz pattern in G major / high chime octave
    { note: 783.99, dur: 0.35, pause: 0.4 },  // G5
    { note: 783.99, dur: 0.25, pause: 0.3 },  // G5
    { note: 880.00, dur: 0.5, pause: 0.6 },   // A5
    { note: 783.99, dur: 0.5, pause: 0.6 },   // G5
    { note: 1046.50, dur: 0.5, pause: 0.6 },  // C6
    { note: 987.77, dur: 0.8, pause: 0.9 },   // B5

    { note: 783.99, dur: 0.35, pause: 0.4 },  // G5
    { note: 783.99, dur: 0.25, pause: 0.3 },  // G5
    { note: 880.00, dur: 0.5, pause: 0.6 },   // A5
    { note: 783.99, dur: 0.5, pause: 0.6 },   // G5
    { note: 1174.66, dur: 0.5, pause: 0.6 },  // D6
    { note: 1046.50, dur: 0.8, pause: 0.9 },  // C6

    { note: 783.99, dur: 0.35, pause: 0.4 },  // G5
    { note: 783.99, dur: 0.25, pause: 0.3 },  // G5
    { note: 1567.98, dur: 0.5, pause: 0.6 },  // G6
    { note: 1318.51, dur: 0.5, pause: 0.6 },  // E6
    { note: 1046.50, dur: 0.5, pause: 0.6 },  // C6
    { note: 987.77, dur: 0.5, pause: 0.6 },   // B5
    { note: 880.00, dur: 0.7, pause: 0.8 },   // A5

    { note: 1396.91, dur: 0.35, pause: 0.4 }, // F6
    { note: 1396.91, dur: 0.25, pause: 0.3 }, // F6
    { note: 1318.51, dur: 0.5, pause: 0.6 },  // E6
    { note: 1046.50, dur: 0.5, pause: 0.6 },  // C6
    { note: 1174.66, dur: 0.6, pause: 0.7 },  // D6
    { note: 1046.50, dur: 1.0, pause: 1.4 },  // C6
  ];

  function playMelodyLoop(index = 0) {
    if (!isPlayingMusic) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    const item = MELODY_NOTES[index % MELODY_NOTES.length];
    playMusicBoxNote(item.note, ctx.currentTime, item.dur);

    melodyTimeout = setTimeout(() => {
      playMelodyLoop(index + 1);
    }, item.pause * 1000);
  }

  function toggleMusic() {
    const bgAudio = document.getElementById('bgAudio');
    const musicBtn = document.getElementById('musicBoxBtn');

    if (isPlayingMusic) {
      isPlayingMusic = false;
      if (melodyTimeout) clearTimeout(melodyTimeout);
      if (bgAudio) bgAudio.pause();
      if (musicBtn) {
        musicBtn.classList.remove('is-playing');
        musicBtn.querySelector('.music-box-label').textContent = 'Play Melody';
      }
    } else {
      getAudioContext();
      isPlayingMusic = true;
      if (musicBtn) {
        musicBtn.classList.add('is-playing');
        musicBtn.querySelector('.music-box-label').textContent = 'Music Playing';
      }
      if (bgAudio && bgAudio.src && !bgAudio.src.includes('undefined')) {
        bgAudio.play().catch(() => playMelodyLoop(0));
      } else {
        playMelodyLoop(0);
      }
      triggerConfetti(window.innerWidth * 0.8, window.innerHeight * 0.9, 15);
    }
  }

  // Cute balloon pop sound
  function playPopSound() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  }

  // Fanfare / chime sound on unbox & RSVP
  function playFanfareChime() {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
      playMusicBoxNote(freq, now + i * 0.12, 1.2);
    });
  }

  // --- CANVAS CONFETTI SYSTEM ---
  const confettiCanvas = document.getElementById('confetti-canvas');
  let confettiCtx = null;
  let confettiParticles = [];
  const CONFETTI_COLORS = ['#f74b78', '#ff85a1', '#bca0ff', '#ffeaa7', '#74b9ff', '#55efc4', '#ffffff'];

  if (confettiCanvas) {
    confettiCtx = confettiCanvas.getContext('2d');
    function resizeConfetti() {
      confettiCanvas.width = window.innerWidth;
      confettiCanvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeConfetti);
    resizeConfetti();
  }

  function triggerConfetti(originX, originY, count = 45) {
    if (!confettiCtx) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 8 + 3;
      confettiParticles.push({
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        size: Math.random() * 8 + 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 15,
        alpha: 1,
        shape: Math.random() > 0.4 ? 'circle' : 'star'
      });
    }
    if (confettiParticles.length > 0 && !confettiAnimActive) {
      animateConfetti();
    }
  }

  let confettiAnimActive = false;
  function animateConfetti() {
    if (!confettiCtx) return;
    confettiAnimActive = true;
    confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    for (let i = confettiParticles.length - 1; i >= 0; i--) {
      const p = confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.22; // gravity
      p.vx *= 0.98;
      p.rotation += p.rotationSpeed;
      p.alpha -= 0.012;

      if (p.alpha <= 0 || p.y > confettiCanvas.height + 20) {
        confettiParticles.splice(i, 1);
        continue;
      }

      confettiCtx.save();
      confettiCtx.translate(p.x, p.y);
      confettiCtx.rotate((p.rotation * Math.PI) / 180);
      confettiCtx.globalAlpha = p.alpha;
      confettiCtx.fillStyle = p.color;

      if (p.shape === 'circle') {
        confettiCtx.beginPath();
        confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        confettiCtx.fill();
      } else {
        // Draw star
        drawStar(confettiCtx, 0, 0, 5, p.size, p.size / 2);
      }
      confettiCtx.restore();
    }

    if (confettiParticles.length > 0) {
      requestAnimationFrame(animateConfetti);
    } else {
      confettiAnimActive = false;
      confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    }
  }

  function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
  }

  // --- SPARKLE DUST CANVAS (Ambient Twinkling) ---
  const sparkleCanvas = document.getElementById('sparkle-canvas');
  if (sparkleCanvas) {
    const sCtx = sparkleCanvas.getContext('2d');
    let stars = [];

    function resizeSparkle() {
      sparkleCanvas.width = window.innerWidth;
      sparkleCanvas.height = window.innerHeight;
      stars = [];
      const count = Math.floor(window.innerWidth / 30);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * sparkleCanvas.width,
          y: Math.random() * sparkleCanvas.height,
          radius: Math.random() * 2 + 1,
          alpha: Math.random(),
          speed: Math.random() * 0.02 + 0.01,
          dir: Math.random() > 0.5 ? 1 : -1,
          color: Math.random() > 0.5 ? '#f74b78' : '#ffeaa7'
        });
      }
    }
    window.addEventListener('resize', resizeSparkle);
    resizeSparkle();

    function renderSparkles() {
      sCtx.clearRect(0, 0, sparkleCanvas.width, sparkleCanvas.height);
      for (let star of stars) {
        star.alpha += star.speed * star.dir;
        if (star.alpha > 0.85) star.dir = -1;
        if (star.alpha < 0.15) star.dir = 1;

        sCtx.beginPath();
        sCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        sCtx.fillStyle = star.color;
        sCtx.globalAlpha = star.alpha;
        sCtx.shadowBlur = 8;
        sCtx.shadowColor = star.color;
        sCtx.fill();
      }
      requestAnimationFrame(renderSparkles);
    }
    renderSparkles();

    // Fairy dust trail on touch/cursor
    window.addEventListener('pointermove', (e) => {
      if (Math.random() > 0.6) {
        triggerConfetti(e.clientX, e.clientY, 2);
      }
    });
  }

  // --- UNBOXING EXPERIENCE ---
  const unboxOverlay = document.getElementById('unboxingOverlay');
  const unboxBtn = document.getElementById('unboxingBtn');
  const giftBoxWrapper = document.getElementById('giftBoxWrapper');

  function openInvitation() {
    if (!unboxOverlay || unboxOverlay.classList.contains('revealed')) return;
    playFanfareChime();
    triggerConfetti(window.innerWidth / 2, window.innerHeight / 2, 70);

    unboxOverlay.classList.add('revealed');
    // Start music automatically if user tapped to open
    setTimeout(() => {
      toggleMusic();
    }, 600);
  }

  if (giftBoxWrapper) giftBoxWrapper.addEventListener('click', openInvitation);
  if (unboxBtn) unboxBtn.addEventListener('click', openInvitation);

  // Check URL params for editor or skip intro
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('nointro') === '1' || urlParams.get('edit') === '1') {
    if (unboxOverlay) {
      unboxOverlay.style.display = 'none';
      unboxOverlay.classList.add('revealed');
    }
  }

  // --- FLOATING INTERACTIVE BALLOONS ---
  const balloonsLayer = document.getElementById('balloonsLayer');
  const BALLOON_STYLES = ['balloon-pink', 'balloon-purple', 'balloon-gold', 'balloon-mint'];

  function createInteractiveBalloon(side, index) {
    if (!balloonsLayer) return;
    const balloon = document.createElement('div');
    const colorClass = BALLOON_STYLES[Math.floor(Math.random() * BALLOON_STYLES.length)];
    balloon.className = `interactive-balloon ${colorClass}`;
    
    // Position along sides
    const posX = side === 'left' ? 12 + Math.random() * 28 : window.innerWidth - 65 - Math.random() * 28;
    const posY = 120 + index * 140 + Math.random() * 40;
    
    balloon.style.left = `${posX}px`;
    balloon.style.top = `${posY}px`;
    balloon.style.animationDelay = `${index * 0.7}s`;

    balloon.addEventListener('click', (e) => {
      e.stopPropagation();
      playPopSound();
      const rect = balloon.getBoundingClientRect();
      triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2, 24);
      balloon.style.transform = 'scale(0)';
      balloon.style.opacity = '0';
      setTimeout(() => {
        balloon.remove();
        // Respawn after 4 seconds
        setTimeout(() => createInteractiveBalloon(side, index), 4000);
      }, 250);
    });

    balloonsLayer.appendChild(balloon);
  }

  function spawnBalloons() {
    if (!balloonsLayer || window.innerWidth < 450) return;
    balloonsLayer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      createInteractiveBalloon('left', i);
      createInteractiveBalloon('right', i);
    }
  }
  spawnBalloons();
  window.addEventListener('resize', () => {
    if (window.innerWidth < 450 && balloonsLayer) balloonsLayer.innerHTML = '';
  });

  // --- COUNTDOWN TIMER ---
  function initCountdown() {
    // Default: Oct 24, 2026, 3:00 PM IST
    const partyDate = new Date('2026-10-24T15:00:00+05:30').getTime();

    function update() {
      const now = new Date().getTime();
      const diff = partyDate - now;

      if (diff <= 0) {
        document.getElementById('cdDays').textContent = '00';
        document.getElementById('cdHours').textContent = '00';
        document.getElementById('cdMinutes').textContent = '00';
        document.getElementById('cdSeconds').textContent = '00';
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      const elDays = document.getElementById('cdDays');
      const elHours = document.getElementById('cdHours');
      const elMinutes = document.getElementById('cdMinutes');
      const elSeconds = document.getElementById('cdSeconds');

      if (elDays) elDays.textContent = String(days).padStart(2, '0');
      if (elHours) elHours.textContent = String(hours).padStart(2, '0');
      if (elMinutes) elMinutes.textContent = String(minutes).padStart(2, '0');
      if (elSeconds) elSeconds.textContent = String(seconds).padStart(2, '0');
    }
    update();
    setInterval(update, 1000);
  }
  initCountdown();

  // --- MUSIC BOX BUTTON ---
  const musicBoxBtn = document.getElementById('musicBoxBtn');
  if (musicBoxBtn) {
    musicBoxBtn.addEventListener('click', toggleMusic);
  }

  // --- LIGHTBOX MODAL ---
  const lightboxModal = document.getElementById('lightboxModal');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxCaption = document.getElementById('lightboxCaption');
  const lightboxClose = document.getElementById('lightboxClose');

  document.querySelectorAll('.polaroid-card').forEach(card => {
    card.addEventListener('click', () => {
      const img = card.querySelector('.polaroid-img');
      const caption = card.querySelector('.polaroid-caption');
      if (lightboxModal && img) {
        lightboxImg.src = img.src;
        lightboxCaption.textContent = caption ? caption.textContent : 'Sweet Memory ✨';
        lightboxModal.classList.add('active');
      }
    });
  });

  if (lightboxClose) {
    lightboxClose.addEventListener('click', () => lightboxModal.classList.remove('active'));
  }
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) lightboxModal.classList.remove('active');
    });
  }

  // --- INTERACTIVE RSVP SUBMISSION ---
  const rsvpForm = document.getElementById('birthdayRsvpForm');
  const rsvpSuccess = document.getElementById('rsvpSuccess');
  const wishesWall = document.getElementById('wishesWallGrid');

  if (rsvpForm) {
    rsvpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const parentName = document.getElementById('parentName')?.value.trim();
      const childNames = document.getElementById('childNames')?.value.trim();
      const wishText = document.getElementById('birthdayWish')?.value.trim();

      playFanfareChime();
      triggerConfetti(window.innerWidth / 2, window.innerHeight * 0.7, 60);

      if (rsvpSuccess) {
        rsvpSuccess.style.display = 'block';
        rsvpSuccess.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      // If a birthday wish was entered, dynamically add it to the Wishes Wall
      if (wishText && wishesWall) {
        const newCard = document.createElement('article');
        newCard.className = 'wish-card';
        newCard.innerHTML = `
          <p class="wish-author">👑 ${parentName || 'Royal Guest'} & ${childNames || 'Family'}</p>
          <p class="wish-text">"${wishText}"</p>
        `;
        wishesWall.prepend(newCard);
      }

      // Reset form
      rsvpForm.reset();
      showToast('💖 Thank you! Your RSVP has been received.');
    });
  }

  // --- TOAST HELPER ---
  function showToast(msg) {
    const toast = document.getElementById('princessToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3200);
  }

  // --- WHATSAPP & COPY LINK SHARING ---
  const whatsappShareBtn = document.getElementById('whatsappShareBtn');
  if (whatsappShareBtn) {
    whatsappShareBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const text = `👑 You're invited to Princess Aria's 5th Birthday Celebration! Join us for a magical fairytale party with games, magic & sweet treats! ✨\n\nView details & RSVP here: ${window.location.href}`;
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
    });
  }

  const copyLinkBtn = document.getElementById('copyLinkBtn');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href).then(() => {
        showToast('✨ Invitation link copied to clipboard!');
      }).catch(() => {
        showToast('✨ Link ready: ' + window.location.href);
      });
    });
  }

  // --- ADD TO CALENDAR (.ICS Generator) ---
  const addToCalendarBtn = document.getElementById('addToCalendarBtn');
  if (addToCalendarBtn) {
    addToCalendarBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const title = "Princess Aria's 5th Birthday Party";
      const desc = "Join us for Princess Aria's 5th Birthday Party! Games, magic show, cake cutting & royal banquet.";
      const loc = "The Grand Starlight Ballroom & Gardens, 124 Princess Boulevard, Worli Seaface, Mumbai";
      const start = "20261024T150000";
      const end = "20261024T193000";

      // Google Calendar web URL
      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&details=${encodeURIComponent(desc)}&location=${encodeURIComponent(loc)}`;
      window.open(gcalUrl, '_blank');
    });
  }

  // --- LIVE EDITOR PREVIEW SUPPORT (SessionStorage / URL parameters) ---
  try {
    const rawPreview = sessionStorage.getItem('inviteo:preview');
    if (rawPreview) {
      const parsed = JSON.parse(rawPreview);
      if (parsed && parsed.data) {
        applyCustomData(parsed.data);
      }
    }
  } catch (err) {
    console.warn('Preview parse note:', err);
  }

  function applyCustomData(data) {
    if (!data) return;
    if (data.childName) {
      const titleEl = document.getElementById('princessTitle');
      if (titleEl) titleEl.textContent = data.childName;
    }
    if (data.age) {
      const ageNum = document.getElementById('turningAgeNum');
      if (ageNum) ageNum.textContent = data.age;
      const kicker = document.getElementById('heroSubtitle');
      if (kicker) kicker.textContent = `Our Little Princess is Turning ${data.age}!`;
    }
    if (data.partyDate) {
      const dateEl = document.getElementById('heroDate');
      if (dateEl) dateEl.textContent = data.partyDate;
    }
    if (data.partyVenue) {
      const venueEl = document.getElementById('venueName');
      if (venueEl) venueEl.textContent = data.partyVenue;
    }
  }

})();
