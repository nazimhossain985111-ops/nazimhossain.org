#!/usr/bin/env python3
"""Build the nazimhossain.org website into the dist folder.

1. First time only:  pip install -r requirements.txt
2. Every time:       python build.py
3. To look at it:    python -m http.server 8000 --directory dist
                     then open http://localhost:8000 in the browser.

The forms only send email on the live website, because sending is done by the
Cloudflare Worker in the worker folder.
"""
from __future__ import annotations

import datetime as dt
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import markdown
import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
STATIC = ROOT / "static"
DIST = ROOT / "dist"
CSS_PARTS = [ROOT / "design" / "tokens.css", STATIC / "css" / "fonts.css", STATIC / "css" / "base.css"]
# [[form:key]] inserts a form. [[form:key:4]] does the same under an h3 section, so its error heading is an h4.
FORM_MARKER = re.compile(r"<p>\[\[form:([a-z-]+)(?::([3-6]))?\]\]</p>")
# [[photos:key]] shows one photo from content/photos.yaml; [[photos:key other-key]] shows two side by side.
PHOTO_MARKER = re.compile(r"<p>\[\[photos:([a-z0-9 -]+)\]\]</p>")
# Old addresses that now live elsewhere. The worker sends visitors on with a permanent redirect.
REDIRECTS = {"/need-help/": "/suggestions-and-support/"}


def split_front_matter(path: Path) -> tuple[dict, str]:
    text = path.read_text(encoding="utf-8")
    if text.startswith("---"):
        _, front, body = text.split("---", 2)
        return yaml.safe_load(front) or {}, body.strip()
    return {}, text.strip()


def to_html(text: str) -> str:
    return markdown.markdown(text, extensions=["extra", "sane_lists"])


def long_date(value) -> str:
    if isinstance(value, str):
        value = dt.date.fromisoformat(value)
    return f"{value.day} {value:%B %Y}"


def load_pages() -> dict[str, dict]:
    pages = {}
    for path in sorted((CONTENT / "pages").glob("*.md")):
        meta, body = split_front_matter(path)
        url = meta.get("url", f"/{path.stem}/")
        html = to_html(body)
        # The opening paragraph becomes the page's lead, shown under the title in the page header.
        lead = re.match(r"<p>(?!\[\[).*?</p>\s*", html, re.S)
        if lead and not lead.group(0).strip().endswith(":</p>"):  # a line ending in a colon belongs with what follows
            html = html[lead.end():]
            lead = lead.group(0).strip().replace("<p>", '<p class="lead">', 1)
        else:
            lead = None
        pages[path.stem] = {**meta, "key": path.stem, "url": url, "lead": lead, "body": html}
    return pages


def load_projects() -> list[dict]:
    projects = []
    for path in sorted((CONTENT / "projects").glob("*.md")):
        if path.name.startswith("_"):
            continue  # files starting with _ are templates and are not published
        meta, body = split_front_matter(path)
        meta["slug"] = path.stem
        meta["body_html"] = to_html(body) if body else ""
        meta["updates"] = [{"date": str(u.get("date", "")), "text": u.get("text", "")} for u in meta.get("updates") or []]
        projects.append(meta)
    return sorted(projects, key=lambda p: (p.get("order", 100), p.get("title", "")))


def load_posts() -> list[dict]:
    posts = []
    for path in sorted((CONTENT / "blog").glob("*.md")):
        if path.name.startswith("_"):
            continue
        meta, body = split_front_matter(path)
        meta.update(key=f"blog-{path.stem}", section="blog", slug=path.stem, url=f"/blog/{path.stem}/", body=to_html(body))
        meta.setdefault("lang", "en")
        meta["date"] = str(meta.get("date", ""))
        meta["minutes"] = max(1, round(len(body.split()) / 200))  # reading time at about 200 words a minute
        posts.append(meta)
    return sorted(posts, key=lambda p: p["date"], reverse=True)


