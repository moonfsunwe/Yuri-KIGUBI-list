/* 数据提交页：新增漫画 / 修改已有漫画，文字 + 佐证图片（每张必须注明章节） */
(function () {
  "use strict";

  var A = window.KIGUBI_APP;
  var CFG = A.CFG;
  var FB = CFG.feedback || {};
  var pendingFiles = [];   // [{ file, chapterNote }]
  var coverFile = null;    // 新增漫画的封面（选填）
  var mode = "new";        // new | modify

  var newChapterStates = [];    // [{ kiss, nudity }]
  var modifyCurrent = [];       // [{ kiss, nudity }]
  var modifyOriginal = [];      // [{ kiss, nudity }]
  var selectedManga = null;

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
    var limits = A.qs("#fileLimitsText");
    var privacy = A.qs("#privacyNote");

    if (isGitHubMode()) {
      if (submit) submit.textContent = "生成 GitHub Issue";
      if (limits) limits.textContent = "图片仅在本地整理与预览；提交后请在 GitHub Issue 编辑器里手动拖入对应图片。";
      if (privacy) privacy.innerHTML = "🔒 隐私说明：本模式不把图片或数据发到本站服务器；数据会整理成 GitHub Issue URL 由你确认后提交，GitHub 账号与仓库权限由 GitHub 管理。";
    } else {
      if (submit) submit.textContent = "提交数据";
      if (limits) limits.textContent = "支持 jpg / png / webp，单张不超过 10MB。图片不会公开展示。";
      if (privacy) privacy.innerHTML = "🔒 隐私说明：佐证图片通过第三方表单服务直接发送到维护者邮箱，本站不存储、不公开展示。数据上架前由维护者人工核对，通过后仅把文字信息写入 <code>data/manga-data.js</code>。";
    }
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
    bindCoverInput();
    bindImages();
    renderNewChapterCells();

    var params = new URLSearchParams(window.location.search);
    var modifySlug = params.get("modify");
    if (modifySlug) {
      var manga = A.getManga(modifySlug);
      if (manga) {
        var inputBox = A.qs("#fbkModifyManga");
        if (inputBox) inputBox.value = manga.title;
        selectManga(manga.slug);
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

  function renderNewChapterCells() {
    var container = A.qs("#newChapterCells");
    if (!container) return;

    var count = Math.max(0, Math.min(300, parseInt(A.qs("#fbkNewChapters").value, 10) || 0));
    var old = newChapterStates;
    var next = [];
    for (var i = 0; i < count; i++) {
      next.push(old[i] || { kiss: "unknown", nudity: "unknown" });
    }
    newChapterStates = next;

    container.textContent = "";
    newChapterStates.forEach(function (state, index) {
      container.appendChild(buildEditCell(index, state.kiss, state.nudity, function (half) {
        cycleState(state, half);
        renderNewChapterCells();
      }));
    });
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
        if (A.normalize(manga.title) === value || A.normalize(manga.slug) === value) {
          exact = manga;
          return true;
        }
        return false;
      });

      A.DATA
        .filter(function (manga) {
          return A.normalize(manga.title).indexOf(value) !== -1 ||
                 A.normalize(manga.slug).indexOf(value) !== -1;
        })
        .slice(0, 10)
        .forEach(function (manga) {
          var opt = document.createElement("option");
          opt.value = manga.title;
          opt.dataset.slug = manga.slug;
          datalist.appendChild(opt);
        });

      if (exact) {
        selectManga(exact.slug);
      } else {
        selectedManga = null;
        modifyOriginal = [];
        modifyCurrent = [];
        var box = A.qs("#modifyChapterCells");
        if (box) box.textContent = "";
      }
    });
  }

  function selectManga(slug) {
    selectedManga = A.getManga(slug);
    modifyOriginal = [];
    modifyCurrent = [];
    var container = A.qs("#modifyChapterCells");
    if (container) container.textContent = "";

    if (!selectedManga) return;

    selectedManga.chapters.slice().sort(function (a, b) { return a.order - b.order; }).forEach(function (chapter) {
      var kiss = halfState(chapter, "kiss");
      var nudity = halfState(chapter, "nudity");
      modifyOriginal.push({ kiss: kiss, nudity: nudity });
      modifyCurrent.push({ kiss: kiss, nudity: nudity });
    });

    renderModifyCells();
  }

  function halfState(chapter, half) {
    var key = half === "kiss" ? "kiss" : "nudity";
    var unknownKey = half === "kiss" ? "kissUnknown" : "nudityUnknown";
    if (chapter[unknownKey] === true || chapter[unknownKey] === 1) return "unknown";
    return (chapter[key] || []).length ? "has" : "none";
  }

  function renderModifyCells() {
    var container = A.qs("#modifyChapterCells");
    if (!container) return;
    container.textContent = "";
    modifyCurrent.forEach(function (state, index) {
      container.appendChild(buildEditCell(index, state.kiss, state.nudity, function (half) {
        cycleModifyState(state, half);
        renderModifyCells();
      }));
    });
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

  function buildEditCell(chapterIndex, kissState, nudityState, onCycle) {
    var cell = A.makeEl("div", "edit-cell");
    cell.appendChild(A.makeEl("span", "cell-half kiss" + stateClass(kissState)));
    cell.appendChild(A.makeEl("span", "cell-half nudity" + stateClass(nudityState)));
    cell.appendChild(A.makeEl("span", "cell-slash"));
    cell.appendChild(A.makeEl("span", "cell-num", String(chapterIndex + 1)));
    if (kissState === "unknown") cell.appendChild(A.makeEl("span", "cell-unknown kiss", "?"));
    if (nudityState === "unknown") cell.appendChild(A.makeEl("span", "cell-unknown nudity", "?"));

    var hitKiss = document.createElement("button");
    hitKiss.type = "button";
    hitKiss.className = "cell-half-hit kiss";
    hitKiss.setAttribute("aria-label", "第" + (chapterIndex + 1) + "章 亲吻：当前" + stateLabel(kissState) + "，点击切换");
    hitKiss.addEventListener("click", function () { onCycle("kiss"); });
    cell.appendChild(hitKiss);

    var hitNudity = document.createElement("button");
    hitNudity.type = "button";
    hitNudity.className = "cell-half-hit nudity";
    hitNudity.setAttribute("aria-label", "第" + (chapterIndex + 1) + "章 露点：当前" + stateLabel(nudityState) + "，点击切换");
    hitNudity.addEventListener("click", function () { onCycle("nudity"); });
    cell.appendChild(hitNudity);

    return cell;
  }

  /* ---------- 封面 ---------- */

  function bindCoverInput() {
    var input = A.qs("#fbkCoverInput");
    if (!input) return;
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      var error = A.qs("#coverError");
      if (error) error.textContent = "";
      if (!file) return;
      if (file.type.indexOf("image/") !== 0) {
        if (error) error.textContent = "封面只能是图片文件。";
        input.value = "";
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        if (error) error.textContent = "封面不能超过 10MB。";
        input.value = "";
        return;
      }
      coverFile = file;
      renderCoverPreview();
      input.value = "";
    });
  }

  function renderCoverPreview() {
    var box = A.qs("#coverPreview");
    if (!box) return;
    box.textContent = "";
    if (!coverFile) { box.style.display = "none"; return; }
    box.style.display = "";

    var img = document.createElement("img");
    img.alt = "封面预览";
    img.src = URL.createObjectURL(coverFile);
    var name = A.makeEl("span", "cover-name", coverFile.name);
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "cover-remove";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "移除封面");
    remove.addEventListener("click", function () {
      coverFile = null;
      renderCoverPreview();
    });
    box.appendChild(img);
    box.appendChild(name);
    box.appendChild(remove);
  }

  /* ---------- 佐证图片（每张必须注明章节） ---------- */

  function bindImages() {
    var input = A.qs("#fbkFiles");
    if (!input) return;
    input.addEventListener("change", function () {
      addFiles(input.files);
      input.value = "";
      renderPreviews();
    });
  }

  function addFiles(fileList) {
    var max = Number(FB.maxImages) || 30;
    var maxBytes = (Number(FB.maxImageSizeMB) || 10) * 1024 * 1024;
    var files = Array.prototype.slice.call(fileList || []);
    var error = A.qs("#fileError");
    if (error) error.textContent = "";

    files.forEach(function (file) {
      if (pendingFiles.length >= max) {
        if (error) error.textContent = "最多上传 " + max + " 张图片。";
        return;
      }
      if (file.type.indexOf("image/") !== 0) return;
      if (file.size > maxBytes) {
        if (error) error.textContent = file.name + " 超过 " + (Number(FB.maxImageSizeMB) || 10) + "MB，已跳过。";
        return;
      }
      var dup = pendingFiles.some(function (item) {
        return item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified;
      });
      if (!dup) pendingFiles.push({ file: file, chapterNote: "" });
    });
  }

  function renderPreviews() {
    var grid = A.qs("#previewGrid");
    if (!grid) return;
    grid.textContent = "";

    pendingFiles.forEach(function (item, index) {
      var row = A.makeEl("div", "preview-item");

      var img = document.createElement("img");
      img.alt = item.file.name;
      img.src = URL.createObjectURL(item.file);

      var note = document.createElement("input");
      note.type = "text";
      note.className = "preview-note";
      note.placeholder = "对应章节（必填），例如：第3话";
      note.value = item.chapterNote;
      note.addEventListener("input", function () {
        item.chapterNote = note.value.trim();
      });

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "preview-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "移除 " + item.file.name);
      remove.addEventListener("click", function () {
        pendingFiles.splice(index, 1);
        renderPreviews();
      });

      row.appendChild(img);
      row.appendChild(note);
      row.appendChild(remove);
      grid.appendChild(row);
    });
  }

  /* ---------- 校验 ---------- */

  function validateChapterNotes() {
    var missing = pendingFiles.some(function (item) { return !item.chapterNote; });
    if (missing) {
      showStatus("err", "每张佐证图片都必须备注对应的章节。");
      return false;
    }
    return true;
  }

  function validateNew() {
    var title = A.qs("#fbkNewTitle").value.trim();
    var chapterCount = parseInt(A.qs("#fbkNewChapters").value, 10);
    if (!title) { showStatus("err", "请填写新增漫画的标题。"); return false; }
    if (!chapterCount || chapterCount < 1) {
      showStatus("err", "请填写章节数量（几章）。");
      return false;
    }
    return true;
  }

  function changedNoneOrUnknownToHas() {
    return modifyOriginal.some(function (orig, index) {
      var cur = modifyCurrent[index];
      if (!cur) return false;
      return ((orig.kiss === "none" || orig.kiss === "unknown") && cur.kiss === "has") ||
             ((orig.nudity === "none" || orig.nudity === "unknown") && cur.nudity === "has");
    });
  }

  function validateModify() {
    var select = A.qs("#fbkModifyManga");
    var reason = A.qs("#fbkModifyReason").value.trim();
    if (!select || !select.value || !selectedManga) { showStatus("err", "请搜索并选择要修改的漫画。"); return false; }
    if (!reason) { showStatus("err", "修改已有漫画必须注明原因。"); return false; }
    if (changedNoneOrUnknownToHas() && pendingFiles.length === 0) {
      showStatus("err", "你把某个章节从“无/未知”改为“有”，必须上传至少一张佐证图片。");
      return false;
    }
    return true;
  }

  function validate() {
    if (!validateChapterNotes()) return false;
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
    var body = buildMessage()
      .replace(/\r\n/g, "\n")
      .split("\n")
      .filter(function (line) { return line.trim() !== "佐证图片仅用于审核，请勿公开展示。"; })
      .join("\n");

    body += "\n\n---\n投稿图片请在此处拖入编辑器中：";
    if (mode === "new" && coverFile) {
      body += "\n- 封面图：" + coverFile.name;
    }
    pendingFiles.forEach(function (item) {
      body += "\n- " + item.file.name + " → " + item.chapterNote;
    });
    if (!pendingFiles.length && !(mode === "new" && coverFile)) {
      body += "\n- （本次未准备图片）";
    }

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
      lines.push("连载状况：" + (A.qs("#fbkNewStatus").value || "未填"));
      lines.push("作者：" + (A.qs("#fbkNewAuthor").value.trim() || "未填"));
      lines.push("章节数：" + newChapterStates.length);
      if (coverFile) lines.push("封面图：已上传（" + coverFile.name + "）");
      else lines.push("封面图：未上传");
    } else if (selectedManga) {
      lines.push("数据类型：修改已有漫画");
      lines.push("漫画：" + selectedManga.title + "（" + selectedManga.slug + "）");
      lines.push("修改原因：" + A.qs("#fbkModifyReason").value.trim());
    }

    lines.push("", "章节状况（" + stateTxt + "）");
    var states = mode === "new" ? newChapterStates : modifyCurrent;
    states.forEach(function (state, index) {
      lines.push("第" + (index + 1) + "章：亲吻=" + stateLabel(state.kiss) + "，露点=" + stateLabel(state.nudity));
    });

    if (pendingFiles.length) {
      lines.push("", "佐证图片（每张对应章节）");
      pendingFiles.forEach(function (item) {
        lines.push("- " + item.file.name + " → " + item.chapterNote);
      });
    }

    lines.push("", "联系方式：" + (A.qs("#fbkContact").value.trim() || "未填写"));
    lines.push("提交时间：" + new Date().toISOString());
    lines.push("", "佐证图片仅用于审核，请勿公开展示。");
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
      fd.append("manga_status", A.qs("#fbkNewStatus").value);
      fd.append("manga_author", A.qs("#fbkNewAuthor").value.trim());
      fd.append("chapter_count", String(newChapterStates.length));
      if (coverFile) fd.append("cover", coverFile, coverFile.name);
    } else if (selectedManga) {
      fd.append("manga_title", selectedManga.title);
      fd.append("manga_slug", selectedManga.slug);
      fd.append("modify_reason", A.qs("#fbkModifyReason").value.trim());
    }

    pendingFiles.forEach(function (item) {
      fd.append("attachment", item.file, item.file.name);
    });
    fd.append("image_notes", pendingFiles.map(function (item) {
      return item.file.name + " → " + item.chapterNote;
    }).join("\n"));

    var contact = A.qs("#fbkContact").value.trim();
    fd.append("contact", contact);
    if (contact.indexOf("@") !== -1) {
      fd.append("from_name", contact.split("@")[0]);
      fd.append("email", contact);
    } else {
      fd.append("from_name", contact || "匿名路人");
    }

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
        pendingFiles = [];
        coverFile = null;
        renderPreviews();
        renderCoverPreview();
        renderNewChapterCells();
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