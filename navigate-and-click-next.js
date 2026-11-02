const pw = require('playwright-core');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = 'https://training.nsc.org/learn/scorm-view/1fd3176f-556d-4511-9b7a-82bea8e83a93?isPreview=false';
  console.log(`Navigating to: ${url}`);

  const browser = await pw.chromium.launch({
    headless: false,
    channel: 'chrome',
    args: ['--start-maximized']
  });

  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    console.log('Page loaded, waiting for dynamic content/iframes to settle...');
    await page.waitForTimeout(10000);

    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
    }

    const beforeScreenshot = path.join(screenshotDir, 'before_click.png');
    await page.screenshot({ path: beforeScreenshot, fullPage: true });
    console.log(`Saved before screenshot to: ${beforeScreenshot}`);

    const frames = page.frames();
    console.log(`Found ${frames.length} frames.`);
    for (let i = 0; i < frames.length; i++) {
      console.log(`Frame ${i}: ${frames[i].url()} | name: ${frames[i].name()}`);
    }

    let clicked = false;

    // Search through all frames for next button or clickable element
    for (const frame of frames) {
      console.log(`Checking frame: ${frame.url()}`);
      
      // Common selectors for next buttons in SCORM / LMS
      const selectors = [
        'button:has-text("Next")',
        'button:has-text("NEXT")',
        'button:has-text("next")',
        'a:has-text("Next")',
        '[aria-label*="Next" i]',
        '[title*="Next" i]',
        '[id*="next" i]',
        '[class*="next" i]',
        '#next',
        '.next-btn',
        '.btn-next',
        '.navigation-next',
        '#nav-next',
        '.scorm-next',
        '.slide-nav-next',
        'button[data-testid*="next" i]',
        'button[data-action="next"]'
      ];

      for (const sel of selectors) {
        try {
          const loc = frame.locator(sel).first();
          const count = await loc.count();
          if (count > 0) {
            const isVisible = await loc.isVisible();
            console.log(`Found locator matching '${sel}' in frame '${frame.name() || frame.url()}'. Visible: ${isVisible}`);
            if (isVisible) {
              console.log(`Clicking '${sel}'...`);
              await loc.scrollIntoViewIfNeeded();
              await loc.click({ timeout: 5000 });
              clicked = true;
              console.log('Successfully clicked next button!');
              break;
            }
          }
        } catch (err) {
          // ignore selector errors
        }
      }

      if (clicked) break;

      // If specific selectors didn't match, inspect all buttons in frame
      try {
        const buttons = await frame.$$('button, a, div[role="button"], input[type="button"], input[type="submit"]');
        for (const btn of buttons) {
          const text = (await btn.innerText().catch(() => '')).trim();
          const ariaLabel = (await btn.getAttribute('aria-label').catch(() => '')) || '';
          const title = (await btn.getAttribute('title').catch(() => '')) || '';
          const id = (await btn.getAttribute('id').catch(() => '')) || '';
          const className = (await btn.getAttribute('class').catch(() => '')) || '';

          if (/next|continue|forward/i.test(text) || /next|continue|forward/i.test(ariaLabel) || /next|continue|forward/i.test(title) || /next/i.test(id)) {
            const isVisible = await btn.isVisible().catch(() => false);
            console.log(`Found element: tag=${await btn.evaluate(e => e.tagName)}, text="${text}", aria-label="${ariaLabel}", title="${title}", id="${id}", visible=${isVisible}`);
            if (isVisible) {
              console.log('Clicking candidate element...');
              await btn.click({ timeout: 5000 });
              clicked = true;
              console.log('Successfully clicked candidate element!');
              break;
            }
          }
        }
      } catch (err) {
        console.log(`Error evaluating buttons in frame: ${err.message}`);
      }

      if (clicked) break;
    }

    if (!clicked) {
      console.log('Could not find a standard next button. Dumping all interactive elements across frames...');
      for (let i = 0; i < frames.length; i++) {
        const frame = frames[i];
        const elements = await frame.$$eval('button, a, [role="button"]', els => els.map(e => ({
          tag: e.tagName,
          id: e.id,
          class: e.className,
          text: e.innerText?.slice(0, 50),
          ariaLabel: e.getAttribute('aria-label'),
          title: e.getAttribute('title')
        }))).catch(() => []);
        console.log(`Frame ${i} interactive elements:`, JSON.stringify(elements, null, 2));
      }
    }

    await page.waitForTimeout(5000);
    const afterScreenshot = path.join(screenshotDir, 'after_click.png');
    await page.screenshot({ path: afterScreenshot, fullPage: true });
    console.log(`Saved after screenshot to: ${afterScreenshot}`);

  } catch (err) {
    console.error('Execution error:', err);
  } finally {
    console.log('Process complete.');
  }
})();
