(() => {
  // ==========================================================================
  // MyAEW Cinema Experience: Integrated Top Overlay & Inactivity Manager
  // Activates ONLY on video playback routes (myaew.com/video/*)
  // ==========================================================================

  let inactivityTimer = null;
  let topOverlay = null;
  let isMenuOpen = false;
  let cachedShowTitle = "";
  let lastVideoPath = "";

  const INACTIVITY_DELAY = 3500;
  const isTouchDevice = () =>
    window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
    "ontouchstart" in window;

  function isVideoRoute() {
    return window.location.pathname.includes("/video");
  }

  function isFullscreen() {
    return !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement ||
      (window.innerWidth === screen.width && window.innerHeight === screen.height)
    );
  }

  function updateFullscreenState() {
    const fs = isFullscreen();
    if (fs) {
      document.documentElement.classList.add("myaew-fullscreen");
    } else {
      document.documentElement.classList.remove("myaew-fullscreen");
    }

    const streamSelectors = document.querySelectorAll(".nav-pip-selector");
    streamSelectors.forEach((el) => {
      if (fs) {
        el.style.setProperty("display", "none", "important");
      } else {
        el.style.display = "";
      }
    });
  }

  function isTimestamp(str) {
    if (!str) return true;
    const clean = str.trim();
    const letters = clean.match(/[a-zA-Z]/g);
    if (!letters || letters.length < 2) {
      return true;
    }
    if (/^(\d{1,2}:)?\d{1,2}:\d{2}(\s*[\/\-]\s*(\d{1,2}:)?\d{1,2}:\d{2})?$/.test(clean) && letters.length < 3) {
      return true;
    }
    return false;
  }

  function cleanTitle(raw) {
    if (!raw) return "";
    let text = raw.trim();
    text = text.replace(/^[\s|–—\-/]+/, "").replace(/[\s|–—\-/]+$/, "").trim();
    text = text.replace(/\s*[-–—|]\s*MyAEW.*$/i, "").trim();
    text = text.replace(/^MyAEW\s*[-–—|]\s*/i, "").trim();
    text = text.replace(/^[\s|–—\-/]+/, "").replace(/[\s|–—\-/]+$/, "").trim();
    return text;
  }

  function getShowTitle() {
    const currentPath = window.location.pathname;
    if (currentPath !== lastVideoPath) {
      lastVideoPath = currentPath;
      cachedShowTitle = "";
    }

    // 1. Check original top bar before or while adopted
    const originalTopBar = document.querySelector("#primaryViewer > .relative.flex.flex-row.items-center");
    if (originalTopBar) {
      const topBarCandidates = originalTopBar.querySelectorAll("span, div, p, h1, h2");
      for (const el of topBarCandidates) {
        if (el.closest(".nav-pip-selector") || el.closest("button") || el.closest(".logo") || el.closest("svg")) {
          continue;
        }
        let text = cleanTitle(el.textContent || "");
        if (text && text.toUpperCase() !== "MYAEW" && !isTimestamp(text) && text.length > 2) {
          cachedShowTitle = text;
          return text;
        }
      }
    }

    // 2. Static title block in #videoPlayer (original standalone block on MyAEW)
    const staticTitleEl = document.querySelector("#videoPlayer > div.absolute.top-0.left-0");
    if (staticTitleEl) {
      const candidate = staticTitleEl.querySelector(".time-text") || staticTitleEl;
      let text = cleanTitle(candidate.textContent || "");
      if (text && text.toUpperCase() !== "MYAEW" && !isTimestamp(text) && text.length > 2) {
        cachedShowTitle = text;
        return text;
      }
    }

    // 3. Any .time-text that is NOT inside player controls or Bitmovin UI
    const allTimeTexts = document.querySelectorAll(".time-text");
    for (const el of allTimeTexts) {
      if (
        el.closest(".player-controls") ||
        el.closest(".bm-wrapper") ||
        el.closest(".bmpui-ui-controlbar") ||
        el.closest(".bitmovinplayer-container")
      ) {
        continue;
      }
      let text = cleanTitle(el.textContent || "");
      if (text && text.toUpperCase() !== "MYAEW" && !isTimestamp(text) && text.length > 2) {
        cachedShowTitle = text;
        return text;
      }
    }

    // 4. Other event title candidate elements across the page
    const otherCandidates = [
      document.querySelector(".event-detail .time-text"),
      document.querySelector(".event-detail h1"),
      document.querySelector(".event-detail .event-title"),
      document.querySelector(".event-detail .title"),
      document.querySelector("#event-detail h1"),
      document.querySelector("#event-detail .event-title"),
      document.querySelector("#event-detail .time-text"),
      document.querySelector("#primaryViewer h1"),
      document.querySelector("#primaryViewer .event-title"),
      document.querySelector(".event-title"),
      document.querySelector("meta[property='og:title']"),
      document.querySelector("meta[name='twitter:title']"),
      document.querySelector("meta[name='title']")
    ];

    for (const el of otherCandidates) {
      if (!el) continue;
      let text = el.tagName === "META" ? el.getAttribute("content") : (el.textContent || "");
      text = cleanTitle(text);
      if (text && text.toUpperCase() !== "MYAEW" && !isTimestamp(text) && text.length > 2) {
        cachedShowTitle = text;
        return text;
      }
    }

    if (cachedShowTitle) {
      return cachedShowTitle;
    }

    const docTitle = cleanTitle(document.title);
    if (docTitle && docTitle.toUpperCase() !== "MYAEW" && !isTimestamp(docTitle) && docTitle.length > 2) {
      cachedShowTitle = docTitle;
      return docTitle;
    }

    return "AEW";
  }

  // Syncs title and playback actions with Android PiP & Notification MediaSession
  function updateMediaSession(title) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || "AEW",
        artist: "MyAEW",
        album: "All Elite Wrestling"
      });

      const getActiveVideo = () => document.querySelector("#videoPlayer video, .bitmovinplayer-container video, video");

      navigator.mediaSession.setActionHandler("play", () => {
        const v = getActiveVideo();
        if (v) v.play().catch(() => {});
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        const v = getActiveVideo();
        if (v) v.pause();
      });
      navigator.mediaSession.setActionHandler("seekbackward", (details) => {
        const v = getActiveVideo();
        if (v) v.currentTime = Math.max(0, v.currentTime - (details.seekOffset || 10));
      });
      navigator.mediaSession.setActionHandler("seekforward", (details) => {
        const v = getActiveVideo();
        if (v) v.currentTime = Math.min(v.duration || Infinity, v.currentTime + (details.seekOffset || 10));
      });
    } catch (e) {}
  }

  function createTopOverlay(videoPlayer) {
    const allOverlays = document.querySelectorAll(".myaew-top-overlay");
    let overlay = null;
    allOverlays.forEach((el) => {
      if (el.parentElement === videoPlayer) {
        if (!overlay) overlay = el;
        else el.remove();
      } else {
        el.remove();
      }
    });

    if (overlay) return overlay;

    overlay = document.createElement("div");
    overlay.className = "myaew-top-overlay myaew-controls-visible";

    const leftSection = document.createElement("div");
    leftSection.className = "myaew-top-overlay-left";

    const rightSection = document.createElement("div");
    rightSection.className = "myaew-top-overlay-right";

    overlay.appendChild(leftSection);
    overlay.appendChild(rightSection);

    videoPlayer.insertBefore(overlay, videoPlayer.firstChild);
    return overlay;
  }

  function updateTitle(overlay) {
    const leftSection = overlay.querySelector(".myaew-top-overlay-left");
    if (!leftSection) return;

    let titleEl = overlay.querySelector(".myaew-show-title");
    if (!titleEl) {
      titleEl = document.createElement("div");
      titleEl.className = "myaew-show-title";
      leftSection.appendChild(titleEl);
    } else {
      if (titleEl.parentElement === leftSection && leftSection.lastElementChild !== titleEl) {
        leftSection.appendChild(titleEl);
      }
    }

    const allTitles = leftSection.querySelectorAll(".myaew-show-title");
    for (let i = 1; i < allTitles.length; i++) {
      allTitles[i].remove();
    }

    const currentTitle = getShowTitle();
    if (currentTitle) {
      if (currentTitle !== "AEW" || !titleEl.textContent || titleEl.textContent === "AEW") {
        if (titleEl.textContent !== currentTitle) {
          titleEl.textContent = currentTitle;
          titleEl.title = currentTitle;
          updateMediaSession(currentTitle);
        }
      }
    }
  }

  function adoptHeaderElements(overlay) {
    const leftSection = overlay.querySelector(".myaew-top-overlay-left");
    const rightSection = overlay.querySelector(".myaew-top-overlay-right");
    if (!leftSection || !rightSection) return;

    const originalTopBar = document.querySelector("#primaryViewer > .relative.flex.flex-row.items-center");
    if (!originalTopBar) {
      const backBtns = leftSection.querySelectorAll(".myaew-back-btn");
      for (let i = 1; i < backBtns.length; i++) backBtns[i].remove();
      const logos = leftSection.querySelectorAll(".myaew-logo");
      for (let i = 1; i < logos.length; i++) logos[i].remove();
      return;
    }

    // 1. Back button
    const backButton = originalTopBar.querySelector(".top-bar-contents button");
    if (backButton && backButton.parentElement !== leftSection) {
      backButton.classList.add("myaew-back-btn");
      const existingBackBtn = leftSection.querySelector(".myaew-back-btn");
      if (existingBackBtn && existingBackBtn !== backButton) {
        existingBackBtn.replaceWith(backButton);
      } else if (!existingBackBtn) {
        leftSection.insertBefore(backButton, leftSection.firstChild);
      }
    }
    const allBackBtns = leftSection.querySelectorAll(".myaew-back-btn");
    for (let i = 1; i < allBackBtns.length; i++) {
      allBackBtns[i].remove();
    }

    // 2. AEW Logo
    const originalLogo = originalTopBar.querySelector(".top-bar-contents .logo");
    if (originalLogo && originalLogo.parentElement !== leftSection) {
      originalLogo.classList.add("myaew-logo");
      const existingLogo = leftSection.querySelector(".myaew-logo");
      if (existingLogo && existingLogo !== originalLogo) {
        existingLogo.replaceWith(originalLogo);
      } else if (!existingLogo) {
        const currentBack = leftSection.querySelector(".myaew-back-btn");
        if (currentBack && currentBack.nextSibling) {
          leftSection.insertBefore(originalLogo, currentBack.nextSibling);
        } else if (currentBack) {
          leftSection.appendChild(originalLogo);
        } else {
          leftSection.insertBefore(originalLogo, leftSection.firstChild);
        }
      }
    }
    const allLogos = leftSection.querySelectorAll(".myaew-logo");
    for (let i = 1; i < allLogos.length; i++) {
      allLogos[i].remove();
    }

    // 3. Show Title
    updateTitle(overlay);

    // 4. Stream selector
    const streamSelector = originalTopBar.querySelector(".nav-pip-selector");
    if (streamSelector && streamSelector.parentElement !== rightSection) {
      const existingStream = rightSection.querySelector(".nav-pip-selector");
      if (existingStream && existingStream !== streamSelector) {
        existingStream.replaceWith(streamSelector);
      } else if (!existingStream) {
        rightSection.insertBefore(streamSelector, rightSection.firstChild);
      }
    }
    const allStreams = rightSection.querySelectorAll(".nav-pip-selector");
    for (let i = 1; i < allStreams.length; i++) {
      allStreams[i].remove();
    }

    // 5. Help Circle button
    const helpBtn = originalTopBar.querySelector(".self-end button") || originalTopBar.querySelector("button img[alt*='Help']");
    const helpContainer = helpBtn ? (helpBtn.closest("button") || helpBtn) : null;
    if (helpContainer && helpContainer.parentElement !== rightSection) {
      helpContainer.classList.add("myaew-help-btn");
      const existingHelp = rightSection.querySelector(".myaew-help-btn");
      if (existingHelp && existingHelp !== helpContainer) {
        existingHelp.replaceWith(helpContainer);
      } else if (!existingHelp) {
        rightSection.appendChild(helpContainer);
      }
    }
    const allHelp = rightSection.querySelectorAll(".myaew-help-btn");
    for (let i = 1; i < allHelp.length; i++) {
      allHelp[i].remove();
    }

    // Hide any matching original top bars
    document.querySelectorAll("#primaryViewer > .relative.flex.flex-row.items-center").forEach((bar) => {
      bar.style.display = "none";
    });
  }

  function showControls(container) {
    container.classList.remove("myaew-controls-hidden");
    container.classList.add("myaew-controls-visible");
  }

  function hideControls(container) {
    const video = container.querySelector("video");
    const hasOpenPopup = document.querySelector(".myaew-speed-popup");
    const qualityMenuOpen = document.querySelector(".menu-wrap [style*='display: flex'], .menu-wrap [style*='display: block']");
    const streamMenuOpen = !isFullscreen() && document.querySelector(".nav-pip-selector [style*='display: flex'], .nav-pip-selector [style*='display: block']");

    // Never hide controls while in Picture-in-Picture or when a popup is open
    if (isMenuOpen || hasOpenPopup || qualityMenuOpen || streamMenuOpen || document.pictureInPictureElement) {
      return;
    }

    if (video && !video.paused) {
      container.classList.remove("myaew-controls-visible");
      container.classList.add("myaew-controls-hidden");
    }
  }

  function resetInactivity(container) {
    showControls(container);
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      hideControls(container);
    }, INACTIVITY_DELAY);
  }

  function setupInactivityManager(container) {
    if (container._inactivityAttached) return;
    container._inactivityAttached = true;

    // Desktop Mouse Movement
    container.addEventListener("mousemove", (e) => {
      if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      if (!isTouchDevice()) resetInactivity(container);
    });

    // Touch vs Mouse Pointer handling
    container.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch" || isTouchDevice()) {
        const inControls = e.target.closest(".myaew-top-overlay, .player-controls, .myaew-speed-popup, button, input");
        if (inControls) {
          // Interacting with a control button on touch: keep visible & restart timer
          isMenuOpen = false;
          resetInactivity(container);
        } else {
          // Tapped empty video area on Android: toggle controls visibility cleanly
          if (container.classList.contains("myaew-controls-visible")) {
            clearTimeout(inactivityTimer);
            container.classList.remove("myaew-controls-visible");
            container.classList.add("myaew-controls-hidden");
          } else {
            resetInactivity(container);
          }
        }
      } else {
        resetInactivity(container);
      }
    });

    const video = container.querySelector("video");
    if (video && !video._cinemaListenersAttached) {
      video._cinemaListenersAttached = true;
      video.addEventListener("play", () => resetInactivity(container));
      video.addEventListener("pause", () => showControls(container));
      video.addEventListener("enterpictureinpicture", () => {
        isMenuOpen = false;
        showControls(container);
      });
      video.addEventListener("leavepictureinpicture", () => {
        resetInactivity(container);
      });
    }

    const topOverlayEl = container.querySelector(".myaew-top-overlay");
    const bottomControlsEl = container.querySelector(".player-controls");

    const keepVisible = () => {
      if (isTouchDevice()) return; // Prevent simulated touch mouseenter from permanently locking controls
      isMenuOpen = true;
      showControls(container);
      clearTimeout(inactivityTimer);
    };

    const allowHide = () => {
      if (isTouchDevice()) return;
      isMenuOpen = false;
      resetInactivity(container);
    };

    if (topOverlayEl) {
      topOverlayEl.addEventListener("mouseenter", keepVisible);
      topOverlayEl.addEventListener("mouseleave", allowHide);
    }

    if (bottomControlsEl) {
      bottomControlsEl.addEventListener("mouseenter", keepVisible);
      bottomControlsEl.addEventListener("mouseleave", allowHide);
    }
  }

  function enhanceFullscreenButton(container) {
    const fsBtn = container.querySelector("button[aria-label='Enter Fullscreen'], button[aria-label='Exit Fullscreen']");
    if (fsBtn && !fsBtn._enhancedFS) {
      fsBtn._enhancedFS = true;
      fsBtn.addEventListener("click", async () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          const root = document.documentElement;
          try {
            if (root.requestFullscreen) {
              await root.requestFullscreen();
            } else if (root.webkitRequestFullscreen) {
              root.webkitRequestFullscreen();
            }
            // Automatically lock to landscape on Vivaldi Android when entering fullscreen
            if (isTouchDevice() && screen.orientation && screen.orientation.lock) {
              screen.orientation.lock("landscape").catch(() => {});
            }
          } catch (e) {}
        } else {
          try {
            if (document.exitFullscreen) {
              await document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
              document.webkitExitFullscreen();
            }
            if (isTouchDevice() && screen.orientation && screen.orientation.unlock) {
              screen.orientation.unlock();
            }
          } catch (e) {}
        }
      }, true);
    }
  }

  function cleanupCinemaMode() {
    document.documentElement.classList.remove("myaew-cinema-active");
    document.documentElement.classList.remove("myaew-fullscreen");
    clearTimeout(inactivityTimer);

    const videoPlayer = document.getElementById("videoPlayer") || document.querySelector(".bitmovinplayer-container");
    if (videoPlayer) {
      videoPlayer.classList.remove("myaew-controls-hidden");
      videoPlayer.classList.remove("myaew-controls-visible");
    }

    const overlay = document.querySelector(".myaew-top-overlay");
    if (overlay) {
      overlay.remove();
      topOverlay = null;
    }

    const originalTopBars = document.querySelectorAll("#primaryViewer > .relative.flex.flex-row.items-center");
    originalTopBars.forEach((bar) => {
      bar.style.display = "";
    });
  }

  function handleRouteAndPlayer() {
    if (!isVideoRoute()) {
      cleanupCinemaMode();
      return;
    }

    const videoPlayer = document.getElementById("videoPlayer") || document.querySelector(".bitmovinplayer-container");
    if (!videoPlayer) {
      cleanupCinemaMode();
      return;
    }

    // Activate cinema layout strictly when on a video route
    document.documentElement.classList.add("myaew-cinema-active");
    updateFullscreenState();

    topOverlay = createTopOverlay(videoPlayer);
    adoptHeaderElements(topOverlay);
    updateTitle(topOverlay);
    setupInactivityManager(videoPlayer);
    enhanceFullscreenButton(videoPlayer);
  }

  // Intercept Vue SPA navigation
  const notifyNavigation = () => setTimeout(handleRouteAndPlayer, 50);
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function() {
    originalPushState.apply(this, arguments);
    notifyNavigation();
  };

  history.replaceState = function() {
    originalReplaceState.apply(this, arguments);
    notifyNavigation();
  };

  window.addEventListener("popstate", notifyNavigation);

  // Fullscreen change listeners
  const onFullscreenChange = () => {
    const fs = isFullscreen();
    if (!fs && isTouchDevice() && screen.orientation && screen.orientation.unlock) {
      try { screen.orientation.unlock(); } catch (e) {}
    }
    updateFullscreenState();
    handleRouteAndPlayer();
    setTimeout(() => {
      updateFullscreenState();
      handleRouteAndPlayer();
    }, 100);
  };

  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  document.addEventListener("mozfullscreenchange", onFullscreenChange);
  document.addEventListener("MSFullscreenChange", onFullscreenChange);
  window.addEventListener("resize", onFullscreenChange);

  const observer = new MutationObserver(() => {
    handleRouteAndPlayer();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

  setInterval(handleRouteAndPlayer, 1500);
  handleRouteAndPlayer();
})();