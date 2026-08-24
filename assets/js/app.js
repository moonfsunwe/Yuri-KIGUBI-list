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

  function getManga(title) {
    for (var i = 0; i < DATA.length; i++) {
      if (DATA[i].title === title) return DATA[i];
    }
    return null;
  }

  function searchText(manga) {
    var parts = [manga.title]
      .concat(manga.altTitles || [])
      .concat([manga.author || "", manga.status || ""]);
    (manga.tags || []).forEach(function (t) {
      parts.push(typeof t === "string" ? t : (t.name || ""));
      if (t && t.note) parts.push(t.note);
    });
    (manga.chapters || []).forEach(function (ch) {
      parts.push(ch.title || "", ch.note || "");
      (ch.tags || []).forEach(function (t) {
        parts.push(typeof t === "string" ? t : (t.name || ""));
      });
      (ch.kiss || []).forEach(function (s) {
        parts.push(s.characters || "", s.note || "");
        (s.tags || []).forEach(function (t) {
          parts.push(typeof t === "string" ? t : (t.name || ""));
        });
      });
      (ch.nudity || []).forEach(function (s) {
        parts.push(s.characters || "", s.note || "");
        (s.tags || []).forEach(function (t) {
          parts.push(typeof t === "string" ? t : (t.name || ""));
        });
      });
    });
    return normalize(parts.join(" "));
  }

  function tagName(t) {
    if (!t) return "";
    if (typeof t === "string") return t.trim();
    return String(t.name || "").trim();
  }

  function mangaTagNames(manga) {
    var set = {};
    function add(list) {
      (list || []).forEach(function (t) {
        var name = tagName(t);
        if (name) set[name] = true;
      });
    }
    add(manga.tags);
    (manga.chapters || []).forEach(function (ch) {
      add(ch.tags);
      (ch.kiss || []).forEach(function (s) { add(s && s.tags); });
      (ch.nudity || []).forEach(function (s) { add(s && s.tags); });
    });
    return Object.keys(set);
  }

  function listAllTagNames() {
    var set = {};
    DATA.forEach(function (manga) {
      mangaTagNames(manga).forEach(function (name) { set[name] = true; });
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, "zh-Hans-CN", { sensitivity: "base" });
    });
  }

  function listHalfTagNames(half) {
    var set = {};
    DATA.forEach(function (manga) {
      (manga.chapters || []).forEach(function (ch) {
        (ch[half] || []).forEach(function (scene) {
          (scene && scene.tags || []).forEach(function (t) {
            var name = tagName(t);
            if (name) set[name] = true;
          });
        });
      });
    });
    return Object.keys(set).sort(function (a, b) {
      return a.localeCompare(b, "zh-Hans-CN", { sensitivity: "base" });
    });
  }

  function listKissTagNames() {
    return listHalfTagNames("kiss");
  }

  function listNudityTagNames() {
    return listHalfTagNames("nudity");
  }

  /* ---------- 检索 / 排序 / 筛选 ---------- */

  function filterManga(query, filters) {
    var words = normalize(query).split(/\s+/).filter(Boolean);
    var f = filters || {};
    var filterTags = (f.tags || []).filter(Boolean);

    return DATA.filter(function (manga) {
      if (f.ongoing && manga.status !== "连载中") return false;
      if (f.finished && manga.status !== "已完结") return false;

      var counts = sceneCounts(manga);
      if (f.hasKiss && counts.kiss === 0) return false;
      if (f.hasNudity && counts.nudity === 0) return false;

      if (filterTags.length) {
        var tags = mangaTagNames(manga);
        if (!filterTags.every(function (name) { return tags.indexOf(name) !== -1; })) return false;
      }

      if (!words.length) return true;

      var hay = searchText(manga);
      return words.every(function (word) { return hay.indexOf(word) !== -1; });
    });
  }

  function sortManga(list, mode) {
    var copy = list.slice();
    if (mode === "chapters") {
      copy.sort(function (a, b) { return sceneCounts(b).chapters - sceneCounts(a).chapters || a.title.localeCompare(b.title, "zh-Hans-CN"); });
    } else { // 默认按标题
      copy.sort(function (a, b) { return a.title.localeCompare(b.title, "zh-Hans-CN", { sensitivity: "base" }); });
    }
    return copy;
  }

  /* ---------- 渲染：漫画卡片 ---------- */

  function renderMangaCard(manga) {
    var card = makeEl("article", "manga-card");
    var counts = sceneCounts(manga);

    var coverLink = makeEl("a", "manga-cover");
    coverLink.href = "manga.html?id=" + encodeURIComponent(manga.title);
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
    titleLink.href = "manga.html?id=" + encodeURIComponent(manga.title);
    title.appendChild(titleLink);
    body.appendChild(title);
    if (manga.author) {
      var authorBtn = makeEl("button", "manga-author");
      authorBtn.type = "button";
      authorBtn.textContent = manga.author;
      authorBtn.title = "按作者搜索：" + manga.author;
      authorBtn.addEventListener("click", function () {
        var input = qs("#searchInput");
        if (!input) return;
        input.value = manga.author;
        if (typeof input.dispatchEvent === "function") {
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      body.appendChild(authorBtn);
    }

    var meta = makeEl("div", "manga-meta");
    if (counts.kiss > 0) meta.appendChild(makeEl("span", "count-badge kiss", "亲吻"));
    if (counts.nudity > 0) meta.appendChild(makeEl("span", "count-badge nudity", "ちくび"));
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
      p.setAttribute("aria-label", kind === "kiss" ? "本话亲吻场景情况未知" : "本话ちくび情况未知");
      p.appendChild(makeEl("span", "record-unknown-pattern", "?   ?   ?   ?   ?   ?"));
      p.appendChild(makeEl("span", "record-unknown-text", kind === "kiss"
        ? "本话亲吻场景情况未知"
        : "本话ちくび情况未知"));
      return p;
    }
    return makeEl("p", "record-empty", kind === "kiss"
      ? "本话暂无亲吻场景记录。"
      : "本话暂无ちくび记录。");
  }

  var PINK_TAGS = ["舌吻", "拉丝", "喂食", "喂饮", "嘴角流血"];

  function normalizeTag(tag) {
    if (typeof tag === "string") return { name: tag, note: "", pink: PINK_TAGS.indexOf(tag) !== -1 };
    if (tag && tag.name) {
      return {
        name: String(tag.name),
        note: tag.note ? String(tag.note) : "",
        pink: tag.pink === true || tag.pink === 1 || tag.tone === "pink" || PINK_TAGS.indexOf(tag.name) !== -1
      };
    }
    return null;
  }

  function renderTagChips(tags) {
    var list = (tags || []).map(normalizeTag).filter(Boolean);
    if (!list.length) return null;

    var box = makeEl("div", "detail-tags tag-chips");
    list.forEach(function (tag) {
      var item = makeEl("span", "detail-tag-item");

      var chip = makeEl("span", "detail-tag", tag.name);

      if (tag.pink) {
        chip.classList.add("pink");
      }

      if (tag.note) {
        chip.classList.add("has-note");
        chip.appendChild(makeEl("span", "tag-note-mark", "i"));
        var tip = makeEl("span", "tag-tip", tag.note);
        item.appendChild(tip);
      }

      item.appendChild(chip);

      box.appendChild(item);
    });
    return box;
  }

  function sceneItemEl(scene, type) {
    var li = makeEl("li", "record-item " + type);

    if (scene.characters) {
      var top = makeEl("div", "record-top");
      top.appendChild(makeEl("span", "record-chars", scene.characters));
      li.appendChild(top);
    }

    if (scene.note) li.appendChild(makeEl("p", "record-note", scene.note));

    if (scene.tags && scene.tags.length) {
      var tagsBox = renderTagChips(scene.tags);
      if (tagsBox) li.appendChild(tagsBox);
    }
    return li;
  }

  function sceneBlock(chapter, type, unknown) {
    var block = makeEl("section", "record-panel");
    var head = makeEl("h4", "record-head " + type);
    head.appendChild(document.createTextNode(type === "kiss" ? "亲吻场景" : "ちくび"));
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
    listAllTagNames: listAllTagNames,
    listKissTagNames: listKissTagNames,
    listNudityTagNames: listNudityTagNames,
    renderMangaCard: renderMangaCard,
    renderTagChips: renderTagChips,
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