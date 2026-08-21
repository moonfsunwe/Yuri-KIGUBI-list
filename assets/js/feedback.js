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
    submit.textContent = isGitHubMode() ? "生成 GitHub Issue" : "提交数据";
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
      container.appendChild(buildEditCell(index, state.kiss, state.nudity, function (half) {
        cycleState(state, half);
        renderNewChapterCells();
      }, state.label));

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
      container.appendChild(buildEditCell(index, state.kiss, state.nudity, function (half) {
        cycleModifyState(state, half);
        renderModifyCells();
      }, state.label || String(index + 1)));

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

  function buildEditCell(chapterIndex, kissState, nudityState, onCycle, labelText) {
    var cell = A.makeEl("div", "edit-cell");
    var label = labelText != null && labelText !== "" ? String(labelText) : String(chapterIndex + 1);
    cell.appendChild(A.makeEl("span", "cell-half kiss" + stateClass(kissState)));
    cell.appendChild(A.makeEl("span", "cell-half nudity" + stateClass(nudityState)));
    cell.appendChild(A.makeEl("span", "cell-slash"));
    cell.appendChild(A.makeEl("span", "cell-num", label));
    if (kissState === "unknown") cell.appendChild(A.makeEl("span", "cell-unknown kiss", "?"));
    if (nudityState === "unknown") cell.appendChild(A.makeEl("span", "cell-unknown nudity", "?"));

    var hitKiss = document.createElement("button");
    hitKiss.type = "button";
    hitKiss.className = "cell-half-hit kiss";
    hitKiss.setAttribute("aria-label", "第" + label + "章 亲吻：当前" + stateLabel(kissState) + "，点击切换");
    hitKiss.addEventListener("click", function () { onCycle("kiss"); });
    cell.appendChild(hitKiss);

    var hitNudity = document.createElement("button");
    hitNudity.type = "button";
    hitNudity.className = "cell-half-hit nudity";
    hitNudity.setAttribute("aria-label", "第" + label + "章 ちくび：当前" + stateLabel(nudityState) + "，点击切换");
    hitNudity.addEventListener("click", function () { onCycle("nudity"); });
    cell.appendChild(hitNudity);

    return cell;
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
    var select = A.qs("#fbkModifyManga");
    var reason = A.qs("#fbkModifyReason").value.trim();
    if (!select || !select.value || !selectedManga) { showStatus("err", "请搜索并选择要修改的漫画。"); return false; }
    if (!reason) { showStatus("err", "修改已有漫画必须注明原因。"); return false; }
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
    if (body.length > 3600) {
      body = body.slice(0, 3600) + "\n\n（内容过长已截断，其余章节状态请在 GitHub Issue 中补充。）";
    }
    return body;
  }

  function buildIssueUrl() {
    var repo = FB.githubIssueRepo.replace(/\/+$/, "").replace(/^\/+/, "");
    var labels = (FB.githubIssueLabels || []).slice();
    var url = "https://github.com/" + repo + "/issues/new";
    var params = new URLSearchParams();
    params.set("title", buildIssueTitle());
    params.set("body", issueBodyForUrl());
    if (labels.length) params.set("labels", labels.join(","));
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

  function bindIssueModal() {
    var modal = A.qs("#issueModal");
    if (!modal) return;

    var cancel = A.qs("#issueCancel");
    if (cancel) cancel.addEventListener("click", function () { modal.hidden = true; });

    var openLink = A.qs("#issueOpen");
    if (openLink) openLink.addEventListener("click", function () {
      modal.hidden = true;
      showStatus("ok", "已打开 GitHub Issue 页面，请在页面中确认并点击 Submit new issue。");
    });

    var copy = A.qs("#issueCopy");
    if (copy) copy.addEventListener("click", function () {
      var bodyPreview = A.qs("#issueBodyPreview");
      if (!bodyPreview) return;
      var text = bodyPreview.value;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          showStatus("ok", "Issue 内容已复制。");
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
    var lines = [];
    var stateTxt = "未知→有→无；粉色/紫色=有，灰色=无，蓝色问号=未知";

    if (mode === "new") {
      lines.push("数据类型：新增漫画");
      lines.push("标题：" + A.qs("#fbkNewTitle").value.trim());
      lines.push("别名：" + (A.qs("#fbkNewAltTitles").value.trim() || "未填"));
      lines.push("连载状况：" + (A.qs("#fbkNewStatus").value || "未填"));
      lines.push("作者：" + (A.qs("#fbkNewAuthor").value.trim() || "未填"));
      var specialCount = newChapterStates.length - newBaseCount;
      lines.push("章节数：" + newBaseCount + (specialCount > 0 ? "（含特典 " + specialCount + " 个：见章节状况中的 .5 章节）" : ""));
    } else if (selectedManga) {
      lines.push("数据类型：修改已有漫画");
      lines.push("漫画：" + selectedManga.title);
      lines.push("修改原因：" + A.qs("#fbkModifyReason").value.trim());
    }

    if (mode === "new") {
      lines.push("", "章节状况（" + stateTxt + "）");
      newChapterStates.forEach(function (state) {
        lines.push("第" + state.label + "章：亲吻=" + stateLabel(state.kiss) + "，ちくび=" + stateLabel(state.nudity));
      });
      if (newTagAssignments.length) {
        lines.push("", "章节 tag 分配：");
        newTagAssignments.forEach(function (assignment) {
          lines.push("- 第" + assignment.label + "章：" + assignment.tag);
        });
      }
    }

    if (mode === "modify" && selectedManga) {
      lines.push("", "变更对照（原 → 新）");
      var changed = false;
      modifyOriginal.forEach(function (orig, index) {
        var cur = modifyCurrent[index];
        if (!cur) return;
        if (orig.kiss !== cur.kiss || orig.nudity !== cur.nudity) {
          changed = true;
          lines.push("- 第" + cur.label + "章：亲吻 " + stateLabel(orig.kiss) + " → " + stateLabel(cur.kiss) +
            "，ちくび " + stateLabel(orig.nudity) + " → " + stateLabel(cur.nudity));
        }
      });
      if (!changed) lines.push("- 章节色块未修改");
      if (modifyTagAssignments.length) {
        lines.push("", "章节 tag 分配：");
        modifyTagAssignments.forEach(function (assignment) {
          lines.push("- 第" + assignment.label + "章：" + assignment.tag);
        });
      }
    }

    lines.push("", "提交时间：" + new Date().toISOString());
    return lines.join("\n");
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
      fd.append("modify_reason", A.qs("#fbkModifyReason").value.trim());
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