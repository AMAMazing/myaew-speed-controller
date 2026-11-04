(() => {
  // --- 1. BITMOVIN PLAYER & BUFFER BOOSTER ---
  const getBitmovinPlayer = () => {
    const wrapper = document.querySelector('.bitmovinplayer-container') || document.querySelector('.bm-wrapper');
    return wrapper && wrapper.player ? wrapper.player : null;
  };

  const setBitmovinBufferTarget = (seconds) => {
    const bp = getBitmovinPlayer();
    if (!bp) return;
    if (bp.buffer && typeof bp.buffer.setTargetLevel === 'function') {
      try {
        bp.buffer.setTargetLevel('forwardduration', seconds, 'video');
        bp.buffer.setTargetLevel('forwardduration', seconds, 'audio');
      } catch (e) {}
    }
    if (typeof bp.getConfig === 'function') {
      try {
        const cfg = bp.getConfig();
        if (cfg.buffer?.video) cfg.buffer.video.forwardduration = seconds;
        if (cfg.buffer?.audio) cfg.buffer.audio.forwardduration = seconds;
        if (cfg.tweaks) cfg.tweaks.max_buffer_level = seconds;
      } catch (e) {}
    }
  };

  let isFastSeeking = false;
  setBitmovinBufferTarget(120);
  setInterval(() => {
    if (!isFastSeeking) setBitmovinBufferTarget(120);
  }, 4000);

  // --- 2. CONFIG & STATE ---
  const PRESETS = [1.0, 1.25, 1.5, 2.0, 3.0, 4.0];
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 4.0;
  const STEP = 0.05;
  const POPUP_OFFSET = { above: 24, below: 12 };

  const SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="h-5 sm:h-6 transform-gpu transition-all duration-200 z-10 hover:scale-110"><path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-11.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/></svg>`;
  const PIP_SVG_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="h-5 sm:h-6 transform-gpu transition-all duration-200 z-10 hover:scale-110"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>`;
  const SKIP_SVG_ICON = `<svg viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`;
  const TRANSPARENT_BTN_STYLE = "background: transparent !important; border: none !important; box-shadow: none !important; outline: none !important; padding: 0 !important; border-radius: 0 !important;";

  let currentSavedSpeed = 1.0;
  let isInternalSpeedChange = false;
  let isSmartSpeedEnabled = false;
  let isAutoSkipBreakEnabled = true;

  try {
    const saved = localStorage.getItem("myaew_playback_speed");
    if (saved) currentSavedSpeed = parseFloat(saved);
    if (localStorage.getItem("myaew_smart_speed_enabled") === "true") isSmartSpeedEnabled = true;
    const autoSkipSaved = localStorage.getItem("myaew_auto_skip_breaks");
    if (autoSkipSaved !== null) isAutoSkipBreakEnabled = autoSkipSaved === "true";
  } catch (e) {}

  const processedVideos = new WeakSet();
  let activePopup = null;
  let activeSkipPill = null;
  let detectedBreakEnd = null;

  const isMobileOrShortScreen = () =>
    window.innerWidth <= 640 || (window.innerHeight <= 500 && window.matchMedia("(hover: none)").matches);

  function getFullscreenContainer() {
    return document.fullscreenElement || document.webkitFullscreenElement || document.body;
  }

  // ==========================================================================
  // 3. ULTRA-FAST BREAK SKIPPER & YOUTUBE-STYLE "SKIP BREAK" PILL
  // ==========================================================================
  const spriteCache = new Map();
  const skipCanvas = document.createElement('canvas');
  skipCanvas.width = 32;
  skipCanvas.height = 18;
  const skipCtx = skipCanvas.getContext('2d', { willReadFrequently: true });

  let isScanningBreak = false;
  let lastSkipWallTime = 0;

  function showToast(message) {
    document.querySelector('.myaew-skip-toast')?.remove();
    const toast = document.createElement('div');
    toast.className = 'myaew-skip-toast';
    toast.innerHTML = `<span>⚡</span> <span>${message}</span>`;
    getFullscreenContainer().appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.25s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  function removeSkipPill() {
    if (activeSkipPill) {
      activeSkipPill.remove();
      activeSkipPill = null;
    }
    detectedBreakEnd = null;
  }

  function showSkipPill(video, targetTime) {
    detectedBreakEnd = targetTime;
    if (activeSkipPill) return;

    const container = document.getElementById("videoPlayer") || document.querySelector(".bitmovinplayer-container") || getFullscreenContainer();
    const pill = document.createElement("button");
    pill.className = "myaew-yt-skip-pill";
    pill.innerHTML = `<span>Skip Break</span> ${SKIP_SVG_ICON}`;

    pill.addEventListener("click", (e) => {
      e.stopPropagation();
      if (detectedBreakEnd) executeFastSkip(video, detectedBreakEnd);
      removeSkipPill();
    });

    container.appendChild(pill);
    activeSkipPill = pill;
  }

  // Fast-Start Seek: Drops forward buffer target to 4s & rate to 1.0x during the seek
  // so Bitmovin plays the first .m4s keyframe chunk in ~1s instead of stalling for 10s+
  function executeFastSkip(video, targetTime) {
    const skippedSec = Math.round(targetTime - video.currentTime);
    if (skippedSec < 10) return;

    lastSkipWallTime = Date.now();
    isFastSeeking = true;
    removeSkipPill();

    const savedRate = video.playbackRate;
    const bp = getBitmovinPlayer();

    // 1. Temporarily set buffer threshold low & playbackRate to 1.0x for instant decode start
    setBitmovinBufferTarget(4);
    isInternalSpeedChange = true;
    video.playbackRate = 1.0;
    isInternalSpeedChange = false;

    // 2. Use Bitmovin's native seek API if available (flushes old .m4s queue cleanly)
    if (bp && typeof bp.seek === 'function') {
      bp.seek(targetTime);
    } else {
      video.currentTime = targetTime;
    }

    // 3. Restore normal speed & 120s buffer as soon as playback resumes
    const restoreAfterSeek = () => {
      video.removeEventListener('playing', restoreAfterSeek);
      setTimeout(() => {
        isFastSeeking = false;
        const restoreRate = isSmartSpeedEnabled ? 1.0 : currentSavedSpeed;
        setVideoSpeed(video, restoreRate || savedRate, false);
        setBitmovinBufferTarget(120);
      }, 600);
    };
    video.addEventListener('playing', restoreAfterSeek);
    setTimeout(restoreAfterSeek, 3000); // Fallback safety

    const mins = Math.floor(skippedSec / 60);
    const secs = skippedSec % 60;
    showToast(`Skipped ${mins > 0 ? `${mins}m ` : ""}${secs}s Break!`);
  }

  async function getThumbnailPixels(bp, timeSec) {
    if (!bp || typeof bp.getThumbnail !== 'function') return null;
    const thumb = bp.getThumbnail(timeSec);
    if (!thumb || !thumb.url) return null;

    if (!spriteCache.has(thumb.url)) {
      if (spriteCache.size > 30) spriteCache.delete(spriteCache.keys().next().value);
      spriteCache.set(thumb.url, new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = thumb.url;
      }));
    }

    try {
      const img = await spriteCache.get(thumb.url);
      skipCtx.drawImage(img, thumb.x || 0, thumb.y || 0, thumb.w || 256, thumb.h || 144, 0, 0, 32, 18);
      return {
        pixels: new Uint8Array(skipCtx.getImageData(0, 0, 32, 18).data),
        start: typeof thumb.start === 'number' ? thumb.start : timeSec
      };
    } catch (e) {
      spriteCache.delete(thumb.url);
      return null;
    }
  }

  function calcFrameDiff(a, b) {
    let diff = 0;
    for (let i = 0; i < a.length; i += 4) {
      diff += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    }
    return diff / (32 * 18 * 3);
  }

  async function checkBreakStatus(video) {
    if (isScanningBreak || isFastSeeking || !video || !isFinite(video.duration)) return;
    if (Date.now() - lastSkipWallTime < 6000) return;

    // If we already found a break and the pill is visible, hide pill if user passed it
    if (detectedBreakEnd && video.currentTime >= detectedBreakEnd - 5) {
      removeSkipPill();
      return;
    }

    const bp = getBitmovinPlayer();
    if (!bp || typeof bp.getThumbnail !== 'function') return;

    isScanningBreak = true;
    try {
      const baseTime = Math.floor(video.currentTime / 10) * 10;
      if (video.duration - baseTime < 50) return;

      // 1. Grab the 4 keyframes of the current 40s window
      const refResults = await Promise.all([0, 10, 20, 30].map((o) => getThumbnailPixels(bp, baseTime + o)));
      if (refResults.some((r) => !r)) return;
      const refFrames = refResults.map((r) => r.pixels);

      // 2. Verify if t+40, t+50, t+60 repeat those 4 keyframes (Diff <= 13.5)
      const verifyResults = await Promise.all([40, 50, 60].map((o) => getThumbnailPixels(bp, baseTime + o)));
      if (verifyResults.some((r) => !r)) return;

      const isInsideBreak = verifyResults.every((vRes) => {
        const minDiff = Math.min(...refFrames.map((ref) => calcFrameDiff(vRes.pixels, ref)));
        return minDiff <= 13.5;
      });

      if (!isInsideBreak) {
        removeSkipPill();
        return;
      }

      // 3. Inside a break! Scan forward up to 12 minutes in 10s steps to find exact segment start where show returns
      let resumeSegmentStart = null;
      let consecutiveShowTiles = 0;
      let candidateStart = null;

      for (let t = baseTime + 40; t < Math.min(video.duration - 10, baseTime + 720); t += 10) {
        const frameData = await getThumbnailPixels(bp, t);
        if (!frameData) break;

        const matchDiff = Math.min(...refFrames.map((ref) => calcFrameDiff(frameData.pixels, ref)));
        if (matchDiff > 18.0) {
          if (consecutiveShowTiles === 0) candidateStart = frameData.start;
          consecutiveShowTiles++;
          if (consecutiveShowTiles >= 2) {
            resumeSegmentStart = candidateStart;
            break;
          }
        } else {
          consecutiveShowTiles = 0;
          candidateStart = null;
        }
      }

      if (resumeSegmentStart && resumeSegmentStart > video.currentTime + 15) {
        // Align directly to the segment boundary (resumeSegmentStart) for instant keyframe decode!
        if (isAutoSkipBreakEnabled) {
          executeFastSkip(video, resumeSegmentStart);
        } else {
          showSkipPill(video, resumeSegmentStart);
        }
      }
    } catch (e) {
    } finally {
      isScanningBreak = false;
    }
  }

  setInterval(() => {
    const video = document.querySelector("video");
    if (video && !video.paused && video.readyState >= 2) {
      checkBreakStatus(video);
    }
  }, 3000);

  // --- 4. SMART SPEED CONTROLLER (SPEED-ONLY) ---
  function formatSpeed(val) {
    return Number(val).toFixed(2) + "x";
  }

  function getBufferAhead(video) {
    const ct = video.currentTime;
    const buf = video.buffered;
    for (let i = 0; i < buf.length; i++) {
      if (buf.start(i) <= ct && buf.end(i) > ct) return buf.end(i) - ct;
    }
    return 0;
  }

  function manageSmartSpeed() {
    if (!isSmartSpeedEnabled || isFastSeeking) return;

    document.querySelectorAll("video").forEach((video) => {
      if (video.paused || video.readyState === 0) return;

      const buffer = getBufferAhead(video);
      const targetRate = currentSavedSpeed;
      const SAFE_BUFFER_MAX = 90;
      const SAFE_BUFFER_MIN = 15;
      const minAllowed = Math.min(1.0, targetRate);

      let newRate;
      if (buffer >= SAFE_BUFFER_MAX) newRate = targetRate;
      else if (buffer <= SAFE_BUFFER_MIN) newRate = minAllowed;
      else {
        const factor = (buffer - SAFE_BUFFER_MIN) / (SAFE_BUFFER_MAX - SAFE_BUFFER_MIN);
        newRate = minAllowed + factor * (targetRate - minAllowed);
      }

      newRate = Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(newRate * 20) / 20));
      if (Math.abs(newRate - video.playbackRate) >= 0.05) {
        setVideoSpeed(video, newRate, false);
      }
    });
  }

  setInterval(manageSmartSpeed, 2500);

  function applySpeedToAllVideos(speed) {
    if (isSmartSpeedEnabled) return;
    document.querySelectorAll("video").forEach((video) => {
      isInternalSpeedChange = true;
      video.playbackRate = speed;
      isInternalSpeedChange = false;
    });
  }

  function setVideoSpeed(video, speed, isManual = true) {
    const clamped = Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(speed * 100) / 100));
    isInternalSpeedChange = true;
    video.playbackRate = clamped;
    isInternalSpeedChange = false;

    if (isManual) {
      currentSavedSpeed = clamped;
      try { localStorage.setItem("myaew_playback_speed", clamped.toString()); } catch (e) {}
    }
    if (activePopup && activePopup._video === video) {
      updatePopupUI(activePopup, clamped);
    }
  }

  function closePopup() {
    if (activePopup) {
      clearInterval(activePopup._telemetryInterval);
      activePopup.remove();
      activePopup = null;
    }
  }

  function updatePopupUI(popup, currentRate) {
    const displaySpeed = isSmartSpeedEnabled ? currentSavedSpeed : currentRate;
    const header = popup.querySelector(".myaew-speed-popup-header");
    if (header) {
      header.textContent = (isSmartSpeedEnabled ? "Target: " : "") + formatSpeed(displaySpeed);
    }

    const slider = popup.querySelector(".myaew-speed-slider");
    if (slider) {
      slider.value = displaySpeed;
      const pct = ((displaySpeed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
      slider.style.background = `linear-gradient(to right, #ffffff ${pct}%, #555555 ${pct}%)`;
    }

    popup.querySelectorAll(".myaew-preset-btn").forEach((btn) => {
      btn.classList.toggle("active", Math.abs(parseFloat(btn.dataset.speed) - displaySpeed) < 0.01);
    });

    const smartBtn = popup.querySelector(".myaew-smart-speed-toggle");
    if (smartBtn) {
      smartBtn.classList.toggle("active", isSmartSpeedEnabled);
      smartBtn.querySelector("span").textContent = `Smart Auto-Speed: ${isSmartSpeedEnabled ? "ON" : "OFF"}`;
    }

    const skipBtn = popup.querySelector(".myaew-auto-skip-toggle");
    if (skipBtn) {
      skipBtn.classList.toggle("active", isAutoSkipBreakEnabled);
      skipBtn.querySelector("span").textContent = `Auto-Skip Breaks: ${isAutoSkipBreakEnabled ? "ON" : "OFF"}`;
    }
  }

  function repositionPopup(popup, triggerBtn, container) {
    const containerRect = container.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    const popupWidth = popupRect.width || 310;
    const popupHeight = popupRect.height || 260;

    if (isMobileOrShortScreen()) {
      popup.style.top = `${Math.max(12, (containerRect.height - popupHeight) / 2)}px`;
      popup.style.left = `${Math.max(12, (containerRect.width - popupWidth) / 2)}px`;
      return;
    }

    const triggerRect = triggerBtn.getBoundingClientRect();
    let top = triggerRect.top - containerRect.top - popupHeight - POPUP_OFFSET.above;
    let left = triggerRect.left - containerRect.left + triggerRect.width / 2 - popupWidth / 2;

    if (top < 10) top = triggerRect.bottom - containerRect.top + POPUP_OFFSET.below;
    if (left < 10) left = 10;
    else if (left + popupWidth > containerRect.width - 10) left = containerRect.width - popupWidth - 10;

    const scrollY = container === document.body ? window.scrollY : container.scrollTop;
    const scrollX = container === document.body ? window.scrollX : container.scrollLeft;

    popup.style.top = `${top + scrollY}px`;
    popup.style.left = `${left + scrollX}px`;
  }

  function createSpeedPopup(video, triggerBtn) {
    closePopup();

    const popup = document.createElement("div");
    popup.className = "myaew-speed-popup";
    popup._video = video;

    const header = document.createElement("div");
    header.className = "myaew-speed-popup-header";
    popup.appendChild(header);

    const sliderRow = document.createElement("div");
    sliderRow.className = "myaew-speed-slider-row";

    const minusBtn = document.createElement("button");
    minusBtn.className = "myaew-circle-btn";
    minusBtn.innerHTML = "&minus;";
    minusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setVideoSpeed(video, (isSmartSpeedEnabled ? currentSavedSpeed : video.playbackRate) - STEP, true);
    });

    const sliderContainer = document.createElement("div");
    sliderContainer.className = "myaew-slider-container";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "myaew-speed-slider";
    slider.min = MIN_SPEED;
    slider.max = MAX_SPEED;
    slider.step = STEP;
    slider.addEventListener("input", (e) => setVideoSpeed(video, parseFloat(e.target.value), true));
    sliderContainer.appendChild(slider);

    const plusBtn = document.createElement("button");
    plusBtn.className = "myaew-circle-btn";
    plusBtn.innerHTML = "&#43;";
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setVideoSpeed(video, (isSmartSpeedEnabled ? currentSavedSpeed : video.playbackRate) + STEP, true);
    });

    sliderRow.append(minusBtn, sliderContainer, plusBtn);
    popup.appendChild(sliderRow);

    const presetsRow = document.createElement("div");
    presetsRow.className = "myaew-speed-presets-row";
    PRESETS.forEach((preset) => {
      const col = document.createElement("div");
      col.className = "myaew-preset-col";
      const btn = document.createElement("button");
      btn.className = "myaew-preset-btn";
      btn.dataset.speed = preset;
      btn.textContent = preset === 1.0 ? "1.0" : preset.toString();
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setVideoSpeed(video, preset, true);
      });
      col.appendChild(btn);
      if (preset === 1.0) {
        const label = document.createElement("div");
        label.className = "myaew-preset-label";
        label.textContent = "Normal";
        col.appendChild(label);
      }
      presetsRow.appendChild(col);
    });
    popup.appendChild(presetsRow);

    // Toggles Column (Auto-Skip Breaks & Smart Auto-Speed)
    const togglesCol = document.createElement("div");
    togglesCol.className = "myaew-toggles-col";

    const autoSkipBtn = document.createElement("button");
    autoSkipBtn.className = "myaew-smart-btn myaew-auto-skip-toggle";
    autoSkipBtn.innerHTML = `<div class="myaew-smart-indicator"></div><span></span>`;
    autoSkipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isAutoSkipBreakEnabled = !isAutoSkipBreakEnabled;
      try { localStorage.setItem("myaew_auto_skip_breaks", isAutoSkipBreakEnabled.toString()); } catch (e) {}
      if (isAutoSkipBreakEnabled && detectedBreakEnd) {
        executeFastSkip(video, detectedBreakEnd);
      } else {
        checkBreakStatus(video);
      }
      updatePopupUI(popup, video.playbackRate);
    });

    const smartBtn = document.createElement("button");
    smartBtn.className = "myaew-smart-btn myaew-smart-speed-toggle";
    smartBtn.innerHTML = `<div class="myaew-smart-indicator"></div><span></span>`;
    smartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isSmartSpeedEnabled = !isSmartSpeedEnabled;
      try { localStorage.setItem("myaew_smart_speed_enabled", isSmartSpeedEnabled.toString()); } catch (e) {}
      updatePopupUI(popup, video.playbackRate);
      if (!isSmartSpeedEnabled) setVideoSpeed(video, currentSavedSpeed, true);
    });

    togglesCol.append(autoSkipBtn, smartBtn);
    popup.appendChild(togglesCol);

    const telemetryRow = document.createElement("div");
    telemetryRow.className = "myaew-telemetry-row";
    const telemetryText = document.createElement("div");
    telemetryText.className = "myaew-telemetry-text";
    telemetryRow.appendChild(telemetryText);
    popup.appendChild(telemetryRow);

    const updateTelemetry = () => {
      if (activePopup !== popup) return;
      if (!isSmartSpeedEnabled) {
        telemetryRow.style.display = "none";
        return;
      }
      telemetryRow.style.display = "block";
      const rate = video.playbackRate.toFixed(2);
      const buf = Math.round(getBufferAhead(video));
      const rateColor = buf < 20 ? "#ff9800" : (video.playbackRate < currentSavedSpeed - 0.05 ? "#2196f3" : "#4caf50");
      const bufColor = buf < 10 ? "#f44336" : (buf < 20 ? "#ff9800" : "#4caf50");
      telemetryText.innerHTML = `Live Speed: <span style="color:${rateColor}">${rate}x</span> | Buffer: <span style="color:${bufColor}">${buf}s</span>`;
    };

    updateTelemetry();
    popup._telemetryInterval = setInterval(updateTelemetry, 500);

    popup.addEventListener("click", (e) => e.stopPropagation());
    popup.addEventListener("pointerdown", (e) => e.stopPropagation());

    const container = getFullscreenContainer();
    container.appendChild(popup);
    activePopup = popup;

    updatePopupUI(popup, video.playbackRate || 1.0);
    repositionPopup(popup, triggerBtn, container);
  }

  function enableVideoPiPCompatibility(video) {
    if (video.hasAttribute("disablePictureInPicture")) video.removeAttribute("disablePictureInPicture");
    if (video.disablePictureInPicture) video.disablePictureInPicture = false;
  }

  async function togglePictureInPicture(video) {
    enableVideoPiPCompatibility(video);
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (typeof video.requestPictureInPicture === "function") await video.requestPictureInPicture();
    } catch (e) {}
  }

  function placeControlButtons(video, speedBtn, pipBtn) {
    const rightSideControls = document.querySelector(".player-controls .right-side");
    if (rightSideControls) {
      if (speedBtn.parentElement !== rightSideControls) {
        speedBtn.className = "myaew-speed-btn relative flex w-8 h-8 flex-col items-center justify-center cursor-pointer";
        speedBtn.style.cssText = TRANSPARENT_BTN_STYLE;
        rightSideControls.insertBefore(speedBtn, rightSideControls.firstChild);
      }
      if (pipBtn && pipBtn.parentElement !== rightSideControls) {
        pipBtn.className = "myaew-pip-btn relative flex w-8 h-8 flex-col items-center justify-center cursor-pointer";
        pipBtn.style.cssText = TRANSPARENT_BTN_STYLE;
        rightSideControls.insertBefore(pipBtn, speedBtn.nextSibling);
      }
    } else {
      const parent = video.parentElement || document.body;
      if (!speedBtn.parentElement) {
        speedBtn.className = "myaew-speed-btn myaew-speed-btn-floating";
        speedBtn.style.cssText = TRANSPARENT_BTN_STYLE;
        parent.appendChild(speedBtn);
      }
      if (pipBtn && !pipBtn.parentElement) {
        pipBtn.className = "myaew-pip-btn myaew-pip-btn-floating";
        pipBtn.style.cssText = TRANSPARENT_BTN_STYLE;
        parent.appendChild(pipBtn);
      }
    }
  }

  function setupVideoController(video) {
    enableVideoPiPCompatibility(video);
    if (processedVideos.has(video)) return;
    processedVideos.add(video);

    if (!isSmartSpeedEnabled && currentSavedSpeed !== 1.0) {
      video.playbackRate = currentSavedSpeed;
    }

    const speedBtn = document.createElement("button");
    speedBtn.innerHTML = SVG_ICON;
    speedBtn.title = "Playback Speed & Break Skipper";
    video._speedBtn = speedBtn;
    speedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (activePopup && activePopup._video === video) closePopup();
      else createSpeedPopup(video, speedBtn);
    });

    let pipBtn = null;
    if (document.pictureInPictureEnabled || typeof video.requestPictureInPicture === "function") {
      pipBtn = document.createElement("button");
      pipBtn.innerHTML = PIP_SVG_ICON;
      pipBtn.title = "Picture-in-Picture";
      video._pipBtn = pipBtn;
      pipBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        closePopup();
        togglePictureInPicture(video);
      });
      video.addEventListener("enterpictureinpicture", () => pipBtn.classList.add("pip-active"));
      video.addEventListener("leavepictureinpicture", () => pipBtn.classList.remove("pip-active"));
    }

    placeControlButtons(video, speedBtn, pipBtn);

    // Note: Removed the old 2.5s video.pause() hold on "waiting" that caused 10s+ seek delays!
    video.addEventListener("waiting", () => {
      if (isSmartSpeedEnabled && !isFastSeeking) setVideoSpeed(video, 1.0, false);
    });

    let rateDebounce = null;
    video.addEventListener("ratechange", () => {
      if (isInternalSpeedChange || isFastSeeking) return;
      clearTimeout(rateDebounce);
      rateDebounce = setTimeout(() => {
        if (!isSmartSpeedEnabled && currentSavedSpeed && Math.abs(video.playbackRate - currentSavedSpeed) > 0.01) {
          isInternalSpeedChange = true;
          video.playbackRate = currentSavedSpeed;
          isInternalSpeedChange = false;
        }
        if (activePopup && activePopup._video === video) updatePopupUI(activePopup, video.playbackRate);
      }, 150);
    });

    video.addEventListener("play", () => {
      if (isSmartSpeedEnabled) setTimeout(manageSmartSpeed, 50);
      else if (currentSavedSpeed && Math.abs(video.playbackRate - currentSavedSpeed) > 0.01) {
        video.playbackRate = currentSavedSpeed;
      }
    });
  }

  function scanAndAttachVideos() {
    document.querySelectorAll("video").forEach((video) => {
      enableVideoPiPCompatibility(video);
      if (!processedVideos.has(video)) setupVideoController(video);
      else if (video._speedBtn) placeControlButtons(video, video._speedBtn, video._pipBtn);
    });
  }

  document.addEventListener("fullscreenchange", () => {
    closePopup();
    setTimeout(scanAndAttachVideos, 50);
  });
  document.addEventListener("click", () => closePopup());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePopup(); });

  new MutationObserver(scanAndAttachVideos).observe(document.documentElement, { childList: true, subtree: true });
  scanAndAttachVideos();
})();