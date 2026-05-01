"""
Spectrum Algo GUI
-----------------
A WinRAR/7-Zip-style interface for Spectrum Algo compression (.spec) and
decompression. Supports both .spec (binary) and .png (pixel) formats.

Run from the project root:
    python gui/spectrum_gui.py
"""

import sys
import os
import threading
import time
from pathlib import Path
import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# ---------------------------------------------------------------------------
# Resolve project root so we can import encoder/decoder modules regardless of
# where the script is launched from.
# Only insert the project root — sub-packages use dotted imports (e.g.
# spec_format.spec_encoder) which Python 3 namespace packages resolve fine.
# ---------------------------------------------------------------------------
# Use os.path.realpath to resolve any symlinks (e.g. macOS /Users → /private/Users)
# so our sys.path entry matches what spec_encoder.py computes via Path(__file__).resolve()
PROJECT_ROOT = Path(os.path.realpath(Path(__file__).parent.parent))
_proj_str = str(PROJECT_ROOT)
if _proj_str not in sys.path:
    sys.path.insert(0, _proj_str)

# ---------------------------------------------------------------------------
# Colour palette (dark theme, WinRAR-inspired)
# ---------------------------------------------------------------------------
C = {
    "bg":         "#1e1e2e",
    "panel":      "#2a2a3e",
    "toolbar":    "#252536",
    "accent":     "#7c6af7",
    "accent_h":   "#9d8ff9",
    "green":      "#50fa7b",
    "red":        "#ff5555",
    "yellow":     "#f1fa8c",
    "fg":         "#cdd6f4",
    "fg_dim":     "#585b70",
    "border":     "#383850",
    "select":     "#3a3a5c",
    "treealt":    "#242436",
    "white":      "#ffffff",
    "btn":        "#363650",
    "btn_h":      "#44445e",
}

# ---------------------------------------------------------------------------
# Human-readable size helper
# ---------------------------------------------------------------------------
def human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:,.1f} {unit}" if unit != "B" else f"{n} B"
        n /= 1024
    return f"{n:.1f} TB"


# ---------------------------------------------------------------------------
# Extension helpers
# ---------------------------------------------------------------------------
COMPRESSIBLE = {".py", ".js", ".html", ".htm", ".css", ".mjs", ".cjs"}
SPEC_EXT     = ".spec"
PNG_EXT      = ".png"

LANG_MAP = {
    "Auto-detect": None,
    "Python (.py)": "py",
    "JavaScript (.js)": "js",
    "HTML (.html)": "html",
    "CSS (.css)": "css",
}


def guess_output_ext(fmt: str) -> str:
    return SPEC_EXT if fmt == ".spec" else PNG_EXT


# ---------------------------------------------------------------------------
# Tooltip helper
# ---------------------------------------------------------------------------
class Tooltip:
    def __init__(self, widget, text):
        self.widget = widget
        self.text   = text
        self.tip    = None
        widget.bind("<Enter>", self._show)
        widget.bind("<Leave>", self._hide)

    def _show(self, _=None):
        x = self.widget.winfo_rootx() + 20
        y = self.widget.winfo_rooty() + self.widget.winfo_height() + 4
        self.tip = tk.Toplevel(self.widget)
        self.tip.wm_overrideredirect(True)
        self.tip.wm_geometry(f"+{x}+{y}")
        lbl = tk.Label(self.tip, text=self.text, bg="#2a2a3e", fg=C["fg"],
                       font=("Segoe UI", 9), padx=8, pady=4,
                       relief="flat", bd=1)
        lbl.pack()

    def _hide(self, _=None):
        if self.tip:
            self.tip.destroy()
            self.tip = None


