// Purpose: film playback and bounded background motion for Crossreview.
"use strict";
(() => {
  const films = [
    { title: "POV", file: "neural", position: "center", artist: "NMAI Research", year: 2026,
      kind: "Artwork by", label: "Artwork", url: "https://nmairesearch.github.io/" }
  ];
  const videos = [document.querySelector("#film-a"), document.querySelector("#film-b")];
  const poster = document.querySelector("#poster");
  const status = document.querySelector("#media-status");
  const motionButton = document.querySelector("#motion");
  const options = [...document.querySelectorAll("[data-film]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let motion = !reduced.matches;
  let heroVisible = true;
  let readingVisible = false;
  let chosen = 0;
  let active = -1;
  let generation = 0;
  let frame = 0;
  let lastDraw = 0;
  let elapsed = 0;

  function updateMotionButton() {
    motionButton.setAttribute("aria-pressed", String(!motion));
    document.querySelector("#motion-label").textContent = motion ? "Pause motion" : "Play motion";
    document.querySelector("#motion-icon").textContent = motion ? "Ⅱ" : "▷";
  }

  async function playActive() {
    if (active < 0 || !motion || !heroVisible || document.hidden) return;
    const target = videos[active];
    const ticket = generation;
    try {
      await target.play();
      if (ticket !== generation || !motion || !heroVisible || document.hidden) target.pause();
    } catch (error) {
      if (ticket !== generation || error.name === "AbortError") return;
      motion = false;
      updateMotionButton();
      status.textContent = "Playback paused. Select Play motion to try again.";
      schedule();
    }
  }

  function selectFilm(index) {
    if (!Number.isInteger(index) || index < 0 || index >= films.length) return;
    const ticket = ++generation;
    chosen = index;
    const film = films[index];
    const next = active === 0 ? 1 : 0;
    const target = videos[next];
    // Keep the still and its credit together while the next film loads.
    for (const video of videos) { video.pause(); video.classList.remove("is-visible"); }
    active = -1;
    target.pause();
    target.classList.remove("is-visible");
    target.onloadeddata = null;
    target.onerror = null;
    target.muted = true;
    target.loop = films.length === 1;
    target.style.objectPosition = film.position;
    target.poster = `media/${film.file}.jpg`;
    poster.src = target.poster;
    poster.style.objectPosition = film.position;
    status.textContent = "";
    document.querySelector("#film-number").textContent = `${String(index + 1).padStart(2, "0")} / ${String(films.length).padStart(2, "0")}`;
    document.querySelector("#film-name").textContent = film.title;
    document.querySelector("#film-type").textContent = film.label;
    document.querySelector("#credit-kind").textContent = film.kind;
    document.querySelector("#credit-artist").textContent = film.artist;
    document.querySelector("#credit-artist").href = film.url;
    document.querySelector("#credit-work").textContent = `‘${film.title}’ · ${film.year}`;
    document.querySelector("#progress").style.transform = "scaleX(0)";
    for (const option of options) {
      const selected = Number(option.dataset.film) === index;
      option.classList.toggle("is-selected", selected);
      option.setAttribute("aria-pressed", String(selected));
    }
    target.onloadeddata = () => {
      if (ticket !== generation) return;
      for (const video of videos) {
        if (video !== target) { video.pause(); video.classList.remove("is-visible"); }
      }
      active = next;
      target.classList.add("is-visible");
      void playActive();
    };
    target.onerror = () => {
      if (ticket !== generation) return;
      for (const video of videos) { video.pause(); video.classList.remove("is-visible"); }
      active = -1;
      status.textContent = "Film unavailable. Showing its still image.";
    };
    target.src = `media/${film.file}.mp4`;
    target.load();
  }

  for (const video of videos) {
    video.addEventListener("ended", () => {
      if (videos[active] === video && motion) selectFilm((chosen + 1) % films.length);
    });
    video.addEventListener("timeupdate", () => {
      if (videos[active] !== video || !Number.isFinite(video.duration)) return;
      document.querySelector("#progress").style.transform = `scaleX(${video.currentTime / video.duration})`;
    });
  }
  for (const option of options) option.addEventListener("click", () => selectFilm(Number(option.dataset.film)));

  const canvas = document.querySelector("#roots");
  const ctx = canvas.getContext("2d");
  const reading = document.querySelector(".reading");
  let width = 0;
  let height = 0;
  const field = typeof window.CrossreviewBranchingField === "function"
    ? new window.CrossreviewBranchingField() : null;

  // Resizing changes the drawing scale, never the accumulated lineage.
  function sizeBackground() {
    const box = reading.getBoundingClientRect();
    width = box.width;
    height = box.height;
    // Bound raster storage even when the review queue makes the page very tall.
    const scale = Math.min(devicePixelRatio || 1, 1.5,
      Math.sqrt(4000000 / Math.max(1, width * height)));
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    if (!ctx) return;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawBackground(elapsed);
  }

  function drawBackground(time) {
    if (!ctx || !field) return;
    field.advance(time);
    field.draw(ctx, width, height, time);
  }

  function tick(time) {
    frame = 0;
    if (!motion || document.hidden || !readingVisible) { lastDraw = 0; return; }
    if (time - lastDraw > 40) {
      elapsed += lastDraw ? Math.min(time - lastDraw, 80) : 40;
      lastDraw = time;
      drawBackground(elapsed);
    }
    frame = requestAnimationFrame(tick);
  }

  function schedule() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastDraw = 0;
    if (motion && !document.hidden && readingVisible) frame = requestAnimationFrame(tick);
  }

  function synchronise() {
    for (let i = 0; i < videos.length; i++) {
      if (!motion || document.hidden || !heroVisible || i !== active) videos[i].pause();
    }
    void playActive();
    schedule();
    updateMotionButton();
  }

  motionButton.addEventListener("click", () => {
    motion = !motion;
    status.textContent = "";
    if (motion && active < 0) selectFilm(chosen);
    synchronise();
  });
  reduced.addEventListener("change", () => { motion = !reduced.matches; synchronise(); });
  document.addEventListener("visibilitychange", synchronise);
  new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.target === reading) readingVisible = entry.isIntersecting;
      else heroVisible = entry.isIntersecting;
    }
    synchronise();
  }, { threshold: 0 }).observe(reading);
  const heroObserver = new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; synchronise(); }, { threshold: 0 });
  heroObserver.observe(document.querySelector(".hero"));
  new ResizeObserver(sizeBackground).observe(reading);
  sizeBackground();
  updateMotionButton();
  selectFilm(0);
})();
