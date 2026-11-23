#!/usr/bin/env python3
"""Build the RumIQ storefront.

  python3 tools/build.py            bundle + prerender every route
  python3 tools/build.py --fast     bundle only (the running site redraws the view itself)

What it does
  1. Minifies assets/js/*.js into site.min.js (everything on first load) and site-tools.min.js
     (studio.js, fetched on demand), and assets/css/site.css into site.min.css, with esbuild.
  2. Opens every route from routes.txt in headless Chrome and writes <route>/index.html with the
     drawn view inside <main>, so search engines and the first paint get real content.
     The page chrome (header, footer, drawers) comes from tools/shell.html.
     The <head> of an existing page is kept (title, description, canonical, structured data);
     a new route gets the shell's head with its own title, description and canonical.
  3. Stamps every page with a content hash (?v=) so browsers fetch new code.

sitemap.xml, robots.txt and feed/products.xml are left as they are: regenerate them when the
range or the domain changes.

Needs: node + esbuild (npx esbuild), Python playwright with Chromium.
"""
import argparse, hashlib, html, http.server, os, re, socketserver, subprocess, sys, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JS = ROOT / "assets/js"
SITE_FILES = ["data", "content", "commerce", "app", "room", "flow", "svep", "myhome", "auth", "account", "ai", "home"]
TOOLS_FILES = ["studio"]
ESBUILD = os.environ.get("ESBUILD", "npx --yes esbuild").split()

# title/description for routes that have no page yet (existing pages keep their own head)
META = {}
# routes that now show another page (tools that were merged): they get that page's head, so the
# canonical address points at the page that is meant to be found
ALIAS = {"studio-analys": "mitt-rum", "studio-kombinera": "mitt-rum", "kollektioner": "looks", "studio": "mitt-rum"}


def minify(path, loader=None):
    cmd = ESBUILD + [str(path), "--minify", "--charset=ascii" if str(path).endswith(".js") else "--log-level=warning"]
    return subprocess.run(cmd, check=True, capture_output=True, text=True).stdout.strip()


def bundle():
    site = "\n".join(minify(JS / f"{f}.js") for f in SITE_FILES) + "\n"
    tools = "\n".join(minify(JS / f"{f}.js") for f in TOOLS_FILES) + "\n"
    css = minify(ROOT / "assets/css/site.css") + "\n"
    (JS / "site.min.js").write_text(site, encoding="utf-8")
    (JS / "site-tools.min.js").write_text(tools, encoding="utf-8")
    (ROOT / "assets/css/site.min.css").write_text(css, encoding="utf-8")
    v = hashlib.sha1((site + tools + css).encode()).hexdigest()[:8]
    print(f"bundled: site {len(site)//1024} kB, tools {len(tools)//1024} kB, css {len(css)//1024} kB, v={v}")
    return v


def stamp(text, v):
    return re.sub(r"\?v=[0-9a-f]{8}", f"?v={v}", text)


def routes():
    return [""] + [r.strip() for r in (ROOT / "routes.txt").read_text().split() if r.strip()]


def page_path(route):
    return ROOT / "index.html" if not route else ROOT / route / "index.html"


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class Server(socketserver.ThreadingTCPServer):
    daemon_threads = True

    def handle_error(self, request, client_address):  # a page left before a file finished loading
        pass


