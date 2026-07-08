// ===============================
// Smart Recipe Search — index.js
// ===============================

// ---- DOM refs ----
const searchInput    = document.querySelector("#searchInput");
const searchBtn      = document.querySelector("#searchBtn");
const searchBox      = document.querySelector(".search");
const searchError    = document.querySelector(".search__error");   // NEW: inline error
const modal          = document.querySelector("#resultsModal");
const modalTitle     = document.querySelector("#modalTitle");
const contactModal         = document.querySelector("#contactModal");
const closeContactModalBtn = document.querySelector("#closeContactModalBtn");
let lastContactFocusedElement = null;
const recipesContainer = document.querySelector("#recipesContainer");
const sortSelect     = document.querySelector("#sortSelect");
const newSearchBtn   = document.querySelector("#newSearchBtn");
const closeModalBtn  = document.querySelector("#closeModalBtn");
const srAnnouncer    = document.querySelector("#srAnnouncer");    // WCAG live region
// Hamburger / mobile nav
const hamburgerBtn   = document.querySelector(".nav__hamburger");
const mobileMenu     = document.querySelector(".nav__mobile-menu");
const mobileOverlay  = document.querySelector(".nav__mobile-overlay");

// ---- State ----
const recipeDetailsCache = new Map();
let currentRecipes = [];
let lastFocusedElement = null; // for returning focus after modal closes

const PROXY_BASE = "https://food-project-seven-eosin.vercel.app";
// Flip to true when the API/proxy is down to test UI with demo data
const DEMO_MODE = false;

// ===============================
// Screen-reader announcer (WCAG 4.1.3 Status Messages)
// ===============================
function announce(msg, priority = "polite") {
  if (!srAnnouncer) return;
  srAnnouncer.setAttribute("aria-live", priority);
  // Reset then set forces re-announcement even for duplicate text
  srAnnouncer.textContent = "";
  requestAnimationFrame(() => { srAnnouncer.textContent = msg; });
}

// ===============================
// Inline error (replaces alert())
// ===============================
function showError(msg) {
  if (!searchError) return;
  const msgEl = searchError.querySelector(".search__error-msg");
  if (msgEl) msgEl.textContent = msg;
  searchError.classList.add("is-visible");
  searchError.setAttribute("aria-hidden", "false");
  announce(msg, "assertive");
}

function clearError() {
  if (!searchError) return;
  searchError.classList.remove("is-visible");
  searchError.setAttribute("aria-hidden", "true");
}

// ===============================
// Modal helpers
// ===============================
function openModal(titleText) {
  lastFocusedElement = document.activeElement; // remember where focus was
  modalTitle.textContent = titleText;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  if (sortSelect) sortSelect.value = "calories_asc";
  // Move focus into modal for keyboard/screen reader users (WCAG 2.4.3)
  closeModalBtn?.focus();
}

function closeModal() {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  recipesContainer.innerHTML = "";
  currentRecipes = [];
  recipeDetailsCache.clear();
  // Do NOT clear searchInput.value — user may want to refine the same search
  // Return focus to wherever it was before modal opened (WCAG 2.4.3)
  lastFocusedElement?.focus();
}

function openContactModal(trigger) {
  if (mobileMenu?.classList.contains("is-open")) {
    closeMobileMenu();
  }
  lastContactFocusedElement = trigger || document.activeElement;
  contactModal.classList.remove("hidden");
  contactModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  closeContactModalBtn?.focus();
}

function closeContactModal() {
  contactModal.classList.add("hidden");
  contactModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  lastContactFocusedElement?.focus();
}

closeContactModalBtn?.addEventListener("click", closeContactModal);

contactModal?.addEventListener("click", e => {
  if (e.target === contactModal) closeContactModal();
});

// ===============================
// Loading state
// ===============================
function setLoading(isLoading) {
  if (!searchBox) return;
  searchBox.classList.toggle("is-loading", isLoading);
  if (searchBtn) {
    searchBtn.disabled = isLoading;
    searchBtn.setAttribute("aria-busy", String(isLoading));
  }
}