# ---------------------------------------------------------------------------
# Rounded button (flat style)
# ---------------------------------------------------------------------------
class FlatButton(tk.Label):
    def __init__(self, parent, text, command=None, icon="", accent=False,
                 width=None, **kw):
        bg = C["accent"] if accent else C["btn"]
        fg = C["white"]  if accent else C["fg"]
        super().__init__(
            parent,
            text=f"{icon}  {text}" if icon else text,
            bg=bg, fg=fg,
            font=("Segoe UI", 10, "bold" if accent else "normal"),
            padx=14, pady=7,
            cursor="hand2",
            relief="flat",
            width=width,
            **kw
        )
        self._bg   = bg
        self._bg_h = C["accent_h"] if accent else C["btn_h"]
        self._cmd  = command
        self.bind("<Enter>",   self._on_enter)
        self.bind("<Leave>",   self._on_leave)
        self.bind("<Button-1>", self._on_click)

    def _on_enter(self, _): self.config(bg=self._bg_h)
    def _on_leave(self, _): self.config(bg=self._bg)
    def _on_click(self, _):
        if self._cmd:
            self._cmd()

    def set_state(self, enabled: bool):
        self.config(cursor="hand2" if enabled else "arrow")
        self._cmd_backup = self._cmd if enabled else None
        if not enabled:
            self.config(bg=C["fg_dim"], fg=C["bg"])
            self._bg = C["fg_dim"]; self._bg_h = C["fg_dim"]
        else:
            self._bg   = C["accent"]
            self._bg_h = C["accent_h"]
            self.config(bg=self._bg, fg=C["white"])


# ---------------------------------------------------------------------------
# File-list row data
# ---------------------------------------------------------------------------
class FileRow:
    def __init__(self, path: Path):
        self.path     = path
        self.name     = path.name
        self.size     = path.stat().st_size if path.exists() else 0
        self.ext      = path.suffix.lower()
        self.lang     = self._detect_lang()
        self.modified = time.strftime(
            "%Y-%m-%d %H:%M", time.localtime(path.stat().st_mtime)
        ) if path.exists() else "—"

    def _detect_lang(self):
        m = {".py": "Python", ".js": "JavaScript", ".html": "HTML",
             ".htm": "HTML", ".css": "CSS", ".mjs": "JavaScript",
             ".cjs": "JavaScript", ".spec": "Spectrum .spec",
             ".png": "Spectrum PNG"}
        return m.get(self.ext, "Unknown")

    @property
    def is_compressible(self):
        return self.ext in COMPRESSIBLE

    @property
    def is_decompressible(self):
        return self.ext in (SPEC_EXT, PNG_EXT)


# ---------------------------------------------------------------------------
# Results pop-up
# ---------------------------------------------------------------------------
class ResultsDialog(tk.Toplevel):
    def __init__(self, parent, title, rows):
        super().__init__(parent)
        self.title(title)
        self.configure(bg=C["bg"])
        self.resizable(False, False)

        # Centre over parent
        pw, ph = parent.winfo_width(), parent.winfo_height()
        px, py = parent.winfo_rootx(), parent.winfo_rooty()
        w, h   = 520, 340
        self.geometry(f"{w}x{h}+{px + (pw-w)//2}+{py + (ph-h)//2}")

        tk.Label(self, text=title, bg=C["bg"], fg=C["accent"],
                 font=("Segoe UI", 13, "bold")).pack(pady=(18, 6))

        frame = tk.Frame(self, bg=C["panel"], padx=20, pady=14)
        frame.pack(fill="both", expand=True, padx=20, pady=10)

        for key, val, colour in rows:
            row = tk.Frame(frame, bg=C["panel"])
            row.pack(fill="x", pady=3)
            tk.Label(row, text=key, bg=C["panel"], fg=C["fg_dim"],
                     font=("Segoe UI", 10), width=22, anchor="w").pack(side="left")
            tk.Label(row, text=str(val), bg=C["panel"],
                     fg=colour or C["fg"],
                     font=("Segoe UI", 10, "bold"), anchor="w").pack(side="left")

        FlatButton(self, "Close", command=self.destroy, accent=True).pack(pady=12)
        self.grab_set()


