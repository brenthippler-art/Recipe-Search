// ===============================
// Smart Recipe Search Project (GitHub Pages + Vercel Proxy)
// ===============================

// ---- DOM ----
const searchInput = document.querySelector("#searchInput");
const searchBtn = document.querySelector("#searchBtn");
const searchBox = document.querySelector(".search");

const modal = document.querySelector("#resultsModal");
const modalTitle = document.querySelector("#modalTitle");
const recipesContainer = document.querySelector("#recipesContainer");
const sortSelect = document.querySelector("#sortSelect");
const newSearchBtn = document.querySelector("#newSearchBtn");
const closeModalBtn = document.querySelector("#closeModalBtn");

// ---- State ----
const recipeDetailsCache = new Map();
let currentRecipes = [];

const PROXY_BASE = "https://food-project-seven-eosin.vercel.app";

// Optional: if the API/proxy is down, flip this to true to demo UI
const DEMO_MODE = false;

// -------------------------------
// UI helpers
// -------------------------------
function openModal(titleText) {
  modalTitle.textContent = titleText;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  if (sortSelect) sortSelect.value = "calories_asc";
}

function closeModal() {
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  recipesContainer.innerHTML = "";
  currentRecipes = [];
  recipeDetailsCache.clear();
}

function setLoading(isLoading) {
  if (!searchBox) return;
  searchBox.classList.toggle("is-loading", isLoading);
  if (searchBtn) searchBtn.disabled = isLoading;
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// -------------------------------
// Proxy fetch helpers
// -------------------------------
async function fetchJson(url) {
  const res = await fetch(url);
  const text = await res.text();

  // Some errors are not JSON; handle safely
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || "Non-JSON response from server." };
  }

  if (!res.ok) {
    const msg =
      data?.error ||
      data?.message ||
      `Request failed (${res.status}).`;
    throw new Error(msg);
  }

  return data;
}

async function fetchRecipes(query) {
  if (DEMO_MODE) return demoRecipes(query);

  if (!PROXY_BASE || PROXY_BASE.includes("YOUR-VERCEL-APP")) {
    throw new Error(
      'Missing PROXY_BASE. Set it to your Vercel URL, e.g. "https://my-app.vercel.app".'
    );
  }

  const url = `${PROXY_BASE}/api/search?q=${encodeURIComponent(query)}&number=12`;
  const data = await fetchJson(url);
  return data?.results || [];
}

async function fetchRecipeDetails(id) {
  if (DEMO_MODE) return demoRecipeDetails(id);

  if (!PROXY_BASE || PROXY_BASE.includes("YOUR-VERCEL-APP")) {
    throw new Error(
      'Missing PROXY_BASE. Set it to your Vercel URL, e.g. "https://my-app.vercel.app".'
    );
  }

  const url = `${PROXY_BASE}/api/details?id=${encodeURIComponent(id)}`;
  return fetchJson(url);
}

// -------------------------------
// Nutrition helpers
// -------------------------------
function getNutrient(recipe, name) {
  const nutrients = recipe?.nutrition?.nutrients;
  if (!Array.isArray(nutrients)) return null;

  const found = nutrients.find(
    (x) => (x.name || "").toLowerCase() === name.toLowerCase()
  );

  return found && typeof found.amount === "number"
    ? `${found.amount} ${found.unit || ""}`.trim()
    : null;
}

function getMacroAmount(recipe, metric) {
  const map = {
    calories: "Calories",
    carbs: "Carbohydrates",
    protein: "Protein",
    fat: "Fat",
  };
  const nutrientName = map[metric];
  if (!nutrientName) return null;

  const nutrients = recipe?.nutrition?.nutrients;
  if (!Array.isArray(nutrients)) return null;

  const found = nutrients.find(
    (x) => (x.name || "").toLowerCase() === nutrientName.toLowerCase()
  );

  return found && typeof found.amount === "number" ? found.amount : null;
}