// ===============================
// XSS protection
// ===============================
function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&",  "&amp;")
    .replaceAll("<",  "&lt;")
    .replaceAll(">",  "&gt;")
    .replaceAll('"',  "&quot;")
    .replaceAll("'",  "&#039;");
}

// ===============================
// Fetch helpers
// ===============================
async function fetchJson(url) {
  const res  = await fetch(url);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || "Non-JSON response from server." };
  }
  if (!res.ok) {
    const msg = data?.error || data?.message || `Request failed (${res.status}).`;
    throw new Error(msg);
  }
  return data;
}

async function fetchRecipes(query) {
  if (DEMO_MODE) return demoRecipes(query);
  if (!PROXY_BASE || PROXY_BASE.includes("YOUR-VERCEL-APP")) {
    throw new Error('Set PROXY_BASE to your Vercel URL, e.g. "https://my-app.vercel.app".');
  }
  const url  = `${PROXY_BASE}/api/search?q=${encodeURIComponent(query)}&number=12`;
  const data = await fetchJson(url);
  return data?.results || [];
}

async function fetchRecipeDetails(id) {
  if (DEMO_MODE) return demoRecipeDetails(id);
  if (!PROXY_BASE || PROXY_BASE.includes("YOUR-VERCEL-APP")) {
    throw new Error('Set PROXY_BASE to your Vercel URL, e.g. "https://my-app.vercel.app".');
  }
  const url = `${PROXY_BASE}/api/details?id=${encodeURIComponent(id)}`;
  return fetchJson(url);
}

// ===============================
// Nutrition helpers
// ===============================
function getNutrient(recipe, name) {
  const nutrients = recipe?.nutrition?.nutrients;
  if (!Array.isArray(nutrients)) return null;
  const found = nutrients.find(x => (x.name || "").toLowerCase() === name.toLowerCase());
  return found && typeof found.amount === "number"
    ? `${found.amount} ${found.unit || ""}`.trim()
    : null;
}

function getMacroAmount(recipe, metric) {
  const map = { calories: "Calories", carbs: "Carbohydrates", protein: "Protein", fat: "Fat" };
  const nutrientName = map[metric];
  if (!nutrientName) return null;
  const nutrients = recipe?.nutrition?.nutrients;
  if (!Array.isArray(nutrients)) return null;
  const found = nutrients.find(x => (x.name || "").toLowerCase() === nutrientName.toLowerCase());
  return found && typeof found.amount === "number" ? found.amount : null;
}

function formatIngredientAmount(ing) {
  const amount = typeof ing.amount === "number" ? Math.round(ing.amount * 100) / 100 : null;
  const unit   = ing.unit || "";
  const name   = ing.nameClean || ing.name || ing.original || "Ingredient";
  const amountText = amount !== null ? `${amount} ${unit}`.trim() : "";
  return { amountText, name };
}

// Defensive sort: spreads internally so the original array is never mutated
function sortRecipes(arr, sortValue) {
  if (!sortValue) return [...arr];
  const [metric, direction] = sortValue.split("_");
  if (!metric || !direction) return [...arr];
  return [...arr].sort((a, b) => {
    const aVal    = getMacroAmount(a, metric);
    const bVal    = getMacroAmount(b, metric);
    const aMissing = aVal === null;
    const bMissing = bVal === null;
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return direction === "asc" ? aVal - bVal : bVal - aVal;
  });
}

// ===============================
// Recipe detail helpers
// ===============================
function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function extractSteps(details) {
  const analyzed = details?.analyzedInstructions;
  if (Array.isArray(analyzed) && analyzed.length && Array.isArray(analyzed[0].steps)) {
    return analyzed[0].steps.map(s => s.step).filter(Boolean);
  }
  if (typeof details?.instructions === "string" && details.instructions.trim()) {
    return details.instructions
      .replace(/<[^>]*>/g, "")
      .split(".")
      .map(s => s.trim())
      .filter(Boolean);
  }
  return [];
}

