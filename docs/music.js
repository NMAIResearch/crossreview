// Purpose: the page's Music on/off button. The song is requested only on a press, and no choice is saved.
"use strict";
(() => {
  const button = document.querySelector("#music");
  const player = document.querySelector("#music-player");
  let on = false;
  let attempt = 0;

  player.volume = 0.35;

  function show() {
    button.setAttribute("aria-pressed", String(on));
    button.textContent = on ? "Music on" : "Music off";
  }

  function stop() {
    attempt++;
    on = false;
    player.pause();
    show();
  }

  function failed() {
    stop();
    // Dropping the source lets the next press request the file again.
    player.removeAttribute("src");
    player.load();
  }

  button.addEventListener("click", () => {
    if (on) { stop(); return; }
    const ticket = ++attempt;
    on = true;
    show();
    if (!player.getAttribute("src")) player.src = "media/pass-it-on-unfinished.mp3";
    const rejected = () => { if (ticket === attempt) failed(); };
    try { const pending = player.play(); if (pending) pending.catch(rejected); } catch (error) { rejected(); }
  });

  player.addEventListener("error", () => { if (on && player.error) failed(); });
  // Keep the label true when the browser or the device's own media keys pause or resume the song.
  player.addEventListener("pause", () => { if (on && player.paused) stop(); });
  player.addEventListener("play", () => {
    if (on || player.paused) return;
    attempt++;
    on = true;
    show();
  });
})();
