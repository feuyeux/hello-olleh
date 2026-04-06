#!/usr/bin/env node
/**
 * Generate a complete PDF ebook from Jekyll _site directory
 * Merges all content (homepage + harness + all workspaces) into a single PDF
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

// Find Chrome/Chromium executable
function findChrome() {
  // In CI, use @sparticuz/chromium
  if (process.env.CI) {
    const chromium = require('@sparticuz/chromium');
    return chromium.executablePath();
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

// Create combined HTML ebook with all content
function createCompleteEbookHtml(sections, cssPath) {
  const css = fs.readFileSync(cssPath, 'utf-8');

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
${sections}
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
      executablePath: chromium.executablePath(),
      headless: 'new',
      args: chromium.args,
      defaultViewport: chromium.defaultViewport
    });
  } else {
    console.log('Using local Chrome');
    const chromePath = findChrome();
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

  const allSections = [];
  let totalChapters = 0;

  for (const section of sections) {
    const sectionDir = path.join(siteDir, section.name);
    if (!fs.existsSync(sectionDir)) {
      console.log(`Skipping ${section.name}: directory not found`);
      continue;
    }

    if (section.isIndex) {
      const indexPath = path.join(sectionDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        console.log(`Skipping ${section.name}: index.html not found`);
        continue;
      }
      const content = extractBody(indexPath);
      allSections.push(`<div class="section"><h1>${section.title}</h1>${content}</div>`);
      console.log(`Added ${section.name} (index)`);
    } else {
      const files = naturalSort(getChapterFiles(sectionDir));
      if (files.length === 0) {
        console.log(`Skipping ${section.name}: no chapter files found`);
        continue;
      }

      totalChapters += files.length;
      console.log(`Added ${section.name} (${files.length} chapters)`);

      // Add section header
      let sectionHtml = `<div class="section"><h1>${section.title}</h1>`;

      // Add all chapters
      for (const f of files) {
        const content = extractBody(path.join(sectionDir, f));
        sectionHtml += `<div class="chapter">${content}</div>`;
      }

      sectionHtml += '</div>';
      allSections.push(sectionHtml);
    }
  }

  console.log(`\nTotal: ${totalChapters} chapters from ${allSections.length} sections`);

  // Create combined HTML
  const combinedHtml = createCompleteEbookHtml(allSections.join('\n'), cssPath);
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

main().catch(console.error);
