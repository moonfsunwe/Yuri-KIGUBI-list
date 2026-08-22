# -*- coding: utf-8 -*-
"""KIGUBI 数据生成器（维护者 GUI）
 
用法：
    python data-gen.py

功能：
    - 填写漫画基本信息
    - 章节数字格：左键点击半区在「无 → 有 → 未知」之间循环；
      整数格之间的 + 可插入 .5 特典；右键数字格选中该章；
      ✕ 删除该章
    - 所有编辑均在同一个主窗口中完成：章节、标签、场景都在下方面板编辑
    - 预览生成并直接写入本地 data/manga-data.js（写入前自动备份为 .bak，原有内容保留）
"""

import json
import re
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


# ---------------------------------------------------------------- 单窗口内嵌编辑器

class TagsEditor(ttk.Frame):
    """窗口内嵌的标签编辑器：列表 + 表单 + 添加/更新/删除。"""

    def __init__(self, master, tags, height=4):
        super().__init__(master)
        self.tags = tags
        self.selected_index = None

        self.listbox = tk.Listbox(self, height=height, activestyle="dotbox")
        self.listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.listbox.bind("<<ListboxSelect>>", self._on_list_select)

        form = ttk.Frame(self)
        form.pack(side=tk.LEFT, fill=tk.Y, padx=8)

        ttk.Label(form, text="标签名").grid(row=0, column=0, sticky="w")
        self.var_name = tk.StringVar()
        ttk.Entry(form, textvariable=self.var_name, width=18).grid(row=0, column=1, pady=3, padx=(4, 0))

        ttk.Label(form, text="备注").grid(row=1, column=0, sticky="w")
        self.var_note = tk.StringVar()
        ttk.Entry(form, textvariable=self.var_note, width=18).grid(row=1, column=1, pady=3, padx=(4, 0))

        self.var_pink = tk.BooleanVar(value=False)
        ttk.Checkbutton(form, text="粉色", variable=self.var_pink).grid(
            row=2, column=0, columnspan=2, sticky="w", pady=(2, 4))

        btns = ttk.Frame(form)
        btns.grid(row=3, column=0, columnspan=2)
        ttk.Button(btns, text="添加", width=7, command=self._add).pack(side=tk.LEFT, padx=2)
        ttk.Button(btns, text="更新选中", width=9, command=self._update).pack(side=tk.LEFT, padx=2)
        ttk.Button(btns, text="删除选中", width=9, command=self._delete).pack(side=tk.LEFT, padx=2)

        self.refresh()

    def set_tags(self, tags):
        self.tags = tags
        self.selected_index = None
        self.var_name.set("")
        self.var_note.set("")
        self.var_pink.set(False)
        self.refresh()

    def refresh(self):
        self.listbox.delete(0, tk.END)
        for t in self.tags:
            note = ("  // " + t["note"]) if t.get("note") else ""
            pink = "  [粉]" if t.get("pink") else ""
            self.listbox.insert(tk.END, t.get("name", "") + note + pink)

    def _on_list_select(self, event=None):
        sel = self.listbox.curselection()
        if not sel:
            return
        self.selected_index = sel[0]
        t = self.tags[self.selected_index]
        self.var_name.set(t.get("name", ""))
        self.var_note.set(t.get("note", ""))
        self.var_pink.set(t.get("pink") is True)

    def _collect(self):
        return {
            "name": self.var_name.get().strip(),
            "note": self.var_note.get().strip(),
            "pink": self.var_pink.get(),
        }

    def _add(self):
        data = self._collect()
        if not data["name"]:
            messagebox.showwarning("标签", "标签名不能为空。", parent=self.winfo_toplevel())
            return
        self.tags.append(data)
        self.var_name.set("")
        self.var_note.set("")
        self.var_pink.set(False)
        self.selected_index = None
        self.refresh()

    def _update(self):
        if self.selected_index is None:
            messagebox.showwarning("标签", "请先在左侧列表选中要更新的标签。", parent=self.winfo_toplevel())
            return
        data = self._collect()
        if not data["name"]:
            messagebox.showwarning("标签", "标签名不能为空。", parent=self.winfo_toplevel())
            return
        self.tags[self.selected_index] = data
        self.refresh()

    def _delete(self):
        if self.selected_index is None:
            messagebox.showwarning("标签", "请先在左侧列表选中要删除的标签。", parent=self.winfo_toplevel())
            return
        del self.tags[self.selected_index]
        self.selected_index = None
        self.var_name.set("")
        self.var_note.set("")
        self.var_pink.set(False)
        self.refresh()