def serve():
    handler = lambda *a, **k: Quiet(*a, directory=str(ROOT), **k)
    srv = Server(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, srv.server_address[1]


GRAB = """async () => {
  if (window.RQ && RQ.loadTools) { try { await RQ.loadTools(); } catch (e) {} }
  await new Promise((r) => setTimeout(r, 250));
  const v = document.getElementById('view').cloneNode(true);
  // the page head already carries the structured data, with the real address
  v.querySelectorAll('script').forEach((x) => x.remove());
  v.querySelectorAll('a[href^="#"]').forEach((a) => {
    const raw = decodeURIComponent(a.getAttribute('href').slice(1));
    if (/^(hem)?$/.test(raw)) a.setAttribute('href', './');
    else if (RQ.isRoute(raw) && !/^faq-\\d+$/.test(raw)) a.setAttribute('href', raw + '/');
  });
  return { main: v.outerHTML, title: document.title, bodyClass: document.body.className };
}"""


def head_for(route, shell_head, title, site_url):
    """Head for a route that has no page yet."""
    t, d = META.get(route, (title, None))
    h = shell_head.replace('<base href="./">', '<base href="../">')
    h = re.sub(r"<title>.*?</title>", f"<title>{html.escape(t)}</title>", h, count=1, flags=re.S)
    h = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + html.escape(t, quote=True), h)
    if d:
        h = re.sub(r'(<meta (?:name="description"|property="og:description") content=")[^"]*', lambda m: m.group(1) + html.escape(d, quote=True), h)
    url = site_url.rstrip("/") + "/" + route + "/"
    h = re.sub(r'(<meta property="og:url" content=")[^"]*', lambda m: m.group(1) + url, h)
    h = re.sub(r'(<link rel="canonical" href=")[^"]*', lambda m: m.group(1) + url, h)
    return h


def prerender(v):
    from playwright.sync_api import sync_playwright
    shell = stamp((ROOT / "tools/shell.html").read_text(encoding="utf-8"), v)
    cut = shell.index("</head>") + len("</head>")
    shell_head, shell_body = shell[:cut], shell[cut:]
    site_url = re.search(r'<link rel="canonical" href="([^"]*)"', shell_head).group(1)
    empty_main = '<main id="view" class="view" tabindex="-1"></main>'
    assert empty_main in shell_body
    srv, port = serve()
    out, problems = {}, []
    with sync_playwright() as p:
        b = p.chromium.launch()
        # reduced motion: the start film is not fetched and nothing is caught mid-animation
        ctx = b.new_context(viewport={"width": 1280, "height": 900}, locale="sv-SE", reduced_motion="reduce")
        ctx.route(re.compile(r"^https?://(?!127\.0\.0\.1)"), lambda r: r.abort())
        pg = ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        for r in routes():
            # a route without a page yet is opened through its hash on the start page
            url = f"http://127.0.0.1:{port}/" + (f"{r}/" if r and page_path(r).exists() else (f"#{r}" if r else ""))
            errs.clear()
            pg.goto(url, wait_until="load")
            got = pg.evaluate(GRAB)
            if errs:
                problems.append((r, errs[:2]))
            if len(got["main"]) < 150:
                problems.append((r, ["empty view"]))
            path = page_path(ALIAS.get(r, r))
            if path.exists():
                old = path.read_text(encoding="utf-8")
                head = stamp(old[: old.index("</head>") + len("</head>")], v)
            else:
                head = head_for(r, shell_head, got["title"], site_url)
            out[r] = head + shell_body.replace(empty_main, got["main"])
        b.close()
    srv.shutdown()
    for r, text in out.items():
        path = page_path(r)
        path.parent.mkdir(exist_ok=True)
        path.write_text(text, encoding="utf-8")
    nf = stamp((ROOT / "404.html").read_text(encoding="utf-8"), v)
    (ROOT / "404.html").write_text(nf, encoding="utf-8")
    print(f"prerendered {len(out)} pages")
    for r, e in problems:
        print("  PROBLEM", r or "(home)", e)
    return not problems


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--fast", action="store_true", help="bundle only, stamp existing pages")
    a = ap.parse_args()
    v = bundle()
    if a.fast:
        for f in [ROOT / "index.html", ROOT / "404.html"] + [page_path(r) for r in routes() if r]:
            if f.exists():
                f.write_text(stamp(f.read_text(encoding="utf-8"), v), encoding="utf-8")
        print("stamped pages (fast)")
        sys.exit(0)
    sys.exit(0 if prerender(v) else 1)
