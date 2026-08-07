const path = require('path');
const { chromium } = require(path.join(process.env.CODEX_NODE_MODULES, 'playwright'));

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1 });
  const errors = [];
  const responses = [];
  const requestFailures = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.url().includes(':8000')) responses.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => { if (request.url().includes(':8000')) requestFailures.push(`${request.url()} ${request.failure()?.errorText || 'unknown error'}`); });
  await page.goto('http://localhost:5173/#/login');
  const health = await page.evaluate(async () => {
    try {
      const response = await fetch('http://localhost:8000/health');
      return { ok: response.ok, status: response.status, body: await response.text() };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByLabel('帳號或 Email').fill('admin');
  await page.getByLabel('密碼').fill(process.env.NOC_QA_PASSWORD);
  await page.getByRole('button', { name: /登入平台/ }).click();
  try { await page.waitForURL(/#\/dashboard/, { timeout: 8000 }); }
  catch (error) { throw new Error(`Login did not navigate. url=${page.url()} health=${JSON.stringify(health)} responses=${responses.join(',')} failures=${requestFailures.join(',')} body=${(await page.locator('body').innerText()).slice(0,800)}`); }
  await page.waitForTimeout(1800);

  const routes = ['/dashboard','/alarms','/incidents','/topology','/map','/diagnosis','/wallboard','/devices','/accounts','/settings'];
  const themeAudit = [];
  const forbidden = /Demo Safe Mode|Demo Control|Mock Data|Fake Device|Sample Data|Development Mode/;
  for (const route of routes) {
    await page.goto(`http://localhost:5173/#${route}`);
    await page.waitForTimeout(350);
    const audit = await page.evaluate(source => {
      const heading = document.querySelector('h1');
      const hero = document.querySelector('.page-title') || document.querySelector('.wallboard header');
      const style = hero ? getComputedStyle(hero) : null;
      return {
        route: location.hash,
        heading: heading?.textContent?.trim() || '',
        headingVisible: Boolean(heading && heading.getBoundingClientRect().width && heading.getBoundingClientRect().height),
        heroColor: style?.color || '',
        heroBackground: style?.backgroundImage || style?.backgroundColor || '',
        forbidden: new RegExp(source).test(document.body.innerText),
      };
    }, forbidden.source);
    themeAudit.push(audit);
  }

  await page.goto('http://localhost:5173/#/dashboard');
  await page.waitForTimeout(500);
  const dashboard = await page.locator('.stat').evaluateAll(cards => cards.map(card => ({ label: card.querySelector('span')?.textContent?.trim(), value: card.querySelector('strong')?.textContent?.trim() })));
  await page.screenshot({ path: path.resolve('docs/sprint-4-5-1-dashboard-dark.png'), fullPage: true });
  await page.getByTitle('Light Enterprise').click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.resolve('docs/sprint-4-5-1-dashboard-light.png'), fullPage: true });

  await page.goto('http://localhost:5173/#/alarms');
  await page.waitForTimeout(500);
  const alarmActive = await page.locator('.page-title .badge').textContent();
  await page.goto('http://localhost:5173/#/wallboard');
  await page.waitForTimeout(350);
  const wallboard = await page.locator('.wall-stats>div').evaluateAll(items => items.map(item => ({ label: item.querySelector('span')?.textContent?.trim(), value: item.querySelector('b')?.textContent?.trim() })));
  await page.goto('http://localhost:5173/#/map');
  await page.waitForTimeout(350);
  const region = await page.locator('.region-stats>div').evaluateAll(items => items.map(item => ({ label: item.querySelector('span')?.childNodes[0]?.textContent?.trim(), value: item.querySelector('b')?.textContent?.trim() })));
  await page.goto('http://localhost:5173/#/devices');
  await page.waitForTimeout(600);
  const deviceRows = await page.locator('tbody tr').count();
  await page.screenshot({ path: path.resolve('docs/sprint-4-5-1-device-light.png'), fullPage: true });
  await page.goto('http://localhost:5173/#/diagnosis');
  await page.waitForTimeout(600);
  const aiTimelineEvents = await page.locator('.ai-timeline>div').count();
  const alarmSelect = page.locator('.toolbar select').first();
  const selectedAlarmId = await alarmSelect.locator('option').nth(1).getAttribute('value');
  if (selectedAlarmId) await alarmSelect.selectOption(selectedAlarmId);
  await page.waitForTimeout(250);
  await page.goto('http://localhost:5173/#/incidents');
  await page.waitForTimeout(350);
  const activeIncidentId = (await page.locator('.incident-tabs button.active small').textContent())?.trim();
  const timelineTimes = page.locator('.timeline time');
  const timelineTimeCount = await timelineTimes.count();
  const timelineTime = timelineTimeCount
    ? await timelineTimes.first().evaluate(element => ({ text: element.textContent?.trim(), whiteSpace: getComputedStyle(element).whiteSpace, minWidth: getComputedStyle(element).minWidth }))
    : null;
  const realtimeLabel = (await page.locator('.sidebar-note').innerText()).trim();
  await page.screenshot({ path: path.resolve('docs/sprint-4-5-1-incident-light.png'), fullPage: true });

  console.log(JSON.stringify({ health, realtimeLabel, dashboard, alarmActive: alarmActive?.trim(), wallboard, region, deviceRows, aiTimelineEvents, selectedAlarmId, activeIncidentId, timelineTimeCount, timelineTime, forbiddenRoutes: themeAudit.filter(item => item.forbidden), invisibleHeadings: themeAudit.filter(item => !item.headingVisible), themeAudit, backendResponses: responses, consoleErrors: errors, requestFailures }, null, 2));
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
