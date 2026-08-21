/* 首页：漫画检索列表 + 条件筛选 */
(function () {
  "use strict";

  var A = window.KIGUBI_APP;

  var ACTIVE_FILTERS = {};
  var KISS_DEFS = [];
  var NUDITY_DEFS = [];

  function buildFilterDefs() {
    KISS_DEFS = [{ id: "hasKiss", label: "亲吻" }];
    (A.listKissTagNames() || []).forEach(function (tag) {
      if (tag !== "亲吻") KISS_DEFS.push({ id: "tag:" + tag, label: tag, tag: tag });
    });

    NUDITY_DEFS = [{ id: "hasNudity", label: "ちくび" }];
    (A.listNudityTagNames() || []).forEach(function (tag) {
      if (tag !== "ちくび") NUDITY_DEFS.push({ id: "tag:" + tag, label: tag, tag: tag });
    });
  }

  function currentFilters() {
    var f = { tags: [] };
    KISS_DEFS.concat(NUDITY_DEFS).forEach(function (def) {
      if (!ACTIVE_FILTERS[def.id]) return;
      if (def.id === "hasKiss") f.hasKiss = true;
      else if (def.id === "hasNudity") f.hasNudity = true;
      else if (def.tag) f.tags.push(def.tag);
    });
    return f;
  }

  function init() {
    A.boot();
    buildFilterDefs();

    var grid = A.qs("#mangaGrid");
    var resultLabel = A.qs("#resultLabel");
    var searchInput = A.qs("#searchInput");
    var sortSelect = A.qs("#sortSelect");
    var kissCloud = A.qs("#kissFilterCloud");
    var nudityCloud = A.qs("#nudityFilterCloud");
    var clearFilters = A.qs("#clearFilters");

    renderFilterClouds(kissCloud, nudityCloud, clearFilters);

    function currentQuery() { return searchInput ? searchInput.value : ""; }
    function currentSort() { return sortSelect ? sortSelect.value : "title"; }

    function refresh() {
      renderGrid(grid, resultLabel, currentQuery(), currentSort());
    }

    if (searchInput) {
      var debounceTimer = null;
      searchInput.addEventListener("input", function () {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(refresh, 120);
      });
    }
    if (sortSelect) sortSelect.addEventListener("change", refresh);

    if (clearFilters) {
      clearFilters.addEventListener("click", function () {
        ACTIVE_FILTERS = {};
        renderFilterClouds(kissCloud, nudityCloud, clearFilters);
        refresh();
      });
    }

    refresh();
    maybeShowSpoilerModal();
  }

  /* ---------- 筛选 chips ---------- */

  function renderFilterClouds(kissCloud, nudityCloud, clearBtn) {
    if (kissCloud) renderFilterCloud(kissCloud, KISS_DEFS);
    if (nudityCloud) renderFilterCloud(nudityCloud, NUDITY_DEFS);

    var any = KISS_DEFS.concat(NUDITY_DEFS).some(function (def) {
      return !!ACTIVE_FILTERS[def.id];
    });
    if (clearBtn) clearBtn.style.display = any ? "" : "none";
  }

  function renderFilterCloud(container, defs) {
    container.textContent = "";

    defs.forEach(function (def) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip" + (ACTIVE_FILTERS[def.id] ? " selected" : "");
      chip.textContent = def.label;
      chip.addEventListener("click", function () {
        ACTIVE_FILTERS[def.id] = !ACTIVE_FILTERS[def.id];
        renderFilterClouds(A.qs("#kissFilterCloud"), A.qs("#nudityFilterCloud"), A.qs("#clearFilters"));
        renderGrid(A.qs("#mangaGrid"), A.qs("#resultLabel"),
          A.qs("#searchInput").value, A.qs("#sortSelect").value);
      });
      container.appendChild(chip);
    });
  }

  function maybeShowSpoilerModal() {
    var modal = A.qs("#spoilerModal");
    if (!modal) return;
    try {
      if (localStorage.getItem("kigubiSpoilerDismissed") === "1") return;
    } catch (e) { /* 隐私模式等情况下不阻断 */ }

    var checkbox = A.qs("#spoilerNever");
    var label = A.qs("#spoilerNeverLabel");
    var confirm = A.qs("#spoilerConfirm");
    if (!modal || !checkbox || !label || !confirm) return;

    modal.hidden = false;

    var seconds = 10;
    label.textContent = "我已了解本网站将会造成一定程度的百合漫画剧透且不提供任何资源，下次不再提示（" + seconds + " 秒后可勾选）";
    var timer = setInterval(function () {
      seconds -= 1;
      if (seconds <= 0) {
        clearInterval(timer);
        checkbox.disabled = false;
        label.textContent = "我已了解本网站将会造成一定程度的百合漫画剧透且不提供任何资源，下次不再提示";
      } else {
        label.textContent = "我已了解本网站将会造成一定程度的百合漫画剧透且不提供任何资源，下次不再提示（" + seconds + " 秒后可勾选）";
      }
    }, 1000);

    confirm.addEventListener("click", function () {
      try {
        if (checkbox.checked) localStorage.setItem("kigubiSpoilerDismissed", "1");
      } catch (e) { /* 忽略 */ }
      clearInterval(timer);
      modal.hidden = true;
    });
  }

  function renderGrid(grid, resultLabel, query, sortMode) {
    grid.textContent = "";
    var list = A.sortManga(A.filterManga(query, currentFilters()), sortMode);

    if (resultLabel) {
      resultLabel.textContent = "";
      resultLabel.appendChild(document.createTextNode("共 "));
      resultLabel.appendChild(A.makeEl("strong", null, String(list.length)));
      resultLabel.appendChild(document.createTextNode(" 部漫画"));
    }

    if (!list.length) {
      var empty = A.makeEl("div", "empty-state");
      empty.appendChild(A.makeEl("span", "big", "🫥"));
      empty.appendChild(A.makeEl("p", null, "没有匹配的漫画。试试减少筛选条件，或用更短的关键词。"));
      var submitLink = A.makeEl("a", "empty-cta", "＋ 提交这部漫画的数据");
      submitLink.href = "feedback.html";
      empty.appendChild(submitLink);
      empty.appendChild(A.makeEl("p", "empty-sub", "如果这部漫画还没有被收录，欢迎提交新增漫画。"));
      grid.appendChild(empty);
      return;
    }

    list.forEach(function (manga) {
      grid.appendChild(A.renderMangaCard(manga));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();