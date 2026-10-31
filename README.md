# dermatological-ucla.github.io
Main website for Dermatological @ UCLA

Active Contributors
- Luis Flores
- Ariel Rose
- Kaity Shimohara
- James Wu

## About the site

A static site in the fine-line botanical style: warm paper, sage ink, serif
type, and procedurally drawn flowers. No build step and no dependencies — open
`index.html` in a browser, or push to `main` to deploy via GitHub Pages.

## Structure

    index.html          Home: hero garden, purpose, core values, our work, recruitment
    about.html          Founding story, mission, future plans, stats
    team.html           Executive board, national board, general members
    our-work.html       Projects with photo galleries, honors, mentions
    partnerships.html   Partner, school, and branch logos
    resources.html      External skin health resources
    contact.html        Contact details
    assets/css/style.css
    assets/js/botanical.js   All canvas artwork (gardens, footer border, blooms)
    assets/js/site.js        Menu, scroll reveals, galleries
    assets/img/              Web-sized photos and logos
    assets/og/               Link preview image and video

## Botanical canvases

Any `<canvas data-botanical="...">` is drawn by `botanical.js`:

- `garden` — ring garden; `data-anchor` names the element the ring fits,
  `data-interactive` enables click/tap/Enter to plant, `data-blobs` adds the
  pale background shapes, `data-count` sets the number of flowers.
- `border` — row of small plants above the footer.
- `bloom` — single flower (value icons, resource icons, missing portraits).

`data-seed` keeps each drawing identical on every visit; change it for a
different arrangement. Motion stops when a canvas is off-screen and is disabled
entirely under `prefers-reduced-motion`.

## Editing

Header and footer are repeated in each page, so nav changes need to be made in
all seven files. Team members with no photo get a `bloom` canvas instead of a
placeholder image.