function sortRecipes(arr, sortValue) {
  if (!sortValue) return arr;

  const [metric, direction] = sortValue.split("_");
  if (!metric || !direction) return arr;

  return arr.sort((a, b) => {
    const aVal = getMacroAmount(a, metric);
    const bVal = getMacroAmount(b, metric);

    const aMissing = aVal === null;
    const bMissing = bVal === null;
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;

    return direction === "asc" ? aVal - bVal : bVal - aVal;
  });
}

// -------------------------------
// Details helpers
// -------------------------------
function slugify(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function extractSteps(details) {
  const analyzed = details?.analyzedInstructions;
  if (
    Array.isArray(analyzed) &&
    analyzed.length &&
    Array.isArray(analyzed[0].steps)
  ) {
    return analyzed[0].steps.map((s) => s.step).filter(Boolean);
  }

  if (typeof details?.instructions === "string" && details.instructions.trim()) {
    return details.instructions
      .replace(/<[^>]*>/g, "")
      .split(".")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}

// -------------------------------
// Rendering
// -------------------------------
function renderRecipes(recipesArr) {
  recipesContainer.innerHTML = "";

  recipesArr.forEach((recipe) => {
    const card = document.createElement("article");
    card.className = "recipe-card";
    card.dataset.id = recipe.id;

    const image = recipe.image || "./assets/placeholder-recipe.png";
    const title = recipe.title || "Recipe";

    const calories = getNutrient(recipe, "Calories");
    const carbs = getNutrient(recipe, "Carbohydrates");
    const protein = getNutrient(recipe, "Protein");
    const fat = getNutrient(recipe, "Fat");

    card.innerHTML = `
      <div class="recipe-card__img-wrapper">
        <img class="recipe-card__img" src="${image}" alt="${escapeHtml(title)}">
      </div>

      <div class="recipe-card__body">
        <h3 class="recipe-card__title">${escapeHtml(title)}</h3>
        <div class="recipe-card__meta">
          <span><strong>Cal:</strong> ${calories ?? "—"}</span>
          <span><strong>Carbs:</strong> ${carbs ?? "—"}</span>
          <span><strong>Protein:</strong> ${protein ?? "—"}</span>
          <span><strong>Fat:</strong> ${fat ?? "—"}</span>
        </div>
      </div>

      <div class="recipe-card__overlay">
        <div class="recipe-card__overlay-inner">
          <p class="recipe-card__overlay-title">${escapeHtml(title)}</p>
          <div class="recipe-card__overlay-content">
            <p class="muted">Click card to load recipe details…</p>
          </div>
          <a class="recipe-card__overlay-link" href="#" target="_blank" rel="noopener">
            View Full Recipe →
          </a>
        </div>
      </div>
    `;

    recipesContainer.appendChild(card);
  });
}

function setCardOverlayLoading(card, text = "Loading recipe…") {
  const overlayContent = card.querySelector(".recipe-card__overlay-content");
  overlayContent.innerHTML = `<p class="muted">${escapeHtml(text)}</p>`;
  card.classList.add("show-overlay");
}

function setCardOverlayError(card, text = "Couldn’t load recipe details.") {
  const overlayContent = card.querySelector(".recipe-card__overlay-content");
  overlayContent.innerHTML = `<p class="muted">${escapeHtml(text)}</p>`;
  card.classList.add("show-overlay");
}

// -------------------------------
// Events
// -------------------------------

// Click card to load details (saves API calls vs hover)
recipesContainer.addEventListener("click", async (e) => {
  const card = e.target.closest(".recipe-card");
  if (!card) return;

  const id = card.dataset.id;
  if (!id) return;

  const overlayLink = card.querySelector(".recipe-card__overlay-link");

  if (card.dataset.loading === "1") return;

  // If cached, just show it
  if (recipeDetailsCache.has(id)) {
    card.classList.add("show-overlay");
    return;
  }

  card.dataset.loading = "1";
  setCardOverlayLoading(card);

  try {
    const details = await fetchRecipeDetails(id);
    recipeDetailsCache.set(id, details);

    const ingredients = (details.extendedIngredients || [])
      .slice(0, 8)
      .map((i) => `<li>${escapeHtml(i.original)}</li>`)
      .join("");

    const steps = extractSteps(details)
      .slice(0, 3)
      .map((s) => `<li>${escapeHtml(s)}</li>`)
      .join("");

    const overlayContent = card.querySelector(".recipe-card__overlay-content");
    overlayContent.innerHTML = `
      <div>
        <strong>Ingredients</strong>
        <ul>${ingredients || "<li>Not available</li>"}</ul>
      </div>
      <div>
        <strong>Steps</strong>
        <ol>${steps || "<li>Not available</li>"}</ol>
      </div>
    `;

    const link = details.sourceUrl
      ? details.sourceUrl
      : `https://spoonacular.com/recipes/${slugify(details.title)}-${details.id}`;

    overlayLink.href = link;
    card.classList.add("show-overlay");
  } catch (err) {
    console.error(err);
    setCardOverlayError(card, err.message || "Details failed.");
    overlayLink.href = `https://spoonacular.com/recipes/${id}`;
  } finally {
    delete card.dataset.loading;
  }
});

// Search button
searchBtn.addEventListener("click", async () => {
  const q = searchInput.value.trim();
  if (!q) return alert("Please enter a food or ingredient");

  setLoading(true);

  try {
    const recipes = await fetchRecipes(q);
    currentRecipes = recipes;

    openModal(`Recipes for "${q}"`);

    if (!currentRecipes.length) {
      recipesContainer.innerHTML =
        `<p style="padding:16px;">No recipes found. Try a different search.</p>`;
      return;
    }

    const initialSort = sortSelect?.value || "";
    const displayList = initialSort
      ? sortRecipes([...currentRecipes], initialSort)
      : currentRecipes;

    renderRecipes(displayList);
  } catch (err) {
    console.error(err);
    alert(err.message || "Could not fetch recipes. Try again.");
  } finally {
    setLoading(false);
  }
});

// Enter key triggers search
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchBtn.click();
});

