const controls = document.getElementById("controls");
const countInput = document.getElementById("count");
const status = document.getElementById("status");
const gallery = document.getElementById("gallery");
const cardTemplate = document.getElementById("card-template");

let allItems = [];

controls.addEventListener("submit", async (event) => {
  event.preventDefault();
  renderFromCount();
});

window.addEventListener("DOMContentLoaded", () => {
  loadSnapshot().catch((error) => {
    renderError(error instanceof Error ? error.message : "Could not load snapshot.");
  });
});

async function loadSnapshot() {
  const response = await fetch("./data/logos.json");
  if (!response.ok) {
    throw new Error(`Snapshot request failed with status ${response.status}`);
  }

  const payload = await response.json();
  allItems = Array.isArray(payload.items) ? payload.items : [];
  countInput.max = String(allItems.length || 100);
  countInput.value = String(Math.min(normalizeCount(countInput.value), allItems.length || 100));
  renderFromCount(payload.generatedAt);
}

function renderFromCount(generatedAt) {
  const maxCount = allItems.length || 100;
  const count = Math.max(1, Math.min(maxCount, normalizeCount(countInput.value)));
  countInput.value = String(count);

  const visibleItems = allItems.slice(0, count);
  renderGallery(visibleItems);

  const updatedLabel = generatedAt ? ` Snapshot: ${new Date(generatedAt).toLocaleDateString()}.` : "";
  status.textContent = `Showing ${visibleItems.length} of ${allItems.length} cached airport logos.${updatedLabel}`;
}

function renderGallery(items) {
  gallery.innerHTML = "";

  if (!items.length) {
    renderError("No logo snapshot items are available.");
    return;
  }

  for (const item of items) {
    const fragment = cardTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".logo-card");
    const image = fragment.querySelector(".logo-image");
    const name = fragment.querySelector(".logo-name");
    const detail = fragment.querySelector(".logo-detail");

    image.src = item.imageUrl;
    image.alt = `${item.name} logo`;
    image.addEventListener("load", () => {
      applyStageTheme(card, image);
    });
    image.addEventListener("error", () => {
      card.remove();
    });

    name.textContent = item.name;
    detail.textContent = [item.iata, item.country].filter(Boolean).join("  /  ");

    if (item.website) {
      card.addEventListener("click", () => window.open(item.website, "_blank", "noopener,noreferrer"));
      card.style.cursor = "pointer";
      card.title = "Open airport website";
    }

    gallery.appendChild(fragment);
  }
}

function renderError(message) {
  gallery.innerHTML = `<article class="error-card">${escapeHtml(message)}</article>`;
  status.textContent = "Static snapshot failed to load.";
}

function normalizeCount(value) {
  const count = Number.parseInt(String(value || "100"), 10);
  if (!Number.isFinite(count)) {
    return 100;
  }

  return count;
}

function applyStageTheme(card, image) {
  const stage = card.querySelector(".logo-stage");
  if (!stage) {
    return;
  }

  if (isMostlyWhiteLogo(image)) {
    stage.classList.add("is-dark");
  } else {
    stage.classList.remove("is-dark");
  }
}

function isMostlyWhiteLogo(image) {
  const sampleSize = 48;
  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return false;
  }

  context.clearRect(0, 0, sampleSize, sampleSize);

  const widthScale = sampleSize / Math.max(image.naturalWidth || 1, 1);
  const heightScale = sampleSize / Math.max(image.naturalHeight || 1, 1);
  const scale = Math.min(widthScale, heightScale);
  const drawWidth = Math.max(1, Math.round((image.naturalWidth || sampleSize) * scale));
  const drawHeight = Math.max(1, Math.round((image.naturalHeight || sampleSize) * scale));
  const offsetX = Math.floor((sampleSize - drawWidth) / 2);
  const offsetY = Math.floor((sampleSize - drawHeight) / 2);

  try {
    context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  } catch {
    return false;
  }

  const { data } = context.getImageData(0, 0, sampleSize, sampleSize);
  let visiblePixelCount = 0;
  let brightPixelCount = 0;
  let luminanceSum = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3];
    if (alpha < 20) {
      continue;
    }

    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;

    visiblePixelCount += 1;
    luminanceSum += luminance;

    if (luminance >= 235) {
      brightPixelCount += 1;
    }
  }

  if (visiblePixelCount < 40) {
    return false;
  }

  const averageLuminance = luminanceSum / visiblePixelCount;
  const brightRatio = brightPixelCount / visiblePixelCount;

  return averageLuminance >= 226 && brightRatio >= 0.82;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
