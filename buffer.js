(() => {
  const applyBufferConfig = () => {
    // 1. Raw Hls.js fallback
    if (window.Hls && window.Hls.DefaultConfig) {
      window.Hls.DefaultConfig.maxBufferLength = 60;
      window.Hls.DefaultConfig.maxMaxBufferLength = 120;
      window.Hls.DefaultConfig.maxBufferSize = 60 * 1000 * 1000;
      window.Hls.DefaultConfig.lowBufferWatchdogPeriod = 1;
    }

    // 2. Video.js VHS configuration (Used by MyAEW / Kiswe)
    if (window.videojs) {
      if (window.videojs.Vhs) {
        window.videojs.Vhs.GOAL_BUFFER_LENGTH = 60;
        window.videojs.Vhs.MAX_GOAL_BUFFER_LENGTH = 120;
      }
      if (window.videojs.Hls) {
        window.videojs.Hls.GOAL_BUFFER_LENGTH = 60;
        window.videojs.Hls.MAX_GOAL_BUFFER_LENGTH = 120;
      }

      // Force apply to active Video.js player instances
      if (window.videojs.players) {
        Object.values(window.videojs.players).forEach((player) => {
          if (player && player.tech_ && player.tech_.vhs) {
            player.tech_.vhs.options_.externVhs = player.tech_.vhs.options_.externVhs || {};
            player.tech_.vhs.options_.externVhs.GOAL_BUFFER_LENGTH = 60;
            player.tech_.vhs.options_.externVhs.MAX_GOAL_BUFFER_LENGTH = 120;
          }
        });
      }
    }

    // 3. Elements with attached Hls instances
    document.querySelectorAll("video").forEach((v) => {
      if (v.hls) {
        v.hls.config.maxBufferLength = 60;
        v.hls.config.maxMaxBufferLength = 120;
        v.hls.config.maxBufferSize = 60 * 1000 * 1000;
      }
    });
  };

  applyBufferConfig();
  setInterval(applyBufferConfig, 3000);
})();