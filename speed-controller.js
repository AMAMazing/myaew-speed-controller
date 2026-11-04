(() => {
  // --- 1. BITMOVIN BUFFER BOOSTER ---
  const applyBufferConfig = () => {
    const wrapper = document.querySelector('.bitmovinplayer-container') || document.querySelector('.bm-wrapper');
    
    if (wrapper && wrapper.player) {
      const bp = wrapper.player;
      if (bp.buffer && typeof bp.buffer.setTargetLevel === 'function') {
        try {
          bp.buffer.setTargetLevel('forwardduration', 120, 'video');
          bp.buffer.setTargetLevel('forwardduration', 120, 'audio');
        } catch (e) {}
      }
      if (typeof bp.getConfig === 'function') {
        try {
          const config = bp.getConfig();
          if (!config.buffer) config.buffer = {};
          if (!config.buffer.video) config.buffer.video = {};
          if (!config.buffer.audio) config.buffer.audio = {};
          
          config.buffer.video.forwardduration = 120;
          config.buffer.audio.forwardduration = 120;

          if (!config.tweaks) config.tweaks = {};
          config.tweaks.max_buffer_level = 120;
        } catch (e) {}
      }
    }
  };

  applyBufferConfig();
  setInterval(applyBufferConfig, 3000);

  // --- 2. EXTENSION SPEED & PIP LOGIC ---
  const PRESETS = [1.0, 1.25, 1.5, 2.0, 3.0, 4.0];
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 4.0;
  const STEP = 0.05;

  const POPUP_OFFSET = { above: 24, below: 12 };

  const SVG_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="h-5 sm:h-6 transform-gpu transition-all duration-200 z-10 hover:scale-110">
      <path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-11.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/>
    </svg>
  `;

  const PIP_SVG_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="h-5 sm:h-6 transform-gpu transition-all duration-200 z-10 hover:scale-110">
      <path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/>
    </svg>
  `;

  const TRANSPARENT_BTN_STYLE = "background: transparent !important; border: none !important; box-shadow: none !important; outline: none !important; padding: 0 !important; border-radius: 0 !important;";

  let currentSavedSpeed = 1.0;
  let isInternalSpeedChange = false;
  let isSmartSpeedEnabled = false;

  let smartTargetMode = 'speed'; // 'speed' or 'time'
  let smartTargetTime = ''; // 'HH:MM'

  const isMobileOrShortScreen = () =>
    window.innerWidth <= 640 ||
    (window.innerHeight <= 500 && window.matchMedia("(hover: none)").matches);

  // Load saved states
  try {
    const saved = localStorage.getItem("myaew_playback_speed");
    if (saved) currentSavedSpeed = parseFloat(saved);

    const smartSaved = localStorage.getItem("myaew_smart_speed_enabled");
    if (smartSaved === "true") isSmartSpeedEnabled = true;

    const savedMode = localStorage.getItem("myaew_smart_mode");
    if (savedMode) smartTargetMode = savedMode;

    const savedTime = localStorage.getItem("myaew_smart_time");
    if (savedTime) smartTargetTime = savedTime;

    applySpeedToAllVideos(currentSavedSpeed);
  } catch (e) {}

  const processedVideos = new WeakSet();
  let activePopup = null;

  function formatSpeed(val) {
    return Number(val).toFixed(2) + "x";
  }

  function calculateTimeBasedTargetRate(video) {
    if (!video || !isFinite(video.duration) || isNaN(video.currentTime)) return currentSavedSpeed;
    if (!smartTargetTime) return currentSavedSpeed;

    const now = new Date();
    const [hours, minutes] = smartTargetTime.split(':').map(Number);
    let targetDate = new Date();
    targetDate.setHours(hours, minutes, 0, 0);
    
    // If target time has already passed today, assume it's for tomorrow
    if (targetDate <= now) {
      targetDate.setDate(targetDate.getDate() + 1);
    }
    
    const realSecRemaining = (targetDate.getTime() - now.getTime()) / 1000;
    const videoRemaining = video.duration - video.currentTime;
    
    if (realSecRemaining > 0 && videoRemaining > 0) {
      let req = videoRemaining / realSecRemaining;
      return Math.max(MIN_SPEED, Math.min(MAX_SPEED, req));
    }
    return currentSavedSpeed;
  }

  // --- SMART AUTO-SPEED ALGORITHM (PROPORTIONAL CONTROL) ---
  function getBufferAhead(video) {
    let bufferAhead = 0;
    const currentTime = video.currentTime;
    const buffered = video.buffered;
    for (let i = 0; i < buffered.length; i++) {
      if (buffered.start(i) <= currentTime && buffered.end(i) > currentTime) {
        bufferAhead = buffered.end(i) - currentTime;
        break;
      }
    }
    return bufferAhead;
  }

  function manageSmartSpeed() {
    if (!isSmartSpeedEnabled) return;

    document.querySelectorAll("video").forEach((video) => {
      if (video.paused || video.readyState === 0) return;

      const buffer = getBufferAhead(video);
      let currentRate = video.playbackRate;
      let targetRate = currentSavedSpeed; 
      
      if (smartTargetMode === 'time' && smartTargetTime) {
        targetRate = calculateTimeBasedTargetRate(video);
      }

      // Proportional Stabilizer Bounds
      const SAFE_BUFFER_MAX = 90; // Seconds of buffer required to reach 100% of target speed
      const SAFE_BUFFER_MIN = 15; // Seconds of buffer where speed drops to 1.0x

      let minAllowedSpeed = Math.min(1.0, targetRate);
      let newRate;

      if (buffer >= SAFE_BUFFER_MAX) {
        newRate = targetRate; // Plenty of buffer, full speed ahead
      } else if (buffer <= SAFE_BUFFER_MIN) {
        newRate = minAllowedSpeed; // Buffer critically low, scale back to 1x to recover
      } else {
        // Smoothly interpolate speed between Min and Max safe buffers
        const bufferFactor = (buffer - SAFE_BUFFER_MIN) / (SAFE_BUFFER_MAX - SAFE_BUFFER_MIN);
        newRate = minAllowedSpeed + bufferFactor * (targetRate - minAllowedSpeed);
      }

      // Final clamps for safety
      newRate = Math.max(MIN_SPEED, Math.min(MAX_SPEED, newRate));

      // Smooth out small decimals (round to nearest 0.05) to prevent constant audio-warble
      newRate = Math.round(newRate * 20) / 20;

      // Apply if there is a meaningful change
      if (Math.abs(newRate - currentRate) >= 0.05) {
        setVideoSpeed(video, newRate, false); 
      }
    });
  }

  // Run the smart loop every 2500ms (also runs while in Picture-in-Picture)
  setInterval(manageSmartSpeed, 2500);

  function applySpeedToAllVideos(speed) {
    if (isSmartSpeedEnabled) return; // Don't enforce static speeds if smart is on
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
      
      // If manual adjustment happens while in time mode, auto-switch to speed mode
      if (isSmartSpeedEnabled && smartTargetMode === 'time') {
         smartTargetMode = 'speed';
         try { localStorage.setItem("myaew_smart_mode", "speed"); } catch(e){}
      }
      
      try {
        localStorage.setItem("myaew_playback_speed", clamped.toString());
      } catch (e) {}
    }

    if (activePopup && activePopup._video === video) {
      updatePopupUI(activePopup, clamped);
    }
  }

  function closePopup() {
    if (activePopup) {
      if (activePopup._telemetryInterval) {
        clearInterval(activePopup._telemetryInterval);
      }
      activePopup.remove();
      activePopup = null;
    }
  }

  function updatePopupUI(popup, currentRate) {
    let displaySpeed = currentRate;
    let computedTargetRate = currentSavedSpeed;

    if (isSmartSpeedEnabled) {
      if (smartTargetMode === 'time' && smartTargetTime) {
         computedTargetRate = calculateTimeBasedTargetRate(popup._video);
      }
      displaySpeed = computedTargetRate;
    }

    const header = popup.querySelector(".myaew-speed-popup-header");
    if (header) {
      if (isSmartSpeedEnabled) {
         if (smartTargetMode === 'time') {
           header.textContent = "Req. Target: " + formatSpeed(displaySpeed);
         } else {
           header.textContent = "Target: " + formatSpeed(displaySpeed);
         }
      } else {
         header.textContent = formatSpeed(displaySpeed);
      }
    }

    const slider = popup.querySelector(".myaew-speed-slider");
    if (slider) {
      slider.value = displaySpeed;
      const percent = ((displaySpeed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
      slider.style.background = `linear-gradient(to right, #ffffff ${percent}%, #555555 ${percent}%)`;
    }

    const presetButtons = popup.querySelectorAll(".myaew-preset-btn");
    presetButtons.forEach((btn) => {
      const presetVal = parseFloat(btn.dataset.speed);
      if (Math.abs(presetVal - displaySpeed) < 0.01) btn.classList.add("active");
      else btn.classList.remove("active");
    });

    const smartBtn = popup.querySelector(".myaew-smart-btn");
    const smartOptions = popup.querySelector(".myaew-smart-options");
    const modeSpeedBtn = popup.querySelector(".myaew-mode-speed-btn");
    const modeTimeBtn = popup.querySelector(".myaew-mode-time-btn");
    const timeRow = popup.querySelector(".myaew-time-row");

    if (smartBtn) {
      if (isSmartSpeedEnabled) {
        smartBtn.classList.add("active");
        smartBtn.querySelector('span').textContent = "Smart Auto-Speed: ON";
        if (smartOptions) smartOptions.style.display = "flex";
      } else {
        smartBtn.classList.remove("active");
        smartBtn.querySelector('span').textContent = "Smart Auto-Speed: OFF";
        if (smartOptions) smartOptions.style.display = "none";
      }
    }

    if (modeSpeedBtn && modeTimeBtn) {
      if (smartTargetMode === 'speed') {
        modeSpeedBtn.classList.add("active");
        modeTimeBtn.classList.remove("active");
      } else {
        modeTimeBtn.classList.add("active");
        modeSpeedBtn.classList.remove("active");
      }
    }

    if (timeRow) {
      timeRow.style.display = smartTargetMode === 'time' ? "flex" : "none";
    }
  }

  function getFullscreenContainer() {
    return (
      document.fullscreenElement || document.webkitFullscreenElement ||
      document.mozFullScreenElement || document.msFullscreenElement || document.body
    );
  }

  function repositionPopup(popup, triggerBtn, container) {
    const containerRect = container.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    const popupWidth = popupRect.width || 320;
    const popupHeight = popupRect.height || 280;

    // Mobile / Vivaldi Android: Center popup neatly so it never clips off-screen
    if (isMobileOrShortScreen()) {
      const top = Math.max(12, (containerRect.height - popupHeight) / 2);
      const left = Math.max(12, (containerRect.width - popupWidth) / 2);
      popup.style.top = `${top}px`;
      popup.style.left = `${left}px`;
      return;
    }

    // Desktop positioning (100% original behavior)
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
    popup.style.zIndex = "2147483647";
    popup.style.position = "absolute";
    popup._video = video;

    const currentSpeed = video.playbackRate || 1.0;

    const header = document.createElement("div");
    header.className = "myaew-speed-popup-header";
    popup.appendChild(header);

    const sliderRow = document.createElement("div");
    sliderRow.className = "myaew-speed-slider-row";

    const minusBtn = document.createElement("button");
    minusBtn.className = "myaew-circle-btn";
    minusBtn.innerHTML = "&minus;";
    minusBtn.title = "Decrease speed";
    minusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setVideoSpeed(video, (isSmartSpeedEnabled && smartTargetMode === 'speed' ? currentSavedSpeed : video.playbackRate) - STEP, true); 
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
    plusBtn.title = "Increase speed";
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setVideoSpeed(video, (isSmartSpeedEnabled && smartTargetMode === 'speed' ? currentSavedSpeed : video.playbackRate) + STEP, true);
    });

    sliderRow.appendChild(minusBtn);
    sliderRow.appendChild(sliderContainer);
    sliderRow.appendChild(plusBtn);
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

    // --- SMART TOGGLE UI ---
    const smartContainer = document.createElement("div");
    smartContainer.className = "myaew-smart-container";
    
    const smartRow = document.createElement("div");
    smartRow.className = "myaew-smart-toggle-row";
    
    const smartBtn = document.createElement("button");
    smartBtn.className = "myaew-smart-btn" + (isSmartSpeedEnabled ? " active" : "");
    
    const indicator = document.createElement("div");
    indicator.className = "myaew-smart-indicator";
    
    const textSpan = document.createElement("span");
    smartBtn.appendChild(indicator);
    smartBtn.appendChild(textSpan);

    smartBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isSmartSpeedEnabled = !isSmartSpeedEnabled;
      
      try {
        localStorage.setItem("myaew_smart_speed_enabled", isSmartSpeedEnabled.toString());
      } catch (e) {}

      updatePopupUI(popup, video.playbackRate);
      repositionPopup(popup, triggerBtn, getFullscreenContainer());

      if (!isSmartSpeedEnabled) {
        setVideoSpeed(video, currentSavedSpeed, true);
      }
    });

    smartRow.appendChild(smartBtn);
    smartContainer.appendChild(smartRow);
    
    // --- SMART OPTIONS UI ---
    const smartOptions = document.createElement("div");
    smartOptions.className = "myaew-smart-options";
    
    const modeRow = document.createElement("div");
    modeRow.className = "myaew-mode-row";
    const modeLabel = document.createElement("span");
    modeLabel.textContent = "Target Mode:";
    
    const modeToggle = document.createElement("div");
    modeToggle.className = "myaew-mode-toggle";
    
    const modeSpeedBtn = document.createElement("button");
    modeSpeedBtn.className = "myaew-mode-btn myaew-mode-speed-btn";
    modeSpeedBtn.textContent = "Speed";
    
    const modeTimeBtn = document.createElement("button");
    modeTimeBtn.className = "myaew-mode-btn myaew-mode-time-btn";
    modeTimeBtn.textContent = "Time";
    
    modeSpeedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      smartTargetMode = 'speed';
      try { localStorage.setItem("myaew_smart_mode", "speed"); } catch(e){}
      updatePopupUI(popup, video.playbackRate);
      repositionPopup(popup, triggerBtn, getFullscreenContainer());
    });
    
    modeTimeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      smartTargetMode = 'time';
      try { localStorage.setItem("myaew_smart_mode", "time"); } catch(e){}
      updatePopupUI(popup, video.playbackRate);
      repositionPopup(popup, triggerBtn, getFullscreenContainer());
    });
    
    modeToggle.appendChild(modeSpeedBtn);
    modeToggle.appendChild(modeTimeBtn);
    modeRow.appendChild(modeLabel);
    modeRow.appendChild(modeToggle);
    smartOptions.appendChild(modeRow);
    
    const timeRow = document.createElement("div");
    timeRow.className = "myaew-time-row";
    const timeLabel = document.createElement("span");
    timeLabel.textContent = "Finish At:";
    
    const timeInput = document.createElement("input");
    timeInput.type = "time";
    timeInput.className = "myaew-time-input";
    timeInput.value = smartTargetTime;
    
    timeInput.addEventListener("change", (e) => {
      smartTargetTime = e.target.value;
      try { localStorage.setItem("myaew_smart_time", smartTargetTime); } catch(e){}
      updatePopupUI(popup, video.playbackRate);
    });
    timeInput.addEventListener("click", (e) => e.stopPropagation());
    
    timeRow.appendChild(timeLabel);
    timeRow.appendChild(timeInput);
    smartOptions.appendChild(timeRow);
    
    smartContainer.appendChild(smartOptions);
    popup.appendChild(smartContainer);
    
    // --- LIVE TELEMETRY UI ---
    const telemetryRow = document.createElement("div");
    telemetryRow.className = "myaew-telemetry-row";
    
    const telemetryText = document.createElement("div");
    telemetryText.className = "myaew-telemetry-text";
    
    telemetryRow.appendChild(telemetryText);
    popup.appendChild(telemetryRow);

    const updateTelemetry = () => {
      if (activePopup !== popup) return;
      
      if (!isSmartSpeedEnabled) {
        telemetryRow.style.display = 'none';
        return;
      }
      
      if (smartTargetMode === 'time') {
        updatePopupUI(popup, video.playbackRate);
      }
      
      telemetryRow.style.display = 'block';
      const rate = video.playbackRate.toFixed(2);
      const buf = Math.round(getBufferAhead(video));
      
      let rateColor = "#4caf50";
      const targetRate = smartTargetMode === 'time' ? calculateTimeBasedTargetRate(video) : currentSavedSpeed;
      
      if (buf < 20) rateColor = "#ff9800";
      else if (video.playbackRate < targetRate - 0.05) rateColor = "#2196f3";

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

    updatePopupUI(popup, currentSpeed);
    repositionPopup(popup, triggerBtn, container);
  }

  // Unlocks Bitmovin's PiP restrictions so both Chrome's PiP Extension and Native PiP work
  function enableVideoPiPCompatibility(video) {
    if (video.hasAttribute("disablePictureInPicture")) {
      video.removeAttribute("disablePictureInPicture");
    }
    if (video.disablePictureInPicture) {
      video.disablePictureInPicture = false;
    }
  }

  async function togglePictureInPicture(video) {
    enableVideoPiPCompatibility(video);
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (typeof video.requestPictureInPicture === "function") {
        await video.requestPictureInPicture();
      } else if (typeof video.webkitSetPresentationMode === "function") {
        const mode = video.webkitPresentationMode === "picture-in-picture" ? "inline" : "picture-in-picture";
        video.webkitSetPresentationMode(mode);
      }
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
        if (document.pictureInPictureElement === video) pipBtn.classList.add("pip-active");
        rightSideControls.insertBefore(pipBtn, speedBtn.nextSibling);
      }
    } else {
      const parent = video.parentElement || video.parentNode || document.body;
      if (parent && parent !== document.body && window.getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }
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

    if (!isSmartSpeedEnabled && currentSavedSpeed && currentSavedSpeed !== 1.0) {
      video.playbackRate = currentSavedSpeed;
    }

    // 1. Speed Button
    const speedBtn = document.createElement("button");
    speedBtn.innerHTML = SVG_ICON;
    speedBtn.title = "Change Playback Speed";
    video._speedBtn = speedBtn;

    speedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (activePopup && activePopup._video === video) closePopup();
      else createSpeedPopup(video, speedBtn);
    });

    // 2. Picture-in-Picture Button (Works with or without Chrome's PiP Extension)
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

      video.addEventListener("enterpictureinpicture", () => {
        pipBtn.classList.add("pip-active");
        closePopup();
      });

      video.addEventListener("leavepictureinpicture", () => {
        pipBtn.classList.remove("pip-active");
      });
    }

    placeControlButtons(video, speedBtn, pipBtn);

    let isBufferingHold = false;
    const handleBufferUnderrun = () => {
      if (isSmartSpeedEnabled) {
        setVideoSpeed(video, 1.0, false);
      }
      
      if (video.playbackRate > 1.0 && !video.paused && !isBufferingHold) {
        isBufferingHold = true;
        video.pause();
        setTimeout(() => {
          video.play().finally(() => { isBufferingHold = false; });
        }, 2500);
      }
    };

    video.addEventListener("waiting", handleBufferUnderrun);
    video.addEventListener("stalled", handleBufferUnderrun);

    let rateDebounce = null;
    video.addEventListener("ratechange", () => {
      if (isInternalSpeedChange) return;
      clearTimeout(rateDebounce);
      rateDebounce = setTimeout(() => {
        if (!isSmartSpeedEnabled && currentSavedSpeed && Math.abs(video.playbackRate - currentSavedSpeed) > 0.01) {
          isInternalSpeedChange = true;
          video.playbackRate = currentSavedSpeed;
          isInternalSpeedChange = false;
        }
        if (activePopup && activePopup._video === video) {
          updatePopupUI(activePopup, video.playbackRate);
        }
      }, 150);
    });

    video.addEventListener("play", () => {
      enableVideoPiPCompatibility(video);
      if (isSmartSpeedEnabled) {
        setTimeout(manageSmartSpeed, 50); 
      } else if (currentSavedSpeed && Math.abs(video.playbackRate - currentSavedSpeed) > 0.01) {
        video.playbackRate = currentSavedSpeed;
      }
    });
  }

  function scanAndAttachVideos() {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      enableVideoPiPCompatibility(video);
      if (!processedVideos.has(video)) setupVideoController(video);
      else if (video._speedBtn) placeControlButtons(video, video._speedBtn, video._pipBtn);
    });
  }

  function handleFullscreenChange() {
    closePopup();
    setTimeout(() => {
      scanAndAttachVideos();
      if (!isSmartSpeedEnabled) applySpeedToAllVideos(currentSavedSpeed);
    }, 50);
  }

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleFullscreenChange);
  document.addEventListener("MSFullscreenChange", handleFullscreenChange);
  document.addEventListener("click", () => closePopup());
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePopup(); });

  window.addEventListener("resize", () => {
    if (activePopup && activePopup._video && activePopup._video._speedBtn) {
      repositionPopup(activePopup, activePopup._video._speedBtn, getFullscreenContainer());
    }
  });

  const observer = new MutationObserver(() => scanAndAttachVideos());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  scanAndAttachVideos();
})();