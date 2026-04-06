#!/usr/bin/env node
/**
 * Generate PDF ebooks from Jekyll _site directory
 * Merges all chapter HTML pages into a single PDF per workspace
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

// Find Chrome/Chromium executable
function findChrome() {
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
  return files.sort((a, b) => {
    const numA = parseInt(a.match(/^\d+/)?.[0] || '0');
    const numB = parseInt(b.match(/^\d+/)?.[0] || '0');
    return numA - numB;
  });
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

// Get chapter files from a directory
function getChapterFiles(dir) {
  try {
    const files = fs.readdirSync(dir);
    return files.filter(f => f.endsWith('.html') && f !== 'index.html');
  } catch {
    return [];
  }
}

// Create combined HTML ebook
function createEbookHtml(title, chapters, cssPath) {
  const css = fs.readFileSync(cssPath, 'utf-8');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
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
    .chapter {
      page-break-before: always;
      padding: 20px 0;
    }
    .chapter:first-of-type {
      page-break-before: avoid;
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
    .site-nav {
      display: none;
    }
    .page-nav {
      display: none;
    }
  </style>
</head>
<body>
<h1>${title}</h1>
${chapters}
</body>
</html>`;
}

// Generate PDF from HTML
async function generatePDF(inputPath, outputPath) {
  const chrome = findChrome();
  if (!chrome) {
    throw new Error('Chrome/Chromium not found');
  }

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  try {
    const page = await browser.newPage();
    const fileUrl = `file://${path.resolve(inputPath)}`;

    console.log(`Loading: ${fileUrl}`);
    await page.goto(fileUrl, { waitUntil: ['networkidle0', 'domcontentloaded'], timeout: 120000 });
    await page.waitForTimeout(2000);

    await page.pdf({
      path: path.resolve(outputPath),
      format: 'A4',
      printBackground: true,
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
const tmpDir = path.join(siteDir, 'tmp');

const ebooks = [
  { name: 'hello-claude-code', title: 'Claude Code 源码分析' },
  { name: 'hello-codex', title: 'OpenAI Codex 源码分析' },
  { name: 'hello-gemini-cli', title: 'Gemini CLI 源码分析' },
  { name: 'hello-opencode', title: 'OpenCode 源码分析' }
];

async function main() {
  // Ensure tmp directory exists
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  for (const ebook of ebooks) {
    const chapterDir = path.join(siteDir, ebook.name);
    if (!fs.existsSync(chapterDir)) {
      console.log(`Skipping ${ebook.name}: directory not found`);
      continue;
    }

    const files = naturalSort(getChapterFiles(chapterDir));
    if (files.length === 0) {
      console.log(`Skipping ${ebook.name}: no chapter files found`);
      continue;
    }

    console.log(`\nGenerating ebook for ${ebook.name} (${files.length} chapters)...`);

    // Combine all chapters
    const chaptersHtml = files.map(f => {
      const content = extractBody(path.join(chapterDir, f));
      return `<div class="chapter">${content}</div>`;
    }).join('\n');

    // Create combined HTML
    const combinedHtml = createEbookHtml(ebook.title, chaptersHtml, cssPath);
    const tmpHtmlPath = path.join(tmpDir, `${ebook.name}-ebook.html`);
    fs.writeFileSync(tmpHtmlPath, combinedHtml, 'utf-8');

    // Generate PDF
    const pdfPath = path.join(siteDir, `${ebook.name}.pdf`);
    try {
      await generatePDF(tmpHtmlPath, pdfPath);
    } catch (err) {
      console.error(`Error generating PDF for ${ebook.name}: ${err.message}`);
    }
  }

  // Cleanup tmp
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log('\nDone!');
}

main().catch(console.error);
