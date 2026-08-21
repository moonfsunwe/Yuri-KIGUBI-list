/* 详情页：单部漫画的章节与亲吻/ちくび记录（折叠 / 详细两种模式） */
(function () {
  "use strict";

  var A = window.KIGUBI_APP;
  var state = { mode: "collapsed" };

  function init() {
    A.boot();

    var root = A.qs("#detail");
    if (!root) return;

    var title = new URLSearchParams(window.location.search).get("id");
    var manga = title ? A.getManga(title) : null;

    if (!manga) {
      renderMissing(root);
      return;
    }

    document.title = manga.title + " - " + A.CFG.siteName;

    root.appendChild(makeBackLink());
    root.appendChild(renderHero(manga));

    /* 章节记录标题 + 显示模式切换 */
    var sectionTitle = A.makeEl("h2", "section-title");
    sectionTitle.textContent = "章节记录";
    sectionTitle.appendChild(A.makeEl("span", "badge-count", (manga.chapters || []).length + " 话"));
    root.appendChild(sectionTitle);

    var modeBar = makeModeBar();
    root.appendChild(modeBar);

    var view = A.makeEl("div");
    view.id = "chapterView";
    root.appendChild(view);

    function render() {
      view.textContent = "";
      var chapters = (manga.chapters || []).slice().sort(function (a, b) { return a.order - b.order; });
      if (state.mode === "detailed") {
        var visibleChapters = chapters.filter(function (chapter) {
          return (chapter.kiss && chapter.kiss.length > 0) || (chapter.nudity && chapter.nudity.length > 0);
        });
        var list = A.makeEl("div", "chapter-list");
        visibleChapters.forEach(function (chapter) {
          list.appendChild(renderChapterCard(chapter));
        });
        view.appendChild(list);
      } else {
        view.appendChild(renderChapterStrip(chapters));
      }
    }

    function setMode(mode, scrollToId) {
      state.mode = mode;
      qsa(".mode-btn", modeBar).forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
      });
      render();
      if (scrollToId) {
        var target = document.getElementById("chapter-" + scrollToId);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    qsa(".mode-btn", modeBar).forEach(function (btn) {
      btn.addEventListener("click", function () {
        setMode(btn.getAttribute("data-mode"));
      });
    });

    setMode("collapsed");
  }

  function qsa(selector, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(selector));
  }

  function isUnknown(value) {
    return value === true || value === 1;
  }

  function makeBackLink() {
    var back = createEl("a", "back-link");
    back.href = "index.html";
    back.textContent = "返回漫画列表";
    back.innerHTML = "← " + back.textContent;
    return back;
  }

  /* ---------- 折叠模式：话数色块 ---------- */

  function renderChapterStrip(chapters) {
    var wrap = A.makeEl("div", "chapter-strip");

    var legend = A.makeEl("div", "chapter-strip-legend");
    legend.appendChild(legendItem("kiss", "亲吻"));
    legend.appendChild(legendItem("nudity", "ちくび"));
    legend.appendChild(legendItem("unknown", "未知"));
    legend.appendChild(legendItem("empty", "无记录"));
    wrap.appendChild(legend);

    chapters.forEach(function (chapter) {
      wrap.appendChild(renderChapterNode(chapter));
    });
    return wrap;
  }

  function legendItem(kind, label) {
    var span = A.makeEl("span");
    span.appendChild(A.makeEl("i", "legend-dot " + kind));
    span.appendChild(document.createTextNode(label));
    return span;
  }

  function renderChapterNode(chapter) {
    var wrap = A.makeEl("div", "chapter-node-wrap");
    var kissUnknown = isUnknown(chapter.kissUnknown);
    var nudityUnknown = isUnknown(chapter.nudityUnknown);
    var hasKiss = !kissUnknown && (chapter.kiss || []).length > 0;
    var hasNudity = !nudityUnknown && (chapter.nudity || []).length > 0;

    var node = document.createElement("button");
    node.type = "button";
    node.className = "chapter-node";
    var title = chapter.title || "第" + chapter.order + "话";
    var aria = title
      + (kissUnknown ? "（亲吻情况未知）" : (hasKiss ? "（亲吻记录）" : "（无亲吻记录）"))
      + (nudityUnknown ? "（ちくび情况未知）" : (hasNudity ? "（ちくび记录）" : "（无ちくび记录）"));
    node.setAttribute("aria-label", aria);

    node.appendChild(A.makeEl("span", "node-half kiss" + (kissUnknown ? " unknown" : (hasKiss ? " on" : ""))));
    node.appendChild(A.makeEl("span", "node-half nudity" + (nudityUnknown ? " unknown" : (hasNudity ? " on" : ""))));
    node.appendChild(A.makeEl("span", "node-slash"));
    node.appendChild(A.makeEl("span", "node-num", String(chapter.order)));
    if (kissUnknown) node.appendChild(A.makeEl("span", "node-unknown kiss", "?"));
    if (nudityUnknown) node.appendChild(A.makeEl("span", "node-unknown nudity", "?"));

    node.addEventListener("click", function () {
      setModeFromNode(chapter.order);
    });
    wrap.appendChild(node);

    if (chapter.note) {
      var mark = A.makeEl("span", "node-note-mark", "i");
      mark.setAttribute("aria-hidden", "true");
      wrap.appendChild(mark);

      var tip = A.makeEl("span", "node-tip");
      tip.appendChild(A.makeEl("span", "node-tip-note", chapter.note));
      wrap.appendChild(tip);
    }

    return wrap;
  }

  function setModeFromNode(chapterOrder) {
    state.mode = "detailed";
    setModeButtons();
    var root = A.qs("#detail");
    var view = A.qs("#chapterView");
    view.textContent = "";

    var title = new URLSearchParams(window.location.search).get("id");
    var manga = A.getManga(title);
    var chapters = (manga.chapters || []).slice().sort(function (a, b) { return a.order - b.order; });
    var list = A.makeEl("div", "chapter-list");
    chapters.forEach(function (chapter) {
      if ((chapter.kiss && chapter.kiss.length > 0) || (chapter.nudity && chapter.nudity.length > 0)) {
        list.appendChild(renderChapterCard(chapter));
      }
    });
    view.appendChild(list);

    var target = document.getElementById("chapter-" + chapterOrder);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setModeButtons() {
    var modeBar = A.qs(".mode-switch");
    if (!modeBar) return;
    qsa(".mode-btn", modeBar).forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === state.mode);
    });
  }

  /* ---------- 详细模式：章节卡片 ---------- */

  function renderChapterCard(chapter) {
    var card = A.makeEl("article", "chapter-card");
    card.id = "chapter-" + chapter.order;

    var head = A.makeEl("div", "chapter-head");
    head.appendChild(A.makeEl("span", "chapter-no", String(chapter.order)));
    if (chapter.title) {
      head.appendChild(A.makeEl("h3", null, chapter.title));
    }
    card.appendChild(head);

    if (A.renderTagChips) {
      var chapterTags = A.renderTagChips(chapter.tags);
      if (chapterTags) card.appendChild(chapterTags);
    }

    var grid = A.makeEl("div", "chapter-grid");
    grid.appendChild(A.sceneBlock(chapter, "kiss", isUnknown(chapter.kissUnknown)));
    grid.appendChild(A.sceneBlock(chapter, "nudity", isUnknown(chapter.nudityUnknown)));
    card.appendChild(grid);

    return card;
  }

  function makeModeBar() {
    var bar = A.makeEl("div", "mode-switch");
    bar.setAttribute("role", "group");
    bar.setAttribute("aria-label", "章节显示模式");

    var label = A.makeEl("span", "mode-switch-label", "显示模式：");
    bar.appendChild(label);

    var collapsed = A.makeEl("button", "mode-btn");
    collapsed.type = "button";
    collapsed.setAttribute("data-mode", "collapsed");
    collapsed.textContent = "折叠模式";
    bar.appendChild(collapsed);

    var detailedWrap = A.makeEl("span", "mode-option");

    var detailed = A.makeEl("button", "mode-btn");
    detailed.type = "button";
    detailed.setAttribute("data-mode", "detailed");
    detailed.textContent = "详细模式";
    detailedWrap.appendChild(detailed);

    var warn = A.makeEl("span", "mode-warn");
    warn.setAttribute("aria-hidden", "true");
    warn.appendChild(A.makeEl("span", "mode-warn-mark", "!"));
    detailedWrap.appendChild(warn);

    var tip = A.makeEl("span", "mode-tip", "包含具体标签，可能会指出具体角色");
    detailedWrap.appendChild(tip);

    bar.appendChild(detailedWrap);

    return bar;
  }

  /* ---------- 失败 / 封面 ---------- */

  function renderMissing(root) {
    var empty = A.makeEl("div", "empty-state");
    empty.appendChild(A.makeEl("span", "big", "🕳️"));
    empty.appendChild(A.makeEl("h1", null, "没有找到这部漫画"));
    empty.appendChild(A.makeEl("p", null, "链接可能已失效，或该条目尚未收录。"));

    var submitLink = A.makeEl("a", "btn-primary", "提交这部漫画的数据");
    submitLink.href = "feedback.html";
    empty.appendChild(submitLink);

    var back = A.makeEl("a", "btn-ghost", "返回漫画列表");
    back.href = "index.html";
    empty.appendChild(back);

    root.appendChild(empty);
  }

  function renderHero(manga) {
    var hero = A.makeEl("section", "detail-hero");
    var counts = A.sceneCounts(manga);

    var frame = A.makeEl("div", "cover-frame");
    if (manga.cover) {
      var img = new Image();
      img.alt = manga.title + " 封面";
      img.src = manga.cover;
      img.addEventListener("error", function () { img.remove(); });
      frame.appendChild(img);
    } else {
      frame.appendChild(makeFallback(manga));
    }

    var main = A.makeEl("div", "detail-main");

    var titleRow = A.makeEl("div", "detail-title-row");
    titleRow.appendChild(A.makeEl("h1", "detail-title", manga.title));
    if (manga.status) {
      titleRow.appendChild(A.makeEl("span", "count-badge chapters", manga.status));
    }
    if (manga.demo) {
      titleRow.appendChild(A.makeEl("span", "count-badge kiss", "示例数据"));
    }
    main.appendChild(titleRow);

    if ((manga.altTitles || []).length) {
      main.appendChild(A.makeEl("p", "detail-alt", manga.altTitles.join(" / ")));
    }

    var meta = A.makeEl("div", "detail-meta");
    meta.appendChild(metaItem("作者", manga.author || "—"));
    meta.appendChild(metaItem("章节", counts.chapters + " 话"));
    meta.appendChild(metaItem("亲吻记录", counts.kiss + " 条"));
    meta.appendChild(metaItem("ちくび记录", counts.nudity + " 条"));
    main.appendChild(meta);

    main.appendChild(A.makeEl("p", "detail-desc", manga.description || ""));

    var tagList = renderDetailTags(manga.tags);
    if (tagList) main.appendChild(tagList);

    var modifyLink = A.makeEl("a", "btn-ghost", "信息有误？点此反馈 →");
    modifyLink.href = "feedback.html?modify=" + encodeURIComponent(manga.title);
    main.appendChild(modifyLink);

    var note = A.makeEl("p", "detail-note detail-alt");
    note.textContent = "本站信息不保证百分百正确，如有错误请及时反馈。";
    main.appendChild(note);

    hero.appendChild(frame);
    hero.appendChild(main);
    return hero;
  }

  function renderDetailTags(tags) {
    return A.renderTagChips ? A.renderTagChips(tags) : null;
  }

  function makeFallback(manga) {
    var fallback = A.makeEl("span", "cover-fallback");
    fallback.appendChild(A.makeEl("span", "full", manga.title.charAt(0) || "?"));
    return fallback;
  }

  function metaItem(label, value) {
    var span = A.makeEl("span");
    span.appendChild(A.makeEl("span", "label", label + "："));
    span.appendChild(document.createTextNode(value));
    return span;
  }

  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = String(text);
    return el;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();