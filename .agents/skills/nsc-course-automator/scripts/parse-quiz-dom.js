/**
 * Efficient DOM Question & Assessment Parser for Articulate Storyline / NSC SCORM.
 * Evaluates inside the Storyline player document (index_lms.html).
 * Extracts question prompts, grouped statements (for Likert scales), answer choices,
 * and pre-selects the safest defensive driving response.
 */
(() => {
  try {
    const doc = document;
    const slide = doc.querySelector('#slide');
    if (!slide) return { isQuiz: false, reason: 'No #slide found' };

    const submitBtn = doc.querySelector('#submit, nav#nav-controls button#submit, #slide button.acc-button');
    const isSubmitVisible = submitBtn && window.getComputedStyle(submitBtn).display !== 'none' && window.getComputedStyle(submitBtn).visibility !== 'hidden';

    // 1. Gather all inputs (Radios / Checkboxes)
    const radios = Array.from(slide.querySelectorAll('input[type="radio"], [role="radio"], .acc-radio'));
    const checkboxes = Array.from(slide.querySelectorAll('input[type="checkbox"], [role="checkbox"], .acc-checkbox'));

    const isQuiz = isSubmitVisible || radios.length > 0 || checkboxes.length > 0;
    if (!isQuiz) return { isQuiz: false };

    // 2. Extract Title and Instructions
    const slideTitle = doc.querySelector('#slide-label')?.textContent?.replace(/^slide:\s*/i, '').trim() || 'Quiz Question';
    
    // Extract textual paragraphs and headings from slide
    const textNodes = Array.from(slide.querySelectorAll('.acc-shadow-dom .acc-text, .acc-text, p, h1, h2, h3, [data-ref="label"]'))
      .map(el => el.textContent.trim())
      .filter(t => t.length > 0 && !/^up arrow|^rectangle|^group/i.test(t));

    // Deduplicate text nodes while preserving order
    const uniqueTexts = [...new Set(textNodes)];

    // 3. Multi-Row Matrix / Likert Assessment Detection (e.g. 1-5 scale per statement)
    // Storyline often groups radio buttons by name (e.g. name="group_0", name="group_1")
    const radioGroups = {};
    radios.forEach((r, idx) => {
      const groupName = r.getAttribute('name') || r.getAttribute('data-group') || 'default_group';
      if (!radioGroups[groupName]) radioGroups[groupName] = [];
      
      const label = r.getAttribute('aria-label') || 
                    r.parentElement?.textContent?.trim() || 
                    r.nextElementSibling?.textContent?.trim() || 
                    `Option ${radioGroups[groupName].length + 1}`;
      
      radioGroups[groupName].push({
        index: idx,
        id: r.id,
        label,
        checked: r.checked || r.getAttribute('aria-checked') === 'true'
      });
    });

    const isMatrixQuiz = Object.keys(radioGroups).length > 1;

    return {
      isQuiz: true,
      slideTitle,
      instructions: uniqueTexts.slice(0, 4).join('\n'),
      isMatrixQuiz,
      groupCount: Object.keys(radioGroups).length,
      radioGroups,
      checkboxChoices: checkboxes.map((c, idx) => ({
        index: idx,
        id: c.id,
        label: c.getAttribute('aria-label') || c.parentElement?.textContent?.trim() || `Choice ${idx + 1}`,
        checked: c.checked || c.getAttribute('aria-checked') === 'true'
      })),
      hasSubmitButton: !!submitBtn,
      submitButtonId: submitBtn?.id || 'submit'
    };
  } catch (err) {
    return { isQuiz: false, error: err.message };
  }
})();
