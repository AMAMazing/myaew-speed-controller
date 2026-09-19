(() => {
  // --- 1. BITMOVIN BUFFER BOOSTER (Runs directly in page context) ---
  const applyBufferConfig = () => {
    const wrapper = document.querySelector('.bitmovinplayer-container') || document.querySelector('.bm-wrapper');
    
    if (wrapper && wrapper.player) {
      const bp = wrapper.player;
      
      // 1. Actively force the running Buffer Manager to 120 seconds for both video and audio
      if (bp.buffer && typeof bp.buffer.setTargetLevel === 'function') {
        try {
          bp.buffer.setTargetLevel('forwardduration', 120, 'video');
          bp.buffer.setTargetLevel('forwardduration', 120, 'audio');
        } catch (e) {
          // Ignore if API changes in future Bitmovin versions
        }
      }

      // 2. Also update the config object just in case they reload/restart the stream
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

  // Run immediately, and check every 3 seconds (in case you navigate to a new video)
  applyBufferConfig();
  setInterval(applyBufferConfig, 3000);


  // --- 2. EXTENSION SPEED LOGIC ---
  const PRESETS = [1.0, 1.25, 1.5, 2.0, 3.0];
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 10.0;
  const STEP = 0.05;

  const POPUP_OFFSET = {
    above: 24,
    below: 12,
  };

  const SVG_ICON = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" class="h-5 sm:h-6 transform-gpu transition-all duration-200 z-10 hover:scale-110">
      <path d="M20.38 8.57l-1.23 1.85a8 8 0 0 1-.22 7.58H5.07A8 8 0 0 1 15.58 6.85l1.85-1.23A10 10 0 0 0 3.35 19a2 2 0 0 0 1.72 1h13.85a2 2 0 0 0 1.74-1 10 10 0 0 0-.27-11.44zm-9.79 6.84a2 2 0 0 0 2.83 0l5.66-8.49-8.49 5.66a2 2 0 0 0 0 2.83z"/>
    </svg>
  `;

  const TRANSPARENT_BTN_STYLE =
    "background: transparent !important; border: none !important; box-shadow: none !important; outline: none !important; padding: 0 !important; border-radius: 0 !important;";

  let currentSavedSpeed = 1.0;
  let isInternalSpeedChange = false;

  // Use localStorage because chrome.storage is unavailable in the MAIN world
  try {
    const saved = localStorage.getItem("myaew_playback_speed");
    if (saved) {
      currentSavedSpeed = parseFloat(saved);
      applySpeedToAllVideos(currentSavedSpeed);
    }
  } catch (e) {}

  const processedVideos = new WeakSet();
  let activePopup = null;

  function formatSpeed(val) {
    return Number(val).toFixed(2) + "x";
  }

  function applySpeedToAllVideos(speed) {
    document.querySelectorAll("video").forEach((video) => {
      isInternalSpeedChange = true;
      video.playbackRate = speed;
      isInternalSpeedChange = false;
    });
  }

  function setVideoSpeed(video, speed, updateStorage = true) {
    const clamped = Math.max(MIN_SPEED, Math.min(MAX_SPEED, Math.round(speed * 100) / 100));

    isInternalSpeedChange = true;
    video.playbackRate = clamped;
    isInternalSpeedChange = false;

    currentSavedSpeed = clamped;

    if (updateStorage) {
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
      activePopup.remove();
      activePopup = null;
    }
  }

  function updatePopupUI(popup, speed) {
    const header = popup.querySelector(".myaew-speed-popup-header");
    if (header) {
      header.textContent = formatSpeed(speed);
    }

    const slider = popup.querySelector(".myaew-speed-slider");
    if (slider) {
      slider.value = speed;
      const percent = ((speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)) * 100;
      slider.style.background = `linear-gradient(to right, #ffffff ${percent}%, #555555 ${percent}%)`;
    }

    const presetButtons = popup.querySelectorAll(".myaew-preset-btn");
    presetButtons.forEach((btn) => {
      const presetVal = parseFloat(btn.dataset.speed);
      if (Math.abs(presetVal - speed) < 0.01) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function getFullscreenContainer() {
    return (
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      document.body
    );
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
    header.textContent = formatSpeed(currentSpeed);
    popup.appendChild(header);

    const sliderRow = document.createElement("div");
    sliderRow.className = "myaew-speed-slider-row";

    const minusBtn = document.createElement("button");
    minusBtn.className = "myaew-circle-btn";
    minusBtn.innerHTML = "&minus;";
    minusBtn.title = "Decrease speed";
    minusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setVideoSpeed(video, video.playbackRate - STEP);
    });

    const sliderContainer = document.createElement("div");
    sliderContainer.className = "myaew-slider-container";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "myaew-speed-slider";
    slider.min = MIN_SPEED;
    slider.max = MAX_SPEED;
    slider.step = STEP;
    slider.value = currentSpeed;

    slider.addEventListener("input", (e) => {
      const val = parseFloat(e.target.value);
      setVideoSpeed(video, val);
    });

    sliderContainer.appendChild(slider);

    const plusBtn = document.createElement("button");
    plusBtn.className = "myaew-circle-btn";
    plusBtn.innerHTML = "&#43;";
    plusBtn.title = "Increase speed";
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      setVideoSpeed(video, video.playbackRate + STEP);
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
        setVideoSpeed(video, preset);
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
    popup.addEventListener("click", (e) => e.stopPropagation());

    const container = getFullscreenContainer();
    container.appendChild(popup);

    const triggerRect = triggerBtn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();

    const popupWidth = popupRect.width || 320;
    const popupHeight = popupRect.height || 150;

    let top = triggerRect.top - containerRect.top - popupHeight - POPUP_OFFSET.above;
    let left = triggerRect.left - containerRect.left + triggerRect.width / 2 - popupWidth / 2;

    if (top < 10) {
      top = triggerRect.bottom - containerRect.top + POPUP_OFFSET.below;
    }
    if (left < 10) {
      left = 10;
    } else if (left + popupWidth > containerRect.width - 10) {
      left = containerRect.width - popupWidth - 10;
    }

    const scrollY = container === document.body ? window.scrollY : container.scrollTop;
    const scrollX = container === document.body ? window.scrollX : container.scrollLeft;

    popup.style.top = `${top + scrollY}px`;
    popup.style.left = `${left + scrollX}px`;

    activePopup = popup;
    updatePopupUI(popup, currentSpeed);
  }

  function placeSpeedButton(video, speedBtn) {
    const rightSideControls = document.querySelector(".player-controls .right-side");

    if (rightSideControls) {
      if (speedBtn.parentElement !== rightSideControls) {
        speedBtn.className =
          "myaew-speed-btn relative flex w-8 h-8 flex-col items-center justify-center cursor-pointer";
        speedBtn.style.cssText = TRANSPARENT_BTN_STYLE;
        rightSideControls.insertBefore(speedBtn, rightSideControls.firstChild);
      }
    } else {
      if (!speedBtn.parentElement) {
        speedBtn.className = "myaew-speed-btn myaew-speed-btn-floating";
        speedBtn.style.cssText = TRANSPARENT_BTN_STYLE;
        const parent = video.parentElement || video.parentNode;
        if (parent) {
          const computedStyle = window.getComputedStyle(parent);
          if (computedStyle.position === "static") {
            parent.style.position = "relative";
          }
          parent.appendChild(speedBtn);
        } else {
          document.body.appendChild(speedBtn);
        }
      }
    }
  }

  function setupVideoController(video) {
    if (processedVideos.has(video)) return;
    processedVideos.add(video);

    if (currentSavedSpeed && currentSavedSpeed !== 1.0) {
      video.playbackRate = currentSavedSpeed;
    }

    const speedBtn = document.createElement("button");
    speedBtn.innerHTML = SVG_ICON;
    speedBtn.title = "Change Playback Speed";
    video._speedBtn = speedBtn;

    speedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (activePopup && activePopup._video === video) {
        closePopup();
      } else {
        createSpeedPopup(video, speedBtn);
      }
    });

    placeSpeedButton(video, speedBtn);

    // Minor pause cushion if the massive buffer somehow still runs out
    let isBufferingHold = false;
    const handleBufferUnderrun = () => {
      if (video.playbackRate > 1.0 && !video.paused && !isBufferingHold) {
        isBufferingHold = true;
        video.pause();
        setTimeout(() => {
          video.play().finally(() => {
            isBufferingHold = false;
          });
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
        if (currentSavedSpeed && Math.abs(video.playbackRate - currentSavedSpeed) > 0.01) {
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
      if (currentSavedSpeed && Math.abs(video.playbackRate - currentSavedSpeed) > 0.01) {
        video.playbackRate = currentSavedSpeed;
      }
    });
  }

  function scanAndAttachVideos() {
    const videos = document.querySelectorAll("video");
    videos.forEach((video) => {
      if (!processedVideos.has(video)) {
        setupVideoController(video);
      } else if (video._speedBtn) {
        placeSpeedButton(video, video._speedBtn);
      }
    });
  }

  function handleFullscreenChange() {
    closePopup();
    setTimeout(() => {
      scanAndAttachVideos();
      applySpeedToAllVideos(currentSavedSpeed);
    }, 50);
  }

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
  document.addEventListener("mozfullscreenchange", handleFullscreenChange);
  document.addEventListener("MSFullscreenChange", handleFullscreenChange);

  document.addEventListener("click", () => closePopup());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePopup();
  });

  const observer = new MutationObserver(() => scanAndAttachVideos());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  scanAndAttachVideos();
})();