# ---------------------------------------------------------------------------
# Main Application Window
# ---------------------------------------------------------------------------
class SpectrumGUI(tk.Tk):

    def __init__(self):
        super().__init__()
        self.title("Spectrum Algo")
        self.geometry("820x620")
        self.minsize(700, 500)
        self.configure(bg=C["bg"])

        # State
        self._files: list[FileRow]   = []
        self._busy                    = False
        self._format_var              = tk.StringVar(value=".spec")
        self._lang_var                = tk.StringVar(value="Auto-detect")
        self._outdir_var              = tk.StringVar(value="")
        self._zlib_var                = tk.StringVar(value="9")
        self._status_var              = tk.StringVar(value="Ready")
        self._progress_var            = tk.DoubleVar(value=0)
        self._mode                    = "compress"   # or "decompress"

        self._build_styles()
        self._build_ui()
        self._refresh_toolbar()

    # ------------------------------------------------------------------
    # ttk style
    # ------------------------------------------------------------------
    def _build_styles(self):
        s = ttk.Style(self)
        s.theme_use("clam")

        s.configure("TFrame",       background=C["bg"])
        s.configure("Panel.TFrame", background=C["panel"])

        s.configure("Treeview",
                    background=C["panel"],
                    foreground=C["fg"],
                    fieldbackground=C["panel"],
                    rowheight=26,
                    borderwidth=0,
                    font=("Segoe UI", 10))
        s.configure("Treeview.Heading",
                    background=C["toolbar"],
                    foreground=C["fg"],
                    font=("Segoe UI", 9, "bold"),
                    relief="flat",
                    borderwidth=0)
        s.map("Treeview",
              background=[("selected", C["select"])],
              foreground=[("selected", C["white"])])
        s.map("Treeview.Heading",
              background=[("active", C["select"])])

        s.configure("Horizontal.TProgressbar",
                    troughcolor=C["border"],
                    background=C["accent"],
                    thickness=6,
                    borderwidth=0)

        s.configure("TCombobox",
                    fieldbackground=C["btn"],
                    background=C["btn"],
                    foreground=C["fg"],
                    selectbackground=C["select"],
                    selectforeground=C["white"],
                    borderwidth=0,
                    relief="flat")
        s.map("TCombobox",
              fieldbackground=[("readonly", C["btn"])],
              selectbackground=[("readonly", C["select"])],
              foreground=[("readonly", C["fg"])])

        s.configure("TRadiobutton",
                    background=C["panel"],
                    foreground=C["fg"],
                    font=("Segoe UI", 10),
                    focuscolor="")
        s.map("TRadiobutton",
              background=[("active", C["panel"])],
              foreground=[("active", C["accent"])])

        s.configure("TLabel",
                    background=C["bg"],
                    foreground=C["fg"],
                    font=("Segoe UI", 10))

        # Scrollbar
        s.configure("TScrollbar",
                    troughcolor=C["bg"],
                    background=C["border"],
                    borderwidth=0,
                    arrowsize=12)
        s.map("TScrollbar",
              background=[("active", C["accent"])])

    # ------------------------------------------------------------------
    # Build UI
    # ------------------------------------------------------------------
    def _build_ui(self):
        self._build_toolbar()
        self._build_body()
        self._build_statusbar()

    # ------------------------------------------------------------------
    # Toolbar
    # ------------------------------------------------------------------
    def _build_toolbar(self):
        bar = tk.Frame(self, bg=C["toolbar"], height=50)
        bar.pack(fill="x", side="top")
        bar.pack_propagate(False)

        # App name / logo
        tk.Label(bar, text="⬡ SPECTRUM ALGO", bg=C["toolbar"],
                 fg=C["accent"], font=("Segoe UI", 12, "bold"),
                 padx=16).pack(side="left", pady=8)

        sep = tk.Frame(bar, bg=C["border"], width=1)
        sep.pack(side="left", fill="y", pady=6, padx=4)

        # Toolbar buttons
        self._btn_add    = FlatButton(bar, "Add Files",   self._add_files,   icon="📂")
        self._btn_add.pack(side="left", padx=4, pady=6)
        Tooltip(self._btn_add, "Add source files to the list")

        self._btn_remove = FlatButton(bar, "Remove",      self._remove_files, icon="✖")
        self._btn_remove.pack(side="left", padx=2, pady=6)
        Tooltip(self._btn_remove, "Remove selected files from list")

        self._btn_clear  = FlatButton(bar, "Clear All",   self._clear_files, icon="🗑")
        self._btn_clear.pack(side="left", padx=2, pady=6)
        Tooltip(self._btn_clear, "Clear the entire file list")

        sep2 = tk.Frame(bar, bg=C["border"], width=1)
        sep2.pack(side="left", fill="y", pady=6, padx=8)

        self._btn_compress   = FlatButton(bar, "Compress",   self._start_compress,   icon="⬇", accent=True)
        self._btn_compress.pack(side="left", padx=4, pady=6)
        Tooltip(self._btn_compress, "Encode selected source files")

        self._btn_decompress = FlatButton(bar, "Decompress", self._start_decompress, icon="⬆", accent=False)
        self._btn_decompress.pack(side="left", padx=4, pady=6)
        Tooltip(self._btn_decompress, "Decode .spec / .png files back to source")

        # About (right-aligned)
        FlatButton(bar, "About", self._show_about, icon="ℹ").pack(side="right", padx=10, pady=6)

    # ------------------------------------------------------------------
    # Body: file list (left) + options panel (right)
    # ------------------------------------------------------------------
    def _build_body(self):
        body = tk.Frame(self, bg=C["bg"])
        body.pack(fill="both", expand=True, padx=10, pady=(6, 4))

        # ---- Left: file list ----------------------------------------
        left = tk.Frame(body, bg=C["bg"])
        left.pack(side="left", fill="both", expand=True)

        hdr = tk.Frame(left, bg=C["bg"])
        hdr.pack(fill="x", pady=(0, 4))
        tk.Label(hdr, text="FILES", bg=C["bg"], fg=C["fg_dim"],
                 font=("Segoe UI", 9, "bold")).pack(side="left")

        self._count_lbl = tk.Label(hdr, text="0 files", bg=C["bg"],
                                   fg=C["accent"], font=("Segoe UI", 9))
        self._count_lbl.pack(side="right")

        tree_frame = tk.Frame(left, bg=C["border"], bd=1, relief="flat")
        tree_frame.pack(fill="both", expand=True)

        cols = ("name", "size", "type", "modified")
        self._tree = ttk.Treeview(tree_frame, columns=cols, show="headings",
                                  selectmode="extended")
        self._tree.heading("name",     text="Name",       anchor="w")
        self._tree.heading("size",     text="Size",       anchor="e")
        self._tree.heading("type",     text="Type",       anchor="w")
        self._tree.heading("modified", text="Modified",   anchor="w")

        self._tree.column("name",     width=220, stretch=True,  anchor="w")
        self._tree.column("size",     width=80,  stretch=False, anchor="e")
        self._tree.column("type",     width=120, stretch=False, anchor="w")
        self._tree.column("modified", width=130, stretch=False, anchor="w")

        vsb = ttk.Scrollbar(tree_frame, orient="vertical",
                            command=self._tree.yview)
        self._tree.configure(yscrollcommand=vsb.set)
        vsb.pack(side="right", fill="y")
        self._tree.pack(side="left", fill="both", expand=True)

        self._tree.tag_configure("odd",    background=C["panel"])
        self._tree.tag_configure("even",   background=C["treealt"])
        self._tree.tag_configure("bad",    foreground=C["red"])
        self._tree.tag_configure("spec",   foreground=C["accent"])
        self._tree.tag_configure("png",    foreground=C["yellow"])

        # Double-click reveals folder
        self._tree.bind("<Double-1>", self._reveal_file)

        # Drop hint
        self._drop_lbl = tk.Label(left,
            text='Drop files here or use \u201cAdd Files\u201d',
            bg=C["bg"], fg=C["fg_dim"],
            font=("Segoe UI", 10, "italic"))
        self._drop_lbl.place(relx=0.5, rely=0.55, anchor="center")

        # ---- Right: options panel -----------------------------------
        right = tk.Frame(body, bg=C["panel"], width=230, padx=14, pady=14)
        right.pack(side="right", fill="y", padx=(10, 0))
        right.pack_propagate(False)

        self._build_options_panel(right)

    def _build_options_panel(self, parent):
        def section(text):
            tk.Label(parent, text=text, bg=C["panel"], fg=C["fg_dim"],
                     font=("Segoe UI", 8, "bold")).pack(anchor="w",
                                                         pady=(12, 2))
            sep = tk.Frame(parent, bg=C["border"], height=1)
            sep.pack(fill="x", pady=(0, 6))

        # ── Output format ──────────────────────────────────────────
        section("OUTPUT FORMAT")
        for label, value in ((".spec  (binary + zlib)", ".spec"),
                              (".png   (pixel image)",   ".png")):
            r = ttk.Radiobutton(parent, text=label,
                                variable=self._format_var, value=value,
                                command=self._on_format_change)
            r.pack(anchor="w")

        # ── Language ───────────────────────────────────────────────
        section("LANGUAGE")
        lang_combo = ttk.Combobox(parent, textvariable=self._lang_var,
                                  values=list(LANG_MAP.keys()),
                                  state="readonly", width=22)
        lang_combo.pack(anchor="w")

        # ── Compression level ──────────────────────────────────────
        section("COMPRESSION LEVEL")
        lvl_frame = tk.Frame(parent, bg=C["panel"])
        lvl_frame.pack(anchor="w", fill="x")
        self._zlib_label = tk.Label(lvl_frame, text="Zlib level:",
                                    bg=C["panel"], fg=C["fg"],
                                    font=("Segoe UI", 10))
        self._zlib_label.pack(side="left")
        self._zlib_combo = ttk.Combobox(lvl_frame,
                                        textvariable=self._zlib_var,
                                        values=[str(i) for i in range(1, 10)],
                                        state="readonly", width=4)
        self._zlib_combo.pack(side="left", padx=(6, 0))

        # ── Output directory ──────────────────────────────────────
        section("OUTPUT DIRECTORY")
        dir_frame = tk.Frame(parent, bg=C["panel"])
        dir_frame.pack(anchor="w", fill="x")

        self._outdir_entry = tk.Entry(dir_frame, textvariable=self._outdir_var,
                                      bg=C["btn"], fg=C["fg"],
                                      insertbackground=C["fg"],
                                      relief="flat", font=("Segoe UI", 9),
                                      width=18)
        self._outdir_entry.pack(side="left", ipady=4)

        FlatButton(dir_frame, "…", self._browse_outdir,
                   width=2).pack(side="left", padx=(4, 0))

        tk.Label(parent, text="(blank = same as source)",
                 bg=C["panel"], fg=C["fg_dim"],
                 font=("Segoe UI", 8, "italic")).pack(anchor="w", pady=(2, 0))

        # ── Stats summary (updated after each run) ────────────────
        section("LAST RUN STATS")
        self._stats_text = tk.Text(parent, bg=C["bg"], fg=C["fg"],
                                   font=("Consolas", 9),
                                   height=7, width=26,
                                   relief="flat", state="disabled",
                                   wrap="word")
        self._stats_text.pack(anchor="w", fill="x")

        self._on_format_change()

    # ------------------------------------------------------------------
    # Status bar
    # ------------------------------------------------------------------
    def _build_statusbar(self):
        bar = tk.Frame(self, bg=C["toolbar"], height=32)
        bar.pack(fill="x", side="bottom")
        bar.pack_propagate(False)

        self._progress = ttk.Progressbar(bar, variable=self._progress_var,
                                          style="Horizontal.TProgressbar",
                                          length=180, mode="determinate")
        self._progress.pack(side="right", padx=10, pady=8)

        self._status_lbl = tk.Label(bar, textvariable=self._status_var,
                                    bg=C["toolbar"], fg=C["fg"],
                                    font=("Segoe UI", 9),
                                    anchor="w", padx=12)
        self._status_lbl.pack(side="left", fill="both", expand=True)

    # ------------------------------------------------------------------
    # File management
    # ------------------------------------------------------------------
    def _add_files(self):
        paths = filedialog.askopenfilenames(
            title="Add Files",
            filetypes=[
                ("All supported", "*.py *.js *.html *.htm *.css *.mjs *.cjs *.spec *.png"),
                ("Source files",  "*.py *.js *.html *.htm *.css *.mjs *.cjs"),
                ("Spectrum files","*.spec *.png"),
                ("All files",     "*.*"),
            ]
        )
        for p in paths:
            self._add_file(Path(p))

    def _add_file(self, path: Path):
        # Avoid duplicates
        if any(f.path == path for f in self._files):
            return
        row = FileRow(path)
        self._files.append(row)
        self._refresh_tree()

    def _remove_files(self):
        sel = self._tree.selection()
        if not sel:
            return
        indices = sorted([self._tree.index(iid) for iid in sel], reverse=True)
        for i in indices:
            del self._files[i]
        self._refresh_tree()

    def _clear_files(self):
        self._files.clear()
        self._refresh_tree()

    def _browse_outdir(self):
        d = filedialog.askdirectory(title="Select Output Directory")
        if d:
            self._outdir_var.set(d)

    def _reveal_file(self, _=None):
        sel = self._tree.selection()
        if not sel:
            return
        idx  = self._tree.index(sel[0])
        path = self._files[idx].path
        if sys.platform == "darwin":
            os.system(f'open -R "{path}"')
        elif sys.platform == "win32":
            os.system(f'explorer /select,"{path}"')
        else:
            os.system(f'xdg-open "{path.parent}"')

    def _refresh_tree(self):
        for iid in self._tree.get_children():
            self._tree.delete(iid)

        for i, f in enumerate(self._files):
            tag = "odd" if i % 2 == 0 else "even"
            if f.ext == ".spec":
                tag = "spec"
            elif f.ext == ".png" and not f.is_compressible:
                tag = "png"
            elif not f.is_compressible and not f.is_decompressible:
                tag = "bad"

            self._tree.insert("", "end",
                              values=(f.name, human_size(f.size), f.lang, f.modified),
                              tags=(tag,))

        n = len(self._files)
        self._count_lbl.config(text=f"{n} file{'s' if n != 1 else ''}")

        # Show/hide drop hint
        if self._files:
            self._drop_lbl.place_forget()
        else:
            self._drop_lbl.place(relx=0.5, rely=0.55, anchor="center")

        self._refresh_toolbar()

    def _refresh_toolbar(self):
        pass  # could toggle button states here

    # ------------------------------------------------------------------
    # Format change
    # ------------------------------------------------------------------
    def _on_format_change(self):
        is_spec = self._format_var.get() == ".spec"
        state   = "readonly" if is_spec else "disabled"
        self._zlib_combo.config(state=state)
        fg = C["fg"] if is_spec else C["fg_dim"]
        self._zlib_label.config(fg=fg)

    # ------------------------------------------------------------------
    # Output path helper
    # ------------------------------------------------------------------
    def _resolve_outpath(self, src: Path, new_ext: str) -> Path:
        outdir = self._outdir_var.get().strip()
        stem   = src.stem
        # For source files that already have a compound stem like "foo.py"
        # when re-decoded, keep original stem.
        if outdir:
            return Path(outdir) / (stem + new_ext)
        return src.parent / (stem + new_ext)

    # ------------------------------------------------------------------
    # COMPRESS
    # ------------------------------------------------------------------
    def _start_compress(self):
        if self._busy:
            return
        sources = [f for f in self._files if f.is_compressible]
        if not sources:
            messagebox.showwarning("No compressible files",
                                   "Add Python, JS, HTML, or CSS source files first.")
            return
        self._run_in_thread(self._do_compress, sources)

    def _do_compress(self, sources: list[FileRow]):
        fmt      = self._format_var.get()
        lang_key = self._lang_var.get()
        lang     = LANG_MAP[lang_key]
        zlib_lvl = int(self._zlib_var.get())
        total    = len(sources)
        results  = []

        for idx, f in enumerate(sources):
            self._set_status(f"Compressing  {f.name}  ({idx+1}/{total})…")
            self._set_progress((idx / total) * 100)
            try:
                if fmt == ".spec":
                    from spec_format.spec_encoder import encode_file
                    out = self._resolve_outpath(f.path, ".spec")
                    kw  = {"use_rle": True, "zlib_level": zlib_lvl}
                    if lang:
                        kw["language_id"] = _lang_str_to_id(lang)
                    stats = encode_file(str(f.path), str(out), **kw)
                    ratio = stats.get("ratio", 0)
                    results.append((f.name, out, stats, ratio))
                else:
                    from encoder.encoder import encode_file
                    out   = self._resolve_outpath(f.path, ".png")
                    stats = encode_file(str(f.path), str(out))
                    ratio = stats.get("ratio", 0)
                    results.append((f.name, out, stats, ratio))
            except Exception as e:
                results.append((f.name, None, {"error": str(e)}, None))

        self._set_progress(100)
        self._set_status(f"Done — {total} file(s) compressed.")
        self._show_compress_results(results, fmt)
        self._update_stats_panel(results, "compress")

    # ------------------------------------------------------------------
    # DECOMPRESS
    # ------------------------------------------------------------------
    def _start_decompress(self):
        if self._busy:
            return
        sources = [f for f in self._files if f.is_decompressible]
        if not sources:
            messagebox.showwarning("No decompressible files",
                                   "Add .spec or .png Spectrum files first.")
            return
        self._run_in_thread(self._do_decompress, sources)

    def _do_decompress(self, sources: list[FileRow]):
        total   = len(sources)
        results = []

        for idx, f in enumerate(sources):
            self._set_status(f"Decompressing  {f.name}  ({idx+1}/{total})…")
            self._set_progress((idx / total) * 100)
            try:
                if f.ext == ".spec":
                    from spec_format.spec_decoder import decode_file
                    # Derive output extension from spec header if possible,
                    # fallback to .py
                    out   = self._resolve_outpath(f.path, _guess_decoded_ext(f.path))
                    stats = decode_file(str(f.path), str(out))
                    ok    = stats.get("fidelity", "?")
                    results.append((f.name, out, stats, ok))
                else:
                    from decoder.decoder import decode_file
                    out   = self._resolve_outpath(f.path, ".py")
                    stats = decode_file(str(f.path), str(out))
                    ok    = "✓ perfect" if stats.get("match") else "✗ mismatch"
                    results.append((f.name, out, stats, ok))
            except Exception as e:
                results.append((f.name, None, {"error": str(e)}, None))

        self._set_progress(100)
        self._set_status(f"Done — {total} file(s) decompressed.")
        self._show_decompress_results(results)
        self._update_stats_panel(results, "decompress")

    # ------------------------------------------------------------------
    # Results display
    # ------------------------------------------------------------------
    def _show_compress_results(self, results, fmt):
        def _show():
            for name, out, stats, ratio in results:
                if "error" in stats:
                    rows = [
                        ("File",  name,              C["fg"]),
                        ("Error", stats["error"],    C["red"]),
                    ]
                else:
                    orig = stats.get("original_size", stats.get("source_size", 0))
                    comp = stats.get("spec_size", stats.get("png_size", 0))
                    rows = [
                        ("File",          name,                           C["fg"]),
                        ("Output",        str(out.name) if out else "—",  C["accent"]),
                        ("Original size", human_size(orig),               C["fg"]),
                        ("Compressed",    human_size(comp),               C["green"]),
                        ("Ratio",         f"{ratio:.2%}" if ratio else "—", _ratio_colour(ratio)),
                        ("Tokens",        f"{stats.get('token_count',0):,}", C["fg"]),
                    ]
                ResultsDialog(self, f"Compressed — {name}", rows)
        self.after(0, _show)

    def _show_decompress_results(self, results):
        def _show():
            for name, out, stats, fidelity in results:
                if "error" in stats:
                    rows = [
                        ("File",  name,           C["fg"]),
                        ("Error", stats["error"], C["red"]),
                    ]
                else:
                    orig    = stats.get("orig_length", stats.get("original_length", 0))
                    decoded = stats.get("decoded_length", 0)
                    rows = [
                        ("File",          name,                            C["fg"]),
                        ("Output",        str(out.name) if out else "—",   C["accent"]),
                        ("Original size", f"{orig:,} bytes",               C["fg"]),
                        ("Decoded size",  f"{decoded:,} bytes",            C["fg"]),
                        ("Fidelity",      fidelity if fidelity else "—",
                         C["green"] if "perfect" in str(fidelity) else C["red"]),
                        ("Tokens",        f"{stats.get('token_count',0):,}", C["fg"]),
                    ]
                ResultsDialog(self, f"Decompressed — {name}", rows)
        self.after(0, _show)

    # ------------------------------------------------------------------
    # Stats panel (right-hand sidebar text widget)
    # ------------------------------------------------------------------
    def _update_stats_panel(self, results, mode):
        lines = []
        for name, out, stats, extra in results:
            lines.append(f"── {name}")
            if "error" in stats:
                lines.append(f"  ERROR: {stats['error'][:50]}")
            else:
                if mode == "compress":
                    orig = stats.get("original_size", 0)
                    comp = stats.get("spec_size", stats.get("png_size", 0))
                    ratio = stats.get("ratio", 0)
                    lines.append(f"  {human_size(orig)} → {human_size(comp)}")
                    lines.append(f"  ratio: {ratio:.2%}")
                else:
                    fid = stats.get("fidelity", "ok" if stats.get("match") else "?")
                    lines.append(f"  fidelity: {fid}")
            lines.append("")

        text = "\n".join(lines).strip()

        def _upd():
            self._stats_text.config(state="normal")
            self._stats_text.delete("1.0", "end")
            self._stats_text.insert("end", text)
            self._stats_text.config(state="disabled")
        self.after(0, _upd)

    # ------------------------------------------------------------------
    # About dialog
    # ------------------------------------------------------------------
    def _show_about(self):
        dlg = tk.Toplevel(self)
        dlg.title("About Spectrum Algo")
        dlg.configure(bg=C["bg"])
        dlg.resizable(False, False)
        pw, ph = self.winfo_width(), self.winfo_height()
        px, py = self.winfo_rootx(), self.winfo_rooty()
        w, h   = 420, 300
        dlg.geometry(f"{w}x{h}+{px + (pw-w)//2}+{py + (ph-h)//2}")

        tk.Label(dlg, text="⬡", bg=C["bg"], fg=C["accent"],
                 font=("Segoe UI", 36)).pack(pady=(20, 0))
        tk.Label(dlg, text="SPECTRUM ALGO", bg=C["bg"], fg=C["white"],
                 font=("Segoe UI", 14, "bold")).pack()
        tk.Label(dlg, text="Token-semantic source code compression",
                 bg=C["bg"], fg=C["fg_dim"], font=("Segoe UI", 10)).pack(pady=4)

        info = tk.Frame(dlg, bg=C["panel"], padx=20, pady=12)
        info.pack(fill="x", padx=24, pady=12)
        for line in [
            "Formats:  .spec (binary + zlib)  ·  .png (pixel)",
            "Languages: Python · JavaScript · HTML · CSS",
            "Dictionary version 6  ·  473 tokens",
        ]:
            tk.Label(info, text=line, bg=C["panel"], fg=C["fg"],
                     font=("Segoe UI", 9)).pack(anchor="w")

        FlatButton(dlg, "Close", dlg.destroy, accent=True).pack(pady=10)
        dlg.grab_set()

    # ------------------------------------------------------------------
    # Threading helpers
    # ------------------------------------------------------------------
    def _run_in_thread(self, fn, *args):
        self._busy = True
        self._progress_var.set(0)
        t = threading.Thread(target=self._thread_wrapper, args=(fn, *args),
                             daemon=True)
        t.start()

    def _thread_wrapper(self, fn, *args):
        try:
            fn(*args)
        except Exception as e:
            self.after(0, lambda: messagebox.showerror("Error", str(e)))
        finally:
            self._busy = False

    def _set_status(self, msg: str):
        self.after(0, lambda: self._status_var.set(msg))

    def _set_progress(self, val: float):
        self.after(0, lambda: self._progress_var.set(val))


