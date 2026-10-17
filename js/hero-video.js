/* hero-video.js — home page video hero

   Plays video/hero-1.mp4 … hero-4.mp4 one after another and loops forever.
   The text and a white overlay stay hidden for the first REVEAL_MS of clip 1, then fade in.
   Two <video> elements take turns, so the next clip is already loaded when one ends
   (swapping the src of a single element shows a blank frame between clips).

   The videos are muted and decorative (aria-hidden). If the visitor's system asks for reduced
   motion, or the browser blocks autoplay, the text shows straight away over the still poster frame.
   Clips: re-encoded from the 4K originals to 1080p 30 fps without sound to keep the page light. */
(function () {
  'use strict';
  const hero = document.getElementById('heroVideo');
  if (!hero) return;

  const CLIPS = ['video/hero-1.mp4', 'video/hero-2.mp4', 'video/hero-3.mp4', 'video/hero-4.mp4'];
  const REVEAL_MS = 2000;

  const players = Array.from(hero.querySelectorAll('.hero-video__clip'));
  let active = 0; // which <video> is showing
  let clip = 0;   // which clip it is playing
  let revealed = false;

  function reveal() {
    if (revealed) return;
    revealed = true;
    hero.classList.add('is-revealed');
  }

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    reveal();
    return; // poster only, no playback
  }

  // Load the clip after `index` into the hidden player so it is ready to go
  function preloadNext(index) {
    const other = players[1 - active];
    other.src = CLIPS[(index + 1) % CLIPS.length];
    other.load();
  }

  function playNext() {
    const current = players[active];
    const next = players[1 - active];
    clip = (clip + 1) % CLIPS.length;
    next.currentTime = 0;
    next.play().catch(function () { /* ignore: will show poster */ });
    next.classList.add('is-active');
    current.classList.remove('is-active');
    active = 1 - active;
    preloadNext(clip);
  }
  players.forEach(function (v) { v.addEventListener('ended', playNext); });

  // Start clip 1, and show the text REVEAL_MS after it actually starts playing
  players[0].src = CLIPS[0];
  players[0].addEventListener('playing', function () { setTimeout(reveal, REVEAL_MS); }, { once: true });
  players[0].play().then(function () { preloadNext(0); }).catch(reveal); // autoplay blocked or video missing: show the text now
  players[0].addEventListener('error', reveal);
  setTimeout(reveal, REVEAL_MS + 4000); // never keep the text hidden if the video is slow to load
})();