class ScenesEditor(ttk.Frame):
    """窗口内嵌的场景编辑器：场景列表 + 人物/描述 + 场景标签。"""

    def __init__(self, master, scenes, height=5):
        super().__init__(master)
        self.scenes = scenes
        self.selected_index = None

        self.listbox = tk.Listbox(self, height=height, activestyle="dotbox")
        self.listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.listbox.bind("<<ListboxSelect>>", self._on_list_select)

        form = ttk.Frame(self)
        form.pack(side=tk.LEFT, fill=tk.Y, padx=8)

        ttk.Label(form, text="人物").grid(row=0, column=0, sticky="w")
        self.var_char = tk.StringVar()
        ttk.Entry(form, textvariable=self.var_char, width=16).grid(row=0, column=1, pady=3, padx=(4, 0))

        ttk.Label(form, text="描述").grid(row=1, column=0, sticky="w")
        self.var_note = tk.StringVar()
        ttk.Entry(form, textvariable=self.var_note, width=16).grid(row=1, column=1, pady=3, padx=(4, 0))

        btns = ttk.Frame(form)
        btns.grid(row=2, column=0, columnspan=2, pady=4)
        ttk.Button(btns, text="添加场景", width=9, command=self._add).pack(side=tk.LEFT, padx=2)
        ttk.Button(btns, text="更新选中", width=9, command=self._update).pack(side=tk.LEFT, padx=2)
        ttk.Button(btns, text="删除选中", width=9, command=self._delete).pack(side=tk.LEFT, padx=2)

        ttk.Label(form, text="场景标签").grid(row=3, column=0, columnspan=2, sticky="w", pady=(4, 0))
        self.tags_editor = TagsEditor(form, [], height=3)
        self.tags_editor.grid(row=4, column=0, columnspan=2, sticky="we", pady=(4, 0))

        self.refresh()

    def set_scenes(self, scenes):
        self.scenes = scenes
        self.selected_index = None
        self.var_char.set("")
        self.var_note.set("")
        self.tags_editor.set_tags([])
        self.refresh()

    def refresh(self):
        self.listbox.delete(0, tk.END)
        for s in self.scenes:
            chars = s.get("characters", "") or "（未填人物）"
            note = s.get("note", "")
            tags = s.get("tags") or []
            tag_names = ", ".join(t.get("name", "") for t in tags if t.get("name"))
            line = chars + ("  |  " + note if note else "") + ("  (" + tag_names + ")" if tag_names else "")
            self.listbox.insert(tk.END, line)

    def _current_tags(self):
        return self.tags_editor.tags

    def _on_list_select(self, event=None):
        sel = self.listbox.curselection()
        if not sel:
            return
        self.selected_index = sel[0]
        s = self.scenes[self.selected_index]
        self.var_char.set(s.get("characters", ""))
        self.var_note.set(s.get("note", ""))
        self.tags_editor.set_tags(s.setdefault("tags", []))

    def _collect(self):
        return {
            "characters": self.var_char.get().strip(),
            "note": self.var_note.get().strip(),
            "tags": list(self.tags_editor.tags),
        }

    def _add(self):
        data = self._collect()
        if not data["characters"] and not data["note"] and not data["tags"]:
            messagebox.showwarning("场景", "请至少填写人物、描述或标签中的一项。", parent=self.winfo_toplevel())
            return
        self.scenes.append(data)
        self.selected_index = None
        self.var_char.set("")
        self.var_note.set("")
        self.tags_editor.set_tags([])
        self.refresh()

    def _update(self):
        if self.selected_index is None:
            messagebox.showwarning("场景", "请先在左侧列表选中要更新的场景。", parent=self.winfo_toplevel())
            return
        data = self._collect()
        if not data["characters"] and not data["note"] and not data["tags"]:
            messagebox.showwarning("场景", "请至少填写人物、描述或标签中的一项。", parent=self.winfo_toplevel())
            return
        self.scenes[self.selected_index] = data
        self.refresh()

    def _delete(self):
        if self.selected_index is None:
            messagebox.showwarning("场景", "请先在左侧列表选中要删除的场景。", parent=self.winfo_toplevel())
            return
        del self.scenes[self.selected_index]
        self.selected_index = None
        self.var_char.set("")
        self.var_note.set("")
        self.tags_editor.set_tags([])
        self.refresh()


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
        self.select_pending = False
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
        self.create_line(pad, CELL_H - pad, CELL_W - pad, pad, fill="#ffffff",
                         width=2, tags=("slash",))

        self.create_oval(CELL_W // 2 - 12, CELL_H // 2 - 12,
                         CELL_W // 2 + 12, CELL_H // 2 + 12,
                         fill="#fffdfb", outline="#e6d2c8", width=1)
        order = self.chapter.get("order", "")
        self.create_text(CELL_W // 2, CELL_H // 2, text=str(order),
                         font=("Segoe UI", 9, "bold"), fill="#3d2f36", tags=("num",))

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
        self.root.geometry("1100x800")
        self.root.minsize(1100, 780)

        self.chapters = [new_chapter(1)]
        self.manga_tags = []
        self.current_chapter = None

        self._build_ui()
        self.rebuild_cells()
        self._update_cell_scroll_region()
        self.select_chapter(self.chapters[0])

    # ---------- UI 构建 ----------
    def _build_ui(self):
        outer = ttk.Frame(self.root, padding=10)
        outer.pack(fill=tk.BOTH, expand=True)

        # 顶部操作条（始终可见）
        top_bar = ttk.Frame(outer)
        top_bar.pack(fill=tk.X, pady=(0, 10))
        ttk.Button(top_bar, text="预览", command=self.preview).pack(side=tk.LEFT, padx=4)
        ttk.Button(top_bar, text="插入 data/manga-data.js",
                   command=self.write_to_data_file).pack(side=tk.LEFT, padx=4)

        # 下方所有内容可垂直滚动，避免控件超出窗口不可见
        wrapper = ttk.Frame(outer)
        wrapper.pack(fill=tk.BOTH, expand=True)

        self.main_canvas = tk.Canvas(wrapper, bd=0, highlightthickness=0)
        self.main_vsb = ttk.Scrollbar(wrapper, orient=tk.VERTICAL, command=self.main_canvas.yview)
        self.main_canvas.configure(yscrollcommand=self.main_vsb.set)
        self.main_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self.main_vsb.pack(side=tk.RIGHT, fill=tk.Y)

        main = ttk.Frame(self.main_canvas)
        self._main_window = self.main_canvas.create_window((0, 0), window=main, anchor="nw")
        main.bind("<Configure>", lambda e: self.main_canvas.configure(
            scrollregion=self.main_canvas.bbox("all")))
        self.main_canvas.bind("<Configure>", lambda e: self.main_canvas.itemconfigure(
            self._main_window, width=e.width))

        # 漫画基本信息
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

        # 漫画标签：主窗口内直接维护
        row_tags = ttk.Frame(info)
        row_tags.pack(fill=tk.X, pady=(6, 0))
        ttk.Label(row_tags, text="漫画标签").pack(side=tk.LEFT)
        self.manga_tags_editor = TagsEditor(row_tags, self.manga_tags, height=2)
        self.manga_tags_editor.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=8)

        # 章节工具条
        ch_bar = ttk.LabelFrame(main, text="章节（左键点半区：无 → 有 → 未知；右键数字格：选中并编辑；✕ 为删除本章）", padding=10)
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
        self.cell_inner.bind("<Configure>", lambda e: self.cell_canvas.configure(
            scrollregion=self.cell_canvas.bbox("all")))

        # 章节编辑面板（主窗口内，不再弹窗）
        edit = ttk.LabelFrame(main, text="章节编辑（右键数字格选中章节）", padding=10)
        edit.pack(fill=tk.X, pady=(10, 0))

        top = ttk.Frame(edit)
        top.pack(fill=tk.X, pady=(0, 8))
        ttk.Label(top, text="order").pack(side=tk.LEFT)
        self.var_ch_order = tk.StringVar()
        ttk.Entry(top, textvariable=self.var_ch_order, width=8).pack(side=tk.LEFT, padx=4)
        ttk.Label(top, text="标题").pack(side=tk.LEFT, padx=(10, 0))
        self.var_ch_title = tk.StringVar()
        ttk.Entry(top, textvariable=self.var_ch_title, width=28).pack(side=tk.LEFT, padx=4)
        ttk.Label(top, text="备注").pack(side=tk.LEFT, padx=(10, 0))
        self.var_ch_note = tk.StringVar()
        ttk.Entry(top, textvariable=self.var_ch_note, width=44).pack(side=tk.LEFT, padx=4)

        self.var_ch_kiss_unknown = tk.BooleanVar(value=False)
        self.var_ch_nudity_unknown = tk.BooleanVar(value=False)
        ttk.Checkbutton(top, text="亲吻未知", variable=self.var_ch_kiss_unknown).pack(side=tk.LEFT, padx=(12, 0))
        ttk.Checkbutton(top, text="ちくび未知", variable=self.var_ch_nudity_unknown).pack(side=tk.LEFT, padx=(8, 0))
        ttk.Button(top, text="应用章节修改", command=self.save_current_chapter).pack(side=tk.RIGHT)

        col1 = ttk.LabelFrame(edit, text="章节标签", padding=6)
        col1.pack(fill=tk.X, pady=(0, 6))
        self.ch_tags_editor = TagsEditor(col1, [], height=3)
        self.ch_tags_editor.pack(fill=tk.X, pady=4)

        col2 = ttk.LabelFrame(edit, text="亲吻场景 kiss", padding=6)
        col2.pack(fill=tk.X, pady=6)
        self.kiss_editor = ScenesEditor(col2, [], height=4)
        self.kiss_editor.pack(fill=tk.X, pady=4)

        col3 = ttk.LabelFrame(edit, text="ちくび nudity", padding=6)
        col3.pack(fill=tk.X, pady=(6, 0))
        self.nudity_editor = ScenesEditor(col3, [], height=4)
        self.nudity_editor.pack(fill=tk.X, pady=4)

        # 预览与写入
        out = ttk.LabelFrame(main, text="输出", padding=10)
        out.pack(fill=tk.X, pady=(10, 0))
        self.preview_text = tk.Text(out, height=8, font=("Consolas", 10))
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
                               on_right_click=self.select_chapter)
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
        for child in self.cell_inner.winfo_children():
            cells = [w for w in child.winfo_children() if isinstance(w, ChapterCell)]
            for cell in cells:
                cell.redraw()

    # ---------- 章节编辑（主窗口内） ----------
    def select_chapter(self, chapter):
        self.current_chapter = chapter
        self.var_ch_order.set(str(chapter.get("order", "")))
        self.var_ch_title.set(chapter.get("title", ""))
        self.var_ch_note.set(chapter.get("note", ""))
        self.var_ch_kiss_unknown.set(is_unknown(chapter.get("kissUnknown")))
        self.var_ch_nudity_unknown.set(is_unknown(chapter.get("nudityUnknown")))
        self.ch_tags_editor.set_tags(chapter.setdefault("tags", []))
        self.kiss_editor.set_scenes(chapter.setdefault("kiss", []))
        self.nudity_editor.set_scenes(chapter.setdefault("nudity", []))

    def save_current_chapter(self):
        ch = self.current_chapter
        if ch is None:
            messagebox.showwarning("章节编辑", "请先在章节数字格上右键选择要编辑的章节。", parent=self.root)
            return
        try:
            ch["order"] = float(self.var_ch_order.get().strip())
        except ValueError:
            pass
        ch["title"] = self.var_ch_title.get().strip()
        ch["note"] = self.var_ch_note.get().strip()
        ch["kissUnknown"] = self.var_ch_kiss_unknown.get()
        ch["nudityUnknown"] = self.var_ch_nudity_unknown.get()
        ch["tags"] = list(self.ch_tags_editor.tags)
        ch["kiss"] = list(self.kiss_editor.scenes)
        ch["nudity"] = list(self.nudity_editor.scenes)
        self.rebuild_cells()

    def _delete_chapter(self, chapter):
        if chapter in self.chapters:
            self.chapters.remove(chapter)
        else:
            idx = next((i for i, c in enumerate(self.chapters) if c is chapter), -1)
            if idx >= 0:
                self.chapters.pop(idx)
        if self.current_chapter is chapter:
            self.current_chapter = self.chapters[0] if self.chapters else None
        self.rebuild_cells()
        if self.current_chapter is not None:
            self.select_chapter(self.current_chapter)
        else:
            self.ch_tags_editor.set_tags([])
            self.kiss_editor.set_scenes([])
            self.nudity_editor.set_scenes([])
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

        self.rebuild_cells()
        if self.current_chapter is not None:
            self.select_chapter(self.current_chapter)

    def max_order(self):
        return max((c.get("order", 0) for c in self.chapters), default=0)

    def add_chapter(self):
        base = int(self.max_order()) + 1
        ch = new_chapter(base)
        self.chapters.append(ch)
        self.chapters.sort(key=lambda c: c.get("order", 0))
        self.rebuild_cells()
        self.select_chapter(ch)

    def add_special(self, after_order=None):
        if after_order is None:
            base = int(self.max_order())
            if base < 1:
                base = 1
            order = base + 0.5
        else:
            order = float(after_order) + 0.5
        ch = new_chapter(order)
        self.chapters.append(ch)
        self.chapters.sort(key=lambda c: c.get("order", 0))
        self.rebuild_cells()
        self.select_chapter(ch)

    def generate_count(self):
        count = int(self.var_count.get() or 0)
        count = max(1, min(300, count))
        wanted = set(range(1, count + 1))
        existing_int = {c.get("order") for c in self.chapters if self._is_int_order(c.get("order", 0))}
        for n in wanted - existing_int:
            self.chapters.append(new_chapter(float(n)))
        for c in list(self.chapters):
            o = c.get("order", 0)
            if self._is_int_order(o) and float(o) > count:
                if not (str(c.get("title", "") or "").strip() or str(c.get("note", "") or "").strip()
                        or valid_tags(c.get("tags")) or valid_scenes(c.get("kiss")) or valid_scenes(c.get("nudity"))):
                    self.chapters.remove(c)
        self.chapters.sort(key=lambda c: c.get("order", 0))
        self.rebuild_cells()
        self.select_chapter(self.chapters[0])

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