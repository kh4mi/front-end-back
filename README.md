# SiteName (DECO1800 Work-in-Progress)

A static website: no build step, no server needed. Open `index.html` in a browser, or upload the whole folder to your team zone.

## Pages
| File | What it is |
|---|---|
| `index.html` | Landing page, search box, sample rentals carousel |
| `quiz.html` | 5-question matching quiz (saves answers in the browser) |
| `results.html` | Ranked suburbs + Leaflet map |
| `suburbSummary.html?s=toowong` | Suburb detail page |
| `rentals.html` | Find a rental (sample listings, filters, saved) |
| `how-it-works.html` | Scoring explanation, data sources, privacy + consent |
| `signup.html` | Sign up / log in form (front end only) |
| `under-construction.html` | The 404 page from the Figma |
| `references.html` | Credits for all outside sources |

## Reusable parts
- **`css/theme.css`**: colours, font, buttons, cards, chips, score bars. Change the variables in `:root` to re-skin everything.
- **`css/pages.css`**: layouts for each page.
- **`js/components.js`**: the navbar and footer, written once. Every page uses `<site-header active="browse"></site-header>` and `<site-footer></site-footer>`. Change `SITE_NAME` at the top of this file when you pick a real name.
- **`js/app.js`**: shared logic (saved data, parks API, matching, listing cards).

## Live data
`js/app.js` calls the Brisbane City Council "Park – Locations" dataset. It looks at the first record to find the real field names, downloads every park, counts parks per suburb, and turns the counts into the Parks & Rec score.
`js/suburb.js` calls the Brisbane City Council "Suburb Boundaries" dataset AND static SEQ GTFS information (data/___.txt files).
BCC dataset uses geoshape of suburb to show the clear suburb lines,
and GTFS information is used currently to marker the stops.

## Placeholder data (replace these)
- `data/suburbs.js`: the `sample` scores for affordability, transport and safety are **made up**. Replace each as its dataset is connected.
- `data/rentals.js`: made-up listings. To go live, see "Rental listings" below.