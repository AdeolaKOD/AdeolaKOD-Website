# adeolakod.com

My personal academic website, live at [adeolakod.com](https://adeolakod.com) and hosted on GitHub Pages. Every push to `main` deploys automatically.

It's plain HTML, CSS and JavaScript. No framework, no build step, and no third-party requests (the font is self-hosted), so it loads fast and there's nothing to keep updated.

## Layout

```
index.html          home: intro and areas of interest
research.html       research statement and thesis
projects.html       projects
cv.html             CV, with the PDF and transcript
404.html            shown by GitHub Pages for any missing page
assets/
  css/site.css      all the styles
  js/site.js        carousel and blur-in reveal
  js/orb.js         the WebGL orbs on the home page
  fonts/            Geist (subset to Latin) and its licence
  img/adeola.jpg    profile photo, also used as the favicon
docs/               PDFs linked from the site
CNAME               custom domain for GitHub Pages
robots.txt, sitemap.xml
```

Links use clean URLs (`/research` rather than `/research.html`). GitHub Pages maps them to the `.html` files automatically.

## Running it locally

Any static server that understands clean URLs works, for example:

```
npx serve .
```

Python's built-in server (`python3 -m http.server`) also works, but you'll need to open the `.html` files directly because it doesn't map `/research` to `research.html`.

## Notes to self

- Every page has a Content-Security-Policy that only allows files from this site. The small inline script in each `<head>` is allowed by its sha256 hash, so if I change that script I need to update the hash in the CSP on every page.
- CSS and JS links end in `?v=...`. When I change `site.css`, `site.js` or `orb.js`, I bump that value on every page so browsers fetch the new file instead of a cached one.
- The orb colours are set per slide with `data-colors="main,light,deep"` in `index.html`.

## To do

- [ ] Dark mode
- [ ] Replace the transcript with a redacted copy
- [ ] Add a publications section to the research page
