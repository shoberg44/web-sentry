---
name: nsc-course-automator
description: >-
  Automates slide progression, manages interactive click-to-reveal slides, and handles quiz questions
  for the National Safety Council (NSC) SCORM training course on ThoughtIndustries/Articulate Storyline.
  Captures slide screenshots for human question approval with zero-latency in-page progression.
---

# NSC Course & Quiz Automator

This skill provides zero-latency in-page automation, deep interactive section scanning, direct HTML5 audio tracking, a **Persistent Control HUD with Global Detach Kill-Switch & Immutable Pause Retention**, and screenshot presentation for human-approved quiz completion.

---

## 1. Deep Interactive Section Scanner & HTML5 Audio Sync

On exploratory multi-section slides (e.g. *Stopping Distances*, *Tips 1–3*, *Who Is The Aggressive Driver?*, *Roadway Surfaces*, *Pavement Types*):
* **Comprehensive Section Detection**:
  Scans all Storyline interactive element formats:
  - Standard HTML buttons: `button`, `[role="button"]`, `.acc-button`
  - Tab bars & cards: `[role="tab"]`
  - SVG shape vectors & hotspots: `[data-acc-text]`, `svg g[cursor="pointer"]`, `[tabindex="0"]`
* **Direct HTML5 Audio/Video Tracking**:
  Directly inspects all `<audio>` and `<video>` elements in the course player frame (`media.paused === false && media.currentTime < media.duration`). Advances to the next section only after the sub-layer audio finishes playing.
* **Deterministic Persistent Registry**:
  Visits are recorded in a JavaScript `Set` keyed by deterministic string (`${slideTitle}::${cleanIdentifier}`) to guarantee that every single section is clicked exactly once and never skipped or duplicated across DOM re-renders.
* **Deep Recovery Sweep**:
  If `button#next` remains disabled after detected cards finish, the script automatically sweeps and clicks any remaining unvisited interactive sections on the slide.

---

## 2. Floating Control HUD, Pause Retention & Detach Kill-Switch

When [scripts/instant-auto-advancer.js](./scripts/instant-auto-advancer.js) is injected, a persistent control badge appears in the top-right corner:

```text
[ 🟢 Auto-Advance: ACTIVE ] [ ⏸️ Pause (Ctrl+Shift+X) ] [ ❌ Detach ]
```

### Controls:
* **⏸️ Immutable Pause / Resume Toggle**:
  * Clicking **Pause** or pressing **`Ctrl + Shift + X`** (or **`Escape`**) flips `window.__nscAutomatorPaused` and persists the state across frames in `localStorage.setItem('__nscAutomatorPaused', 'true')`.
  * The pause state is **immutable against agent re-evaluations**; it remains paused indefinitely until you explicitly click Resume or press the shortcut.
* **❌ Global Detach Kill-Switch (`window.nscDetach()`)**:
  * Immediately sets `window.__nscKilled = true` and `localStorage.setItem('__nscAutomatorKilled', 'true')`.
  * All active intervals, callbacks, and `MutationObserver` instances across the window immediately terminate, and the HUD is removed from the DOM.

---

## 3. Immediate Next Button Trigger

* `button#next` is evaluated as **Priority #1** on every cycle. The moment `aria-disabled="false"` occurs or narration ends, the next button is clicked within **50ms** (unless paused or killed).

---

## 4. Screenshot-Based Human Question Approval Protocol

When any quiz, self-assessment, or knowledge check is reached:

1. **Extract Question & Choices**:
   Execute [scripts/parse-quiz-dom.js](./scripts/parse-quiz-dom.js) in the course player frame.
2. **Pre-Select Recommended Answer**:
   Analyze the question against defensive driving rules and pre-select the choice in the UI.
3. **Capture Question Screenshot**:
   - Capture a screenshot using `take_screenshot` and save it to the conversation artifacts directory.
4. **STRICT RULE — NEVER CLICK SUBMIT WITHOUT APPROVAL**:
   Do **NOT** click `button#submit` without explicit user confirmation.
5. **Present Question with Screenshot to User**:
   ```markdown
   ### 🛑 Quiz Question Detected: [Slide Title]

   ![Question Screenshot](file:///path/to/screenshot.png)

   **Question**: [Question Prompt]
   - [x] **(Recommended) Option A**
   - [ ] Option B

   *I have pre-selected Option A in the browser UI. Would you like me to submit this answer and continue?*
   ```
6. **Execute on Confirmation**:
   Click `button#submit` and resume the instant advancer.

---

## 5. Reference Documentation

- [references/dom-selectors.md](./references/dom-selectors.md) — Complete frame hierarchy, selector map, and click-to-reveal layer structure.
