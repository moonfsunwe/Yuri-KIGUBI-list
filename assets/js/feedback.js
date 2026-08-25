/* 数据提交页：新增漫画 / 修改已有漫画，整理后生成 GitHub Issue（或邮件提交）。 */
(function () {
  "use strict";

  var A = window.KIGUBI_APP;
  var CFG = A.CFG;
  var FB = CFG.feedback || {};
  var mode = "new";        // new | modify

  var newChapterStates = [];    // [{ kiss, nudity, label }]
  var newBaseCount = 0;         // 正篇话数（不含插入的 .5 特典）
  var modifyCurrent = [];       // [{ kiss, nudity }]
  var modifyOriginal = [];      // [{ kiss, nudity }]
  var selectedManga = null;
  var newTagAssignments = [];      // [{ label, tag }]
  var modifyTagAssignments = [];   // [{ label, tag }]
  var allTagNames = [];

  function configured() {
    if (!FB.enabled) return false;
    if (FB.backend === "githubIssue") {
      return !!FB.githubIssueRepo &&
        FB.githubIssueRepo.indexOf("YOUR_OWNER") === -1 &&
        FB.githubIssueRepo.indexOf("/") !== -1;
    }
    if (FB.backend === "formspree") {
      return !!FB.formspreeEndpoint && FB.formspreeEndpoint.indexOf("YOUR_FORM_ID") === -1;
    }
    return !!FB.web3formsAccessKey && FB.web3formsAccessKey.indexOf("YOUR_") === -1;
  }

  function isGitHubMode() {
    return FB.backend === "githubIssue" && configured();
  }

  function updateBackendUi() {
    var submit = A.qs("#fbkSubmit");
    if (!submit) return;
    submit.textContent = isGitHubMode() ? "生成内容" : "提交数据";
  }

  function init() {
    A.boot();

    var form = A.qs("#feedbackForm");
    if (!form) return;

    var setup = A.qs("#setupNotice");
    var submit = A.qs("#fbkSubmit");
    var ok = configured();

    if (setup) setup.style.display = ok ? "none" : "";
    if (submit) submit.disabled = !ok;
    updateBackendUi();
    bindIssueModal();

    bindTabs();
    populateModifySelect();
    bindNewChapterCount();
    allTagNames = A.listAllTagNames() || [];
    fillTagDatalists();
    bindTagAssignment("new");
    bindTagAssignment("modify");

    bindTagChapterWheel("new");
    bindTagChapterWheel("modify");
    bindBatchChapterControls("new");
    bindBatchChapterControls("modify");

    renderNewChapterCells();

    var params = new URLSearchParams(window.location.search);
    var modifyTitle = params.get("modify");
    if (modifyTitle) {
      var manga = A.getManga(modifyTitle);
      if (manga) {
        var inputBox = A.qs("#fbkModifyManga");
        if (inputBox) inputBox.value = manga.title;
        selectManga(manga.title);
        setMode("modify");
      }
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!ok) {
        showStatus("err", "数据提交通道尚未配置，请按页面顶部提示完成设置。");
        return;
      }
      if (!validate()) return;
      sendFeedback(submit);
    });
  }

  /* ---------- 模式切换 ---------- */

  function setMode(next) {
    mode = next;
    var tabNew = A.qs("#tabNew");
    var tabModify = A.qs("#tabModify");
    var panelNew = A.qs("#panelNew");
    var panelModify = A.qs("#panelModify");

    if (tabNew) tabNew.classList.toggle("active", mode === "new");
    if (tabModify) tabModify.classList.toggle("active", mode === "modify");
    if (panelNew) panelNew.classList.toggle("active", mode === "new");
    if (panelModify) panelModify.classList.toggle("active", mode === "modify");
  }

  function bindTabs() {
    var tabNew = A.qs("#tabNew");
    var tabModify = A.qs("#tabModify");
    if (tabNew) tabNew.addEventListener("click", function () { setMode("new"); });
    if (tabModify) tabModify.addEventListener("click", function () { setMode("modify"); });
  }

  /* ---------- 章节色块 ---------- */

  function stateClass(state) {
    if (state === "has") return " on";
    if (state === "unknown") return " unknown";
    return "";
  }

  function stateLabel(state) {
    return state === "has" ? "有" : (state === "unknown" ? "未知" : "无");
  }

  function bindNewChapterCount() {
    var input = A.qs("#fbkNewChapters");
    if (input) input.addEventListener("input", renderNewChapterCells);
  }

  function isNormalChapterLabel(label) {
    return /^\d+$/.test(String(label));
  }

  function renderNewChapterCells() {
    var container = A.qs("#newChapterCells");
    if (!container) return;

    var count = Math.max(0, Math.min(300, parseInt(A.qs("#fbkNewChapters").value, 10) || 0));
    if (count !== newBaseCount) {
      newBaseCount = count;
      newChapterStates = [];
      for (var n = 0; n < count; n++) {
        newChapterStates.push({ kiss: "unknown", nudity: "unknown", label: String(n + 1) });
      }
    }

    container.textContent = "";

    newChapterStates.forEach(function (state, index) {
        container.appendChild(buildEditCell(
          index,
          state.kiss,
          state.nudity,
          function (half) {
            cycleState(state, half);
            renderNewChapterCells();
          },
          state.label,
          function (deleteIndex) {
            newChapterStates.splice(deleteIndex, 1);
            renderNewChapterCells();
          }
        ));

      var next = newChapterStates[index + 1];
      if (next && isNormalChapterLabel(state.label) && isNormalChapterLabel(next.label)) {
        var plus = document.createElement("button");
        plus.type = "button";
        plus.className = "cell-plus";
        plus.title = "添加特典章节（" + state.label + ".5）";
        plus.textContent = "+";
        plus.addEventListener("click", function () {
          newChapterStates.splice(index + 1, 0, {
            kiss: "unknown",
            nudity: "unknown",
            label: state.label + ".5"
          });
          renderNewChapterCells();
        });
        container.appendChild(plus);
      }
    });

    refreshBatchChapterControls("new");
    refreshTagAssignUI("new");
  }

  function populateModifySelect() {
    var input = A.qs("#fbkModifyManga");
    var datalist = A.qs("#modifyMangaList");
    if (!input || !datalist) return;

    input.addEventListener("input", function () {
      var raw = input.value.trim();
      datalist.textContent = "";

      if (!raw) {
        selectedManga = null;
        modifyOriginal = [];
        modifyCurrent = [];
        var emptyBox = A.qs("#modifyChapterCells");
        if (emptyBox) emptyBox.textContent = "";
        return;
      }

      var value = A.normalize(raw);
      var exact = null;
      A.DATA.some(function (manga) {
        if (A.normalize(manga.title) === value) {
          exact = manga;
          return true;
        }
        return false;
      });

      A.DATA
        .filter(function (manga) {
          return A.normalize(manga.title).indexOf(value) !== -1;
        })
        .slice(0, 10)
        .forEach(function (manga) {
          var opt = document.createElement("option");
          opt.value = manga.title;
          datalist.appendChild(opt);
        });

      if (exact) {
        selectManga(exact.title);
      } else {
        selectedManga = null;
        modifyOriginal = [];
        modifyCurrent = [];
        var box = A.qs("#modifyChapterCells");
        if (box) box.textContent = "";
      }
    });
  }

  function selectManga(title) {
    selectedManga = A.getManga(title);
    modifyOriginal = [];
    modifyCurrent = [];
    var container = A.qs("#modifyChapterCells");
    if (container) container.textContent = "";

    if (!selectedManga) return;

    selectedManga.chapters.slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (chapter) {
      var kiss = halfState(chapter, "kiss");
      var nudity = halfState(chapter, "nudity");
      modifyOriginal.push({ kiss: kiss, nudity: nudity });
      modifyCurrent.push({ kiss: kiss, nudity: nudity, label: String(chapter.order) });
    });

    renderModifyCells();
  }

  function halfState(chapter, half) {
    var key = half === "kiss" ? "kiss" : "nudity";
    var unknownKey = half === "kiss" ? "kissUnknown" : "nudityUnknown";
    if (chapter[unknownKey] === true || chapter[unknownKey] === 1) return "unknown";
    return (chapter[key] || []).length ? "has" : "none";
  }

  function nextNormalChapterLabel() {
    var max = 0;
    modifyCurrent.forEach(function (state) {
      var n = parseInt(state.label, 10);
      if (isNormalChapterLabel(state.label) && n > max) max = n;
    });
    return String(max + 1);
  }

  function renderModifyCells() {
    var container = A.qs("#modifyChapterCells");
    if (!container) return;
    container.textContent = "";
    modifyCurrent.forEach(function (state, index) {
      container.appendChild(buildEditCell(
        index,
        state.kiss,
        state.nudity,
        function (half) {
          cycleModifyState(state, half);
          renderModifyCells();
        },
        state.label || String(index + 1),
        function (deleteIndex) {
          modifyCurrent.splice(deleteIndex, 1);
          modifyOriginal.splice(deleteIndex, 1);
          renderModifyCells();
        }
      ));

      var next = modifyCurrent[index + 1];
      if (next && isNormalChapterLabel(state.label) && isNormalChapterLabel(next.label)) {
        var plus = document.createElement("button");
        plus.type = "button";
        plus.className = "cell-plus";
        plus.title = "添加特典章节（" + state.label + ".5）";
        plus.textContent = "+";
        plus.addEventListener("click", function () {
          modifyCurrent.splice(index + 1, 0, {
            kiss: "none",
            nudity: "none",
            label: state.label + ".5"
          });
          modifyOriginal.splice(index + 1, 0, { kiss: "none", nudity: "none" });
          renderModifyCells();
        });
        container.appendChild(plus);
      }
    });

    var add = document.createElement("button");
    add.type = "button";
    add.className = "cell-add";
    add.title = "添加下一章节";
    add.textContent = "+";
    add.addEventListener("click", function () {
      var label = nextNormalChapterLabel();
      modifyCurrent.push({ kiss: "none", nudity: "none", label: label });
      modifyOriginal.push({ kiss: "none", nudity: "none" });
      renderModifyCells();
    });
    container.appendChild(add);

    refreshBatchChapterControls("modify");
    refreshTagAssignUI("modify");
  }

  function cycleState(state, half) {
    var order = ["unknown", "has", "none"];
    var current = order.indexOf(state[half]);
    state[half] = order[(current + 1) % order.length];
  }

  function cycleModifyState(state, half) {
    // 修改已有漫画时不允许修改成未知：只在有 / 无之间切换
    state[half] = state[half] === "has" ? "none" : "has";
  }

  function buildEditCell(chapterIndex, kissState, nudityState, onCycle, labelText, onDelete) {
    var cell = A.makeEl("div", "edit-cell");
    var label = labelText != null && labelText !== ""
      ? String(labelText)
      : String(chapterIndex + 1);

    cell.appendChild(A.makeEl("span", "cell-half kiss" + stateClass(kissState)));
    cell.appendChild(A.makeEl("span", "cell-half nudity" + stateClass(nudityState)));
    cell.appendChild(A.makeEl("span", "cell-slash"));

    /*
    * 只有 .5 特典章节可以删除
    */
    var num = A.makeEl("span", "cell-num", label);

    if (/^\d+\.5$/.test(label) && onDelete) {
      num.classList.add("cell-num-delete");

      num.addEventListener("click", function (event) {
        event.preventDefault();
        event.stopPropagation();

        onDelete(chapterIndex);
      });
    }

    cell.appendChild(num);

    if (kissState === "unknown") {
      cell.appendChild(A.makeEl("span", "cell-unknown kiss", "?"));
    }

    if (nudityState === "unknown") {
      cell.appendChild(A.makeEl("span", "cell-unknown nudity", "?"));
    }

    var hitKiss = document.createElement("button");
    hitKiss.type = "button";
    hitKiss.className = "cell-half-hit kiss";
    hitKiss.setAttribute(
      "aria-label",
      "第" + label + "章 亲吻：当前" + stateLabel(kissState) + "，点击切换"
    );
    hitKiss.addEventListener("click", function () {
      onCycle("kiss");
    });
    cell.appendChild(hitKiss);

    var hitNudity = document.createElement("button");
    hitNudity.type = "button";
    hitNudity.className = "cell-half-hit nudity";
    hitNudity.setAttribute(
      "aria-label",
      "第" + label + "章 ちくび：当前" + stateLabel(nudityState) + "，点击切换"
    );
    hitNudity.addEventListener("click", function () {
      onCycle("nudity");
    });
    cell.appendChild(hitNudity);

    return cell;
  }

  /* ---------- 批量设置章节状态 ---------- */

  function batchChapterStatesFor(mode) {
    return mode === "new" ? newChapterStates : modifyCurrent;
  }

  function batchChapterRangeOptions(mode) {
    var states = batchChapterStatesFor(mode);
    return states.map(function (state) {
      return String(state.label);
    });
  }

  function bindBatchChapterControls(mode) {
    var container = A.qs("#" + mode + "ChapterCells");
    if (!container || container.parentNode.querySelector(".batch-chapter-controls-" + mode)) {
      return;
    }

    var box = document.createElement("div");
    box.className = "batch-chapter-controls batch-chapter-controls-" + mode;

    var title = document.createElement("div");
    title.className = "batch-chapter-title";
    title.textContent = "批量设置章节";
    box.appendChild(title);

    var rangeRow = document.createElement("div");
    rangeRow.className = "batch-chapter-range";

    var fromLabel = document.createElement("span");
    fromLabel.textContent = "从";
    rangeRow.appendChild(fromLabel);

    var fromSelect = document.createElement("select");
    fromSelect.className = "select batch-chapter-from";
    fromSelect.setAttribute("aria-label", "批量设置起始章节");
    rangeRow.appendChild(fromSelect);

    var toLabel = document.createElement("span");
    toLabel.textContent = "至";
    rangeRow.appendChild(toLabel);

    var toSelect = document.createElement("select");
    toSelect.className = "select batch-chapter-to";
    toSelect.setAttribute("aria-label", "批量设置结束章节");
    rangeRow.appendChild(toSelect);

    var chapterLabel = document.createElement("span");
    chapterLabel.textContent = "章";
    rangeRow.appendChild(chapterLabel);

    box.appendChild(rangeRow);

    bindBatchSelectWheel(fromSelect);
    bindBatchSelectWheel(toSelect);


    var kissRow = document.createElement("div");
    kissRow.className = "batch-chapter-actions";

    var kissTitle = document.createElement("span");
    kissTitle.className = "batch-chapter-action-label";
    kissTitle.textContent = "亲吻";
    kissRow.appendChild(kissTitle);

    addBatchButton(kissRow, "有", function () {
      applyBatchChapterState(mode, "kiss", "has");
    });

    addBatchButton(kissRow, "无", function () {
      applyBatchChapterState(mode, "kiss", "none");
    });

    if (mode === "new") {
      addBatchButton(kissRow, "未知", function () {
        applyBatchChapterState(mode, "kiss", "unknown");
      });
    }

    box.appendChild(kissRow);

    var nudityRow = document.createElement("div");
    nudityRow.className = "batch-chapter-actions";

    var nudityTitle = document.createElement("span");
    nudityTitle.className = "batch-chapter-action-label";
    nudityTitle.textContent = "ちくび";
    nudityRow.appendChild(nudityTitle);

    addBatchButton(nudityRow, "有", function () {
      applyBatchChapterState(mode, "nudity", "has");
    });

    addBatchButton(nudityRow, "无", function () {
      applyBatchChapterState(mode, "nudity", "none");
    });

    if (mode === "new") {
      addBatchButton(nudityRow, "未知", function () {
        applyBatchChapterState(mode, "nudity", "unknown");
      });
    }

    box.appendChild(nudityRow);

    container.parentNode.insertBefore(box, container);

    refreshBatchChapterControls(mode);
  }

  function bindBatchSelectWheel(select) {
    if (!select) return;

    select.addEventListener("wheel", function (event) {
      event.preventDefault();

      var index = select.selectedIndex;

      if (event.deltaY > 0) {
        // 向下滚轮 → 下一章
        if (index < select.options.length - 1) {
          select.selectedIndex = index + 1;
        }
      } else {
        // 向上滚轮 → 上一章
        if (index > 0) {
          select.selectedIndex = index - 1;
        }
      }
    }, { passive: false });
  }

  function addBatchButton(parent, text, handler) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "btn-ghost batch-chapter-button";
    button.textContent = text;
    button.addEventListener("click", handler);
    parent.appendChild(button);
  }

  function refreshBatchChapterControls(mode) {
    var controls = document.querySelector(".batch-chapter-controls-" + mode);
    if (!controls) return;

    var fromSelect = controls.querySelector(".batch-chapter-from");
    var toSelect = controls.querySelector(".batch-chapter-to");

    if (!fromSelect || !toSelect) return;

    var labels = batchChapterRangeOptions(mode);
    var oldFrom = fromSelect.value;
    var oldTo = toSelect.value;

    fromSelect.textContent = "";
    toSelect.textContent = "";

    labels.forEach(function (label) {
      var fromOption = document.createElement("option");
      fromOption.value = label;
      fromOption.textContent = label;
      fromSelect.appendChild(fromOption);

      var toOption = document.createElement("option");
      toOption.value = label;
      toOption.textContent = label;
      toSelect.appendChild(toOption);
    });

    if (!labels.length) return;

    if (labels.indexOf(oldFrom) !== -1) {
      fromSelect.value = oldFrom;
    } else {
      fromSelect.selectedIndex = 0;
    }

    if (labels.indexOf(oldTo) !== -1) {
      toSelect.value = oldTo;
    } else {
      toSelect.selectedIndex = labels.length - 1;
    }
  }

  function applyBatchChapterState(mode, half, stateValue) {
    var states = batchChapterStatesFor(mode);
    var controls = document.querySelector(".batch-chapter-controls-" + mode);

    if (!controls || !states.length) {
      showStatus("err", "当前没有可设置的章节。");
      return;
    }

    var fromSelect = controls.querySelector(".batch-chapter-from");
    var toSelect = controls.querySelector(".batch-chapter-to");

    if (!fromSelect || !toSelect) return;

    var fromLabel = fromSelect.value;
    var toLabel = toSelect.value;

    var fromIndex = states.findIndex(function (state) {
      return String(state.label) === String(fromLabel);
    });

    var toIndex = states.findIndex(function (state) {
      return String(state.label) === String(toLabel);
    });

    if (fromIndex === -1 || toIndex === -1) {
      showStatus("err", "请选择有效的章节范围。");
      return;
    }

    if (fromIndex > toIndex) {
      var temp = fromIndex;
      fromIndex = toIndex;
      toIndex = temp;
    }

    var count = 0;

    for (var i = fromIndex; i <= toIndex; i++) {
      states[i][half] = stateValue;
      count++;
    }

    if (mode === "new") {
      renderNewChapterCells();
    } else {
      renderModifyCells();
    }

    var halfName = half === "kiss" ? "亲吻" : "ちくび";
    var stateName = stateLabel(stateValue);

    showStatus(
      "ok",
      "已将第 " +
        states[fromIndex].label +
        "～" +
        states[toIndex].label +
        " 章的" +
        halfName +
        "设置为“" +
        stateName +
        "”（共 " +
        count +
        " 章）。"
    );
  }

  /* ---------- 章节 tag 分配 ---------- */

  function chapterStatesFor(mode) {
    return mode === "new" ? newChapterStates : modifyCurrent;
  }

  function tagAssignmentsFor(mode) {
    return mode === "new" ? newTagAssignments : modifyTagAssignments;
  }

  function fillTagDatalists() {
    ["new", "modify"].forEach(function (mode) {
      var datalist = A.qs("#" + mode + "TagDatalist");
      if (datalist) {
        datalist.textContent = "";
        allTagNames.forEach(function (name) {
          var opt = document.createElement("option");
          opt.value = name;
          datalist.appendChild(opt);
        });
      }
      renderTagChipButtons(mode);
    });
  }

  function renderTagChipButtons(mode) {
    var box = A.qs("#" + mode + "TagChips");
    if (!box) return;
    box.textContent = "";
    allTagNames.forEach(function (name) {
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-pick-chip";
      chip.textContent = name;
      chip.addEventListener("click", function () {
        var select = A.qs("#" + mode + "TagChapter");
        if (!select || !select.value) {
          showStatus("err", "请先选择要添加 tag 的章节。");
          return;
        }
        tagAssignmentsFor(mode).push({ label: select.value, tag: name });
        renderTagAssignList(mode);
      });
      box.appendChild(chip);
    });
  }

  function bindTagAssignment(mode) {
    var button = A.qs("#" + mode + "TagAdd");
    if (button) {
      button.addEventListener("click", function () { addTagAssignment(mode); });
    }
    var input = A.qs("#" + mode + "TagName");
    if (input) {
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          addTagAssignment(mode);
        }
      });
    }
  }

  function bindTagChapterWheel(mode) {
  var select = A.qs("#" + mode + "TagChapter");
  if (!select) return;

  select.addEventListener("wheel", function (event) {
    event.preventDefault();

    var index = select.selectedIndex;

    if (event.deltaY > 0) {
      // 向下滚轮 → 下一章
      if (index < select.options.length - 1) {
        select.selectedIndex = index + 1;
      }
    } else {
      // 向上滚轮 → 上一章
      if (index > 0) {
        select.selectedIndex = index - 1;
      }
    }

    // 通知现有逻辑章节发生变化
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

  function addTagAssignment(mode) {
    var select = A.qs("#" + mode + "TagChapter");
    var input = A.qs("#" + mode + "TagName");
    if (!select || !input) return;

    var label = select.value;
    var tag = input.value.trim();
    if (!label || !tag) return;

    tagAssignmentsFor(mode).push({ label: label, tag: tag });
    input.value = "";
    renderTagAssignList(mode);
  }

  function refreshTagAssignUI(mode) {
    var select = A.qs("#" + mode + "TagChapter");
    if (select) {
      var previous = select.value;
      select.textContent = "";
      chapterStatesFor(mode).forEach(function (state) {
        var opt = document.createElement("option");
        opt.value = String(state.label);
        opt.textContent = "第 " + String(state.label) + " 章";
        select.appendChild(opt);
      });
      if (previous) {
        var exists = Array.prototype.some.call(select.options, function (opt) { return opt.value === previous; });
        if (exists) select.value = previous;
      }
    }
    renderTagAssignList(mode);
  }

  function renderTagAssignList(mode) {
    var listEl = A.qs("#" + mode + "TagAssignList");
    if (!listEl) return;

    listEl.textContent = "";
    tagAssignmentsFor(mode).forEach(function (assignment, index) {
      var li = document.createElement("li");
      var text = document.createElement("span");
      text.textContent = "第 " + assignment.label + " 章：" + assignment.tag;
      li.appendChild(text);

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tag-assign-remove";
      remove.textContent = "移除";
      remove.addEventListener("click", function () {
        tagAssignmentsFor(mode).splice(index, 1);
        renderTagAssignList(mode);
      });
      li.appendChild(remove);
      listEl.appendChild(li);
    });
  }

  /* ---------- 校验 ---------- */

  function validateNew() {
    var title = A.qs("#fbkNewTitle").value.trim();
    var chapterCount = parseInt(A.qs("#fbkNewChapters").value, 10);
    if (!title) { showStatus("err", "请填写新增漫画的标题。"); return false; }
    if (!chapterCount || chapterCount < 1) {
      showStatus("err", "请填写章节数量（几章）。");
      return false;
    }
    var hasKnown = newChapterStates.some(function (state) {
      return state.kiss !== "unknown" || state.nudity !== "unknown";
    });
    if (!hasKnown) {
      showStatus("err", "章节情况不能全部为未知：请至少把一章的亲吻或ちくび标为“有”或“无”。");
      return false;
    }
    return true;
  }

  function validateModify() {
    if (!selectedManga) {
      showStatus("err", "请搜索并选择要修改的漫画。");
      return false;
    }

    return true;
  }

  function validate() {
    if (mode === "new") return validateNew();
    return validateModify();
  }

  /* ---------- 提交 ---------- */

  function buildIssueTitle() {
    if (mode === "new") {
      return "[投稿] 新增漫画：" + A.qs("#fbkNewTitle").value.trim();
    }
    return "[投稿] 修改已有漫画：" + (selectedManga ? selectedManga.title : "");
  }

  function issueBodyForUrl() {
    var body = buildMessage().replace(/\r\n/g, "\n").trim();
    /*if (body.length > 30000) {
      body = "\n\n（内容过长已截断，其余章节状态请通过自行复制补充。）" + body.slice(0, 30000);
    }*/
    return body;
  }
  
  function indentBody(body) {
    return body.replace(/\n/g, "\n    ");
  }

  function buildIssueUrl() {
    var repo = FB.githubIssueRepo.replace(/\/+$/, "").replace(/^\/+/, "");
    var url = "https://github.com/" + repo + "/issues/new";
    var params = new URLSearchParams();

    params.set("title", buildIssueTitle());

    var body = issueBodyForUrl();

    var extraNote = A.qs("#fbkExtraNote");
    var reason = extraNote ? extraNote.value.trim() : "";

    // 补充说明放在 GitHub 代码块外面
    var githubBody = "<!-- KIGUBI-SUBMISSION -->\n";

    if (reason) {
      githubBody += "补充说明：" + reason + "\n";
      body = body.replace("补充说明：" + reason + "\n", "");
    }

    githubBody += "```\n" + indentBody(body) + "\n```";

    params.set("body", githubBody);

    return url + "?" + params.toString();
  }

  function openIssueConfirm() {
    var modal = A.qs("#issueModal");
    var bodyPreview = A.qs("#issueBodyPreview");
    var openLink = A.qs("#issueOpen");
    if (!modal || !bodyPreview || !openLink) return;

    bodyPreview.value = issueBodyForUrl();
    openLink.href = buildIssueUrl();
    modal.hidden = false;
  }

  function openLilySubmit() {
    var title = buildIssueTitle();
    var body = indentBody(issueBodyForUrl());
    var extraNoteEl = A.qs("#fbkExtraNote");
    var extraNote = extraNoteEl ? extraNoteEl.value.trim() : "";
    var text = "[collapse=0," + title + "]\n";
    
    if (extraNote) {
      text += "补充说明：" + extraNote + "\n";
    }

    text += "[code]" + body + "\n[/code]\n[/collapse]";

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text);
      });
    } else {
      fallbackCopy(text);
    }

    var base = (FB.lilySubmitUrl || "").trim();
    var lilyOpen = A.qs("#lilyOpen");

    if (base) {
      var url = base;
      if (url.indexOf("message=") === -1) {
        // Discuz! 对 message 二次解码，不能直接把 " 编码成 %22；
        // 先把 " 转成 &quot;，再交给 encodeURIComponent，最终 URL 中是 %26quot%3B
        var discuzMessage = text.replace(/"/g, "&quot;");
        url += (url.indexOf("?") === -1 ? "?" : "&") + "message=" + encodeURIComponent(discuzMessage);
      }
      if (lilyOpen) lilyOpen.href = url;
      window.open(url, "_blank", "noopener");
      showStatus("ok", "已复制，并打开百合会投稿页面。");
    } else {
      if (lilyOpen) lilyOpen.href = "#";
      showStatus("err", "内容已复制。");
    }
  }

  function bindIssueModal() {
    var modal = A.qs("#issueModal");
    if (!modal) return;

    var cancel = A.qs("#issueCancel");
    if (cancel) cancel.addEventListener("click", function () { modal.hidden = true; });

    var openLink = A.qs("#issueOpen");
    if (openLink) openLink.addEventListener("click", function () {
      showStatus("ok", "已打开 GitHub Issue 页面，请在页面中确认并点击 Submit new issue。");
    });

    var lilyOpen = A.qs("#lilyOpen");
    if (lilyOpen) {
      lilyOpen.addEventListener("click", function (event) {
        event.preventDefault();
        openLilySubmit();
      });
    }

    var copy = A.qs("#issueCopy");
    if (copy) copy.addEventListener("click", function () {
      var bodyPreview = A.qs("#issueBodyPreview");
      if (!bodyPreview) return;
      var body = indentBody(bodyPreview.value);

      var extraNote = A.qs("#fbkExtraNote");
      var reason = extraNote ? extraNote.value.trim() : "";

      var text = "```\n[collapse=0]\n";

      if (reason) {
        text += "补充说明：" + reason + "\n";
      }

      text += "[code]" + body + "[/code]\n[/collapse]\n```";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showStatus("ok", "内容已复制。");
        }).catch(function () { fallbackCopy(text); });
      } else {
        fallbackCopy(text);
      }
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body && document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); showStatus("ok", "Issue 内容已复制。"); }
    catch (e) { showStatus("err", "复制失败，请手动复制。"); }
    if (document.body) document.body.removeChild(ta);
  }

  function buildMessage() {
    if (mode === "new") {
      return buildNewMangaBody();
    }

    if (mode === "modify" && selectedManga) {
      return buildModifyMangaBody();
    }

    return "";
  }

  function buildModifyMangaBody() {
    var originalOrders = {};
    (selectedManga.chapters || []).forEach(function (chapter) {
      var order = parseFloat(chapter.order);
      originalOrders[isFinite(order) ? String(order) : String(chapter.order)] = true;
    });

    var tagMap = {};
    modifyTagAssignments.forEach(function (assignment) {
      if (!tagMap[assignment.label]) tagMap[assignment.label] = [];
      tagMap[assignment.label].push(assignment.tag);
    });

    var chapters = [];
    modifyCurrent.forEach(function (cur, index) {
      var orig = modifyOriginal[index];
      var order = parseFloat(cur.label);
      var orderKey = isFinite(order) ? String(order) : String(cur.label);
      var isNew = !Object.prototype.hasOwnProperty.call(originalOrders, orderKey);
      var tags = tagMap[String(cur.label)] || [];
      var changed = !!orig && (orig.kiss !== cur.kiss || orig.nudity !== cur.nudity);

      if (isNew || changed || tags.length) {
        chapters.push(formatIssueChapter(cur.label, cur.kiss, cur.nudity, tags));
      }
    });

    var lines = [];
    lines.push("{");
    lines.push("  title: " + jsString(selectedManga.title) + ",");
    lines.push("  chapters: [");
    chapters.forEach(function (chapter, index) {
      var comma = index < chapters.length - 1 ? "," : "";
      lines.push("    " + chapter + comma);
    });
    lines.push("  ]");
    lines.push("}");
    return lines.join("\n");
  }

  function jsString(value) {
    return JSON.stringify(String(value));
  }

  function buildNewMangaBody() {
    var title = A.qs("#fbkNewTitle").value.trim();
    var altRaw = A.qs("#fbkNewAltTitles").value.trim();
    var altTitles = altRaw ? altRaw.replace(/，/g, ",").split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [];
    var author = A.qs("#fbkNewAuthor").value.trim();

    var tagMap = {};
    newTagAssignments.forEach(function (assignment) {
      if (!tagMap[assignment.label]) tagMap[assignment.label] = [];
      tagMap[assignment.label].push(assignment.tag);
    });

    var chapters = newChapterStates
      .slice()
      .sort(function (a, b) { return parseFloat(a.label) - parseFloat(b.label); })
      .map(function (state) {
        return formatIssueChapter(state.label, state.kiss, state.nudity, tagMap[String(state.label)] || []);
      });

    var lines = [];
    lines.push("{");
    lines.push("  title: " + jsString(title) + ",");
    if (altTitles.length) {
      lines.push("  altTitles: [" + altTitles.map(jsString).join(", ") + "],");
    }
    if (author) {
      lines.push("  author: " + jsString(author) + ",");
    }
    var status = A.qs("#fbkNewStatus").value.trim();
    if (status) {
      lines.push("  status: " + jsString(status) + ",");
    }
    lines.push("  cover: " + jsString("assets/covers/" + title + ".jpg") + ",");
    lines.push("  chapters: [");
    chapters.forEach(function (chapter, index) {
      var comma = index < chapters.length - 1 ? "," : "";
      lines.push("    " + chapter + comma);
    });
    lines.push("  ]");
    lines.push("}");
    return lines.join("\n");
  }

  function formatIssueChapter(label, kissState, nudityState, tagNames) {
    var order = parseFloat(label);
    var orderText = isFinite(order) ? String(order) : String(label);
    var extras = [];

    if (kissState === "unknown") {
      extras.push("kissUnknown: true");
    } else if (kissState === "has") {
      if (tagNames.length) {
        var tagObjects = tagNames.map(function (name) {
          return "{ name: " + jsString(name) + " }";
        });
        extras.push("kiss: [ { tags: [ " + tagObjects.join(", ") + " ] } ]");
      } else {
        extras.push("kiss: [ 1 ]");
      }
    }

    if (nudityState === "unknown") {
      extras.push("nudityUnknown: true");
    } else if (nudityState === "has") {
      extras.push("nudity: [ 1 ]");
    }

    if (!extras.length) {
      return "{ order: " + orderText + " }";
    }

    var text = "{ order: " + orderText + ",";
    text += "\n      " + extras.join(",\n      ") + "\n    ";
    text += "}";
    return text;
  }

  function sendFeedback(button) {
    if (isGitHubMode()) {
      openIssueConfirm();
      return;
    }
    sendEmailFeedback(button);
  }

  function sendEmailFeedback(button) {
    var original = button.textContent;
    button.disabled = true;
    button.textContent = "提交中…";
    showStatus("", "");

    var message = buildMessage();
    var fd = new FormData();

    fd.append("subject", "[KIGUBI数据] " + (mode === "new" ? "新增漫画" : "修改已有漫画"));
    fd.append("message", message);
    fd.append("feedback_type", mode === "new" ? "新增漫画" : "修改已有漫画");

    if (mode === "new") {
      fd.append("manga_title", A.qs("#fbkNewTitle").value.trim());
      fd.append("manga_alt_titles", A.qs("#fbkNewAltTitles").value.trim());
      fd.append("manga_status", A.qs("#fbkNewStatus").value);
      fd.append("manga_author", A.qs("#fbkNewAuthor").value.trim());
      fd.append("chapter_count", String(newBaseCount));
    } else if (selectedManga) {
      fd.append("manga_title", selectedManga.title);
    }

    fd.append("from_name", "匿名投稿");

    var endpoint;
    if (FB.backend === "formspree") {
      endpoint = FB.formspreeEndpoint;
      fd.append("_subject", "[KIGUBI数据] " + (mode === "new" ? "新增漫画" : "修改已有漫画"));
    } else {
      endpoint = "https://api.web3forms.com/submit";
      fd.append("access_key", FB.web3formsAccessKey);
    }

    fetch(endpoint, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: fd
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (json) {
        return { ok: res.ok, json: json };
      });
    }).then(function (result) {
      var ok = result.ok && (!result.json || result.json.success !== false);
      if (ok) {
        showStatus("ok", "提交成功！审核通过后，新增/修改的条目会出现在对应位置。");
        A.qs("#feedbackForm").reset();
        newTagAssignments = [];
        modifyTagAssignments = [];
        renderNewChapterCells();
        renderTagAssignList("new");
        renderTagAssignList("modify");
        refreshTagAssignUI("modify");
        selectManga(A.qs("#fbkModifyManga").value || "");
        setMode("new");
      } else {
        var msg = result.json && result.json.message ? result.json.message : "提交失败，请稍后重试。";
        showStatus("err", "提交失败：" + msg);
      }
    }).catch(function () {
      showStatus("err", "网络错误，提交失败。请检查网络后重试。");
    }).finally(function () {
      button.disabled = !configured();
      button.textContent = original;
    });
  }

  function showStatus(type, text) {
    var status = A.qs("#fbkStatus");
    if (!status) return;
    status.className = "form-status" + (type ? " " + type : "");
    status.textContent = text;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();