# ---------------------------------------------------------------------------
# Helpers used by worker threads
# ---------------------------------------------------------------------------
def _ratio_colour(ratio) -> str:
    if ratio is None:
        return C["fg"]
    if ratio < 0.5:
        return C["green"]
    if ratio < 0.9:
        return C["yellow"]
    return C["red"]


def _lang_str_to_id(lang: str) -> int:
    """Convert short lang string to LANGUAGE_* constant from spec_encoder."""
    try:
        from spec_format import spec_encoder as se
        return {
            "py":   se.LANGUAGE_PYTHON,
            "html": se.LANGUAGE_HTML,
            "js":   se.LANGUAGE_JS,
            "css":  se.LANGUAGE_CSS,
        }.get(lang, se.LANGUAGE_PYTHON)
    except Exception:
        return 0


def _guess_decoded_ext(spec_path: Path) -> str:
    """Peek at .spec header to determine original language."""
    try:
        from spec_format import spec_decoder as sd
        from spec_format import spec_encoder as se
        with open(spec_path, "rb") as fh:
            raw = fh.read(16)
        hdr     = sd.parse_header(raw)
        lang_id = hdr.get("language_id", 0)
        return {
            se.LANGUAGE_PYTHON: ".py",
            se.LANGUAGE_HTML:   ".html",
            se.LANGUAGE_JS:     ".js",
            se.LANGUAGE_CSS:    ".css",
        }.get(lang_id, ".py")
    except Exception:
        return ".py"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    app = SpectrumGUI()
    app.mainloop()
