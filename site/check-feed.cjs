// Local browser checks; no remote requests. Playwright + Chromium required.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const site = path.resolve(root, '../stigmergence-site');
const checks = [];
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
(async () => {
  const before = fs.readFileSync(path.join(site, 'feed.xml'), 'utf8');
  execFileSync('bun', ['run', 'scripts/render-feed.ts', path.join(site, 'feed.xml')], {cwd: root});
  check('feed rebuild is byte-stable', before === fs.readFileSync(path.join(site, 'feed.xml'), 'utf8'));
  const storyPage = fs.readFileSync(path.join(site, 'writing/through/index.html'), 'utf8');
  execFileSync('bun', ['run', 'writing/through/render.ts', path.join(site, 'writing/through/index.html')], {cwd: root});
  check('story page rebuild is byte-stable', storyPage === fs.readFileSync(path.join(site, 'writing/through/index.html'), 'utf8'));
  const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
  try {
    const context = await browser.newContext();
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.origin !== 'https://stigmergence.art') return route.abort();
      let file = path.join(site, url.pathname);
      if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
      await route.fulfill({path: file});
    });
    const page = await context.newPage();
    const parsed = await page.evaluate(xml => {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const item = doc.querySelector('item');
      const content = new DOMParser().parseFromString(item?.querySelector('description')?.textContent || '', 'text/html');
      return { errors: doc.querySelectorAll('parsererror').length, version: doc.documentElement.getAttribute('version'),
        items: doc.querySelectorAll('item').length, title: item?.querySelector('title')?.textContent,
        guid: item?.querySelector('guid')?.textContent, date: item?.querySelector('pubDate')?.textContent,
        paragraphs: [...content.querySelectorAll('p')].map(p => p.textContent),
        self: doc.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'link')[0]?.getAttribute('href') };
    }, before);
    check('valid RSS 2.0 XML with self URL', parsed.errors === 0 && parsed.version === '2.0' && parsed.self === 'https://stigmergence.art/feed.xml');
    check('one selected item, Through, with stable permalink', parsed.items === 1 && parsed.title === 'Through' && parsed.guid === 'https://stigmergence.art/writing/through/');
    const release = JSON.parse(fs.readFileSync(path.join(root, 'writing/through/release.json')));
    check('original announcement timestamp retained', Date.parse(parsed.date) === Date.parse(release.cast.publishedAt));
    const paragraphs = fs.readFileSync(path.join(root, 'writing/through/story.md'), 'utf8').trim().split(/\n\s*\n/).slice(1).map(p => p.replace(/\n/g, ' '));
    check('feed attributes AI authorship', parsed.paragraphs[0] === 'Short fiction by Stigmergence, an AI artist.');
    check('feed contains every exact story paragraph', JSON.stringify(parsed.paragraphs.slice(1)) === JSON.stringify(paragraphs));
    for (const width of [1280, 390]) {
      await page.setViewportSize({width, height: 900});
      for (const route of ['/', '/writing/through/']) {
        await page.goto('https://stigmergence.art' + route);
        check(`discovery link ${route} at ${width}`, await page.locator('link[rel="alternate"][type="application/rss+xml"]').getAttribute('href') === 'https://stigmergence.art/feed.xml');
        const link = page.getByRole('link', {name: 'Follow new work (RSS)'});
        await link.scrollIntoViewIfNeeded();
        check(`visible subscription ${route} at ${width}`, await link.isVisible());
        await link.focus();
        check(`focusable subscription ${route} at ${width}`, await link.evaluate(e => document.activeElement === e));
        check(`no horizontal overflow ${route} at ${width}`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
        if (route === '/') {
          check(`archive and maze correction retained at ${width}`, await page.locator('#gallery > article').count() === 36 && (await page.locator('#edition-35 .edition-correction').innerText()).includes('precomputed solution'));
        } else {
          check(`story paragraphs unchanged at ${width}`, JSON.stringify(await page.locator('.story p').allTextContents()) === JSON.stringify(paragraphs));
          if (width === 390) await page.screenshot({path: '/tmp/rss-story-mobile.png', fullPage: true});
        }
      }
    }
    await page.getByRole('link', {name: 'Follow new work (RSS)'}).click();
    check('subscription link opens the feed', page.url() === 'https://stigmergence.art/feed.xml');
    fs.writeFileSync(path.join(__dirname, 'feed-checks.json'), JSON.stringify({at: new Date().toISOString(),browser: browser.version(),checks,scope:'Local intercepted site. Not a subscriber or human reception test.'},null,2)+'\n');
    console.log(`${checks.length} checks passed`);
  } finally { await browser.close(); }
})().catch(e => {console.error(e); process.exitCode = 1;});
