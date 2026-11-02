# NSC SCORM Course DOM Reference

## Frame Hierarchy

```text
Top Window (training.nsc.org/learn/scorm-view/...)
└── iframe.standalone-scorm__iframe-container
    └── iframe#ScormContent (RusticiEngine modern.html)
        └── index_lms.html (Articulate Storyline 360 Player)
```

---

## 1. Core Navigation & Control Selectors

| Target | Selector | Attributes & States |
| :--- | :--- | :--- |
| **Next Button** | `button#next`, `nav#nav-controls button#next` | `aria-disabled="true"` or `.disabled` class during audio/video playback |
| **Previous Button** | `button#prev`, `nav#nav-controls button#prev` | `aria-disabled="true"` or `display: none` |
| **Submit Button** | `button#submit`, `nav#nav-controls button#submit` | `display: block` on quizzes, `display: none` on content |
| **Seekbar Progress** | `#seek input[data-ref="progressBar"]`, `#seek input[type="range"]` | `value` = current ms, `max` = total duration ms |
| **Slide Label** | `#slide-label` | Contains text: `"slide: <Slide Title>"` |

---

## 2. Comprehensive Interactive Section Elements

On multi-section exploratory slides (e.g. Stopping Distances, Tips 1–3, Roadway Surfaces, Pavement Conditions, Aggressive Driving Types):
* **Comprehensive Selector Set**:
  - Buttons: `#slide button`, `#slide [role="button"]`, `#slide .acc-button`
  - Tab Bars: `#slide [role="tab"]`
  - Hotspots & SVG Shape Vectors: `#slide [data-acc-text]`, `#slide svg g[cursor="pointer"]`, `#slide [tabindex="0"]`
* **Direct HTML5 Audio/Video Tracking**:
  - Monitors all media elements in the course document: `courseDoc.querySelectorAll('audio, video')`.
  - Confirms completion when `media.paused === true || media.ended === true || media.currentTime >= media.duration`.
  - Next section in the queue is triggered within 50ms of audio completion.
* **Deep Recovery Sweep**:
  - If `button#next` remains disabled after initial cards, unvisited interactive sections are automatically scanned and clicked to unblock the course.

---

## 3. Quiz & Self-Assessment Formats

### A. Single-Choice Questions
- **Radio Inputs**: `#slide input[type="radio"]`, `#slide [role="radio"]`, `.acc-radio`
- **Labels**: `aria-label` or sibling/parent text elements

### B. Likert Scale Assessment Grids (1–5 scale)
- **Statements**: `#slide .acc-shadow-dom .acc-text`, `p`
- **Radio Matrix**: Grouped by statement row, with values 1 ("Never") to 5 ("Always").

### C. Scenario Hazard Checklists (Multi-Select)
- **Checkboxes**: `#slide input[type="checkbox"]`, `#slide [role="checkbox"]`, `.acc-checkbox`

---

## 4. Control HUD & Pause Synchronization

- **HUD Container**: `#nsc-automator-hud` (top-right fixed overlay)
- **Pause Button**: `#nsc-pause-btn`
- **Detach Button**: `#nsc-detach-btn`
- **Keyboard Shortcut**: `Ctrl + Shift + X` or `Escape`
- **State Storage**: `localStorage.getItem('__nscAutomatorPaused')`
- **Global Detach**: `window.nscDetach()`
