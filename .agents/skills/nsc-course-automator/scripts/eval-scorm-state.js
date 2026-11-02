/**
 * Evaluates the NSC SCORM Storyline player state across nested iframes.
 * Extracts playback timing ("progress" vs "max"), calculates remaining duration in seconds,
 * provides exact wait times and a 30-second fallback escape limit to prevent stalling.
 */
(() => {
  try {
    // 1. Locate ThoughtIndustries LMS frame
    const lmsIframe = document.querySelector('div.standalone-scorm__iframe-container iframe, main iframe');
    if (!lmsIframe) {
      return { error: 'LMS container iframe not found' };
    }

    const rusticiDoc = lmsIframe.contentDocument || lmsIframe.contentWindow?.document;
    if (!rusticiDoc) {
      return { error: 'Rustici dispatcher document not accessible' };
    }

    // 2. Locate Storyline Content frame
    const storylineIframe = rusticiDoc.querySelector('iframe#ScormContent, iframe[name="ScormContent"]');
    if (!storylineIframe) {
      return { error: 'Storyline content iframe not found' };
    }

    const courseDoc = storylineIframe.contentDocument || storylineIframe.contentWindow?.document;
    if (!courseDoc) {
      return { error: 'Course document not accessible' };
    }

    // 3. Inspect Navigation & Playback Controls
    const nextBtn = courseDoc.querySelector('#next');
    const submitBtn = courseDoc.querySelector('#submit');
    const progressBar = courseDoc.querySelector('#seek input[data-ref="progressBar"], #seek input[type="range"]');
    const slideLabelEl = courseDoc.querySelector('#slide-label');
    const slideTitle = slideLabelEl ? slideLabelEl.textContent.replace(/^slide:\s*/i, '').trim() : 'Unknown';

    const isNextDisabled = !nextBtn || nextBtn.getAttribute('aria-disabled') === 'true' || nextBtn.classList.contains('disabled') || nextBtn.style.display === 'none';
    const isSubmitVisible = submitBtn && submitBtn.style.display !== 'none' && window.getComputedStyle(submitBtn).display !== 'none';

    // 4. Progress & Timing Calculation
    const curVal = progressBar ? parseInt(progressBar.value || '0', 10) : 0;
    const maxVal = progressBar ? parseInt(progressBar.max || '1000', 10) : 1000;
    const remainingMs = Math.max(0, maxVal - curVal);
    const remainingSec = parseFloat((remainingMs / 1000).toFixed(1));
    const isPlaybackFinished = remainingMs <= 100;
    const fallbackTimeoutSec = parseFloat((remainingSec + 30).toFixed(1)); // 30-second escape watchdog

    // 5. Inspect Quiz Questions & Interactive Elements
    const radios = Array.from(courseDoc.querySelectorAll('#slide input[type="radio"], #slide [role="radio"]'));
    const checkboxes = Array.from(courseDoc.querySelectorAll('#slide input[type="checkbox"], #slide [role="checkbox"]'));
    const isQuizSlide = isSubmitVisible || radios.length > 0 || checkboxes.length > 0;

    let questionData = null;
    if (isQuizSlide) {
      const slideTextNodes = Array.from(courseDoc.querySelectorAll('#slide .acc-shadow-dom .acc-text, #slide .acc-text, #slide p, #slide h2, #slide h3'))
        .map(el => el.textContent.trim())
        .filter(t => t.length > 0);

      const choices = (radios.length > 0 ? radios : checkboxes).map((input, idx) => {
        const label = input.getAttribute('aria-label') || input.parentElement?.textContent?.trim() || `Option ${idx + 1}`;
        const isChecked = input.checked || input.getAttribute('aria-checked') === 'true';
        return { index: idx, label, isChecked };
      });

      questionData = {
        prompt: slideTextNodes.slice(0, 3).join(' | '),
        choiceType: radios.length > 0 ? 'single-choice' : 'multiple-choice',
        choices
      };
    }

    return {
      slideTitle,
      isQuizSlide,
      isNextDisabled,
      canClickNext: !isQuizSlide && !isNextDisabled,
      isPlaybackFinished,
      progressMs: curVal,
      durationMs: maxVal,
      remainingMs,
      remainingSec,
      waitSuggestedSec: remainingSec,
      fallbackEscapeSec: fallbackTimeoutSec,
      isSubmitVisible: !!isSubmitVisible,
      questionData
    };
  } catch (err) {
    return { error: err.message };
  }
})();
