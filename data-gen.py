#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""KIGUBI 数据生成器（维护者 GUI）

用法：
    python data-gen.py

功能：
    - 填写漫画基本信息
    - 章节数字格：左键点击半区在「未知 → 有 → 无」之间循环；
      整数格之间的 + 可插入 .5 特典；右键数字格打开该章节的详细编辑窗口
    - 预览生成并直接写入本地 data/manga-data.js（写入前自动备份为 .bak，原有内容保留）
"""

import json
import re
import sys
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

BASE = Path(__file__).resolve().parent
DATA_FILE = BASE / "data" / "manga-data.js"

# 缩进规则：与 data/manga-data.js 保持一致
IND_MANGA = "      "        # 漫画对象起始/字段
IND_CLOSE = "    "          # 漫画对象结束
IND_CH = "        "         # 章节对象起始/结束
IND_CH_FIELD = "          "  # 章节字段


# ---------------------------------------------------------------- 数据工具

def is_unknown(value):
    return value is True or value == 1


def valid_tags(tags):
    out = []
    for t in tags or []:
        if isinstance(t, dict) and str(t.get("name", "")).strip():
            out.append({
                "name": str(t["name"]).strip(),
                "note": str(t.get("note", "") or "").strip(),
                "pink": t.get("pink") is True or t.get("pink") == 1 or t.get("tone") == "pink",
            })
    return out


def valid_scenes(scenes):
    out = []
    for s in scenes or []:
        if not isinstance(s, dict):
            continue
        chars = str(s.get("characters", "") or "").strip()
        note = str(s.get("note", "") or "").strip()
        tags = valid_tags(s.get("tags"))
        if chars or note or tags:
            out.append({"characters": chars, "note": note, "tags": tags})
    return out


def js_str(value):
    return json.dumps(str(value), ensure_ascii=False)


def fmt_tags_inline(tags):
    tags = valid_tags(tags)
    if not tags:
        return None
    pieces = []
    for t in tags:
        obj = ["name: " + js_str(t["name"])]
        if t["note"]:
            obj.append("note: " + js_str(t["note"]))
        if t["pink"]:
            obj.append("pink: true")
        pieces.append("{ " + ", ".join(obj) + " }")
    return "tags: [ " + ", ".join(pieces) + " ]"


def fmt_scene_inline(scene):
    parts = ["characters: " + js_str(scene["characters"])]
    if scene.get("note"):
        parts.append("note: " + js_str(scene["note"]))
    tags = fmt_tags_inline(scene.get("tags"))
    if tags:
        parts.append(tags)
    return "{ " + ", ".join(parts) + " }"


def fmt_scenes_inline(key, scenes):
    scenes = valid_scenes(scenes)
    if not scenes:
        return None
    return key + ": [ " + ", ".join(fmt_scene_inline(s) for s in scenes) + " ]"


def fmt_chapter(ch, last=False):
    order = ch.get("order", 1)
    try:
        order_val = float(order)
        order_str = ("%g" % order_val)
    except Exception:
        order_str = str(order)

    scalars = []
    if str(ch.get("title", "") or "").strip():
        scalars.append("title: " + js_str(str(ch["title"]).strip()))
    if str(ch.get("note", "") or "").strip():
        scalars.append("note: " + js_str(str(ch["note"]).strip()))
    if is_unknown(ch.get("kissUnknown")):
        scalars.append("kissUnknown: true")
    if is_unknown(ch.get("nudityUnknown")):
        scalars.append("nudityUnknown: true")

    tags = fmt_tags_inline(ch.get("tags"))

    kiss_scenes = valid_scenes(ch.get("kiss"))
    kiss = fmt_scenes_inline("kiss", kiss_scenes)
    if not is_unknown(ch.get("kissUnknown")):
        if not kiss and ch.get("_kissOn"):
            kiss = "kiss: [ 1 ]"

    nudity_scenes = valid_scenes(ch.get("nudity"))
    nudity = fmt_scenes_inline("nudity", nudity_scenes)
    if not is_unknown(ch.get("nudityUnknown")):
        if not nudity and ch.get("_nudityOn"):
            nudity = "nudity: [ 1 ]"

    extras = []
    for s in scalars:
        extras.append(s)
    if tags:
        extras.append(tags)
    if kiss:
        extras.append(kiss)
    if nudity:
        extras.append(nudity)

    comma = "" if last else ","
    if not extras:
        return IND_CH + "{ order: " + order_str + " }" + comma

    lines = [IND_CH + "{ order: " + order_str + ","]
    for s in extras:
        lines.append(IND_CH_FIELD + s + ",")
    lines.append(IND_CH + "}" + comma)
    return "\n".join(lines)


def fmt_manga_entry(manga):
    lines = [IND_MANGA + "{"]
    lines.append(IND_MANGA + "title: " + js_str(manga["title"]) + ",")

    alt_raw = manga.get("altTitles", manga.get("alt_titles")) or []
    alt = [str(x).strip() for x in alt_raw if str(x).strip()]
    if alt:
        lines.append(IND_MANGA + "altTitles: [" + ", ".join(js_str(x) for x in alt) + "],")
    if str(manga.get("author", "") or "").strip():
        lines.append(IND_MANGA + "author: " + js_str(str(manga["author"]).strip()) + ",")
    if str(manga.get("status", "") or "").strip():
        lines.append(IND_MANGA + "status: " + js_str(str(manga["status"]).strip()) + ",")
    if str(manga.get("cover", "") or "").strip():
        lines.append(IND_MANGA + "cover: " + js_str(str(manga["cover"]).strip()) + ",")
    if str(manga.get("description", "") or "").strip():
        lines.append(IND_MANGA + "description: " + js_str(str(manga["description"]).strip()) + ",")

    tags = fmt_tags_inline(manga.get("tags"))
    if tags:
        lines.append(IND_MANGA + tags + ",")
    if manga.get("demo"):
        lines.append(IND_MANGA + "demo: true,")

    chs = sorted(manga.get("chapters") or [], key=lambda c: c.get("order", 0))
    lines.append(IND_MANGA + "chapters: [")
    for i, ch in enumerate(chs):
        lines.append(fmt_chapter(ch, last=(i == len(chs) - 1)))
    lines.append(IND_MANGA + "]")
    lines.append(IND_CLOSE + "}")
    return "\n".join(lines)


def full_file_from_entry(entry):
    return (
        "/* 由 data-gen.py 生成 */\n"
        "(function () {\n"
        '  "use strict";\n\n'
        "  window.KIGUBI_DATA = [\n"
        + entry +
        "\n  ];\n"
        "})();\n"
    )


def insert_entry_into_text(text, entry):
    marker = "window.KIGUBI_DATA"
    idx = text.find(marker)
    if idx == -1:
        return full_file_from_entry(entry)

    start = text.find("[", idx)
    if start == -1:
        return text
    end = text.find("];", start)
    if end == -1:
        return text

    tail_match = re.search(r"([ \t]*)$", text[:end])
    tail_indent = tail_match.group(1) if tail_match else "  "

    before = text[:end].rstrip()
    inner = text[start + 1:end].strip()
    if inner:
        before += ","  # 原来的最后一个条目补上逗号，新条目才是最后一条
    after = text[end:]  # 以 ]; 开头
    after = after.replace("];", tail_indent + "];", 1)
    return before + "\n" + entry.rstrip() + "\n" + after


# ---------------------------------------------------------------- 章节状态

def chapter_half_state(ch, half):
    if is_unknown(ch.get(half + "Unknown")):
        return "unknown"
    if ch.get("_" + half + "On"):
        return "has"
    raw = ch.get(half) or []
    return "has" if raw and any(isinstance(s, dict) for s in raw) else "none"


def cycle_half(ch, half):
    current = chapter_half_state(ch, half)
    if current == "none":
        ch[half + "Unknown"] = False
        ch["_" + half + "On"] = True
        ch[half] = []
    elif current == "has":
        ch[half + "Unknown"] = True
        ch["_" + half + "On"] = False
        ch[half] = []
    else:  # unknown -> none
        ch[half + "Unknown"] = False
        ch["_" + half + "On"] = False
        ch[half] = []
    return current


def new_chapter(order):
    return {
        "title": "",
        "order": order,
        "note": "",
        "kissUnknown": False,
        "nudityUnknown": False,
        "tags": [],
        "kiss": [],
        "nudity": [],
    }


# ---------------------------------------------------------------- 弹窗

def center_window(win, width, height):
    win.update_idletasks()
    sw = win.winfo_screenwidth()
    sh = win.winfo_screenheight()
    x = max(0, (sw - width) // 2)
    y = max(0, (sh - height) // 2)
    win.geometry(f"{width}x{height}+{x}+{y}")


class TagDialog(tk.Toplevel):
    """单个标签：name + note。"""

    def __init__(self, master, tag=None):
        super().__init__(master)
        self.title("标签")
        self.result = None
        self.resizable(False, False)
        self.transient(master)

        tag = tag or {"name": "", "note": ""}
        self.var_name = tk.StringVar(value=tag.get("name", ""))
        self.var_note = tk.StringVar(value=tag.get("note", ""))
        self.var_pink = tk.BooleanVar(value=tag.get("pink") is True or tag.get("pink") == 1 or tag.get("tone") == "pink")

        body = ttk.Frame(self, padding=16)
        body.pack(fill=tk.BOTH, expand=True)
        ttk.Label(body, text="标签名").grid(row=0, column=0, sticky="w")
        ttk.Entry(body, textvariable=self.var_name, width=34).grid(row=0, column=1, pady=6)
        ttk.Label(body, text="悬停注释").grid(row=1, column=0, sticky="w")
        ttk.Entry(body, textvariable=self.var_note, width=34).grid(row=1, column=1, pady=6)
        ttk.Checkbutton(body, text="粉色标签（无 note 也显示粉色）", variable=self.var_pink
                        ).grid(row=2, column=0, columnspan=2, sticky="w", pady=(4, 0))

        btns = ttk.Frame(body)
        btns.grid(row=3, column=0, columnspan=2, pady=(12, 0))
        ttk.Button(btns, text="确定", command=self._ok).pack(side=tk.LEFT, padx=8)
        ttk.Button(btns, text="取消", command=self.destroy).pack(side=tk.LEFT, padx=8)

        self.bind("<Return>", lambda e: self._ok())
        self.bind("<Escape>", lambda e: self.destroy())
        self.grab_set()
        center_window(self, 430, 260)
        self.wait_window(self)

    def _ok(self):
        name = self.var_name.get().strip()
        if not name:
            self.destroy()
            return
        self.result = {"name": name, "note": self.var_note.get().strip(), "pink": self.var_pink.get()}
        self.destroy()


def edit_tag(master, tag=None):
    dlg = TagDialog(master, tag)
    return dlg.result


class TagsEditor(ttk.Frame):
    """标签小编辑器：列表 + 添加/删除。"""

    def __init__(self, master, tags, height=3):
        super().__init__(master)
        self.tags = tags
        self.listbox = tk.Listbox(self, height=height, activestyle="dotbox")
        self.listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        bar = ttk.Frame(self)
        bar.pack(side=tk.LEFT, fill=tk.Y, padx=4)
        ttk.Button(bar, text="添加", width=6, command=self._add).pack(pady=2)
        ttk.Button(bar, text="编辑", width=6, command=self._edit).pack(pady=2)
        ttk.Button(bar, text="删除", width=6, command=self._del).pack(pady=2)
        self.refresh()

    def _selected_index(self):
        sel = self.listbox.curselection()
        return sel[0] if sel else None

    def refresh(self):
        self.listbox.delete(0, tk.END)
        for t in self.tags:
            note = ("  // " + t["note"]) if t["note"] else ""
            self.listbox.insert(tk.END, t["name"] + note)

    def _add(self):
        dlg = TagDialog(self.winfo_toplevel())
        if dlg.result:
            self.tags.append(dlg.result)
            self.refresh()

    def _edit(self):
        idx = self._selected_index()
        if idx is None:
            return
        dlg = TagDialog(self.winfo_toplevel(), self.tags[idx])
        if dlg.result:
            self.tags[idx] = dlg.result
            self.refresh()

    def _del(self):
        idx = self._selected_index()
        if idx is None:
            return
        del self.tags[idx]
        self.refresh()


class SceneDialog(tk.Toplevel):
    """一个吻戏/ちくび：characters + note + 场景标签。"""

    def __init__(self, master, scene=None):
        super().__init__(master)
        self.title("场景记录")
        self.result = None
        self.resizable(True, True)
        self.transient(master)

        scene = scene or {"characters": "", "note": "", "tags": []}
        self.scene = {"characters": scene.get("characters", ""),
                      "note": scene.get("note", ""),
                      "tags": [dict(t) for t in (scene.get("tags") or [])]}
        self.var_char = tk.StringVar(value=self.scene["characters"])
        self.var_note = tk.StringVar(value=self.scene["note"])

        body = ttk.Frame(self, padding=16)
        body.pack(fill=tk.BOTH, expand=True)
        ttk.Label(body, text="人物（如 A × B）").grid(row=0, column=0, sticky="w")
        ttk.Entry(body, textvariable=self.var_char, width=44).grid(row=0, column=1, pady=6)
        ttk.Label(body, text="情境与镜头描述").grid(row=1, column=0, sticky="w")
        ttk.Entry(body, textvariable=self.var_note, width=44).grid(row=1, column=1, pady=6)
        ttk.Label(body, text="场景标签").grid(row=2, column=0, sticky="nw")
        self.tags_editor = TagsEditor(body, self.scene["tags"], height=4)
        self.tags_editor.grid(row=2, column=1, pady=6, sticky="we")

        btns = ttk.Frame(body)
        btns.grid(row=3, column=0, columnspan=2, pady=(12, 0))
        ttk.Button(btns, text="确定", command=self._ok).pack(side=tk.LEFT, padx=8)
        ttk.Button(btns, text="取消", command=self.destroy).pack(side=tk.LEFT, padx=8)

        self.bind("<Return>", lambda e: self._ok())
        self.bind("<Escape>", lambda e: self.destroy())
        self.grab_set()
        center_window(self, 560, 330)
        self.wait_window(self)

    def _ok(self):
        self.scene["characters"] = self.var_char.get().strip()
        self.scene["note"] = self.var_note.get().strip()
        self.scene["tags"] = self.tags_editor.tags
        self.result = self.scene
        self.destroy()


def edit_scene(master, scene=None):
    dlg = SceneDialog(master, scene)
    return dlg.result


class ScenesEditor(ttk.Frame):
    """场景列表编辑器：Treeview + 添加/编辑/删除。"""

    def __init__(self, master, scenes, height=4):
        super().__init__(master)
        self.scenes = scenes
        self.tree = ttk.Treeview(self, columns=("c", "n"), show="headings", height=height)
        self.tree.heading("c", text="人物")
        self.tree.heading("n", text="描述")
        self.tree.column("c", width=140, anchor="w")
        self.tree.column("n", width=280, anchor="w")
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        bar = ttk.Frame(self)
        bar.pack(side=tk.LEFT, fill=tk.Y, padx=4)
        ttk.Button(bar, text="添加", width=6, command=self._add).pack(pady=2)
        ttk.Button(bar, text="编辑", width=6, command=self._edit).pack(pady=2)
        ttk.Button(bar, text="删除", width=6, command=self._del).pack(pady=2)
        self.refresh()

    def _selected(self):
        sel = self.tree.selection()
        return self.tree.item(sel[0], "text") if sel else None

    def _index(self):
        sel = self.tree.selection()
        return int(sel[0]) if sel else None

    def refresh(self):
        for iid in self.tree.get_children():
            self.tree.delete(iid)
        for i, s in enumerate(self.scenes):
            self.tree.insert("", tk.END, iid=str(i), values=(s.get("characters", ""),
                                                              s.get("note", "")))

    def _add(self):
        dlg = SceneDialog(self.winfo_toplevel())
        if dlg.result:
            self.scenes.append(dlg.result)
            self.refresh()

    def _edit(self):
        idx = self._index()
        if idx is None:
            return
        dlg = SceneDialog(self.winfo_toplevel(), self.scenes[idx])
        if dlg.result:
            self.scenes[idx] = dlg.result
            self.refresh()

    def _del(self):
        idx = self._index()
        if idx is None:
            return
        del self.scenes[idx]
        self.refresh()


class ChapterEditor(tk.Toplevel):
    """右键章节格时弹出的详细编辑窗口。"""

    def __init__(self, master, chapter, on_close=None):
        super().__init__(master)
        self.title(f"编辑第 {chapter.get('order', '?')} 章")
        self.chapter = chapter
        self.on_close = on_close
        self.resizable(True, True)
        self.transient(master)
        self.grab_set()

        self.var_title = tk.StringVar(value=chapter.get("title", ""))
        self.var_order = tk.StringVar(value=str(chapter.get("order", "")))
        self.var_note = tk.StringVar(value=chapter.get("note", ""))
        self.var_kiss_unknown = tk.BooleanVar(value=is_unknown(chapter.get("kissUnknown")))
        self.var_nudity_unknown = tk.BooleanVar(value=is_unknown(chapter.get("nudityUnknown")))

        frame = ttk.Frame(self, padding=16)
        frame.pack(fill=tk.BOTH, expand=True)

        ttk.Label(frame, text="order").grid(row=0, column=0, sticky="w")
        ttk.Entry(frame, textvariable=self.var_order, width=12).grid(row=0, column=1, sticky="w", pady=5)
        ttk.Label(frame, text="标题（可选）").grid(row=0, column=2, sticky="w", padx=(12, 0))
        ttk.Entry(frame, textvariable=self.var_title, width=48).grid(row=0, column=3, pady=5)

        ttk.Label(frame, text="备注 note").grid(row=1, column=0, sticky="w")
        ttk.Entry(frame, textvariable=self.var_note, width=72).grid(row=1, column=1, columnspan=3, sticky="we", pady=5)

        ttk.Checkbutton(frame, text="亲吻未知 (kissUnknown)", variable=self.var_kiss_unknown,
                        command=lambda: self._set_unknown("kissUnknown", self.var_kiss_unknown.get())
                        ).grid(row=2, column=0, columnspan=2, sticky="w")
        ttk.Checkbutton(frame, text="ちくび未知 (nudityUnknown)", variable=self.var_nudity_unknown,
                        command=lambda: self._set_unknown("nudityUnknown", self.var_nudity_unknown.get())
                        ).grid(row=2, column=2, columnspan=2, sticky="w")

        ttk.Label(frame, text="章节标签").grid(row=3, column=0, sticky="nw", pady=(8, 0))
        self.tags_editor = TagsEditor(frame, chapter.setdefault("tags", []), height=4)
        self.tags_editor.grid(row=3, column=1, columnspan=3, sticky="we", pady=(8, 0))

        ttk.Label(frame, text="亲吻场景 kiss").grid(row=4, column=0, sticky="nw", pady=(8, 0))
        self.kiss_editor = ScenesEditor(frame, chapter.setdefault("kiss", []), height=5)
        self.kiss_editor.grid(row=4, column=1, columnspan=3, sticky="we", pady=(8, 0))

        ttk.Label(frame, text="ちくび nudity").grid(row=5, column=0, sticky="nw", pady=(8, 0))
        self.nudity_editor = ScenesEditor(frame, chapter.setdefault("nudity", []), height=5)
        self.nudity_editor.grid(row=5, column=1, columnspan=3, sticky="we", pady=(8, 0))

        btns = ttk.Frame(frame)
        btns.grid(row=6, column=0, columnspan=4, pady=(14, 0))
        ttk.Button(btns, text="保存并关闭", command=self._ok).pack(side=tk.LEFT, padx=8)
        ttk.Button(btns, text="取消", command=self.destroy).pack(side=tk.LEFT, padx=8)

        self.bind("<Escape>", lambda e: self.destroy())
        self.protocol("WM_DELETE_WINDOW", self.destroy)
        self.wait_window(self)

    def _set_unknown(self, key, value):
        self.chapter[key] = True if value else False

    def _ok(self):
        try:
            self.chapter["order"] = float(self.var_order.get().strip())
        except ValueError:
            pass
        self.chapter["title"] = self.var_title.get().strip()
        self.chapter["note"] = self.var_note.get().strip()
        self.chapter["kissUnknown"] = self.var_kiss_unknown.get()
        self.chapter["nudityUnknown"] = self.var_nudity_unknown.get()
        self.chapter["tags"] = self.tags_editor.tags
        self.chapter["kiss"] = self.kiss_editor.scenes
        self.chapter["nudity"] = self.nudity_editor.scenes
        if self.on_close:
            self.on_close()
        self.destroy()


# ---------------------------------------------------------------- 章节格子

CELL_W = 64
CELL_H = 64
COLOR_NONE = "#efe6dd"
COLOR_UNKNOWN = "#4eb5d8"
COLOR_KISS = "#ef7d9b"
COLOR_NUDITY = "#9f7ee8"


class ChapterCell(tk.Canvas):
    """单个章节数字格，模拟网页上的对角半区格子。"""

    def __init__(self, master, chapter, on_cycle=None, on_right_click=None):
        super().__init__(master, width=CELL_W, height=CELL_H,
                         bg="#fbf6f0", highlightthickness=0, bd=0)
        self.chapter = chapter
        self.on_cycle = on_cycle
        self.on_right_click = on_right_click
        self.bind("<Button-1>", self._on_click)
        self.bind("<Button-3>", self._on_right_click)
        self.bind("<Enter>", lambda e: self.config(cursor="hand2"))
        self.bind("<Leave>", lambda e: self.config(cursor=""))
        self.redraw()

    def redraw(self):
        self.delete("all")
        kiss = chapter_half_state(self.chapter, "kiss")
        nudity = chapter_half_state(self.chapter, "nudity")
        kiss_color = COLOR_UNKNOWN if kiss == "unknown" else (COLOR_KISS if kiss == "has" else COLOR_NONE)
        nudity_color = COLOR_UNKNOWN if nudity == "unknown" else (COLOR_NUDITY if nudity == "has" else COLOR_NONE)

        pad = 3
        self.create_polygon(pad, pad, CELL_W - pad, pad, pad, CELL_H - pad,
                            fill=kiss_color, outline="", tags=("kiss",))
        self.create_polygon(CELL_W - pad, CELL_H - pad, CELL_W - pad, pad, pad, CELL_H - pad,
                            fill=nudity_color, outline="", tags=("nudity",))
        # 白色对角线
        self.create_line(pad, CELL_H - pad, CELL_W - pad, pad, fill="#ffffff",
                         width=2, tags=("slash",))

        # 数字为中心的小圆
        self.create_oval(CELL_W // 2 - 12, CELL_H // 2 - 12,
                         CELL_W // 2 + 12, CELL_H // 2 + 12,
                         fill="#fffdfb", outline="#e6d2c8", width=1)
        order = self.chapter.get("order", "")
        self.create_text(CELL_W // 2, CELL_H // 2, text=str(order),
                         font=("Segoe UI", 9, "bold"), fill="#3d2f36", tags=("num",))

        # 未知问号
        if kiss == "unknown":
            self.create_text(14, 9, text="?", font=("Segoe UI", 11, "bold"),
                             fill="#ffffff", tags=("qk",))
        if nudity == "unknown":
            self.create_text(CELL_W - 14, CELL_H - 9, text="?",
                             font=("Segoe UI", 11, "bold"), fill="#ffffff", tags=("qn",))

    def _on_click(self, event):
        if event.x + event.y <= CELL_W:
            half = "kiss"
        else:
            half = "nudity"
        if self.on_cycle:
            self.on_cycle(self.chapter, half)
            self.redraw()

    def _on_right_click(self, event):
        if self.on_right_click:
            self.on_right_click(self.chapter)


# ---------------------------------------------------------------- 主 GUI

class App:
    def __init__(self, root):
        self.root = root
        self.root.title("KIGUBI 数据生成器（维护者用）")
        self.root.geometry("1180x760")
        self.root.minsize(960, 640)

        self.chapters = [new_chapter(1)]
        self.manga_tags = []

        self._build_ui()
        self.rebuild_cells()
        self._update_cell_scroll_region()

    # ---------- UI 构建 ----------
    def _build_ui(self):
        main = ttk.Frame(self.root, padding=10)
        main.pack(fill=tk.BOTH, expand=True)

        # 上部：漫画信息
        info = ttk.LabelFrame(main, text="漫画基本信息", padding=10)
        info.pack(fill=tk.X)

        self.var_title = tk.StringVar()
        self.var_alt = tk.StringVar()
        self.var_author = tk.StringVar()
        self.var_status = tk.StringVar(value="")
        self.var_cover = tk.StringVar()
        self.var_desc = tk.StringVar()
        self.var_demo = tk.BooleanVar(value=False)

        grid = ttk.Frame(info)
        grid.pack(fill=tk.X)
        ttk.Label(grid, text="标题（必填）").grid(row=0, column=0, sticky="w")
        ttk.Entry(grid, textvariable=self.var_title, width=40).grid(row=0, column=1, sticky="we", padx=4, pady=3)
        ttk.Label(grid, text="别名（逗号分隔）").grid(row=0, column=2, sticky="w", padx=(12, 0))
        ttk.Entry(grid, textvariable=self.var_alt, width=40).grid(row=0, column=3, sticky="we", padx=4, pady=3)

        ttk.Label(grid, text="作者").grid(row=1, column=0, sticky="w")
        ttk.Entry(grid, textvariable=self.var_author, width=40).grid(row=1, column=1, sticky="we", padx=4, pady=3)
        ttk.Label(grid, text="连载状况").grid(row=1, column=2, sticky="w", padx=(12, 0))
        self.status_box = ttk.Combobox(grid, textvariable=self.var_status, width=18,
                                       values=["", "连载中", "已完结", "休刊"])
        self.status_box.grid(row=1, column=3, sticky="w", padx=4, pady=3)

        ttk.Label(grid, text="封面文件名").grid(row=2, column=0, sticky="w")
        ttk.Entry(grid, textvariable=self.var_cover, width=40).grid(row=2, column=1, sticky="we", padx=4, pady=3)
        ttk.Label(grid, text="默认加 assets/covers/ 前缀").grid(row=2, column=2, columnspan=2, sticky="w", padx=(12, 0))
        ttk.Label(grid, text="简介").grid(row=3, column=0, sticky="w")
        ttk.Entry(grid, textvariable=self.var_desc, width=40).grid(row=3, column=1, columnspan=3, sticky="we", padx=4, pady=3)
        ttk.Checkbutton(grid, text="标记为示例数据（demo: true）", variable=self.var_demo).grid(
            row=4, column=0, columnspan=4, sticky="w", pady=(4, 0))

        row_tags = ttk.Frame(info)
        row_tags.pack(fill=tk.X, pady=(6, 0))
        ttk.Label(row_tags, text="漫画标签").pack(side=tk.LEFT)
        self.manga_tags_editor = TagsEditor(row_tags, self.manga_tags, height=2)
        self.manga_tags_editor.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=8)

        # 章节工具条
        ch_bar = ttk.LabelFrame(main, text="章节（左键点半区：无 → 有 → 未知；右键数字格：编辑该章；✕ 为删除本章）", padding=10)
        ch_bar.pack(fill=tk.X, pady=(10, 0))

        bar = ttk.Frame(ch_bar)
        bar.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(bar, text="正篇章节数").pack(side=tk.LEFT)
        self.var_count = tk.StringVar(value="1")
        ttk.Spinbox(bar, from_=1, to=300, textvariable=self.var_count, width=6).pack(side=tk.LEFT, padx=6)
        ttk.Button(bar, text="生成数字格", command=self.generate_count).pack(side=tk.LEFT, padx=4)
        ttk.Button(bar, text="添加正篇", command=self.add_chapter).pack(side=tk.LEFT, padx=4)
        ttk.Button(bar, text="插入特典", command=self.add_special).pack(side=tk.LEFT, padx=4)

        batch = ttk.Frame(ch_bar)
        batch.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(batch, text="批量状态：").pack(side=tk.LEFT)
        self.var_batch_from = tk.StringVar(value="1")
        self.var_batch_to = tk.StringVar(value="1")
        self.var_batch_half = tk.StringVar(value="kiss")
        self.var_batch_state = tk.StringVar(value="无")
        ttk.Label(batch, text="从").pack(side=tk.LEFT, padx=(0, 4))
        ttk.Entry(batch, textvariable=self.var_batch_from, width=6).pack(side=tk.LEFT)
        ttk.Label(batch, text="到").pack(side=tk.LEFT, padx=(8, 4))
        ttk.Entry(batch, textvariable=self.var_batch_to, width=6).pack(side=tk.LEFT)
        ttk.Combobox(batch, textvariable=self.var_batch_half, width=8, state="readonly",
                     values=["kiss", "nudity"]).pack(side=tk.LEFT, padx=8)
        ttk.Combobox(batch, textvariable=self.var_batch_state, width=8, state="readonly",
                     values=["无", "未知", "有"]).pack(side=tk.LEFT, padx=8)
        ttk.Button(batch, text="批量应用", command=self.apply_batch_state).pack(side=tk.LEFT, padx=8)

        # 章节格横向滚动区域
        scroll_wrap = ttk.Frame(ch_bar)
        scroll_wrap.pack(fill=tk.X)
        self.cell_canvas = tk.Canvas(scroll_wrap, height=116, bd=0, highlightthickness=0)
        self.cell_hbar = ttk.Scrollbar(scroll_wrap, orient=tk.HORIZONTAL, command=self.cell_canvas.xview)
        self.cell_canvas.configure(xscrollcommand=self.cell_hbar.set)
        self.cell_inner = ttk.Frame(self.cell_canvas)
        self._cell_window = self.cell_canvas.create_window((2, 2), window=self.cell_inner, anchor="nw")
        self.cell_canvas.pack(fill=tk.X, side=tk.TOP)
        self.cell_hbar.pack(fill=tk.X, side=tk.BOTTOM)
        self.cell_inner.bind("<Configure>", lambda e: self.cell_canvas.configure(scrollregion=self.cell_canvas.bbox("all")))

        # 预览与写入
        out = ttk.LabelFrame(main, text="输出", padding=10)
        out.pack(fill=tk.BOTH, expand=True, pady=(10, 0))
        btns = ttk.Frame(out)
        btns.pack(fill=tk.X, pady=(0, 6))
        ttk.Button(btns, text="预览生成条目", command=self.preview).pack(side=tk.LEFT, padx=4)
        ttk.Button(btns, text="写入 data/manga-data.js（自动备份，不覆盖原内容）",
                   command=self.write_to_data_file).pack(side=tk.LEFT, padx=4)
        self.preview_text = tk.Text(out, height=10, font=("Consolas", 10))
        self.preview_text.pack(fill=tk.BOTH, expand=True)

    # ---------- 章节格 ----------
    def rebuild_cells(self):
        for child in self.cell_inner.winfo_children():
            child.destroy()

        self.chapters.sort(key=lambda c: c.get("order", 0))

        for i, ch in enumerate(self.chapters):
            wrap = ttk.Frame(self.cell_inner)
            cell = ChapterCell(wrap, ch,
                               on_cycle=self._on_cell_cycle,
                               on_right_click=self._open_chapter_editor)
            cell.pack(side=tk.TOP, padx=2, pady=(4, 0))
            del_btn = ttk.Button(wrap, text="✕", width=3,
                                 command=lambda c=ch: self._delete_chapter(c))
            del_btn.pack(side=tk.TOP)
            wrap.pack(side=tk.LEFT, padx=4, pady=4)

            nxt = self.chapters[i + 1] if i + 1 < len(self.chapters) else None
            if nxt and self._is_int_order(ch["order"]) and self._is_int_order(nxt["order"]):
                plus = ttk.Button(self.cell_inner, text="+", width=3,
                                  command=lambda o=ch["order"]: self.add_special(o))
                plus.pack(side=tk.LEFT, padx=2, pady=(38, 0))

        add = ttk.Button(self.cell_inner, text="+", width=5, command=self.add_chapter)
        add.pack(side=tk.LEFT, padx=6, pady=(26, 0))

        self.root.after(50, self._update_cell_scroll_region)

    def _update_cell_scroll_region(self):
        self.cell_canvas.configure(scrollregion=self.cell_canvas.bbox("all"))

    @staticmethod
    def _is_int_order(order):
        try:
            return float(order).is_integer()
        except (TypeError, ValueError):
            return False

    def _on_cell_cycle(self, chapter, half):
        cycle_half(chapter, half)
        # 重绘兄弟控件
        for child in self.cell_inner.winfo_children():
            if isinstance(child, ChapterCell):
                child.redraw()

    def _open_chapter_editor(self, chapter):
        def on_close():
            self.rebuild_cells()
        ChapterEditor(self.root, chapter, on_close=on_close)

    def _delete_chapter(self, chapter):
        if chapter in self.chapters:
            self.chapters.remove(chapter)
        else:
            idx = next((i for i, c in enumerate(self.chapters) if c is chapter), -1)
            if idx >= 0:
                self.chapters.pop(idx)
        self.rebuild_cells()
        return True

    def apply_batch_state(self):
        try:
            fro = float(self.var_batch_from.get())
            to = float(self.var_batch_to.get())
        except ValueError:
            messagebox.showwarning("范围错误", "请填写数字范围（如 3 到 10）。")
            return
        if fro > to:
            fro, to = to, fro
        half = self.var_batch_half.get()
        state = self.var_batch_state.get()

        affected = [c for c in self.chapters if fro <= float(c.get("order", 0)) <= to]
        if not affected:
            messagebox.showwarning("没有章节", "该范围内没有章节。")
            return

        for ch in affected:
            if state == "无":
                ch[half + "Unknown"] = False
                ch["_" + half + "On"] = False
                ch[half] = []
            elif state == "未知":
                ch[half + "Unknown"] = True
                ch["_" + half + "On"] = False
            else:  # 有
                ch[half + "Unknown"] = False
                ch["_" + half + "On"] = True

        for child in self.cell_inner.winfo_children():
            if isinstance(child, ChapterCell):
                child.redraw()
        self.rebuild_cells()

    def max_order(self):
        return max((c.get("order", 0) for c in self.chapters), default=0)

    def add_chapter(self):
        base = int(self.max_order()) + 1
        self.chapters.append(new_chapter(base))
        self.chapters.sort(key=lambda c: c.get("order", 0))
        self.rebuild_cells()

    def add_special(self, after_order=None):
        if after_order is None:
            base = int(self.max_order())
            if base < 1:
                base = 1
            order = base + 0.5
        else:
            order = float(after_order) + 0.5
        self.chapters.append(new_chapter(order))
        self.chapters.sort(key=lambda c: c.get("order", 0))
        self.rebuild_cells()

    def generate_count(self):
        count = int(self.var_count.get() or 0)
        count = max(1, min(300, count))
        wanted = set(range(1, count + 1))
        existing_int = {c.get("order") for c in self.chapters if self._is_int_order(c.get("order", 0))}
        # 新增缺失整数章
        for n in wanted - existing_int:
            self.chapters.append(new_chapter(float(n)))
        # 删除多余整数章：只删除没有实际内容的
        for c in list(self.chapters):
            o = c.get("order", 0)
            if self._is_int_order(o) and float(o) > count:
                if not (str(c.get("title", "") or "").strip() or str(c.get("note", "") or "").strip()
                        or valid_tags(c.get("tags")) or valid_scenes(c.get("kiss")) or valid_scenes(c.get("nudity"))):
                    self.chapters.remove(c)
        self.chapters.sort(key=lambda c: c.get("order", 0))
        self.rebuild_cells()

    # ---------- 生成 / 写入 ----------
    def collect_manga(self):
        title = self.var_title.get().strip()
        if not title:
            messagebox.showwarning("缺少标题", "请先填写漫画标题。")
            return None
        alt = [x.strip() for x in self.var_alt.get().replace("，", ",").split(",") if x.strip()]
        cover = self.var_cover.get().strip()
        if not cover:
            covers_dir = BASE / "assets" / "covers"
            for ext in (".jpg", ".jpeg", ".png", ".webp"):
                candidate = covers_dir / (title + ext)
                if candidate.exists():
                    cover = "assets/covers/" + candidate.name
                    break
        if cover and "/" not in cover:
            cover = "assets/covers/" + cover
        cover = cover.replace("\\", "/")
        manga = {
            "title": title,
            "alt_titles": alt,
            "author": self.var_author.get().strip(),
            "status": self.var_status.get().strip(),
            "cover": cover,
            "description": self.var_desc.get().strip(),
            "demo": self.var_demo.get(),
            "tags": self.manga_tags,
            "chapters": self.chapters,
        }
        return manga

    def make_entry_text(self):
        manga = self.collect_manga()
        if manga is None:
            return None
        return fmt_manga_entry(manga)

    def preview(self):
        entry = self.make_entry_text()
        if entry is None:
            return
        self.preview_text.delete("1.0", tk.END)
        self.preview_text.insert("1.0", entry)

    def write_to_data_file(self):
        entry = self.make_entry_text()
        if entry is None:
            return
        path = DATA_FILE
        if not path.exists():
            path = Path(filedialog.askopenfilename(
                title="选择 data/manga-data.js",
                filetypes=[("JavaScript", "*.js"), ("所有文件", "*.*")]))
            if not path:
                return

        text = path.read_text(encoding="utf-8")
        backup = path.with_suffix(".js.bak")
        try:
            backup.write_text(text, encoding="utf-8")
        except OSError:
            pass

        updated = insert_entry_into_text(text, entry)
        path.write_text(updated, encoding="utf-8")
        entry_count = len(self.chapters)
        messagebox.showinfo("写入成功",
                            f"已插入到 {path.name}（原有内容保留）。\n"
                            f"备份文件：{backup.name}\n"
                            f"当前章节数：{entry_count}")


def main():
    root = tk.Tk()
    try:
        ttk.Style().theme_use("clam")
    except tk.TclError:
        pass
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()