// Sort
if (sortSelect) {
  sortSelect.addEventListener("change", () => {
    const sorted = sortRecipes([...currentRecipes], sortSelect.value);
    renderRecipes(sorted);
  });
}

// New search
if (newSearchBtn) {
  newSearchBtn.addEventListener("click", () => {
    closeModal();
    searchInput.focus();
  });
}

// Close modal button
if (closeModalBtn) {
  closeModalBtn.addEventListener("click", closeModal);
}

// Click outside panel closes modal
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});

// ESC closes modal
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
});

// -------------------------------
// Demo fallback (optional)
// -------------------------------
function demoRecipes(query) {
  return [
    {
      id: "demo-1",
      title: `${query} Bowl`,
      image: "./assets/placeholder-recipe.png",
      nutrition: {
        nutrients: [
          { name: "Calories", amount: 420, unit: "kcal" },
          { name: "Carbohydrates", amount: 35, unit: "g" },
          { name: "Protein", amount: 30, unit: "g" },
          { name: "Fat", amount: 18, unit: "g" },
        ],
      },
    },
    {
      id: "demo-2",
      title: `${query} Skillet`,
      image: "./assets/placeholder-recipe.png",
      nutrition: {
        nutrients: [
          { name: "Calories", amount: 610, unit: "kcal" },
          { name: "Carbohydrates", amount: 50, unit: "g" },
          { name: "Protein", amount: 22, unit: "g" },
          { name: "Fat", amount: 28, unit: "g" },
        ],
      },
    },
    {
      id: "demo-3",
      title: `${query} Salad`,
      image: "./assets/placeholder-recipe.png",
      nutrition: {
        nutrients: [
          { name: "Calories", amount: 280, unit: "kcal" },
          { name: "Carbohydrates", amount: 22, unit: "g" },
          { name: "Protein", amount: 14, unit: "g" },
          { name: "Fat", amount: 12, unit: "g" },
        ],
      },
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
      { original: "2 tbsp demo spice" },
      { original: "Salt to taste" },
    ],
    analyzedInstructions: [
      {
        steps: [
          { step: "Mix ingredients." },
          { step: "Cook for 10 minutes." },
          { step: "Serve and enjoy." },
        ],
      },
    ],
  };
}
