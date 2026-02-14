(function () {
    "use strict";

    // ── DOM ──
    const $ = (s) => document.querySelector(s);
    const mainImage    = $("#mainImage");
    const loader       = $("#loader");
    const errorMsg     = $("#errorMsg");
    const imageWrap    = $("#imageWrap");
    const downloadBtn  = $("#downloadBtn");
    const nextBtn      = $("#nextBtn");
    const retryBtn     = $("#retryBtn");
    const toggleBtn    = $("#toggleFilters");
    const filtersPanel = $("#filtersPanel");
    const nsfwToggle   = $("#nsfwToggle");
    const applyBtn     = $("#applyFilters");
    const tagsContainer  = $("#tagsContainer");
    const metaInfo       = $("#metaInfo");

    // waifu.pics selects
    const sfwSelect  = $("#sfwCategorySelect");
    const nsfwSelect = $("#nsfwCategorySelect");

    // sections
    const waifuimSection   = $("#waifuimTags");
    const waifupicsSection = $("#waifupicsCategories");

    // ── State ──
    let currentApi   = "waifuim";
    let isNsfw       = false;
    let selectedTags = [];
    let currentUrl   = null;
    let loading      = false;

    // ── waifu.im tags ──
    const WAIFUIM_SFW_TAGS  = [
        "waifu", "maid", "marin-kitagawa", "mori-calliope",
        "raiden-shogun", "oppai", "selfies", "uniform",
        "kamisato-ayaka", "genshin-impact"
    ];
    const WAIFUIM_NSFW_TAGS = [
        "ass", "hentai", "milf", "oral", "paizuri", "ecchi", "ero"
    ];

    // ── waifu.pics categories ──
    const WAIFUPICS_SFW = [
        "waifu", "neko", "shinobu", "megumin", "bully", "cuddle", "cry",
        "hug", "awoo", "kiss", "lick", "pat", "smug", "bonk", "yeet",
        "blush", "smile", "wave", "highfive", "handhold", "nom", "bite",
        "glomp", "slap", "kill", "kick", "happy", "wink", "poke", "dance", "cringe"
    ];
    const WAIFUPICS_NSFW = ["waifu", "neko", "trap", "blowjob"];

    // ── Overlay for mobile ──
    let overlay = document.createElement("div");
    overlay.className = "overlay";
    document.body.appendChild(overlay);

    // ── Init ──
    function init() {
        renderWaifuimTags();
        renderWaifupicsSelects();
        bindEvents();
        fetchImage();
    }

    // ── Render tags for waifu.im ──
    function renderWaifuimTags() {
        const tags = isNsfw
            ? [...WAIFUIM_SFW_TAGS, ...WAIFUIM_NSFW_TAGS]
            : WAIFUIM_SFW_TAGS;

        tagsContainer.innerHTML = "";
        tags.forEach((tag) => {
            const chip = document.createElement("button");
            chip.className = "tag-chip";
            chip.textContent = tag;
            if (selectedTags.includes(tag)) chip.classList.add("selected");

            chip.addEventListener("click", () => {
                chip.classList.toggle("selected");
                if (selectedTags.includes(tag)) {
                    selectedTags = selectedTags.filter((t) => t !== tag);
                } else {
                    selectedTags.push(tag);
                }
            });

            tagsContainer.appendChild(chip);
        });
    }

    // ── Render waifu.pics selects ──
    function renderWaifupicsSelects() {
        sfwSelect.innerHTML = WAIFUPICS_SFW
            .map((c) => `<option value="${c}">${c}</option>`)
            .join("");

        nsfwSelect.innerHTML = WAIFUPICS_NSFW
            .map((c) => `<option value="${c}">${c}</option>`)
            .join("");
    }

    // ── Events ──
    function bindEvents() {
        // Filter panel toggle
        toggleBtn.addEventListener("click", () => {
            const open = filtersPanel.classList.toggle("open");
            toggleBtn.classList.toggle("active", open);
            overlay.classList.toggle("visible", open);
        });

        overlay.addEventListener("click", closeFilters);

        // API source switch
        document.querySelectorAll('input[name="api"]').forEach((radio) => {
            radio.addEventListener("change", (e) => {
                currentApi = e.target.value;
                updateFilterSections();
            });
        });

        // NSFW toggle
        nsfwToggle.addEventListener("change", () => {
            isNsfw = nsfwToggle.checked;
            // cleanup tags that are no longer available
            if (!isNsfw) {
                selectedTags = selectedTags.filter(
                    (t) => !WAIFUIM_NSFW_TAGS.includes(t)
                );
            }
            renderWaifuimTags();
            updateNsfwSelects();
        });

        // Apply filters
        applyBtn.addEventListener("click", () => {
            closeFilters();
            fetchImage();
        });

        // Buttons
        nextBtn.addEventListener("click", () => fetchImage());
        retryBtn.addEventListener("click", () => fetchImage());
        downloadBtn.addEventListener("click", downloadImage);

        // Keyboard
        document.addEventListener("keydown", (e) => {
            if (e.key === "ArrowRight" || e.key === " ") {
                e.preventDefault();
                if (!loading) fetchImage();
            }
            if (e.key === "Escape") closeFilters();
        });
    }

    function closeFilters() {
        filtersPanel.classList.remove("open");
        toggleBtn.classList.remove("active");
        overlay.classList.remove("visible");
    }

    function updateFilterSections() {
        if (currentApi === "waifuim") {
            waifuimSection.classList.remove("filters__section--hidden");
            waifupicsSection.classList.add("filters__section--hidden");
        } else {
            waifuimSection.classList.add("filters__section--hidden");
            waifupicsSection.classList.remove("filters__section--hidden");
        }
    }

    function updateNsfwSelects() {
        if (isNsfw) {
            sfwSelect.classList.add("filters__select--hidden");
            nsfwSelect.classList.remove("filters__select--hidden");
        } else {
            sfwSelect.classList.remove("filters__select--hidden");
            nsfwSelect.classList.add("filters__select--hidden");
        }
    }

    // ── Fetch image ──
    async function fetchImage() {
        if (loading) return;
        loading = true;

        showLoader();
        hideError();
        downloadBtn.disabled = true;
        nextBtn.disabled = true;
        metaInfo.innerHTML = "";

        try {
            if (currentApi === "waifuim") {
                await fetchFromWaifuIm();
            } else {
                await fetchFromWaifuPics();
            }
        } catch (err) {
            console.error(err);
            showError();
        } finally {
            loading = false;
            nextBtn.disabled = false;
        }
    }

    // ── waifu.im ──
    async function fetchFromWaifuIm() {
        const params = new URLSearchParams();
        params.set("is_nsfw", isNsfw.toString());

        selectedTags.forEach((tag) => params.append("included_tags", tag));

        // if no tags selected, default to "waifu"
        if (selectedTags.length === 0) {
            params.append("included_tags", "waifu");
        }

        const res = await fetch(
            `https://api.waifu.im/images?${params.toString()}`
        );

        if (!res.ok) throw new Error(`waifu.im ${res.status}`);

        const data = await res.json();
        if (!data.items || data.items.length === 0) throw new Error("No images");

        const img = data.items[0];
        currentUrl = img.url;

        loadImage(img.url);

        // Meta
        let meta = "";
        if (img.tags && img.tags.length > 0) {
            meta += img.tags.map((t) => t.name).join(", ");
        }
        if (img.artists && img.artists.length > 0) {
            const artist = img.artists[0];
            if (artist.name) {
                meta += ` &middot; ${artist.name}`;
            }
        }
        if (img.source) {
            meta += ` &middot; <a href="${img.source}" target="_blank" rel="noopener">источник</a>`;
        }
        if (img.width && img.height) {
            meta += ` &middot; ${img.width}&times;${img.height}`;
        }
        metaInfo.innerHTML = meta;
    }

    // ── waifu.pics ──
    async function fetchFromWaifuPics() {
        const type = isNsfw ? "nsfw" : "sfw";
        const category = isNsfw ? nsfwSelect.value : sfwSelect.value;

        const res = await fetch(
            `https://api.waifu.pics/${type}/${category}`
        );

        if (!res.ok) throw new Error(`waifu.pics ${res.status}`);

        const data = await res.json();
        if (!data.url) throw new Error("No image URL");

        currentUrl = data.url;
        loadImage(data.url);
        metaInfo.innerHTML = `${type} / ${category}`;
    }

    // ── Load image into DOM ──
    function loadImage(url) {
        mainImage.classList.remove("loaded");
        // Only set crossOrigin for CORS-enabled sources (waifu.im)
        // waifu.pics CDN doesn't send Access-Control-Allow-Origin
        const supportsCors = currentApi === "waifuim";
        mainImage.crossOrigin = supportsCors ? "anonymous" : null;

        const img = new Image();
        if (supportsCors) img.crossOrigin = "anonymous";

        img.onload = () => {
            mainImage.src = url;
            mainImage.classList.add("loaded");
            hideLoader();
            downloadBtn.disabled = false;
        };

        img.onerror = () => {
            showError();
            hideLoader();
        };

        img.src = url;
    }

    // ── Download ──
    async function downloadImage() {
        if (!currentUrl) return;

        downloadBtn.disabled = true;
        try {
            if (currentApi !== "waifuim") {
                // waifu.pics doesn't support CORS — open in new tab
                window.open(currentUrl, "_blank");
                return;
            }
            const res = await fetch(currentUrl, { mode: "cors" });
            const blob = await res.blob();
            const ext = getExtension(currentUrl, blob.type);
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `waifu_${Date.now()}${ext}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(a.href);
        } catch {
            // Fallback: open in new tab
            window.open(currentUrl, "_blank");
        } finally {
            downloadBtn.disabled = false;
        }
    }

    function getExtension(url, mime) {
        const urlExt = url.match(/\.(png|jpg|jpeg|gif|webp)/i);
        if (urlExt) return "." + urlExt[1].toLowerCase();

        const mimeMap = {
            "image/png": ".png",
            "image/jpeg": ".jpg",
            "image/gif": ".gif",
            "image/webp": ".webp",
        };
        return mimeMap[mime] || ".png";
    }

    // ── UI helpers ──
    function showLoader() {
        loader.classList.remove("hidden");
    }
    function hideLoader() {
        loader.classList.add("hidden");
    }
    function showError() {
        errorMsg.classList.add("visible");
        hideLoader();
    }
    function hideError() {
        errorMsg.classList.remove("visible");
    }

    // ── Start ──
    init();
})();