// ===============================
// Rendering
// ===============================
function renderRecipes(recipesArr) {
  recipesContainer.innerHTML = "";

  if (!recipesArr.length) {
    recipesContainer.innerHTML =
      `<p style="padding:16px;color:var(--color-muted);">No recipes found. Try a different search.</p>`;
    announce("No recipes found. Try a different search.");
    return;
  }

  recipesArr.forEach((recipe, idx) => {
    const card     = document.createElement("article");
    card.className = "recipe-card";
    card.dataset.id = recipe.id;
    // Make card keyboard-focusable (WCAG 2.1.1)
    card.setAttribute("tabindex", "0");
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${recipe.title || "Recipe"} — click for details`);

    const image   = escapeHtml(recipe.image || "./assets/stockimg.png");
    const title   = escapeHtml(recipe.title || "Recipe");
    const calories = getNutrient(recipe, "Calories");
    const carbs    = getNutrient(recipe, "Carbohydrates");
    const protein  = getNutrient(recipe, "Protein");
    const fat      = getNutrient(recipe, "Fat");

    card.innerHTML = `
  <div class="recipe-card__img-wrapper">
    <img
      class="recipe-card__img"
      src="${image}"
      alt="${title}"
      loading="${idx < 6 ? 'eager' : 'lazy'}"
      onerror="this.src='./assets/stockimg.png'; this.onerror=null;"
    >
  </div>
  <div class="recipe-card__body">
    <h3 class="recipe-card__title">${title}</h3>
    <div class="recipe-card__meta" aria-label="Nutrition info">
      <span><strong>Cal:</strong> ${calories ?? "—"}</span>
      <span><strong>Carbs:</strong> ${carbs ?? "—"}</span>
      <span><strong>Protein:</strong> ${protein ?? "—"}</span>
      <span><strong>Fat:</strong> ${fat ?? "—"}</span>
    </div>
  </div>
  <div class="recipe-card__overlay" aria-hidden="true">
    <div class="recipe-card__overlay-inner">
      <p class="recipe-card__overlay-title">${title}</p>
      <div class="recipe-card__overlay-content">
        <p class="muted">Press Enter or click to load recipe details…</p>
      </div>
      <button
        type="button"
        class="recipe-card__ingredients-btn is-disabled"
        aria-disabled="true"
        tabindex="-1"
      >
        <i class="fa-solid fa-list" aria-hidden="true"></i> Ingredient List
      </button>
      <a
      
        class="recipe-card__overlay-link is-disabled"
        href="#"
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled="true"
        tabindex="-1"
        aria-label="View full recipe for ${title} (opens in new tab)"
      >
        View Full Recipe →
      </a>
    </div>
  </div>
  <div class="recipe-card__ingredients-panel" aria-hidden="true">
    <h4 class="recipe-card__ingredients-title">Ingredients</h4>
    <ul class="recipe-card__ingredients-list"></ul>
    <div class="recipe-card__ingredients-actions">
      <button type="button" class="recipe-card__print-btn">
        <i class="fa-solid fa-print" aria-hidden="true"></i> Print
      </button>
      <button type="button" class="recipe-card__back-btn">
        <i class="fa-solid fa-arrow-left" aria-hidden="true"></i> Back
      </button>
    </div>
  </div>
`;

    recipesContainer.appendChild(card);
  });

  announce(`${recipesArr.length} recipe${recipesArr.length !== 1 ? "s" : ""} loaded.`);
}

function setCardOverlayContent(card, html) {
  const el = card.querySelector(".recipe-card__overlay-content");
  if (el) el.innerHTML = html;
  const overlay = card.querySelector(".recipe-card__overlay");
  if (overlay) overlay.setAttribute("aria-hidden", "false");
  card.classList.add("show-overlay");
}

function setCardOverlayLoading(card, text = "Loading recipe details…") {
  setCardOverlayContent(card, `<p class="muted">${escapeHtml(text)}</p>`);
}

function setCardOverlayError(card, text = "Couldn't load recipe details.") {
  setCardOverlayContent(card, `<p class="muted">${escapeHtml(text)}</p>`);
}

function printIngredientsForCard(card) {
  const titleEl = card.querySelector(".recipe-card__title");
  const listEl  = card.querySelector(".recipe-card__ingredients-list");
  if (!titleEl || !listEl) return;

  const printTitle = document.querySelector("#printIngredientsTitle");
  const printList  = document.querySelector("#printIngredientsList");
  if (!printTitle || !printList) return;

  printTitle.textContent = titleEl.textContent;
  printList.innerHTML = listEl.innerHTML;

  window.print();
}

// ===============================
// Card detail loader (shared by click + keyboard)
// ===============================
async function loadCardDetails(card) {
  const id = card.dataset.id;
  if (!id) return;
  if (card.dataset.loading === "1") return;

  // Already cached — just show
  if (recipeDetailsCache.has(id)) {
    const overlay = card.querySelector(".recipe-card__overlay");
    if (overlay) overlay.setAttribute("aria-hidden", "false");
    card.classList.add("show-overlay");
    return;
  }

  card.dataset.loading = "1";
  setCardOverlayLoading(card);

  try {
    const details     = await fetchRecipeDetails(id);
    recipeDetailsCache.set(id, details);

    const ingredients = (details.extendedIngredients || [])
      .slice(0, 8)
      .map(i => `<li>${escapeHtml(i.original)}</li>`)
      .join("");

    const steps = extractSteps(details)
      .slice(0, 3)
      .map(s => `<li>${escapeHtml(s)}</li>`)
      .join("");

    const ingredientsListEl = card.querySelector(".recipe-card__ingredients-list");
const ingredientsBtn    = card.querySelector(".recipe-card__ingredients-btn");

if (ingredientsListEl) {
  const fullIngredients = details.extendedIngredients || [];
  ingredientsListEl.innerHTML = fullIngredients.length
    ? fullIngredients.map(ing => {
        const { amountText, name } = formatIngredientAmount(ing);
        return `<li><span>${escapeHtml(name)}</span><span class="recipe-card__ingredient-amount">${escapeHtml(amountText)}</span></li>`;
      }).join("")
    : `<li>Ingredient details not available</li>`;
}

if (ingredientsBtn) {
  ingredientsBtn.classList.remove("is-disabled");
  ingredientsBtn.removeAttribute("aria-disabled");
  ingredientsBtn.removeAttribute("tabindex");
}

    setCardOverlayContent(card, `
      <div>
        <strong>Ingredients</strong>
        <ul>${ingredients || "<li>Not available</li>"}</ul>
      </div>
      <div>
        <strong>Steps</strong>
        <ol>${steps || "<li>Not available</li>"}</ol>
      </div>
    `);

    const link = details.sourceUrl
      ? details.sourceUrl
      : `https://spoonacular.com/recipes/${slugify(details.title)}-${details.id}`;

    const overlayLink = card.querySelector(".recipe-card__overlay-link");
if (overlayLink) {
  overlayLink.href = link;
  overlayLink.classList.remove("is-disabled");
  overlayLink.removeAttribute("aria-disabled");
  overlayLink.removeAttribute("tabindex");
}

  } catch (err) {
    console.error(err);
    setCardOverlayError(card, err.message || "Details failed to load.");
    const overlayLink = card.querySelector(".recipe-card__overlay-link");
if (overlayLink) {
  overlayLink.href = `https://spoonacular.com/recipes/${id}`;
  overlayLink.classList.remove("is-disabled");
  overlayLink.removeAttribute("aria-disabled");
  overlayLink.removeAttribute("tabindex");
}
  } finally {
    delete card.dataset.loading;
  }
}

// ===============================
// Hamburger / Mobile nav
// ===============================
function openMobileMenu() {
  if (!mobileMenu || !hamburgerBtn) return;
  mobileMenu.classList.add("is-open");
  mobileOverlay?.classList.add("is-open");
  hamburgerBtn.setAttribute("aria-expanded", "true");
  // Move focus to first link inside drawer (WCAG 2.4.3)
  const firstLink = mobileMenu.querySelector("a, button");
  firstLink?.focus();
}

function closeMobileMenu() {
  if (!mobileMenu || !hamburgerBtn) return;
  mobileMenu.classList.remove("is-open");
  mobileOverlay?.classList.remove("is-open");
  hamburgerBtn.setAttribute("aria-expanded", "false");
  hamburgerBtn.focus(); // return focus to trigger (WCAG 2.4.3)
}

hamburgerBtn?.addEventListener("click", () => {
  const isOpen = hamburgerBtn.getAttribute("aria-expanded") === "true";
  isOpen ? closeMobileMenu() : openMobileMenu();
});

// Clicking the overlay closes the drawer
mobileOverlay?.addEventListener("click", closeMobileMenu);

// ESC closes mobile menu when it's open
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (mobileMenu?.classList.contains("is-open")) {
      closeMobileMenu();
      return;
    }
    if (contactModal && !contactModal.classList.contains("hidden")) {
      closeContactModal();
      return;
    }
    if (!modal.classList.contains("hidden")) {
      closeModal();
    }
  }
});