def build_search_index() -> None:
    try:
        subprocess.run([sys.executable, "-m", "pagefind", "--site", str(DIST)], check=True, capture_output=True, text=True)
        print("Search index built.")
    except (subprocess.CalledProcessError, FileNotFoundError) as error:
        print("Search index was not built. Run: pip install -r requirements.txt", error)


def write_sitemap(site: dict, urls: list[str]) -> None:
    today = dt.date.today().isoformat()
    items = "".join(f"<url><loc>{site['url']}{u}</loc><lastmod>{today}</lastmod></url>" for u in urls)
    (DIST / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{items}</urlset>\n',
        encoding="utf-8",
    )
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {site['url']}/sitemap.xml\n", encoding="utf-8")


def main() -> None:
    site = yaml.safe_load((CONTENT / "site.yaml").read_text(encoding="utf-8"))
    forms = yaml.safe_load((CONTENT / "forms.yaml").read_text(encoding="utf-8"))
    photos = yaml.safe_load((CONTENT / "photos.yaml").read_text(encoding="utf-8"))
    pages = load_pages()
    projects = load_projects()
    posts = load_posts()

    env = Environment(
        loader=FileSystemLoader(ROOT / "templates"),
        autoescape=select_autoescape(["html", "svg"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["longdate"] = long_date
    env.globals.update(site=site, photos=photos, year=dt.date.today().year, version=dt.datetime.now().strftime("%Y%m%d%H%M"))

    # The worker that sends form email reads the same form settings, and the redirects.
    (ROOT / "worker" / "forms.json").write_text(json.dumps(forms, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (ROOT / "worker" / "redirects.json").write_text(json.dumps(REDIRECTS, indent=2) + "\n", encoding="utf-8")

    def insert_forms(page: dict) -> dict:
        def form_html(match: re.Match) -> str:
            key = match.group(1)
            return env.get_template("form.html").render(key=key, form=forms[key], level=int(match.group(2) or 3))
        body, count = FORM_MARKER.subn(form_html, page["body"])
        body = PHOTO_MARKER.sub(lambda m: env.get_template("photos.html").render(keys=m.group(1).split()), body)
        return {**page, "body": body, "has_forms": count > 0}

    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(STATIC, DIST, ignore=shutil.ignore_patterns("css"))
    (DIST / "css").mkdir()
    (DIST / "css" / "site.css").write_text("\n\n".join(p.read_text(encoding="utf-8") for p in CSS_PARTS), encoding="utf-8")

    def render(url: str, template: str, **context) -> None:
        out = DIST / "404.html" if url == "/404.html" else DIST / url.strip("/") / "index.html"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(env.get_template(template).render(**context), encoding="utf-8")

    sitemap = ["/"]
    home = {"key": "home", "title": site["name"], "url": "/", "description": site["description"]}
    render("/", "home.html", page=home, projects=projects, posts=posts, need_help=pages.get("suggestions-and-support"))

    # A fallback page at each old address, for local preview. On the live site the worker redirects first.
    for old, new in REDIRECTS.items():
        render(old, "redirect.html", page={"key": "redirect", "title": "Page moved", "url": old, "target": new, "noindex": True})

    for key, page in pages.items():
        page = insert_forms(page)
        if key == "404":
            render("/404.html", "page.html", page={**page, "url": "/404.html", "noindex": True})
            continue
        template = {"ongoing-projects": "projects.html", "blog": "blog.html", "about": "about.html"}.get(key, "page.html")
        render(page["url"], template, page=page, projects=projects, posts=posts)
        if not page.get("noindex"):
            sitemap.append(page["url"])

    for post in posts:
        render(post["url"], "post.html", page=post)
        sitemap.append(post["url"])

    search = {"key": "search", "title": "Search", "url": "/search/", "description": "Search the website of Nazim Hossain.", "noindex": True}
    render("/search/", "search.html", page=search)

    write_sitemap(site, sitemap)
    build_search_index()
    print(f"Website built in {DIST}")


if __name__ == "__main__":
    main()
