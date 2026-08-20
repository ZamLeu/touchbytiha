"""Normalize line endings and trailing whitespace for the touchbytiha codebase.
Converts CRLF -> LF and strips trailing spaces/tabs on each line.
"""
from pathlib import Path

FILES = [
    "index.html",
    "js/modules/gallery.js",
    "js/modules/testimonials.js",
    "js/app.js",
    "css/layout.css",
    "css/components/portfolio.css",
    "css/components/services.css",
    "css/components/testimonials.css",
]

for rel in FILES:
    p = Path(rel)
    raw = p.read_bytes()
    text = raw.decode("utf-8")
    if "\r\n" in text:
        text = text.replace("\r\n", "\n")
    text = "\n".join(line.rstrip(" \t") for line in text.split("\n"))
    p.write_bytes(text.encode("utf-8"))
    print("normalized", rel)