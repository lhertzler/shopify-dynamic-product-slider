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
      ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.image_alt || product.title || "") + '" loading="lazy">'
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

  function buildSkeletonCard() {
    return (
      '<article class="dynamic-product-slider__card dynamic-product-slider__card--skeleton">' +
      '<div class="dynamic-product-slider__card-image dynamic-product-slider__skeleton"></div>' +
      '<div class="dynamic-product-slider__card-meta">' +
      '<div class="dynamic-product-slider__skeleton dynamic-product-slider__skeleton-title"></div>' +
      '<div class="dynamic-product-slider__skeleton dynamic-product-slider__skeleton-price"></div>' +
      "</div>" +
      "</article>"
    );
  }

  function getConfig(root) {
    return {
      initialSource: root.getAttribute("data-initial-source") || "manual",
      limit: root.getAttribute("data-limit") || "15",
      featuredCollection: root.getAttribute("data-featured-collection") || "",
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

  function unslick(track) {
    if (!window.jQuery || !window.jQuery.fn || !window.jQuery.fn.slick) {
      return;
    }

    var $track = window.jQuery(track);

    if ($track.hasClass("slick-initialized")) {
      $track.slick("unslick");
    }
  }

  function getItemsForCurrentViewport(config) {
    if (window.innerWidth < 750) {
      return Number(config.mobileItems || 2);
    }

    if (window.innerWidth < 1024) {
      return Number(config.tabletItems || 3);
    }

    return Number(config.desktopItems || 5);
  }

  function renderSkeleton(root) {
    var track = root.querySelector("[data-dynamic-product-slider-track]");
    var config = getConfig(root);
    var count = Math.max(1, getItemsForCurrentViewport(config));
    var skeletons = [];

    if (!track) {
      return;
    }

    unslick(track);

    for (var index = 0; index < count; index += 1) {
      skeletons.push(buildSkeletonCard());
    }

    track.innerHTML = skeletons.join("");
    track.classList.add("dynamic-product-slider__track--skeleton");
    track.setAttribute("aria-hidden", "true");
  }

  function renderEmpty(root) {
    var track = root.querySelector("[data-dynamic-product-slider-track]");

    if (!track) {
      return;
    }

    unslick(track);
    track.innerHTML = '<p class="dynamic-product-slider__empty">No products returned for this source yet.</p>';
    track.classList.remove("dynamic-product-slider__track--skeleton");
    track.removeAttribute("aria-hidden");
  }

  function renderProducts(root, products) {
    var viewport = root.querySelector("[data-dynamic-product-slider-viewport]");
    var track = root.querySelector("[data-dynamic-product-slider-track]");
    var config = getConfig(root);

    if (!viewport || !track) {
      return;
    }

    unslick(track);
    track.innerHTML = products.map(buildProductCard).join("");
    track.classList.remove("dynamic-product-slider__track--skeleton");
    track.removeAttribute("aria-hidden");
    viewport.hidden = false;

    initSlick(track, config, products.length);
  }

  function initSlick(track, config, productCount) {
    if (!window.jQuery || !window.jQuery.fn || !window.jQuery.fn.slick) {
      return;
    }

    var $track = window.jQuery(track);

    if ($track.hasClass("slick-initialized")) {
      $track.slick("unslick");
    }

    if (productCount <= Number(config.desktopItems || 5)) {
      return;
    }

    $track.slick({
      arrows: true,
      dots: true,
      infinite: false,
      slidesToShow: Number(config.desktopItems || 5),
      slidesToScroll: Number(config.desktopItems || 5),
      speed: 300,
      responsive: [
        {
          breakpoint: 1024,
          settings: {
            slidesToShow: Number(config.tabletItems || 3),
            slidesToScroll: Number(config.tabletItems || 3)
          }
        },
        {
          breakpoint: 750,
          settings: {
            slidesToShow: Number(config.mobileItems || 2),
            slidesToScroll: Number(config.mobileItems || 2)
          }
        }
      ]
    });
  }

  function getSourceCacheKey(config, source) {
    if (source === "featured") {
      return source + ":" + config.featuredCollection;
    }

    return source;
  }

  function setActiveTab(root, source) {
    var tabs = root.querySelectorAll("[data-dynamic-product-slider-tab]");

    tabs.forEach(function (tab) {
      var isActive = tab.getAttribute("data-dynamic-product-slider-tab") === source;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", isActive ? "true" : "false");
    });
  }

  function loadSource(root, source) {
    var config = getConfig(root);
    var cacheKey = getSourceCacheKey(config, source);
    var cached = root._dynamicProductSliderCache && root._dynamicProductSliderCache[cacheKey];
    var endpoint = new URL(ENDPOINT_PATH, window.location.origin);

    setActiveTab(root, source);
    root.setAttribute("data-active-source", source);

    if (cached) {
      renderProducts(root, cached);
      return;
    }

    renderSkeleton(root);

    endpoint.searchParams.set("source", source);
    endpoint.searchParams.set("limit", config.limit);
    if (source === "featured" && config.featuredCollection) {
      endpoint.searchParams.set("collection", config.featuredCollection);
    }

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
          root.setAttribute("data-dynamic-product-slider-empty", "true");
          renderEmpty(root);
          return;
        }

        root._dynamicProductSliderCache = root._dynamicProductSliderCache || {};
        root._dynamicProductSliderCache[cacheKey] = products;
        root.removeAttribute("data-dynamic-product-slider-empty");
        root.removeAttribute("data-dynamic-product-slider-error");
        renderProducts(root, products);
      })
      .catch(function () {
        root.setAttribute("data-dynamic-product-slider-error", "true");
        renderEmpty(root);
      });
  }

  function bindTabs(root) {
    var tabs = root.querySelectorAll("[data-dynamic-product-slider-tab]");

    tabs.forEach(function (tab) {
      if (tab.getAttribute("data-dynamic-product-slider-tab-bound") === "true") {
        return;
      }

      tab.setAttribute("data-dynamic-product-slider-tab-bound", "true");
      tab.addEventListener("click", function () {
        var source = tab.getAttribute("data-dynamic-product-slider-tab") || "manual";
        loadSource(root, source);
      });
    });
  }

  function init(root) {
    if (!root || root.getAttribute("data-dynamic-product-slider-ready") === "true") {
      return;
    }

    root.setAttribute("data-dynamic-product-slider-ready", "true");

    var config = getConfig(root);
    setGridVars(root, config);
    bindTabs(root);
    loadSource(root, config.initialSource);
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
