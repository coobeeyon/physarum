// Local browser checks; no remote requests. Playwright + Chromium required.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const site = path.resolve(root, '../stigmergence-site');
const checks = [];
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, 'feed-items.json')));
const stories = catalog.map(item => ({...item,
  route: new URL(item.url).pathname,
  paragraphs: fs.readFileSync(path.join(root, item.source), 'utf8').trim().split(/\n\s*\n/).slice(1).map(p => p.replace(/\n/g, ' '))
}));
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); };
(async () => {
  const before = fs.readFileSync(path.join(site, 'feed.xml'), 'utf8');
  execFileSync('bun', ['run', 'scripts/render-feed.ts', path.join(site, 'feed.xml')], {cwd: root});
  check('feed rebuild is byte-stable', before === fs.readFileSync(path.join(site, 'feed.xml'), 'utf8'));
  for (const story of stories) {
    const destination = path.join(site, story.route, 'index.html');
    const storyPage = fs.readFileSync(destination, 'utf8');
    execFileSync('bun', ['run', path.join(path.dirname(story.source), 'render.ts'), destination], {cwd: root});
    check(`${story.title} page rebuild is byte-stable`, storyPage === fs.readFileSync(destination, 'utf8'));
  }
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
      return { errors: doc.querySelectorAll('parsererror').length, version: doc.documentElement.getAttribute('version'),
        items: [...doc.querySelectorAll('item')].map(item => {
          const content = new DOMParser().parseFromString(item.querySelector('description').textContent, 'text/html');
          return {title: item.querySelector('title').textContent,
            guid: item.querySelector('guid').textContent, date: item.querySelector('pubDate').textContent,
            paragraphs: [...content.querySelectorAll('p')].map(p => p.textContent)};
        }),
        self: doc.getElementsByTagNameNS('http://www.w3.org/2005/Atom', 'link')[0]?.getAttribute('href') };
    }, before);
    check('valid RSS 2.0 XML with self URL', parsed.errors === 0 && parsed.version === '2.0' && parsed.self === 'https://stigmergence.art/feed.xml');
    check('exact selected item count', parsed.items.length === stories.length);
    check('feed is newest first', parsed.items.every((item, i) => i === 0 || Date.parse(parsed.items[i-1].date) >= Date.parse(item.date)));
    const release = JSON.parse(fs.readFileSync(path.join(root, 'writing/through/release.json')));
    check('Through original announcement timestamp retained', Date.parse(parsed.items.find(item => item.title === 'Through').date) === Date.parse(release.cast.publishedAt));
    for (const story of stories) {
      const matches = parsed.items.filter(item => item.guid === story.url);
      check(`${story.title} unique stable permalink`, matches.length === 1 && matches[0].title === story.title);
      const item = matches[0];
      check(`${story.title} original release date (RSS seconds)`, Date.parse(item.date) === Math.floor(Date.parse(story.publishedAt) / 1000) * 1000);
      check(`${story.title} AI attribution`, item.paragraphs[0] === story.byline);
      check(`${story.title} exact full text in feed`, JSON.stringify(item.paragraphs.slice(1)) === JSON.stringify(story.paragraphs));
    }
    for (const width of [1280, 390]) {
      await page.setViewportSize({width, height: 900});
      for (const route of ['/', ...stories.map(story => story.route)]) {
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
          for (const story of stories) {
            check(`${story.title} homepage link at ${width}`, await page.getByRole('link', {name: story.title, exact: true}).isVisible());
          }
        } else {
          const story = stories.find(story => story.route === route);
          check(`${story.title} paragraphs unchanged at ${width}`, JSON.stringify(await page.locator('.story p').allTextContents()) === JSON.stringify(story.paragraphs));
          check(`${story.title} canonical and heading at ${width}`, await page.locator('link[rel="canonical"]').getAttribute('href') === story.url && await page.locator('h1').innerText() === story.title);
          check(`${story.title} visible AI attribution at ${width}`, (await page.locator('.byline').innerText()).includes('an AI artist'));
          if (width === 390) await page.screenshot({path: `/tmp/${path.basename(path.dirname(story.source))}-mobile.png`, fullPage: true});
        }
      }
    }
    await page.getByRole('link', {name: 'Follow new work (RSS)'}).click();
    check('subscription link opens the feed', page.url() === 'https://stigmergence.art/feed.xml');
    fs.writeFileSync(path.join(__dirname, 'feed-checks.json'), JSON.stringify({at: new Date().toISOString(),browser: browser.version(),checks,scope:'Local intercepted site. Not a subscriber or human reception test.'},null,2)+'\n');
    console.log(`${checks.length} checks passed`);
  } finally { await browser.close(); }
})().catch(e => {console.error(e); process.exitCode = 1;});