// Trap focus inside mobile drawer while open (WCAG 2.1.2)
mobileMenu?.addEventListener("keydown", e => {
  if (e.key !== "Tab") return;
  const focusable = Array.from(
    mobileMenu.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')
  ).filter(el => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

contactModal?.addEventListener("keydown", e => {
  if (e.key !== "Tab" || contactModal.classList.contains("hidden")) return;
  const focusable = Array.from(
    contactModal.querySelectorAll('a, button, [tabindex]:not([tabindex="-1"])')
  ).filter(el => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

function goHome() {
  if (mobileMenu?.classList.contains("is-open")) closeMobileMenu();
  window.scrollTo({ top: 0 });
}

function goToSearch() {
  if (mobileMenu?.classList.contains("is-open")) closeMobileMenu();
  window.scrollTo({ top: 0 });
  setTimeout(() => searchInput?.focus(), 300);
}

// ===============================
// Search
// ===============================
async function runSearch() {
  const q = searchInput.value.trim();
  clearError();

  if (!q) {
    showError("Please enter a food or ingredient.");
    searchInput.focus();
    return;
  }

  setLoading(true);
  announce("Searching for recipes…");

  try {
    const recipes  = await fetchRecipes(q);
    currentRecipes = recipes;
    openModal(`Recipes for "${q}"`);
    const initialSort = sortSelect?.value || "";
    const displayList = initialSort
      ? sortRecipes(currentRecipes, initialSort)
      : currentRecipes;
    renderRecipes(displayList);
  } catch (err) {
    console.error(err);
    showError(err.message || "Could not fetch recipes. Please try again.");
  } finally {
    setLoading(false);
  }
}

searchBtn?.addEventListener("click", runSearch);

searchInput?.addEventListener("keydown", e => {
  if (e.key === "Enter") runSearch();
});

// Dismiss error when user starts typing again
searchInput?.addEventListener("input", clearError);

// ===============================
// Sort
// ===============================
sortSelect?.addEventListener("change", () => {
  const sorted = sortRecipes([...currentRecipes], sortSelect.value);
  renderRecipes(sorted);
});

// ===============================
// Card interaction (click + keyboard)
// ===============================
recipesContainer.addEventListener("click", e => {
  const printBtn = e.target.closest(".recipe-card__print-btn");
  if (printBtn) {
    const card = printBtn.closest(".recipe-card");
    if (card) printIngredientsForCard(card);
    return;
  }

  const backBtn = e.target.closest(".recipe-card__back-btn");
  if (backBtn) {
    const card  = backBtn.closest(".recipe-card");
    const panel = card?.querySelector(".recipe-card__ingredients-panel");
    panel?.setAttribute("aria-hidden", "true");
    card?.classList.remove("show-ingredients-panel");
    return;
  }

  const ingredientsBtn = e.target.closest(".recipe-card__ingredients-btn");
  if (ingredientsBtn) {
    if (ingredientsBtn.classList.contains("is-disabled")) return;
    const card  = ingredientsBtn.closest(".recipe-card");
    const panel = card?.querySelector(".recipe-card__ingredients-panel");
    panel?.setAttribute("aria-hidden", "false");
    card?.classList.add("show-ingredients-panel");
    return;
  }

  const link = e.target.closest(".recipe-card__overlay-link");
  if (link) {
    if (link.classList.contains("is-disabled")) e.preventDefault();
    return;
  }

  const card = e.target.closest(".recipe-card");
  if (!card) return;
  loadCardDetails(card);
});

// Keyboard: Enter or Space activates card (WCAG 2.1.1)
recipesContainer.addEventListener("keydown", e => {
  if (e.key !== "Enter" && e.key !== " ") return;
  if (e.target.closest("button, a")) return; // let the focused control's own click handle it
  const card = e.target.closest(".recipe-card");
  if (!card) return;
  e.preventDefault();
  loadCardDetails(card);
});

// ===============================
// Modal controls
// ===============================
closeModalBtn?.addEventListener("click", closeModal);

newSearchBtn?.addEventListener("click", () => {
  closeModal();
  searchInput?.focus();
});

// Click backdrop to close
modal?.addEventListener("click", e => {
  if (e.target === modal) closeModal();
});

// Trap focus inside modal while open (WCAG 2.1.2)
modal?.addEventListener("keydown", e => {
  if (e.key !== "Tab" || modal.classList.contains("hidden")) return;
  const focusable = Array.from(
    modal.querySelectorAll('a, button, select, input, [tabindex]:not([tabindex="-1"])')
  ).filter(el => !el.disabled && el.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});

// ===============================
// Demo fallback
// ===============================
function demoRecipes(query) {
  return [
    {
      id: "demo-1",
      title: `${query} Bowl`,
      image: "./assets/stockimg.png",
      nutrition: { nutrients: [
        { name: "Calories",      amount: 420, unit: "kcal" },
        { name: "Carbohydrates", amount: 35,  unit: "g"    },
        { name: "Protein",       amount: 30,  unit: "g"    },
        { name: "Fat",           amount: 18,  unit: "g"    },
      ]},
    },
    {
      id: "demo-2",
      title: `${query} Skillet`,
      image: "./assets/stockimg.png",
      nutrition: { nutrients: [
        { name: "Calories",      amount: 610, unit: "kcal" },
        { name: "Carbohydrates", amount: 50,  unit: "g"    },
        { name: "Protein",       amount: 22,  unit: "g"    },
        { name: "Fat",           amount: 28,  unit: "g"    },
      ]},
    },
    {
      id: "demo-3",
      title: `${query} Salad`,
      image: "./assets/stockimg.png",
      nutrition: { nutrients: [
        { name: "Calories",      amount: 280, unit: "kcal" },
        { name: "Carbohydrates", amount: 22,  unit: "g"    },
        { name: "Protein",       amount: 14,  unit: "g"    },
        { name: "Fat",           amount: 12,  unit: "g"    },
      ]},
    },
  ];
}

function demoRecipeDetails(id) {
  return {
    id,
    title: "Demo Recipe",
    sourceUrl: "https://spoonacular.com/",
    extendedIngredients: [
      { original: "1 cup demo ingredient" },
      { original: "2 tbsp demo spice"     },
      { original: "Salt to taste"         },
    ],
    analyzedInstructions: [{
      steps: [
        { step: "Mix ingredients together." },
        { step: "Cook over medium heat for 10 minutes." },
        { step: "Serve warm and enjoy."  },
      ],
    }],
  };
}