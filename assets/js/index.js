/* 首页：漫画检索列表 + 条件筛选 */
(function () {
  "use strict";

  var A = window.KIGUBI_APP;

  var ACTIVE_FILTERS = { ongoing: false, finished: false, hasKiss: false, hasNudity: false };
  var FILTER_DEFS = [
    { id: "ongoing", label: "连载中" },
    { id: "finished", label: "已完结" },
    { id: "hasKiss", label: "有亲吻" },
    { id: "hasNudity", label: "有露点" }
  ];

  function init() {
    A.boot();

    var grid = A.qs("#mangaGrid");
    var resultLabel = A.qs("#resultLabel");
    var searchInput = A.qs("#searchInput");
    var sortSelect = A.qs("#sortSelect");
    var filterCloud = A.qs("#filterCloud");
    var clearFilters = A.qs("#clearFilters");

    renderOverviewStats();
    renderFilterChips(filterCloud, clearFilters);

    function currentQuery() { return searchInput ? searchInput.value : ""; }
    function currentSort() { return sortSelect ? sortSelect.value : "recent"; }

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
        ACTIVE_FILTERS.ongoing = false;
        ACTIVE_FILTERS.finished = false;
        ACTIVE_FILTERS.hasKiss = false;
        ACTIVE_FILTERS.hasNudity = false;
        renderFilterChips(filterCloud, clearFilters);
        refresh();
      });
    }

    refresh();
  }

  function renderOverviewStats() {
    var kiss = 0;
    var nudity = 0;
    A.DATA.forEach(function (m) {
      var c = A.sceneCounts(m);
      kiss += c.kiss;
      nudity += c.nudity;
    });
    A.setText(A.qs("#statManga"), String(A.DATA.length));
    A.setText(A.qs("#statKiss"), String(kiss));
    A.setText(A.qs("#statNudity"), String(nudity));
  }

  function renderFilterChips(container, clearBtn) {
    container.textContent = "";

    FILTER_DEFS.forEach(function (def) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "filter-chip" + (ACTIVE_FILTERS[def.id] ? " selected" : "");
      chip.textContent = def.label;
      chip.addEventListener("click", function () {
        var nextValue = !ACTIVE_FILTERS[def.id];
        ACTIVE_FILTERS[def.id] = nextValue;

        // 连载中 / 已完结 互斥
        if (nextValue) {
          if (def.id === "ongoing") ACTIVE_FILTERS.finished = false;
          if (def.id === "finished") ACTIVE_FILTERS.ongoing = false;
        }

        renderFilterChips(container, clearBtn);
        renderGrid(A.qs("#mangaGrid"), A.qs("#resultLabel"),
          A.qs("#searchInput").value, A.qs("#sortSelect").value);
      });
      container.appendChild(chip);
    });

    var any = FILTER_DEFS.some(function (def) { return ACTIVE_FILTERS[def.id]; });
    clearBtn.style.display = any ? "" : "none";
  }

  function renderGrid(grid, resultLabel, query, sortMode) {
    grid.textContent = "";
    var list = A.sortManga(A.filterManga(query, ACTIVE_FILTERS), sortMode);

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