# Jolt Pickleball Club — Website

A fast, static marketing + shop site for a pickleball club selling paddles,
apparel, nets and interlocking court tiles. No framework, no server required
— just HTML, CSS and vanilla JS, assembled by a small Node build script.

## Structure

```
pickleball-club/
├── build.js               # Assembles src/ into dist/
├── deploy.sh               # Ships dist/ to a hosting target
├── package.json            # npm run build / dev / deploy
├── src/
│   ├── config.json         # Single source of truth: brand name, email,
│   │                       # phone, address, nav links, year — edit this
│   │                       # file to re-brand or re-point the site.
│   ├── partials/
│   │   ├── shell.html      # Base <html> document wrapper
│   │   ├── head.html       # <head>: meta tags, fonts, favicon, CSS
│   │   ├── header.html     # Site nav + logo
│   │   └── footer.html     # Footer columns + contact links
│   ├── pages/
│   │   ├── index.html      # Home / marketing page (body content only)
│   │   ├── shop.html       # Paddles, apparel, nets, court tiles
│   │   ├── contact.html    # Contact form + direct contact info
│   │   └── 404.html        # Not-found page
│   └── assets/
│       ├── css/style.css
│       ├── js/main.js
│       └── img/            # Logo, court photo, tile product photos
└── dist/                   # Generated output — this is what you deploy
```

Every page in `src/pages/` is just body content — no repeated `<head>`,
nav, or footer markup. `build.js` stitches the shared partials around each
page and writes the finished, standalone HTML files to `dist/`, so there's
one place to edit the nav or footer instead of four.

## Requirements

- Node.js 16+ (no other dependencies — the build script uses only the
  Node standard library)

## Commands

```bash
npm run build     # Build the site into dist/
npm run dev       # Build, then serve dist/ locally at http://localhost:8080
npm run deploy    # Build, then run deploy.sh
```

## Editing content

- **Brand info, email, phone, address, social links, nav:** edit
  `src/config.json`. These values are injected wherever `{{CONTACT_EMAIL}}`,
  `{{PHONE}}`, `{{ADDRESS}}`, etc. appear in the partials and pages.
- **Page copy:** edit the relevant file in `src/pages/`.
- **Products:** each product is a `.product-card` block in `shop.html` —
  copy an existing card and change the name, description, price and the
  `Enquire` link's `topic`/`item` query params (these pre-fill the contact
  form automatically).
- **Styling:** all design tokens (colors, fonts, spacing) are CSS custom
  properties at the top of `src/assets/css/style.css`.

## The contact form

This is a static site with no backend, so the contact form builds a
`mailto:` link from the visitor's input and opens their email client with
the subject and message pre-filled, addressed to the email in
`config.json`. If you'd rather collect submissions server-side, swap the
submit handler in `src/assets/js/main.js` for a call to a form backend
(e.g. Formspree, Netlify Forms, or your own API) — the form's `name`
attributes are already set up for that.

## Deploying

`deploy.sh` always runs `npm run build` first, then ships `dist/` using
whichever target you pass in:

```bash
./deploy.sh netlify     # Netlify CLI (npx netlify-cli)
./deploy.sh vercel      # Vercel CLI (npx vercel)
./deploy.sh gh-pages    # Publish dist/ to a gh-pages branch
./deploy.sh rsync       # rsync dist/ to your own server (edit REMOTE first)
./deploy.sh zip         # Just zip dist/ for manual upload anywhere
```

For manual hosting (S3, cPanel, any static host), just run `npm run build`
and upload the contents of `dist/`.
