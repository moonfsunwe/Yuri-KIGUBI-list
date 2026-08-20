/* 共享工具与渲染函数：列表页、详情页、数据提交页都会加载 */
(function () {
  "use strict";

  var CFG = window.KIGUBI_CONFIG || {};
  var DATA = window.KIGUBI_DATA || [];

  /* ---------- 基础工具 ---------- */

  function qs(selector, ctx) {
    return (ctx || document).querySelector(selector);
  }
  function qsa(selector, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(selector));
  }
  function normalize(value) {
    return String(value == null ? "" : value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ");
  }
  function makeEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }
  function setText(el, text) {
    el.textContent = text;
    return el;
  }

  /* ---------- 数据统计 ---------- */

  function sceneCounts(manga) {
    var kiss = 0;
    var nudity = 0;
    var chapters = 0;
    (manga.chapters || []).forEach(function (ch) {
      chapters += 1;
      kiss += (ch.kiss || []).length;
      nudity += (ch.nudity || []).length;
    });
    return { kiss: kiss, nudity: nudity, chapters: chapters };
  }

  function getManga(slug) {
    for (var i = 0; i < DATA.length; i++) {
      if (DATA[i].slug === slug) return DATA[i];
    }
    return null;
  }

  function searchText(manga) {
    var parts = [manga.title]
      .concat(manga.altTitles || [])
      .concat([manga.author || "", manga.status || ""]);
    (manga.chapters || []).forEach(function (ch) {
      parts.push(ch.title || "");
      (ch.kiss || []).forEach(function (s) { parts.push(s.characters || "", s.note || ""); });
      (ch.nudity || []).forEach(function (s) { parts.push(s.characters || "", s.note || ""); });
    });
    return normalize(parts.join(" "));
  }

  /* ---------- 检索 / 排序 / 筛选 ---------- */

  function filterManga(query, filters) {
    var words = normalize(query).split(/\s+/).filter(Boolean);
    var f = filters || {};

    return DATA.filter(function (manga) {
      if (f.ongoing && manga.status !== "连载中") return false;

      var counts = sceneCounts(manga);
      if (f.hasKiss && counts.kiss === 0) return false;
      if (f.hasNudity && counts.nudity === 0) return false;

      if (!words.length) return true;

      var hay = searchText(manga);
      return words.every(function (word) { return hay.indexOf(word) !== -1; });
    });
  }

  function sortManga(list, mode) {
    var copy = list.slice();
    if (mode === "title") {
      copy.sort(function (a, b) { return a.title.localeCompare(b.title, "zh-Hans-CN", { sensitivity: "base" }); });
    } else if (mode === "chapters") {
      copy.sort(function (a, b) { return sceneCounts(b).chapters - sceneCounts(a).chapters || a.title.localeCompare(b.title, "zh-Hans-CN"); });
    } else { // recent
      copy.sort(function (a, b) {
        return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")) ||
          a.title.localeCompare(b.title, "zh-Hans-CN");
      });
    }
    return copy;
  }

  /* ---------- 渲染：漫画卡片 ---------- */

  function renderMangaCard(manga) {
    var card = makeEl("article", "manga-card");
    var counts = sceneCounts(manga);

    var coverLink = makeEl("a", "manga-cover");
    coverLink.href = "manga.html?id=" + encodeURIComponent(manga.slug);
    coverLink.setAttribute("aria-label", manga.title);

    var fallback = makeEl("span", "cover-fallback");
    fallback.appendChild(makeEl("span", "full", manga.title.charAt(0) || "?"));

    var img = new Image();
    img.alt = manga.title + " 封面";
    img.loading = "lazy";
    img.addEventListener("error", function () {
      img.remove();
      fallback.style.display = "";
    });
    if (manga.cover) {
      img.src = manga.cover;
      fallback.style.display = "none";
    }
    coverLink.appendChild(fallback);
    if (manga.cover) coverLink.appendChild(img);

    if (manga.status) coverLink.appendChild(makeEl("span", "status-badge", manga.status));
    if (manga.demo) coverLink.appendChild(makeEl("span", "demo-badge", "示例"));

    var body = makeEl("div", "manga-body");
    var title = makeEl("h3", "manga-title");
    var titleLink = makeEl("a", null, manga.title);
    titleLink.href = "manga.html?id=" + encodeURIComponent(manga.slug);
    title.appendChild(titleLink);
    body.appendChild(title);
    body.appendChild(makeEl("p", "manga-author", manga.author || ""));

    var meta = makeEl("div", "manga-meta");
    meta.appendChild(makeEl("span", "count-badge kiss", "亲吻 " + counts.kiss));
    meta.appendChild(makeEl("span", "count-badge nudity", "露点 " + counts.nudity));
    meta.appendChild(makeEl("span", "count-badge chapters", counts.chapters + " 话"));
    body.appendChild(meta);

    card.appendChild(coverLink);
    card.appendChild(body);
    return card;
  }

  /* ---------- 渲染：场景条目 ---------- */

  function emptyRecord(kind, unknown) {
    if (unknown) {
      var p = makeEl("p", "record-empty unknown");
      p.setAttribute("aria-label", kind === "kiss" ? "本话亲吻场景情况未知" : "本话露点场景情况未知");
      p.appendChild(makeEl("span", "record-unknown-pattern", "?   ?   ?   ?   ?   ?"));
      p.appendChild(makeEl("span", "record-unknown-text", kind === "kiss"
        ? "本话亲吻场景情况未知"
        : "本话露点场景情况未知"));
      return p;
    }
    return makeEl("p", "record-empty", kind === "kiss"
      ? "本话暂无亲吻场景记录。"
      : "本话暂无露点场景记录。");
  }

  function sceneItemEl(scene, type) {
    var li = makeEl("li", "record-item " + type);

    if (scene.characters) {
      var top = makeEl("div", "record-top");
      top.appendChild(makeEl("span", "record-chars", scene.characters));
      li.appendChild(top);
    }

    if (scene.note) li.appendChild(makeEl("p", "record-note", scene.note));
    return li;
  }

  function sceneBlock(chapter, type, unknown) {
    var block = makeEl("section", "record-panel");
    var head = makeEl("h4", "record-head " + type);
    head.appendChild(document.createTextNode(type === "kiss" ? "亲吻场景" : "露点场景"));
    block.appendChild(head);

    var list = makeEl("ul", "record-list");
    var scenes = chapter[type] || [];
    if (!scenes.length || unknown) {
      list.appendChild(emptyRecord(type, unknown));
    } else {
      scenes.forEach(function (scene) { list.appendChild(sceneItemEl(scene, type)); });
    }
    block.appendChild(list);
    return block;
  }

  /* ---------- 导航高亮 ---------- */

  function setActiveNav() {
    var fileName = (window.location.pathname.split("/").pop() || "index.html");
    if (!fileName) fileName = "index.html";
    qsa("[data-nav]").forEach(function (link) {
      var href = (link.getAttribute("href") || "").split("/").pop();
      var active = href === fileName;
      if (active) link.classList.add("active");
      else link.classList.remove("active");
    });
  }

  /* ---------- 页脚年份 ---------- */

  function hydrateYear() {
    var el = qs("[data-year]");
    if (el) el.textContent = String(new Date().getFullYear());
  }

  window.KIGUBI_APP = {
    CFG: CFG,
    DATA: DATA,
    qs: qs,
    qsa: qsa,
    normalize: normalize,
    makeEl: makeEl,
    setText: setText,
    sceneCounts: sceneCounts,
    getManga: getManga,
    filterManga: filterManga,
    sortManga: sortManga,
    renderMangaCard: renderMangaCard,
    sceneItemEl: sceneItemEl,
    sceneBlock: sceneBlock,
    setActiveNav: setActiveNav,
    hydrateYear: hydrateYear,
    boot: function () {
      setActiveNav();
      hydrateYear();
    }
  };
})();