// Cue — phone teleprompter.
// Renders the script into a scrolling-text MP4 on the device (WebCodecs + mp4-muxer),
// then puts it in Picture-in-Picture so it floats over Instagram, Snapchat, Camera, etc.
(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const FPS = 30;
  const SHAPES = { wide: [960, 540], square: [720, 720], tall: [540, 960] };
  const SIZES = { m: 0.105, l: 0.135, xl: 0.165, xxl: 0.2 }; // × min(width, height)
  const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

  const DEFAULT_SCRIPT =
    "Hey! This is Cue, your floating teleprompter.\n\n" +
    "Paste your own script in the box, then tap Make floating prompter.\n\n" +
    "Open Instagram or Snapchat, drag me next to your camera, tap play, and just read.\n\n" +
    "Keep your eyes up here and you'll look straight into the lens.";

  // ---------- settings ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem("cue." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("cue." + k, JSON.stringify(v)); } catch {} },
  };
  const cfg = {
    script: store.get("script", DEFAULT_SCRIPT),
    wpm: store.get("wpm", 140),
    size: store.get("size", "l"),
    shape: store.get("shape", "wide"),
    color: store.get("color", "#ffffff"),
    countdown: store.get("countdown", true),
  };

  // ---------- text layout + frame drawing (shared by video render and practice mode) ----------
  function countWords(t) { return (t.trim().match(/\S+/g) || []).length; }

  function layout(ctx, text, W, H, sizeKey) {
    const fontPx = Math.round(Math.min(W, H) * SIZES[sizeKey]);
    ctx.font = `700 ${fontPx}px ${FONT}`;
    const maxW = W * 0.86;
    const lh = fontPx * 1.3;
    const gap = fontPx * 0.55;
    const lines = [];
    let y = 0;
    const paras = text.replace(/\r/g, "").split("\n");
    let prevBlank = true;
    for (const raw of paras) {
      const para = raw.trim();
      if (!para) { if (!prevBlank) y += gap; prevBlank = true; continue; }
      prevBlank = false;
      let line = "";
      for (const word of para.split(/\s+/)) {
        const test = line ? line + " " + word : word;
        if (line && ctx.measureText(test).width > maxW) { lines.push({ t: line, y }); y += lh; line = word; }
        else line = test;
      }
      if (line) { lines.push({ t: line, y }); y += lh; }
    }
    const last = lines.length ? lines[lines.length - 1].y : 0;
    return { lines, fontPx, lh, dist: last, W, H };
  }

  function timing(L, words, wpm, countdown) {
    const lead = countdown ? 3.2 : 0.8;
    const speakSecs = Math.max(4, (words / wpm) * 60);
    const pps = L.dist > 0 ? L.dist / speakSecs : 0;
    const tail = 2.5;
    return { lead, speakSecs, pps, total: lead + speakSecs + tail };
  }

  function drawFrame(ctx, L, T, t, color) {
    const { W, H, lh, fontPx } = L;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    const readY = H * 0.34;
    const off = Math.min(L.dist, Math.max(0, t - T.lead) * T.pps);
    ctx.font = `700 ${fontPx}px ${FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    for (const ln of L.lines) {
      const cy = readY + ln.y - off;
      if (cy < -lh || cy > H + lh) continue;
      const d = Math.abs(cy - readY) / (H * 0.55);
      ctx.globalAlpha = Math.max(0.16, Math.min(1, 1.08 - d * 1.25));
      ctx.fillText(ln.t, W / 2, cy);
    }
    ctx.globalAlpha = 1;
    // soft fades top & bottom
    const fade = H * 0.16;
    let g = ctx.createLinearGradient(0, 0, 0, fade);
    g.addColorStop(0, "rgba(0,0,0,0.95)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, fade);
    g = ctx.createLinearGradient(0, H - fade * 1.4, 0, H);
    g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.95)");
    ctx.fillStyle = g; ctx.fillRect(0, H - fade * 1.4, W, fade * 1.4);
    // reading markers
    const m = Math.max(10, fontPx * 0.26);
    ctx.fillStyle = "#ff6b8b";
    for (const [x, dir] of [[m * 0.6, 1], [W - m * 0.6, -1]]) {
      ctx.beginPath(); ctx.moveTo(x, readY - m * 0.7); ctx.lineTo(x + m * dir, readY); ctx.lineTo(x, readY + m * 0.7); ctx.closePath(); ctx.fill();
    }
    // progress bar
    const p = L.dist > 0 ? off / L.dist : 1;
    const bh = Math.max(4, H * 0.009);
    ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(0, H - bh, W, bh);
    g = ctx.createLinearGradient(0, 0, W, 0);
    g.addColorStop(0, "#7c5cff"); g.addColorStop(0.55, "#ff6b8b"); g.addColorStop(1, "#ffb86b");
    ctx.fillStyle = g; ctx.fillRect(0, H - bh, W * p, bh);
    // countdown
    if (t < T.lead && T.lead > 1) {
      ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(0, 0, W, H);
      const n = Math.ceil(T.lead - 0.2 - t);
      if (n >= 1) {
        const frac = (T.lead - 0.2 - t) % 1;
        ctx.globalAlpha = Math.min(1, frac * 3 + 0.2);
        ctx.font = `800 ${Math.round(Math.min(W, H) * 0.42)}px ${FONT}`;
        ctx.fillStyle = "#fff";
        ctx.fillText(String(n), W / 2, H / 2);
        ctx.globalAlpha = 1;
      }
    }
    // end card
    if (t > T.lead + T.speakSecs + 0.4) {
      ctx.fillStyle = "rgba(0,0,0,0.9)"; ctx.fillRect(0, 0, W, H);
      ctx.font = `800 ${Math.round(Math.min(W, H) * 0.14)}px ${FONT}`;
      ctx.fillStyle = "#fff";
      ctx.fillText("That's a wrap ✓", W / 2, H / 2);
    }
  }

  // ---------- rendering to MP4 ----------
  async function pickCodec(W, H) {
    const candidates = ["avc1.4d0028", "avc1.42e028", "avc1.640028", "avc1.42001f"];
    for (const codec of candidates) {
      const c = { codec, width: W, height: H, bitrate: 2_500_000, framerate: FPS, avc: { format: "avc" } };
      try { const s = await VideoEncoder.isConfigSupported(c); if (s.supported) return c; } catch {}
    }
    return null;
  }

  async function renderWithWebCodecs(L, T, color, onProgress) {
    const { W, H } = L;
    const config = await pickCodec(W, H);
    if (!config) throw new Error("no-codec");
    const canvas = new OffscreenCanvasOr(W, H);
    const ctx = canvas.getContext("2d");
    const muxer = new Mp4Muxer.Muxer({
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: "avc", width: W, height: H, frameRate: FPS },
      fastStart: "in-memory",
    });
    let failure = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { failure = e; },
    });
    encoder.configure(config);
    const frames = Math.ceil(T.total * FPS);
    const usPerFrame = 1e6 / FPS;
    for (let i = 0; i < frames; i++) {
      if (failure) throw failure;
      drawFrame(ctx, L, T, i / FPS, color);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i * usPerFrame), duration: Math.round(usPerFrame) });
      encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      if (encoder.encodeQueueSize > 8) await new Promise((r) => encoder.addEventListener("dequeue", r, { once: true }));
      if (i % 15 === 0) { onProgress(i / frames); await new Promise((r) => setTimeout(r, 0)); }
    }
    await encoder.flush();
    if (failure) throw failure;
    encoder.close();
    muxer.finalize();
    onProgress(1);
    return new Blob([muxer.target.buffer], { type: "video/mp4" });
  }

  // Fallback for older iPhones: record the canvas in real time.
  async function renderWithRecorder(L, T, color, onProgress) {
    const canvas = document.createElement("canvas");
    canvas.width = L.W; canvas.height = L.H;
    const ctx = canvas.getContext("2d");
    const type = ["video/mp4;codecs=avc1", "video/mp4", "video/webm"].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    if (!type || !canvas.captureStream) throw new Error("unsupported");
    const stream = canvas.captureStream(FPS);
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 2_500_000 });
    const parts = [];
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    const done = new Promise((r) => (rec.onstop = r));
    drawFrame(ctx, L, T, 0, color);
    rec.start(500);
    const t0 = performance.now();
    await new Promise((resolve) => {
      const step = () => {
        const t = (performance.now() - t0) / 1000;
        drawFrame(ctx, L, T, Math.min(t, T.total), color);
        onProgress(Math.min(1, t / T.total));
        if (t >= T.total) resolve(); else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    rec.stop();
    await done;
    return new Blob(parts, { type: type.split(";")[0] });
  }

  function OffscreenCanvasOr(W, H) {
    if (typeof OffscreenCanvas !== "undefined") {
      try { const c = new OffscreenCanvas(W, H); if (c.getContext("2d")) return c; } catch {}
    }
    const c = document.createElement("canvas"); c.width = W; c.height = H; return c;
  }

  // ---------- UI ----------
  const ui = {
    script: $("#script"), words: $("#words"), dur: $("#dur"), wpm: $("#wpm"), wpmVal: $("#wpmVal"),
    countdown: $("#countdown"), make: $("#make"), progress: $("#progress"), bar: $("#progress i"),
    status: $("#status"), result: $("#result"), video: $("#video"), float: $("#float"), save: $("#save"),
  };
  let currentBlob = null, currentUrl = null, dirty = true;

  function fmt(secs) { const s = Math.round(secs); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
  function refreshMeta() {
    const w = countWords(ui.script.value);
    ui.words.textContent = `${w} word${w === 1 ? "" : "s"}`;
    ui.dur.textContent = w ? `about ${fmt((w / cfg.wpm) * 60)} to read` : "—";
    ui.wpmVal.textContent = `${cfg.wpm} wpm`;
  }
  function markDirty() {
    dirty = true;
    if (currentBlob) ui.status.textContent = "Settings changed. Tap Make again to update.";
  }
  function bindSeg(id, key) {
    const el = $(id);
    const paint = () => el.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.v === cfg[key]));
    el.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      cfg[key] = b.dataset.v; store.set(key, cfg[key]); paint(); markDirty();
    });
    paint();
  }

  ui.script.value = cfg.script;
  ui.wpm.value = cfg.wpm;
  ui.countdown.checked = cfg.countdown;
  refreshMeta();
  bindSeg("#size", "size");
  bindSeg("#shape", "shape");
  bindSeg("#color", "color");
  ui.script.addEventListener("input", () => { cfg.script = ui.script.value; store.set("script", cfg.script); refreshMeta(); markDirty(); });
  ui.wpm.addEventListener("input", () => { cfg.wpm = +ui.wpm.value; store.set("wpm", cfg.wpm); refreshMeta(); markDirty(); });
  ui.countdown.addEventListener("change", () => { cfg.countdown = ui.countdown.checked; store.set("countdown", cfg.countdown); markDirty(); });

  ui.make.addEventListener("click", async () => {
    const text = ui.script.value.trim();
    if (!text) { ui.status.textContent = "Add your script first."; ui.script.focus(); return; }
    ui.make.disabled = true;
    ui.progress.style.display = "block";
    ui.bar.style.width = "0%";
    const [W, H] = SHAPES[cfg.shape];
    const measure = document.createElement("canvas").getContext("2d");
    const L = layout(measure, text, W, H, cfg.size);
    const T = timing(L, countWords(text), cfg.wpm, cfg.countdown);
    const onProgress = (p) => { ui.bar.style.width = `${Math.round(p * 100)}%`; };
    try {
      let blob;
      if ("VideoEncoder" in window && "VideoFrame" in window) {
        ui.status.textContent = "Building your prompter…";
        try { blob = await renderWithWebCodecs(L, T, cfg.color, onProgress); }
        catch (e) { console.warn("WebCodecs failed, falling back", e); blob = null; }
      }
      if (!blob) {
        ui.status.textContent = `Building in real time (about ${fmt(T.total)}). Keep this screen open.`;
        blob = await renderWithRecorder(L, T, cfg.color, onProgress);
      }
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      currentBlob = blob;
      currentUrl = URL.createObjectURL(blob);
      ui.video.src = currentUrl;
      ui.video.load();
      ui.video.playbackRate = rate;
      ui.result.style.display = "block";
      dirty = false;
      ui.status.textContent = `Ready · ${fmt(T.total)} long`;
      setTimeout(() => ui.result.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      console.error(e);
      ui.status.textContent = "Sorry, this browser can't build the video. Update iOS, then try again in Safari.";
    } finally {
      ui.make.disabled = false;
      setTimeout(() => (ui.progress.style.display = "none"), 600);
    }
  });

  let rate = 1;
  $("#rates").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    rate = +b.dataset.r; ui.video.playbackRate = rate;
    $("#rates").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
  });
  ui.video.addEventListener("play", () => { ui.video.playbackRate = rate; });

  // ── Keep scrolling while a camera app records ──
  // iOS pauses Picture-in-Picture media when Instagram / Snapchat / Camera start recording.
  // The prompter video is muted with no audio track, so Safari lets us call play() again
  // without a tap. Only a pause the user asked for (PiP controls, lock-screen) sticks.
  let userPaused = false;
  const inPip = (v) => v.webkitPresentationMode === "picture-in-picture" || document.pictureInPictureElement === v;
  const resume = () => {
    const v = ui.video;
    if (userPaused || v.ended || !v.src) return;
    v.muted = true;
    const p = v.play(); if (p && p.catch) p.catch(() => {});
  };
  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.setActionHandler("play", () => { userPaused = false; resume(); });
      navigator.mediaSession.setActionHandler("pause", () => { userPaused = true; ui.video.pause(); });
    } catch (e) {}
  }
  ui.video.addEventListener("pause", () => {
    const v = ui.video;
    if (userPaused || v.ended || !inPip(v)) return;
    [0, 150, 500, 1200, 2500].forEach((ms) => setTimeout(() => { if (v.paused && inPip(v)) resume(); }, ms));
  });
  // The system can also stall playback without a pause event; a light watchdog catches it.
  setInterval(() => { const v = ui.video; if (v.paused && inPip(v) && !userPaused && !v.ended && v.currentTime > 0) resume(); }, 700);
  // Any real start of playback (PiP play button, our resume) clears the user-pause.
  let priming = false;
  ui.video.addEventListener("playing", () => { if (!priming) userPaused = false; });
  // Tapping the video itself (in the page) still pauses/plays normally.
  ui.video.addEventListener("click", () => { if (!ui.video.paused) userPaused = true; });

  ui.float.addEventListener("click", () => {
    const v = ui.video;
    if (!v.src) return;
    if (v.ended || v.currentTime > v.duration - 0.5) v.currentTime = 0;
    // Must stay inside the tap: start playback and enter PiP synchronously.
    const playing = v.play();
    let entered = false;
    try {
      if (typeof v.webkitSetPresentationMode === "function" && v.webkitSupportsPresentationMode && v.webkitSupportsPresentationMode("picture-in-picture")) {
        v.webkitSetPresentationMode("picture-in-picture"); entered = true;
      } else if (document.pictureInPictureEnabled && v.requestPictureInPicture) {
        v.requestPictureInPicture().catch((e) => { console.warn(e); pipFailed(); }); entered = true;
      }
    } catch (e) { console.warn(e); }
    // Prime playback inside the tap, then park at 0:00 until the user presses play in the window.
    userPaused = true; priming = true;
    const park = () => { userPaused = true; v.pause(); v.currentTime = 0; setTimeout(() => { priming = false; }, 300); };
    if (playing && playing.then) playing.then(park).catch(() => { priming = false; });
    else priming = false;
    if (!entered) pipFailed();
    else ui.status.textContent = "Floating! Swipe home and open your camera app. Tap the window and press play.";
  });
  function pipFailed() {
    ui.status.textContent = "Picture-in-Picture isn't available here. Open this page in Safari and try again.";
  }

  ui.save.addEventListener("click", async () => {
    if (!currentBlob) return;
    const file = new File([currentBlob], "cue-prompter.mp4", { type: currentBlob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Cue prompter" }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = currentUrl; a.download = "cue-prompter.mp4"; document.body.appendChild(a); a.click(); a.remove();
  });

  // ---------- practice mode (live, full screen) ----------
  const P = { el: $("#practice"), canvas: $("#pcanvas"), raf: 0, t: 0, last: 0, paused: false, L: null, T: null };
  function startPractice() {
    const text = ui.script.value.trim();
    if (!text) { ui.status.textContent = "Add your script first."; return; }
    P.el.style.display = "block";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = Math.round(innerWidth * dpr), H = Math.round(innerHeight * dpr);
    P.canvas.width = W; P.canvas.height = H;
    const ctx = P.canvas.getContext("2d");
    const sizeBoost = { m: "m", l: "m", xl: "l", xxl: "xl" }[cfg.size]; // full screen is big already
    P.L = layout(ctx, text, W, H, sizeBoost);
    P.T = timing(P.L, countWords(text), cfg.wpm, cfg.countdown);
    P.t = 0; P.last = performance.now(); P.paused = false;
    const loop = (now) => {
      const dt = (now - P.last) / 1000; P.last = now;
      if (!P.paused) P.t = Math.min(P.T.total, P.t + dt);
      drawFrame(ctx, P.L, P.T, P.t, cfg.color);
      P.raf = requestAnimationFrame(loop);
    };
    P.raf = requestAnimationFrame(loop);
  }
  function stopPractice() { cancelAnimationFrame(P.raf); P.el.style.display = "none"; }
  $("#practiceBtn").addEventListener("click", startPractice);
  $("#pclose").addEventListener("click", (e) => { e.stopPropagation(); stopPractice(); });
  let touchY = null, moved = false;
  P.el.addEventListener("pointerdown", (e) => { touchY = e.clientY; moved = false; });
  P.el.addEventListener("pointermove", (e) => {
    if (touchY === null || !P.T) return;
    const dy = e.clientY - touchY;
    if (Math.abs(dy) > 4) moved = true;
    if (moved && P.T.pps > 0) {
      const dpr = P.canvas.width / innerWidth;
      P.t = Math.max(P.T.lead, Math.min(P.T.total, P.t - (dy * dpr) / P.T.pps));
      touchY = e.clientY;
    }
  });
  P.el.addEventListener("pointerup", (e) => {
    if (e.target.id === "pclose") return;
    if (!moved) { if (P.t >= P.T.total) P.t = 0; P.paused = !P.paused; }
    touchY = null;
  });

  // ---------- install hint + offline ----------
  const standalone = window.navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIOS && !standalone) $("#install").classList.add("show");
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});

  // Expose for automated checks.
  window.__cue = { layout, timing, drawFrame, renderWithWebCodecs, countWords, SHAPES };
})();
