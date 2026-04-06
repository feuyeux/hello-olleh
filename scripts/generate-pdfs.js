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
    body {
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
      font-family: 'Noto Sans SC', 'Crimson Pro', Georgia, sans-serif;
      font-size: 14px;
      line-height: 1.8;
    }
    a {
      color: #2e6f64;
      text-decoration: underline;
      text-underline-offset: 2px;
    }
    .section {
      page-break-before: always;
      padding: 20px 0;
    }
    .section:first-of-type {
      page-break-before: avoid;
    }
    .chapter {
      page-break-before: always;
      padding: 15px 0;
    }
    .chapter:first-of-type {
      page-break-before: avoid;
    }
    .ebook-toc-section {
      page-break-before: avoid;
    }
    .ebook-nav-backdrop {
      background: linear-gradient(180deg, #fffef9 0%, #f5f0e6 100%);
      border: 1px solid #d4cfc4;
      border-radius: 14px;
      padding: 28px 32px;
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
      margin-bottom: 18px;
      padding-bottom: 8px;
      border-bottom: 1px dashed #d4cfc4;
    }
    .ebook-local-nav a {
      color: #5c564f;
      text-decoration: none;
    }
    h1 {
      color: #2d2a26;
      font-size: 2em;
      margin-bottom: 30px;
    }
    h2 {
      color: #4a7c6f;
      font-size: 1.5em;
      margin-top: 30px;
      border-bottom: 1px solid #d4cfc4;
      padding-bottom: 10px;
    }
    h3 {
      color: #3d6659;
      font-size: 1.2em;
      margin-top: 20px;
    }
    pre {
      background: #f5f0e6;
      padding: 15px;
      overflow-x: auto;
      border-radius: 4px;
      font-size: 12px;
    }
    code {
      background: #f5f0e6;
      padding: 2px 6px;
      border-radius: 3px;
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
      border: 1px solid #d4cfc4;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background: #f5f0e6;
    }
    blockquote {
      border-left: 4px solid #4a7c6f;
      margin: 15px 0;
      padding-left: 15px;
      color: #5a5550;
    }
    .site-nav, .page-nav, .source-links, .harness-diagram {
      display: none;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    .cli-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    .cli-card {
      background: #fffef8;
      border: 1px solid #d4cfc4;
      border-radius: 8px;
      padding: 15px;
      display: flex;
      align-items: center;
      gap: 15px;
      color: #2d2a26;
    }
    .chapter-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 15px;
      margin: 20px 0;
    }
    .chapter-card {
      background: #fffef8;
      border: 1px solid #d4cfc4;
      border-radius: 8px;
      padding: 15px;
      display: flex;
      align-items: center;
      gap: 15px;
      color: #2d2a26;
    }
    .source-link {
      background: #fffef8;
      border: 1px solid #d4cfc4;
      border-radius: 8px;
      padding: 12px 15px;
      display: block;
      color: #2d2a26;
      margin: 8px 0;
    }
    hr {
      display: none;
    }
  </style>
</head>
<body>
${tocHtml}
${renderedSections}
</body>
</html>`;
}

// Generate PDF from HTML
async function generatePDF(inputPath, outputPath) {
  const puppeteer = require('puppeteer-core');

  let browser;
  if (process.env.CI) {
    console.log('Using @sparticuz/chromium in CI');
    const chromium = require('@sparticuz/chromium');
    browser = await puppeteer.launch({
      executablePath: await chromium.executablePath(),
      headless: 'new',
      args: chromium.args,
      defaultViewport: chromium.defaultViewport
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
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
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
        introHtml: extractBody(indexPath),
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
          ? extractBody(sectionIndexPath)
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
          html: extractBody(chapterPath)
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
  createCompleteEbookHtml
};
