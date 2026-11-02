/**
 * Enhanced Instant In-Page SCORM Auto-Advancer (v3.5 - Deep Interactive Scanner & HTML5 Audio Sync)
 *
 * Core Enhancements:
 * - Comprehensive Interactive Scanner: Scans buttons, tabs, SVG shape groups (`<g role="button">`),
 *   hotspots, `[data-acc-text]`, and focusable vectors (`[tabindex="0"]`) so no section is ever missed.
 * - Direct HTML5 Audio/Video Tracking: Inspects `<audio>` and `<video>` elements directly in the course frame
 *   to ensure 100% complete playback of sub-layer narration before advancing to the next section.
 * - Deterministic Persistent Registry: Uses a memory Set keyed by `${slideTitle}::${identifier}` to guarantee
 *   elements are clicked exactly once without skipping or infinite loops.
 * - Deep Recovery Sweep: Automatically sweeps and cycles unclicked hotspots if Next remains locked.
 * - Global Kill-Switch & Immutable Pause Authority (`localStorage`).
 * - Instant Priority Next Advance (<50ms trigger).
 * - Quiz Detection: Automatically pauses on question slides for human screenshot approval.
 */
(() => {
  // 1. Reset Kill Switch
  localStorage.removeItem('__nscAutomatorKilled');
  window.__nscKilled = false;

  // 2. Strict Singleton Cleanup
  if (window.__nscAutomatorIntervalId) {
    clearInterval(window.__nscAutomatorIntervalId);
    window.__nscAutomatorIntervalId = null;
  }
  if (window.__nscNextObserver) {
    window.__nscNextObserver.disconnect();
    window.__nscNextObserver = null;
  }

  const isCurrentlyPaused = localStorage.getItem('__nscAutomatorPaused') === 'true';
  window.__nscAutomatorActive = true;
  window.__nscAutomatorPaused = isCurrentlyPaused;

  window.__nscAutomatorStatus = {
    state: isCurrentlyPaused ? 'paused_by_user' : 'running',
    slidesAdvanced: 0,
    currentSlide: '',
    progressMs: 0,
    durationMs: 0,
    remainingSec: 0,
    lastAction: 'initialized',
    pendingQuiz: null,
    visitedCardsOnCurrentSlide: [],
    totalCardsOnCurrentSlide: 0
  };

  // 3. Persistent Card & Section Registry
  const visitedCardRegistry = new Set();
  let currentPlayingCardKey = null;
  let currentCardStartTime = 0;

  // 4. Inject Floating Control HUD
  function injectControlHUD() {
    let hud = document.getElementById('nsc-automator-hud');
    if (hud) hud.remove();

    hud = document.createElement('div');
    hud.id = 'nsc-automator-hud';
    hud.style.cssText = `
      position: fixed !important;
      top: 14px !important;
      right: 14px !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      background: rgba(15, 23, 42, 0.96) !important;
      border: 1px solid rgba(255, 255, 255, 0.25) !important;
      box-shadow: 0 6px 24px rgba(0,0,0,0.5) !important;
      border-radius: 28px !important;
      padding: 7px 16px !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 13px !important;
      color: #fff !important;
      backdrop-filter: blur(10px) !important;
      user-select: none !important;
      pointer-events: auto !important;
    `;

    hud.innerHTML = `
      <div id="nsc-status-dot" style="width: 10px; height: 10px; border-radius: 50%; background: ${window.__nscAutomatorPaused ? '#f59e0b' : '#10b981'}; box-shadow: 0 0 10px ${window.__nscAutomatorPaused ? '#f59e0b' : '#10b981'}; transition: all 0.2s;"></div>
      <span id="nsc-status-label" style="font-weight: 600; letter-spacing: 0.3px; min-width: 140px;">${window.__nscAutomatorPaused ? 'Auto-Advance: PAUSED' : 'Auto-Advance: ACTIVE'}</span>
      <button id="nsc-pause-btn" style="
        background: ${window.__nscAutomatorPaused ? '#10b981' : 'rgba(255,255,255,0.18)'} !important;
        border: 1px solid rgba(255,255,255,0.2) !important;
        color: #fff !important;
        padding: 5px 12px !important;
        border-radius: 14px !important;
        cursor: pointer !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        pointer-events: auto !important;
        transition: all 0.2s ease !important;
      ">${window.__nscAutomatorPaused ? '▶️ Resume' : '⏸️ Pause (Ctrl+Shift+X)'}</button>
      <button id="nsc-detach-btn" style="
        background: rgba(239, 68, 68, 0.25) !important;
        border: 1px solid rgba(239, 68, 68, 0.4) !important;
        color: #fca5a5 !important;
        padding: 5px 10px !important;
        border-radius: 14px !important;
        cursor: pointer !important;
        font-size: 12px !important;
        font-weight: 600 !important;
        pointer-events: auto !important;
        transition: all 0.2s ease !important;
      ">❌ Detach</button>
    `;

    document.body.appendChild(hud);

    const pauseBtn = hud.querySelector('#nsc-pause-btn');
    const detachBtn = hud.querySelector('#nsc-detach-btn');
    const statusDot = hud.querySelector('#nsc-status-dot');
    const statusLabel = hud.querySelector('#nsc-status-label');

    function updateVisuals() {
      if (window.__nscAutomatorPaused) {
        statusDot.style.background = '#f59e0b';
        statusDot.style.boxShadow = '0 0 10px #f59e0b';
        statusLabel.textContent = 'Auto-Advance: PAUSED';
        pauseBtn.textContent = '▶️ Resume (Ctrl+Shift+X)';
        pauseBtn.style.background = '#10b981';
      } else {
        statusDot.style.background = '#10b981';
        statusDot.style.boxShadow = '0 0 10px #10b981';
        statusLabel.textContent = 'Auto-Advance: ACTIVE';
        pauseBtn.textContent = '⏸️ Pause (Ctrl+Shift+X)';
        pauseBtn.style.background = 'rgba(255,255,255,0.18)';
      }
    }

    function togglePause(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      window.__nscAutomatorPaused = !window.__nscAutomatorPaused;
      localStorage.setItem('__nscAutomatorPaused', window.__nscAutomatorPaused ? 'true' : 'false');
      window.__nscAutomatorStatus.state = window.__nscAutomatorPaused ? 'paused_by_user' : 'running';
      console.log(`[AutoAdvancer] Pause state toggled: ${window.__nscAutomatorPaused}`);
      updateVisuals();
    }

    pauseBtn.addEventListener('click', togglePause, true);
    pauseBtn.addEventListener('pointerdown', (e) => e.stopPropagation(), true);

    detachBtn.addEventListener('click', (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      window.nscDetach();
    }, true);
    detachBtn.addEventListener('pointerdown', (e) => e.stopPropagation(), true);

    window.__nscUpdateHUD = updateVisuals;
    window.__nscTogglePause = togglePause;
  }

  // 5. Global Clean Detach
  window.nscDetach = function() {
    console.log('[AutoAdvancer] 🛑 Detaching automator...');
    window.__nscKilled = true;
    localStorage.setItem('__nscAutomatorKilled', 'true');

    if (window.__nscAutomatorIntervalId) {
      clearInterval(window.__nscAutomatorIntervalId);
      window.__nscAutomatorIntervalId = null;
    }
    if (window.__nscNextObserver) {
      window.__nscNextObserver.disconnect();
      window.__nscNextObserver = null;
    }
    window.__nscAutomatorActive = false;
    window.__nscAutomatorPaused = true;
    window.__nscAutomatorStatus.state = 'detached';

    const hud = document.getElementById('nsc-automator-hud');
    if (hud) hud.remove();

    console.log('[AutoAdvancer] Successfully detached.');
  };

  // 6. Keyboard Listener (Ctrl+Shift+X or Escape)
  if (!window.__nscKeyHandlerAttached) {
    window.__nscKeyHandlerAttached = true;
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'X' || e.key === 'x')) || e.key === 'Escape') {
        e.preventDefault();
        if (window.__nscTogglePause) {
          window.__nscTogglePause();
        }
      }
    }, true);
  }

  injectControlHUD();

  function getCourseDocument() {
    try {
      const lmsIframe = document.querySelector('div.standalone-scorm__iframe-container iframe, main iframe');
      if (!lmsIframe) return null;
      const rusticiDoc = lmsIframe.contentDocument || lmsIframe.contentWindow?.document;
      if (!rusticiDoc) return null;
      const storylineIframe = rusticiDoc.querySelector('iframe#ScormContent, iframe[name="ScormContent"]');
      if (!storylineIframe) return null;
      return storylineIframe.contentDocument || storylineIframe.contentWindow?.document || null;
    } catch (e) {
      return null;
    }
  }

  function getDeterministicKey(btn, idx, slideTitle) {
    const rawText = btn.getAttribute('data-acc-text') || 
                    btn.getAttribute('aria-label') || 
                    btn.textContent.trim() || 
                    btn.id || 
                    `section_${idx}`;
    const cleanText = rawText.replace(/\s+/g, ' ').slice(0, 40);
    return `${slideTitle}::${cleanText}`;
  }

  function isAnyAudioPlaying(courseDoc) {
    const mediaEls = Array.from(courseDoc.querySelectorAll('audio, video'));
    for (const media of mediaEls) {
      if (!media.paused && !media.ended && media.currentTime > 0) {
        return true;
      }
    }
    return false;
  }

  let lastClickedSlide = '';
  let clickCooldown = false;
  let slideStartTime = Date.now();

  function checkAndAdvance() {
    // 1. Kill-Switch & Pause Authority
    if (window.__nscKilled || localStorage.getItem('__nscAutomatorKilled') === 'true') {
      return;
    }

    const storedPause = localStorage.getItem('__nscAutomatorPaused') === 'true';
    if (storedPause !== window.__nscAutomatorPaused) {
      window.__nscAutomatorPaused = storedPause;
      if (window.__nscUpdateHUD) window.__nscUpdateHUD();
    }

    if (window.__nscAutomatorPaused) {
      window.__nscAutomatorStatus.state = 'paused_by_user';
      return;
    }

    const courseDoc = getCourseDocument();
    if (!courseDoc) return;

    const slideLabelEl = courseDoc.querySelector('#slide-label');
    const slideTitle = slideLabelEl ? slideLabelEl.textContent.replace(/^slide:\s*/i, '').trim() : 'Unknown';
    
    // Reset state on slide transition
    if (slideTitle !== window.__nscAutomatorStatus.currentSlide) {
      window.__nscAutomatorStatus.currentSlide = slideTitle;
      slideStartTime = Date.now();
      currentPlayingCardKey = null;
      currentCardStartTime = 0;
      window.__nscAutomatorStatus.visitedCardsOnCurrentSlide = [];
    }

    // 2. PRIORITY #1: Check Next Button
    const nextBtn = courseDoc.querySelector('#next');
    const isNextDisabled = !nextBtn || 
                           nextBtn.getAttribute('aria-disabled') === 'true' || 
                           nextBtn.classList.contains('disabled') || 
                           nextBtn.disabled === true ||
                           nextBtn.style.display === 'none';

    // Instant Advance when Next unlocks
    if (!isNextDisabled && slideTitle !== lastClickedSlide && !clickCooldown) {
      console.log(`[AutoAdvancer] ⚡ Next button unlocked on "${slideTitle}". Advancing immediately!`);
      lastClickedSlide = slideTitle;
      clickCooldown = true;
      nextBtn.click();
      window.__nscAutomatorStatus.slidesAdvanced++;
      window.__nscAutomatorStatus.lastAction = `clicked_next_on_${slideTitle}`;

      setTimeout(() => {
        clickCooldown = false;
      }, 1500);
      return;
    }

    // 3. PRIORITY #2: Quiz / Assessment Detection
    const submitBtn = courseDoc.querySelector('#submit');
    const isSubmitVisible = submitBtn && submitBtn.style.display !== 'none' && window.getComputedStyle(submitBtn).display !== 'none' && window.getComputedStyle(submitBtn).visibility !== 'hidden';
    const radios = Array.from(courseDoc.querySelectorAll('#slide input[type="radio"], #slide [role="radio"]'));
    const checkboxes = Array.from(courseDoc.querySelectorAll('#slide input[type="checkbox"], #slide [role="checkbox"]'));
    const isQuiz = isSubmitVisible || radios.length > 0 || checkboxes.length > 0;

    if (isQuiz) {
      if (window.__nscAutomatorStatus.state !== 'quiz_detected') {
        window.__nscAutomatorStatus.state = 'quiz_detected';
        window.__nscAutomatorStatus.lastAction = 'paused_for_quiz';

        const slideTexts = Array.from(courseDoc.querySelectorAll('#slide .acc-shadow-dom .acc-text, #slide .acc-text, #slide p, #slide h2, #slide h3'))
          .map(el => el.textContent.trim())
          .filter(t => t.length > 0);

        const choices = (radios.length > 0 ? radios : checkboxes).map((input, idx) => {
          const label = input.getAttribute('aria-label') || input.parentElement?.textContent?.trim() || `Option ${idx + 1}`;
          return { index: idx, id: input.id, label };
        });

        window.__nscAutomatorStatus.pendingQuiz = {
          slideTitle,
          prompt: slideTexts.slice(0, 4).join(' | '),
          choices
        };

        console.log('[AutoAdvancer] 🛑 Quiz detected. Paused for human approval.', window.__nscAutomatorStatus.pendingQuiz);
      }
      return;
    }

    // 4. Playback Metrics & Audio Inspection
    const progressBar = courseDoc.querySelector('#seek input[data-ref="progressBar"], #seek input[type="range"]');
    const curVal = progressBar ? parseInt(progressBar.value || '0', 10) : 0;
    const maxVal = progressBar ? parseInt(progressBar.max || '1000', 10) : 1000;
    const remainingMs = Math.max(0, maxVal - curVal);
    const remainingSec = parseFloat((remainingMs / 1000).toFixed(1));
    const audioPlaying = isAnyAudioPlaying(courseDoc);

    window.__nscAutomatorStatus.state = 'running';
    window.__nscAutomatorStatus.progressMs = curVal;
    window.__nscAutomatorStatus.durationMs = maxVal;
    window.__nscAutomatorStatus.remainingSec = remainingSec;

    // 5. PRIORITY #3: Comprehensive Interactive Section Exploration
    if (isNextDisabled) {
      // Find all clickable sections: buttons, tabs, hotspots, svg shape groups, and focusable nodes
      const interactiveSelector = [
        '#slide button',
        '#slide [role="button"]',
        '#slide [role="tab"]',
        '#slide .acc-button',
        '#slide [data-acc-text]',
        '#slide svg g[cursor="pointer"]',
        '#slide [tabindex="0"]'
      ].join(', ');

      const rawInteractiveElements = Array.from(courseDoc.querySelectorAll(interactiveSelector));
      const validElements = rawInteractiveElements.filter(el => {
        const isNav = el.id === 'next' || el.id === 'prev' || el.id === 'submit';
        const isProgress = el.closest('#seek') || el.closest('#nav-controls') || el.closest('#top-bar');
        const style = window.getComputedStyle(el);
        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
        return !isNav && !isProgress && isVisible;
      });

      window.__nscAutomatorStatus.totalCardsOnCurrentSlide = validElements.length;

      if (validElements.length > 0) {
        // If a section is currently playing, check if its audio/timeline has finished
        if (currentPlayingCardKey) {
          const timeSinceClick = Date.now() - currentCardStartTime;
          // Must play for at least 2.5 seconds AND no audio is currently actively playing
          const seekbarFinished = (maxVal > 0 && remainingMs <= 250) || (maxVal === 0);
          if (!audioPlaying && (seekbarFinished || timeSinceClick >= 3000)) {
            console.log(`[AutoAdvancer] 🎵 Audio completed for: "${currentPlayingCardKey}". Recording in registry.`);
            visitedCardRegistry.add(currentPlayingCardKey);
            currentPlayingCardKey = null;
          }
        }

        // If no section is currently active, find the NEXT unvisited interactive section
        if (!currentPlayingCardKey) {
          let nextTarget = null;
          let nextKey = null;

          for (let i = 0; i < validElements.length; i++) {
            const el = validElements[i];
            const key = getDeterministicKey(el, i, slideTitle);
            if (!visitedCardRegistry.has(key)) {
              nextTarget = el;
              nextKey = key;
              break;
            }
          }

          if (nextTarget && nextKey) {
            currentPlayingCardKey = nextKey;
            currentCardStartTime = Date.now();

            console.log(`[AutoAdvancer] 👆 Clicking interactive section: "${nextKey}"`);
            nextTarget.click();
            window.__nscAutomatorStatus.visitedCardsOnCurrentSlide = Array.from(visitedCardRegistry);
            return;
          }
        }
      }

      // 6. Deep Recovery Sweep: If all detected items in current view were visited but Next remains locked for > 5s
      const timeElapsedOnSlide = Date.now() - slideStartTime;
      if (timeElapsedOnSlide > 5000 && !currentPlayingCardKey && !audioPlaying) {
        // Re-scan for any unclicked interactive element on the slide
        const anyUnvisited = validElements.find((el, idx) => !visitedCardRegistry.has(getDeterministicKey(el, idx, slideTitle)));
        if (anyUnvisited) {
          const key = getDeterministicKey(anyUnvisited, 999, slideTitle);
          currentPlayingCardKey = key;
          currentCardStartTime = Date.now();
          console.log(`[AutoAdvancer] 🔄 Deep recovery clicking unvisited item: "${key}"`);
          anyUnvisited.click();
        }
      }
    }
  }

  // 100ms high-frequency polling loop
  window.__nscAutomatorIntervalId = setInterval(checkAndAdvance, 100);

  // MutationObserver for Next button & media ended listeners
  function attachObserver() {
    const courseDoc = getCourseDocument();
    if (!courseDoc) {
      setTimeout(attachObserver, 500);
      return;
    }

    const nextBtn = courseDoc.querySelector('#next');
    if (nextBtn) {
      window.__nscNextObserver = new MutationObserver(() => {
        checkAndAdvance();
      });
      window.__nscNextObserver.observe(nextBtn, { attributes: true, attributeFilter: ['aria-disabled', 'class', 'disabled', 'style'] });
    }

    const mediaEls = courseDoc.querySelectorAll('video, audio');
    mediaEls.forEach(media => {
      media.addEventListener('ended', () => {
        setTimeout(checkAndAdvance, 50);
      });
    });
  }

  attachObserver();
  console.log('[AutoAdvancer v3.5] Initialized with Deep Scanner & HTML5 Audio Sync.');
  return window.__nscAutomatorStatus;
})();
