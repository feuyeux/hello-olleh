#!/usr/bin/env node
/**
 * Generate a complete PDF ebook from Jekyll _site directory
 * Merges all content (homepage + harness + all workspaces) into a single PDF
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

// Find Chrome/Chromium executable
async function findChrome() {
  // In CI, use @sparticuz/chromium
  if (process.env.CI) {
    const chromium = require('@sparticuz/chromium');
    return await chromium.executablePath();
  }

  // Local development
  const chromePaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  ].filter(Boolean);

  for (const p of chromePaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Natural sort for chapter files
function naturalSort(files) {
  return files.sort((a, b) =>
    a.localeCompare(b, 'zh-Hans-CN', { numeric: true, sensitivity: 'base' })
  );
}

// Extract body content from HTML
function extractBody(htmlPath) {
  try {
    const content = fs.readFileSync(htmlPath, 'utf-8');
    const match = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return match ? match[1] : '';
  } catch (e) {
    return '';
  }
}

function extractTitle(htmlPath, fallbackTitle = '') {
  try {
    const content = fs.readFileSync(htmlPath, 'utf-8');
    const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      return titleMatch[1].trim();
    }

    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const body = bodyMatch ? bodyMatch[1] : content;
    const headingMatch = body.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (headingMatch?.[1]) {
      return stripTags(headingMatch[1]);
    }
  } catch {
    // Fall through to fallback title.
  }

  return fallbackTitle;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function readHtml(htmlPath) {
  return fs.readFileSync(htmlPath, 'utf-8');
}

function extractBodyAndClassNames(html) {
  const bodyMatch = html.match(/<body([^>]*)>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) {
    return { bodyAttrs: '', bodyClassNames: '', bodyHtml: '' };
  }

  const bodyAttrs = bodyMatch[1] || '';
  const classMatch = bodyAttrs.match(/\bclass=(["'])(.*?)\1/i);
  return {
    bodyAttrs,
    bodyClassNames: classMatch ? classMatch[2] : '',
    bodyHtml: bodyMatch[2] || ''
  };
}

function findTagBounds(html, tagName, startIndex = 0) {
  const openTag = new RegExp(`<${tagName}\\b[^>]*>`, 'ig');
  openTag.lastIndex = startIndex;
  const firstMatch = openTag.exec(html);
  if (!firstMatch) {
    return null;
  }

  const tokenPattern = new RegExp(`</?${tagName}\\b[^>]*>`, 'ig');
  tokenPattern.lastIndex = firstMatch.index;

  let depth = 0;
  let tokenMatch;
  while ((tokenMatch = tokenPattern.exec(html))) {
    if (tokenMatch[0][1] === '/') {
      depth -= 1;
      if (depth === 0) {
        return {
          start: firstMatch.index,
          end: tokenMatch.index + tokenMatch[0].length
        };
      }
    } else {
      depth += 1;
    }
  }

  return null;
}

function findElementByClass(html, tagName, className) {
  const pattern = new RegExp(`<${tagName}\\b[^>]*class=(["'])[^"']*\\b${escapeRegExp(className)}\\b[^"']*\\1[^>]*>`, 'ig');
  const match = pattern.exec(html);
  if (!match) {
    return null;
  }

  const bounds = findTagBounds(html, tagName, match.index);
  if (!bounds) {
    return null;
  }

  return {
    start: bounds.start,
    end: bounds.end,
    outerHtml: html.slice(bounds.start, bounds.end)
  };
}

function getInnerHtml(outerHtml, tagName) {
  const openTagPattern = new RegExp(`^<${tagName}\\b[^>]*>`, 'i');
  return outerHtml
    .replace(openTagPattern, '')
    .replace(new RegExp(`</${tagName}>\\s*$`, 'i'), '');
}

function stripSiteChrome(html) {
  return html
    .replace(/<footer\b[^>]*class=(["'])[^"']*\bsite-footer\b[^"']*\1[\s\S]*?<\/footer>/ig, '')
    .replace(/<nav\b[^>]*class=(["'])[^"']*\bsite-nav\b[^"']*\1[\s\S]*?<\/nav>/ig, '')
    .replace(/<aside\b[^>]*class=(["'])[^"']*\bcontent-rail\b[^"']*\1[\s\S]*?<\/aside>/ig, '')
    .replace(/<header\b[^>]*class=(["'])[^"']*\bpage-header\b[^"']*\1[\s\S]*?<\/header>/ig, '')
    .trim();
}

function extractRenderableContent(htmlPath) {
  try {
    const html = readHtml(htmlPath);
    const { bodyClassNames, bodyHtml } = extractBodyAndClassNames(html);
    if (!bodyHtml) {
      return '';
    }

    if (/\blayout-content\b/.test(bodyClassNames)) {
      const mainContent = findElementByClass(bodyHtml, 'div', 'main-content');
      if (mainContent) {
        return mainContent.outerHtml.trim();
      }
    }

    const siteMain = findElementByClass(bodyHtml, 'main', 'site-main');
    if (siteMain) {
      return stripSiteChrome(getInnerHtml(siteMain.outerHtml, 'main'));
    }

    return stripSiteChrome(bodyHtml);
  } catch {
    return '';
  }
}

// Get chapter HTML paths from a rendered Jekyll section directory.
// Supports both flat output (`01.html`) and pretty permalinks (`01/index.html`).
function getChapterPaths(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const chapterPaths = [];

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.html') && entry.name !== 'index.html') {
        chapterPaths.push(path.join(dir, entry.name));
      }

      if (entry.isDirectory()) {
        const prettyIndexPath = path.join(dir, entry.name, 'index.html');
        if (fs.existsSync(prettyIndexPath)) {
          chapterPaths.push(prettyIndexPath);
        }
      }
    }

    return naturalSort(chapterPaths);
  } catch {
    return [];
  }
}

function getSiteIndexPath(siteDir, section) {
  if (section.isIndex) {
    return path.join(siteDir, 'index.html');
  }
  return path.join(siteDir, section.name, 'index.html');
}

function getBaseUrl(configPath) {
  try {
    const config = fs.readFileSync(configPath, 'utf-8');
    const match = config.match(/^baseurl:\s*["']?([^"'\n]+)["']?\s*$/m);
    if (!match) return '';
    const baseUrl = match[1].trim();
    return baseUrl === '/' ? '' : baseUrl.replace(/\/$/, '');
  } catch {
    return '';
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function makeAnchorId(prefix, value) {
  const slug = slugify(value);
  return slug ? `${prefix}-${slug}` : prefix;
}

function normalizeSitePath(sitePath) {
  if (!sitePath || sitePath === '/') return '';

  let normalized = sitePath.trim();
  normalized = normalized.split('#')[0].split('?')[0];
  normalized = normalized.replace(/^\/+/, '');
  normalized = normalized.replace(/\/index\.html$/i, '');
  normalized = normalized.replace(/\.html$/i, '');
  normalized = normalized.replace(/\/+$/, '');

  return normalized;
}

function resolveRelativeSitePath(currentDir, relativePath) {
  const [pathPart] = relativePath.split('#');
  const resolved = path.posix.normalize(path.posix.join(`/${currentDir || ''}`, pathPart));
  return normalizeSitePath(resolved);
}

function toSiteFileUrl(siteDir, sitePath) {
  const normalizedPath = normalizeSitePath(sitePath);
  let resolvedPath = path.join(siteDir, normalizedPath);

  if (sitePath.endsWith('/')) {
    resolvedPath = path.join(resolvedPath, 'index.html');
  } else if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isDirectory()) {
    resolvedPath = path.join(resolvedPath, 'index.html');
  } else if (!path.extname(resolvedPath)) {
    const htmlPath = `${resolvedPath}.html`;
    if (fs.existsSync(htmlPath)) {
      resolvedPath = htmlPath;
    }
  }

  return pathToFileURL(resolvedPath).href;
}

function rewriteDocumentUrls(html, {
  currentDir = '',
  siteDir,
  baseUrl,
  internalLinkMap
}) {
  return html.replace(/\b(href|src)=("|\')([^"\']+)\2/g, (match, attr, quote, value) => {
    if (
      value.startsWith('#') ||
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('mailto:') ||
      value.startsWith('tel:') ||
      value.startsWith('data:')
    ) {
      return match;
    }

    let sitePath = null;

    if (baseUrl && (value === baseUrl || value === `${baseUrl}/`)) {
      sitePath = '';
    } else if (baseUrl && value.startsWith(`${baseUrl}/`)) {
      sitePath = normalizeSitePath(value.slice(baseUrl.length));
    } else if (value.startsWith('/')) {
      sitePath = normalizeSitePath(value);
    } else {
      sitePath = resolveRelativeSitePath(currentDir, value);
    }

    if (attr === 'href') {
      const anchorId = internalLinkMap.get(sitePath);
      if (anchorId) {
        return `${attr}=${quote}#${anchorId}${quote}`;
      }
    }

    return `${attr}=${quote}${toSiteFileUrl(siteDir, sitePath || '/')}${quote}`;
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildTocHtml(book) {
  const sectionItems = book.sections.map(section => {
    const chapterItems = section.chapters.length
      ? `<ul class="ebook-toc-children">
${section.chapters.map(chapter =>
  `<li><a href="#${chapter.id}">${chapter.title}</a></li>`
).join('\n')}
</ul>`
      : '';

    return `<li>
  <a href="#${section.id}">${section.tocTitle}</a>
  ${chapterItems}
</li>`;
  }).join('\n');

  return `<section class="section ebook-toc-section" id="ebook-toc">
  <div class="ebook-nav-backdrop">
    <p class="hero-kicker">Navigation</p>
    <h1>目录树</h1>
    <p>点击章节可在 PDF 内跳转。</p>
    <ul class="ebook-toc-root">
${sectionItems}
    </ul>
  </div>
</section>`;
}

// Create combined HTML ebook with all content
function createCompleteEbookHtml(book, cssPath, siteDir, baseUrl) {
  const css = fs.readFileSync(cssPath, 'utf-8');
  const tocHtml = buildTocHtml(book);
  const renderedSections = book.sections.map(section => {
    const introHtml = rewriteDocumentUrls(section.introHtml, {
      currentDir: section.sitePath,
      siteDir,
      baseUrl,
      internalLinkMap: book.internalLinkMap
    });

    const renderedChapters = section.chapters.map(chapter => {
      const chapterHtml = rewriteDocumentUrls(chapter.html, {
        currentDir: chapter.sitePath,
        siteDir,
        baseUrl,
        internalLinkMap: book.internalLinkMap
      });

      return `<article class="chapter" id="${chapter.id}">
  <div class="ebook-local-nav"><a href="#ebook-toc">目录</a><a href="#${section.id}">${section.tocTitle}</a></div>
  ${chapterHtml}
</article>`;
    }).join('\n');

    return `<section class="section" id="${section.id}">
  <div class="ebook-local-nav"><a href="#ebook-toc">目录</a></div>
  ${introHtml}
  ${renderedChapters}
</section>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>Hello Olleh - AI Coding CLI 源码分析</title>
  <style>
${css}
    :root {
      --ebook-paper: #f7f1e6;
      --ebook-panel: rgba(255, 251, 243, 0.96);
      --ebook-ink: #241d18;
      --ebook-muted: #6f6458;
      --ebook-rule: rgba(52, 39, 27, 0.2);
      --ebook-rule-strong: rgba(45, 33, 23, 0.42);
      --ebook-accent: #8f3a2a;
    }
    @page {
      size: A4;
      margin: 16mm 14mm 20mm;
    }
    body {
      padding: 0;
      max-width: 1000px;
      margin: 0 auto;
      font-family: 'Noto Serif SC', 'Newsreader', serif;
      font-size: 13px;
      line-height: 1.8;
      color: var(--ebook-ink);
      background: var(--ebook-paper);
    }
    body::before {
      display: none;
    }
    *,
    *::before,
    *::after {
      animation: none !important;
      transition: none !important;
    }
    .site-main,
    .page-wrapper,
    .content-page .page-content,
    .content-main {
      width: auto !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    a {
      color: var(--ebook-accent);
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .section {
      page-break-before: always;
      padding: 8mm 0 2mm;
    }
    .section:first-of-type {
      page-break-before: avoid;
    }
    .chapter {
      page-break-before: always;
      padding: 4mm 0 0;
    }
    .chapter:first-of-type {
      page-break-before: avoid;
    }
    .ebook-toc-section {
      page-break-before: avoid;
    }
    .ebook-shell {
      padding: 10mm 0 16mm;
    }
    .ebook-nav-backdrop {
      background: linear-gradient(180deg, #fffaf0 0%, #f0e5d3 100%);
      border: 1px solid var(--ebook-rule);
      padding: 8mm 9mm;
      box-shadow: 0 12px 24px rgba(31, 24, 19, 0.05);
    }
    .ebook-toc-root,
    .ebook-toc-children {
      margin: 0;
      padding-left: 1.25rem;
    }
    .ebook-toc-root > li {
      margin: 14px 0;
    }
    .ebook-toc-children > li {
      margin: 6px 0;
    }
    .ebook-local-nav {
      display: flex;
      gap: 14px;
      font-size: 12px;
      margin-bottom: 14px;
      padding-bottom: 6px;
      border-bottom: 1px dashed var(--ebook-rule);
    }
    .ebook-local-nav a {
      color: var(--ebook-muted);
      text-decoration: none;
    }
    .front-hero,
    .hero {
      padding-top: 0;
    }
    .front-hero::before,
    .hero::before {
      width: 100%;
      margin-bottom: 10mm;
    }
    .front-grid {
      display: grid !important;
      grid-template-columns: minmax(0, 1.45fr) minmax(0, 0.95fr);
      gap: 7mm;
      margin-bottom: 6mm;
    }
    .news-briefs,
    .source-links,
    .chapter-grid,
    .cli-grid {
      display: grid !important;
      gap: 4mm;
    }
    .source-links {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .chapter-grid,
    .cli-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .lead-story,
    .brief-card,
    .source-link,
    .chapter-card,
    .cli-card,
    .editorial-figure,
    .main-content,
    .mermaid-container {
      break-inside: avoid;
      background: var(--ebook-panel);
      box-shadow: none !important;
      border: 1px solid var(--ebook-rule) !important;
    }
    .lead-story,
    .brief-card,
    .source-link,
    .chapter-card,
    .cli-card,
    .main-content,
    .mermaid-container {
      padding: 5mm 5.5mm;
    }
    .lead-story::before,
    .brief-card::before,
    .source-link::before,
    .chapter-card::before,
    .cli-card::before,
    .main-content::before {
      border-top-color: var(--ebook-rule-strong);
    }
    h1 {
      color: var(--ebook-ink);
      font-size: 2.2em;
      margin-bottom: 20px;
    }
    h2 {
      color: var(--ebook-ink);
      font-size: 1.5em;
      margin-top: 30px;
      border-bottom: 1px solid var(--ebook-rule);
      padding-bottom: 8px;
    }
    h3 {
      color: #4f2c21;
      font-size: 1.2em;
      margin-top: 20px;
    }
    pre {
      background: rgba(248, 241, 230, 0.9);
      padding: 15px;
      overflow-x: auto;
      border: 1px solid var(--ebook-rule);
      border-radius: 0;
      font-size: 12px;
    }
    code {
      background: rgba(248, 241, 230, 0.92);
      padding: 2px 6px;
      border: 1px solid rgba(58, 45, 31, 0.12);
      border-radius: 0;
      font-size: 12px;
    }
    .mermaid-container {
      text-align: center;
      margin: 20px 0;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 15px 0;
    }
    th, td {
      border: 1px solid var(--ebook-rule);
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: rgba(240, 230, 214, 0.85);
    }
    blockquote {
      border-left: 4px solid var(--ebook-accent);
      margin: 15px 0;
      padding-left: 15px;
      color: var(--ebook-muted);
    }
    .site-nav,
    .page-nav,
    .content-rail,
    .page-header,
    .site-footer,
    .lead-actions,
    hr.section-divider {
      display: none;
    }
    img {
      max-width: 100%;
      height: auto;
      break-inside: avoid;
    }
    .editorial-figure {
      padding: 4mm;
      margin: 0 0 6mm;
    }
    .editorial-figure figcaption {
      padding-top: 4mm;
      color: var(--ebook-muted);
      font-size: 11px;
    }
    .chapter-card,
    .cli-card {
      min-height: 0;
    }
    .chapter-arrow,
    .ticker-row {
      color: var(--ebook-accent);
    }
    .main-content {
      padding: 7mm 8mm;
    }
    .main-content > h1:first-child {
      font-size: 2.4em;
      margin-bottom: 7mm;
    }
    .main-content > p:first-of-type::first-letter {
      color: var(--ebook-accent);
    }
    .content-page {
      padding: 0;
    }
    .front-meta span,
    .hero-badge {
      background: rgba(255, 250, 241, 0.9);
    }
    .front-kicker,
    .hero-kicker,
    .section-kicker,
    .story-kicker,
    .brief-label,
    .page-kicker,
    .source-meta,
    .cli-version,
    .chapter-number,
    .footer-links a {
      color: var(--ebook-accent);
    }
    .ebook-local-nav,
    .front-meta,
    .ticker-row {
      font-family: 'IBM Plex Sans Condensed', sans-serif;
    }
    .harness-diagram {
      text-align: center;
      margin: 6mm 0;
    }
    .harness-diagram img {
      border: 1px solid var(--ebook-rule);
    }
    @media print {
      .section,
      .chapter,
      .lead-story,
      .brief-card,
      .source-link,
      .chapter-card,
      .cli-card,
      .main-content,
      .editorial-figure,
      .mermaid-container,
      table,
      pre,
      blockquote {
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="ebook-shell">
${tocHtml}
${renderedSections}
  </div>
</body>
</html>`;
}

// Generate PDF from HTML
async function generatePDF(inputPath, outputPath) {
  const puppeteer = require('puppeteer-core');
  const protocolTimeout = 10 * 60 * 1000;

  let browser;
  if (process.env.CI) {
    console.log('Using @sparticuz/chromium in CI');
    const chromium = require('@sparticuz/chromium');
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      headless: 'new',
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      protocolTimeout
    });
  } else {
    console.log('Using local Chrome');
    const chromePath = await findChrome();
    if (!chromePath) {
      throw new Error('Chrome/Chromium not found');
    }
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      protocolTimeout
    });
  }

  try {
    const page = await browser.newPage();
    const fileUrl = `file://${path.resolve(inputPath)}`;

    console.log(`Loading: ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await delay(1000);
    await page.emulateMediaType('screen');

    await page.pdf({
      path: path.resolve(outputPath),
      format: 'A4',
      printBackground: true,
      outline: false,
      timeout: 0,
      margin: { top: '20mm', bottom: '25mm', left: '15mm', right: '15mm' },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:10px;text-align:center;width:100%;font-family:sans-serif;"><span class="title"></span></div>`,
      footerTemplate: `<div style="font-size:10px;text-align:center;width:100%;font-family:sans-serif;"><span class="pageNumber"></span> / <span class="totalPages"></span></div>`
    });

    console.log(`Generated: ${outputPath}`);
  } finally {
    await browser.close();
  }
}

// Main
const siteDir = path.join(__dirname, '..', '_site');
const cssPath = path.join(__dirname, '..', 'style.css');
const configPath = path.join(__dirname, '..', '_config.yml');
const tmpDir = path.join(siteDir, 'tmp');

// Define all sections in order
const sections = [
  { name: 'hello-olleh', title: 'Hello Olleh - AI Coding CLI 源码分析总览', isIndex: true },
  { name: 'hello-harness', title: 'Harness Engineering Framework' },
  { name: 'hello-claude-code', title: 'Claude Code' },
  { name: 'hello-codex', title: 'OpenAI Codex' },
  { name: 'hello-gemini-cli', title: 'Gemini CLI' },
  { name: 'hello-opencode', title: 'OpenCode' }
];

async function main() {
  // Ensure tmp directory exists
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const book = {
    sections: [],
    internalLinkMap: new Map()
  };
  let totalChapters = 0;

  for (const section of sections) {
    if (section.isIndex) {
      const indexPath = getSiteIndexPath(siteDir, section);
      if (!fs.existsSync(indexPath)) {
        console.log(`Skipping ${section.name}: index.html not found`);
        continue;
      }
      const sitePath = '';
      const sectionEntry = {
        id: makeAnchorId('section', section.name),
        tocTitle: section.title,
        sitePath,
        introHtml: extractRenderableContent(indexPath),
        chapters: []
      };

      book.sections.push(sectionEntry);
      book.internalLinkMap.set(sitePath, sectionEntry.id);
      console.log(`Added ${section.name} (index)`);
    } else {
      const sectionDir = path.join(siteDir, section.name);
      if (!fs.existsSync(sectionDir)) {
        console.log(`Skipping ${section.name}: directory not found`);
        continue;
      }

      const chapterPaths = getChapterPaths(sectionDir);
      if (chapterPaths.length === 0) {
        console.log(`Skipping ${section.name}: no chapter files found`);
        continue;
      }

      totalChapters += chapterPaths.length;
      console.log(`Added ${section.name} (${chapterPaths.length} chapters)`);

      const sectionIndexPath = path.join(sectionDir, 'index.html');
      const sectionSitePath = section.name;
      const sectionEntry = {
        id: makeAnchorId('section', section.name),
        tocTitle: section.title,
        sitePath: sectionSitePath,
        introHtml: fs.existsSync(sectionIndexPath)
          ? extractRenderableContent(sectionIndexPath)
          : `<h1>${section.title}</h1>`,
        chapters: []
      };

      book.sections.push(sectionEntry);
      book.internalLinkMap.set(sectionSitePath, sectionEntry.id);

      for (const chapterPath of chapterPaths) {
        const chapterSlug = normalizeSitePath(path.relative(sectionDir, chapterPath)).replace(/^index$/i, '');
        const chapterSitePath = normalizeSitePath(path.posix.join(section.name, chapterSlug));
        const chapterEntry = {
          id: makeAnchorId('chapter', chapterSitePath),
          sitePath: chapterSitePath,
          title: extractTitle(chapterPath, chapterSlug || section.title),
          html: extractRenderableContent(chapterPath)
        };

        sectionEntry.chapters.push(chapterEntry);
        book.internalLinkMap.set(chapterSitePath, chapterEntry.id);
      }
    }
  }

  console.log(`\nTotal: ${totalChapters} chapters from ${book.sections.length} sections`);

  // Create combined HTML
  const baseUrl = getBaseUrl(configPath);
  const combinedHtml = createCompleteEbookHtml(book, cssPath, siteDir, baseUrl);
  const tmpHtmlPath = path.join(tmpDir, 'hello-olleh-complete.html');
  fs.writeFileSync(tmpHtmlPath, combinedHtml, 'utf-8');

  // Generate single PDF
  const pdfPath = path.join(siteDir, 'hello-olleh-complete.pdf');
  try {
    await generatePDF(tmpHtmlPath, pdfPath);
  } catch (err) {
    console.error(`Error generating PDF: ${err.message}`);
    process.exit(1);
  }

  // Cleanup tmp
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log('\nDone! Generated: hello-olleh-complete.pdf');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  findChrome,
  naturalSort,
  getChapterPaths,
  getSiteIndexPath,
  getBaseUrl,
  rewriteDocumentUrls,
  buildTocHtml,
  extractTitle,
  normalizeSitePath,
  resolveRelativeSitePath,
  delay,
  extractBody,
  extractRenderableContent,
  createCompleteEbookHtml
};
