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
    window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches;

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

  function isInPictureInPicture() {
    return !!document.pictureInPictureElement;
  }

  function updateFullscreenState() {
    const fs = isFullscreen();
    if (fs) {
      document.documentElement.classList.add("myaew-fullscreen");
      if (isTouchDevice() && screen.orientation && typeof screen.orientation.lock === "function") {
        screen.orientation.lock("landscape").catch(() => {});
      }
    } else {
      document.documentElement.classList.remove("myaew-fullscreen");
      if (isTouchDevice() && screen.orientation && typeof screen.orientation.unlock === "function") {
        try { screen.orientation.unlock(); } catch (e) {}
      }
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

  function updateMediaSessionMetadata(title) {
    if (!("mediaSession" in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || "AEW Broadcast",
        artist: "MyAEW",
        album: "All Elite Wrestling"
      });

      const video = document.querySelector("video");
      if (video && !video._mediaSessionBound) {
        video._mediaSessionBound = true;
        navigator.mediaSession.setActionHandler("play", () => video.play().catch(() => {}));
        navigator.mediaSession.setActionHandler("pause", () => video.pause());
        navigator.mediaSession.setActionHandler("seekbackward", (details) => {
          video.currentTime = Math.max(0, video.currentTime - (details.seekOffset || 10));
        });
        navigator.mediaSession.setActionHandler("seekforward", (details) => {
          video.currentTime = Math.min(video.duration || Infinity, video.currentTime + (details.seekOffset || 10));
        });
      }
    } catch (e) {}
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

    const staticTitleEl = document.querySelector("#videoPlayer > div.absolute.top-0.left-0");
    if (staticTitleEl) {
      const candidate = staticTitleEl.querySelector(".time-text") || staticTitleEl;
      let text = cleanTitle(candidate.textContent || "");
      if (text && text.toUpperCase() !== "MYAEW" && !isTimestamp(text) && text.length > 2) {
        cachedShowTitle = text;
        return text;
      }
    }

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
          updateMediaSessionMetadata(currentTitle);
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

    updateTitle(overlay);

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

    document.querySelectorAll("#primaryViewer > .relative.flex.flex-row.items-center").forEach((bar) => {
      bar.style.display = "none";
    });
  }

  function showControls(container) {
    container.classList.remove("myaew-controls-hidden");
    container.classList.add("myaew-controls-visible");
  }

  function hideControls(container) {
    if (isInPictureInPicture()) return;

    const video = container.querySelector("video");
    const hasOpenPopup = document.querySelector(".myaew-speed-popup");
    const qualityMenuOpen = document.querySelector(".menu-wrap [style*='display: flex'], .menu-wrap [style*='display: block']");
    const streamMenuOpen = !isFullscreen() && document.querySelector(".nav-pip-selector [style*='display: flex'], .nav-pip-selector [style*='display: block']");

    if (isMenuOpen || hasOpenPopup || qualityMenuOpen || streamMenuOpen) {
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

    container.addEventListener("mousemove", (e) => {
      if (e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;
      resetInactivity(container);
    });

    container.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "touch") {
        const clickedUI =
          e.target.closest(".myaew-top-overlay") ||
          e.target.closest(".player-controls") ||
          e.target.closest(".myaew-speed-popup") ||
          e.target.closest("button");

        if (!clickedUI) {
          if (container.classList.contains("myaew-controls-visible")) {
            clearTimeout(inactivityTimer);
            container.classList.remove("myaew-controls-visible");
            container.classList.add("myaew-controls-hidden");
            return;
          }
        }
      }
      resetInactivity(container);
    });

    const video = container.querySelector("video");
    if (video) {
      video.addEventListener("play", () => resetInactivity(container));
      video.addEventListener("pause", () => showControls(container));
      video.addEventListener("enterpictureinpicture", () => {
        document.documentElement.classList.add("myaew-pip-active");
        showControls(container);
      });
      video.addEventListener("leavepictureinpicture", () => {
        document.documentElement.classList.remove("myaew-pip-active");
        resetInactivity(container);
      });
    }

    const topOverlayEl = container.querySelector(".myaew-top-overlay");
    const bottomControlsEl = container.querySelector(".player-controls");

    const keepVisible = (e) => {
      if (isTouchDevice() || (e && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents)) return;
      isMenuOpen = true;
      showControls(container);
      clearTimeout(inactivityTimer);
    };

    const allowHide = () => {
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
      fsBtn.addEventListener("click", () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
          const root = document.documentElement;
          if (root.requestFullscreen) {
            root.requestFullscreen().catch(() => {});
          } else if (root.webkitRequestFullscreen) {
            root.webkitRequestFullscreen();
          }
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
        }
      }, true);
    }
  }

  function cleanupCinemaMode() {
    document.documentElement.classList.remove("myaew-cinema-active");
    document.documentElement.classList.remove("myaew-fullscreen");
    document.documentElement.classList.remove("myaew-pip-active");
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

    document.documentElement.classList.add("myaew-cinema-active");
    updateFullscreenState();

    topOverlay = createTopOverlay(videoPlayer);
    adoptHeaderElements(topOverlay);
    updateTitle(topOverlay);
    setupInactivityManager(videoPlayer);
    enhanceFullscreenButton(videoPlayer);
  }

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

  const onFullscreenChange = () => {
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