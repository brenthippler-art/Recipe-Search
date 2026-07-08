Smart Recipe Search

A recipe discovery app that lets users search by ingredient or dish name, sort results by macronutrients, and pull up a printable ingredient list for any recipe — built with a strong focus on accessibility (WCAG 2.1/2.2 AA).

Features

Search recipes by food name or ingredient
Sort results by calories, carbs, protein, or fat (low → high or high → low)
Recipe detail overlay — ingredients and instructions load on demand per card
Printable ingredient list — pull just one recipe's ingredients and amounts into a clean, print-ready view without leaving the results grid
Contact modal — quick access to direct email, reachable from the nav and footer
Fully responsive — mobile-first layout with a dedicated mobile navigation drawer
Accessible by design, not as an afterthought (see below)


Accessibility

This project was built and audited against WCAG 2.1 AA, with several 2.2-level practices included as well:


Skip-to-content link for keyboard users
Screen-reader live regions for search status, result counts, and errors
Full keyboard support for recipe cards (Enter/Space to open, focus-visible states throughout)
Focus trapping and focus-return in both modals and the mobile nav drawer
Semantic landmarks (role="search", role="dialog", aria-modal, etc.)
Minimum 44×44px touch targets on all interactive controls
Reduced-motion support via prefers-reduced-motion
Color contrast checked against WCAG AA thresholds (4.5:1 text, 3:1 UI components)
No information conveyed by color alone


Tech Stack


Frontend: Vanilla JavaScript, HTML5, CSS3 (BEM-style naming)
Icons: Font Awesome
Recipe data: Spoonacular API, accessed through a serverless proxy
Proxy/backend: Node.js serverless functions on Vercel — keeps the API key server-side and out of client code


Architecture Notes

All recipe data requests go through a Vercel-hosted proxy rather than calling the Spoonacular API directly from the browser. This keeps the API key out of client-side code entirely and gives a single place to handle rate limiting, error normalization, and response shaping before data ever reaches the frontend.

Browser  →  Vercel serverless functions (/api/search, /api/details)  →  Spoonacular API

Running Locally

bashgit clone https://github.com/brenthippler-art/Recipe-Search.git
cd Recipe-Search

Open index.html directly in a browser, or serve it with any static server (e.g. the VS Code Live Server extension). No build step is required — this is a vanilla JS/HTML/CSS project.


Note: recipe search and detail features depend on the deployed Vercel proxy. To run your own instance of the proxy, you'll need a Spoonacular API key configured as an environment variable on your own Vercel deployment.



Known Limitations


Ingredient lists are shown per-recipe only — the app intentionally does not aggregate ingredients across multiple recipes into a single shopping list, to avoid unreliable text-parsing of free-form ingredient strings.
Recipe data availability (images, nutrition, instructions) depends on what Spoonacular provides per recipe; some entries may be missing certain fields.


Author

Brenton Hippler
Frontend Developer | brentoncodes.dev
📧 brenton@brentoncodes.dev

License

This project is open source and available for reference under the MIT License.
