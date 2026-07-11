#!/usr/bin/env node
/**
 * Jolt Pickleball Club — static site build script
 * ---------------------------------------------------
 * Assembles the modular partials (head/header/footer/shell) and page
 * content in src/pages/ into complete, deployable HTML files in dist/,
 * then copies the assets folder alongside them.
 *
 * Usage: node build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');

const config = JSON.parse(fs.readFileSync(path.join(SRC, 'config.json'), 'utf8'));

// Per-page metadata: title + meta description shown in <head> and used for OG tags
const PAGE_META = {
  'index.html': {
    title: 'Home',
    description: 'Jolt Pickleball Club — tour-grade paddles, performance apparel, nets and modular interlocking court tiles.'
  },
  'shop.html': {
    title: 'Shop',
    description: 'Shop Jolt paddles, apparel, nets and interlocking court tiles. Bulk and club pricing available on request.'
  },
  'contact.html': {
    title: 'Contact Us',
    description: 'Get in touch with Jolt Pickleball Club about paddles, apparel, nets, court tile installs or bulk orders.'
  },
  '404.html': {
    title: 'Page Not Found',
    description: 'The page you requested could not be found on the Jolt Pickleball Club site.'
  }
};

function read(relPath) {
  return fs.readFileSync(path.join(SRC, relPath), 'utf8');
}

/** Replace every {{KEY}} in `str` using the provided map. Unknown keys are left as-is. */
function fill(str, map) {
  return str.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : match;
  });
}

function rimraf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dest);
    else fs.copyFileSync(src, dest);
  }
}

function build() {
  console.log('▲ Building Jolt Pickleball Club site…');

  rimraf(DIST);
  fs.mkdirSync(DIST, { recursive: true });

  const shell = read('partials/shell.html');
  const headTpl = read('partials/head.html');
  const header = fill(read('partials/header.html'), {});
  const footerTpl = read('partials/footer.html');

  const globalTokens = {
    SITE_NAME: config.siteName,
    SITE_URL: config.url,
    CONTACT_EMAIL: config.contactEmail,
    SALES_EMAIL: config.salesEmail,
    PHONE: config.phone,
    PHONE_TEL: config.phone.replace(/[^\d+]/g, ''),
    ADDRESS: config.address,
    HOURS: config.hours,
    INSTAGRAM_URL: config.social.instagram,
    FACEBOOK_URL: config.social.facebook,
    YEAR: config.year
  };

  const footer = fill(footerTpl, globalTokens);

  const pagesDir = path.join(SRC, 'pages');
  const pageFiles = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.html'));

  for (const file of pageFiles) {
    const meta = PAGE_META[file] || { title: file.replace('.html', ''), description: config.description };
    const head = fill(headTpl, {
      ...globalTokens,
      PAGE_TITLE: meta.title,
      PAGE_DESCRIPTION: meta.description,
      PAGE_FILE: file
    });

    let content = fs.readFileSync(path.join(pagesDir, file), 'utf8');
    content = fill(content, globalTokens);

    const page = fill(shell, {
      HEAD: head,
      HEADER: header,
      CONTENT: content,
      FOOTER: footer
    });

    fs.writeFileSync(path.join(DIST, file), page, 'utf8');
    console.log(`  ✓ ${file}`);
  }

  copyDir(path.join(SRC, 'assets'), path.join(DIST, 'assets'));
  console.log('  ✓ assets/');

  console.log('▲ Build complete → dist/');
}

build();
