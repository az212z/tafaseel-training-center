"""Verify exported pages, metadata, local assets, and contact destinations."""

from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import Request, urlopen
import json
import sys

ROOT = Path(__file__).resolve().parent.parent
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:3014"
BASE = BASE.rstrip("/")
ORIGIN = f"{urlsplit(BASE).scheme}://{urlsplit(BASE).netloc}"
BASE_PATH = urlsplit(BASE).path


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.in_title = False
        self.h1 = 0
        self.description = ""
        self.references = []
        self.designer_links = []
        self.images_without_alt = 0
        self.direction = ""
        self.language = ""

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.direction = attrs.get("dir")
            self.language = attrs.get("lang")
        if tag == "title":
            self.in_title = True
        if tag == "h1":
            self.h1 += 1
        if tag == "meta" and attrs.get("name") == "description":
            self.description = attrs.get("content", "")
        if tag == "img" and "alt" not in attrs:
            self.images_without_alt += 1
        if tag == "a" and "footer-designer-link" in attrs.get("class", "").split():
            self.designer_links.append(attrs.get("href", ""))
        if tag in ("a", "link", "script", "img"):
            ref = attrs.get("href") or attrs.get("src")
            if ref:
                self.references.append(ref)

    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False

    def handle_data(self, data):
        if self.in_title:
            self.title += data


errors, titles, paths, whatsapp_numbers = [], {}, set(), set()
# Next.js also exports an internal alias of the same custom 404 page.
pages = sorted(p for p in (ROOT / "out").rglob("index.html") if p.parent.name != "_not-found")
for file in pages:
    route = "/" + str(file.parent.relative_to(ROOT / "out")).strip(".").strip("/")
    route = route.rstrip("/") + "/"
    page = Page()
    page.feed(file.read_text())
    expected_designer_links = ["https://wa.me/966505989304"] if route.startswith("/v2/") else []
    for condition, issue in [
        (page.title and page.title not in titles, "missing or duplicate title"),
        (page.h1 == 1, "expected one h1"),
        (bool(page.description), "missing description"),
        (page.direction == "rtl" and page.language == "ar", "Arabic RTL missing"),
        (page.images_without_alt == 0, "image missing alt attribute"),
        (page.designer_links == expected_designer_links, "incorrect designer credit destination or scope"),
    ]:
        if not condition:
            errors.append([route, issue])
    titles[page.title] = route
    paths.add(BASE_PATH + route)
    for ref in page.references:
        url = urlsplit(urljoin(BASE + route, ref))
        if url.netloc == urlsplit(BASE).netloc:
            paths.add(unquote(url.path))
        if url.netloc == "wa.me":
            whatsapp_numbers.add(url.path)
            if ref not in page.designer_links and url.path != "/966544552366":
                errors.append([route, "incorrect WhatsApp number", ref])
        if url.scheme == "tel" and url.path != "+966558815053":
            errors.append([route, "incorrect phone number", ref])


def check(path):
    try:
        with urlopen(Request(ORIGIN + path, method="HEAD"), timeout=15) as response:
            return {"path": path, "status": response.status}
    except HTTPError as error:
        return {"path": path, "status": error.code}
    except Exception as error:
        return {"path": path, "status": str(error)}


with ThreadPoolExecutor(max_workers=8) as executor:
    responses = list(executor.map(check, sorted(paths)))
errors.extend([r["path"], "HTTP failure", r["status"]] for r in responses if r["status"] != 200)
missing = check(BASE_PATH + "/__verification_missing_page__/")
if missing["status"] != 404:
    errors.append([missing["path"], "missing route must return 404", missing["status"]])

report = {
    "base_url": BASE,
    "pages_including_404": len(pages),
    "unique_titles": len(titles),
    "internal_assets_and_links": len(paths),
    "whatsapp_numbers": sorted(whatsapp_numbers),
    "errors": errors,
    "missing_page_response": missing,
    "responses": responses,
}
target = ROOT / "output/qa/routes-and-assets.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({k: v for k, v in report.items() if k != "responses"}, ensure_ascii=False, indent=2))
sys.exit(bool(errors))
