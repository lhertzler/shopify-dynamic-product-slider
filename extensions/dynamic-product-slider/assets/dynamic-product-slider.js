(function () {
  var ENDPOINT_PATH = "/apps/dynamic-product-slider/products";

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(cents) {
    var themeGlobal = window.theme;

    if (themeGlobal && themeGlobal.Currency && themeGlobal.settings && themeGlobal.settings.moneyFormat) {
      return themeGlobal.Currency.formatMoney(cents, themeGlobal.settings.moneyFormat);
    }

    return "$" + (Number(cents || 0) / 100).toFixed(2);
  }

  function buildProductCard(product) {
    var image = product.featured_image || product.image || "";
    var imageMarkup = image
      ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.title || "") + '" loading="lazy">'
      : "";

    return (
      '<article class="dynamic-product-slider__card">' +
      '<a class="dynamic-product-slider__card-link" href="' +
      escapeHtml(product.url || (product.handle ? "/products/" + product.handle : "#")) +
      '">' +
      '<div class="dynamic-product-slider__card-image">' +
      imageMarkup +
      "</div>" +
      '<div class="dynamic-product-slider__card-meta">' +
      '<h3 class="dynamic-product-slider__card-title">' +
      escapeHtml(product.title || "Product") +
      "</h3>" +
      '<div class="dynamic-product-slider__card-price">' +
      formatMoney(product.price || product.price_min || 0) +
      "</div>" +
      "</div>" +
      "</a>" +
      "</article>"
    );
  }

  function getConfig(root) {
    return {
      source: root.getAttribute("data-source") || "manual",
      limit: root.getAttribute("data-limit") || "15",
      mobileItems: root.getAttribute("data-mobile-items") || "2",
      tabletItems: root.getAttribute("data-tablet-items") || "3",
      desktopItems: root.getAttribute("data-desktop-items") || "5"
    };
  }

  function setGridVars(root, config) {
    root.style.setProperty("--dynamic-product-slider-items", config.mobileItems);
    root.style.setProperty("--dynamic-product-slider-tablet-items", config.tabletItems);
    root.style.setProperty("--dynamic-product-slider-desktop-items", config.desktopItems);
  }

  function setStatus(root, message) {
    var status = root.querySelector("[data-dynamic-product-slider-status]");
    if (status) {
      status.textContent = message;
      status.hidden = false;
    }
  }

  function renderProducts(root, products) {
    var viewport = root.querySelector("[data-dynamic-product-slider-viewport]");
    var track = root.querySelector("[data-dynamic-product-slider-track]");
    var status = root.querySelector("[data-dynamic-product-slider-status]");

    if (!viewport || !track) {
      return;
    }

    track.innerHTML = products.map(buildProductCard).join("");
    viewport.hidden = false;

    if (status) {
      status.hidden = true;
    }
  }

  function init(root) {
    if (!root || root.getAttribute("data-dynamic-product-slider-ready") === "true") {
      return;
    }

    root.setAttribute("data-dynamic-product-slider-ready", "true");

    var config = getConfig(root);
    var endpoint = new URL(ENDPOINT_PATH, window.location.origin);
    endpoint.searchParams.set("source", config.source);
    endpoint.searchParams.set("limit", config.limit);

    setGridVars(root, config);

    fetch(endpoint.toString(), { credentials: "same-origin" })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Dynamic product source failed");
        }

        return response.json();
      })
      .then(function (payload) {
        var products = Array.isArray(payload.products) ? payload.products : [];

        if (!products.length) {
          setStatus(root, payload.message || "No products returned for this source yet.");
          return;
        }

        renderProducts(root, products);
      })
      .catch(function () {
        setStatus(root, "Dynamic products are unavailable right now.");
      });
  }

  function initAll() {
    document.querySelectorAll("[data-dynamic-product-slider]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }

  document.addEventListener("shopify:section:load", initAll);
})();
