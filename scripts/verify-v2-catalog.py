"""Check the exported V2 hierarchy and the course-to-booking navigation contract."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import json

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"
EXPECTED = {
    "aptitude": ["general-aptitude"],
    "english": ["english-foundation", "ielts", "toefl"],
    "exams": ["achievement-test", "step", "educational-competencies"],
    "development": ["self-development", "professional-development"],
    "arts": ["arabic-calligraphy", "interior-design", "drawing-fine-arts", "digital-art"],
}

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.bookings = []
        self.links = []
        self.groups = []
        self.program_cards = 0
        self.feed(path.read_text())

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "a":
            href = attrs.get("href", "")
            self.links.append(href)
            if "v2-course-actions" not in attrs.get("class", ""):
                slug = parse_qs(urlsplit(href).query).get("course", [None])[0]
                if slug and attrs.get("aria-label", "").startswith("طلب التسجيل في"):
                    self.bookings.append(slug)
        if attrs.get("data-program"):
            self.groups.append(attrs["data-program"])
        if "v2-program-card" in attrs.get("class", "").split():
            self.program_cards += 1

slugs = [slug for group in EXPECTED.values() for slug in group]
assert len(slugs) == len(set(slugs)) == 13, "Each course belongs to one program"
home = Page(OUT / "v2/index.html")
assert home.program_cards == 5, "Homepage must display all five programs"
catalog = Page(OUT / "v2/courses/index.html")
assert catalog.groups == list(EXPECTED), "Catalog program order must match the homepage"
assert catalog.bookings == slugs, "Catalog must offer exactly 13 course-specific registrations"
for program, members in EXPECTED.items():
    page = Page(OUT / f"v2/tracks/{program}/index.html")
    assert page.bookings == members, (program, page.bookings)
    for slug in members:
        course = Page(OUT / f"v2/courses/{slug}/index.html")
        assert any(f"/v2/tracks/{program}/" in link for link in course.links), (slug, "Incorrect parent program")
        assert any(f"/v2/booking/?course={slug}" in link for link in course.links), (slug, "Missing preselected booking")
        assert set(course.bookings) == set(members) - {slug}, (slug, "Related courses must remain within the program")
        for link in course.links:
            if link.startswith("/tafaseel-training-center/"):
                assert link.startswith("/tafaseel-training-center/v2/"), (slug, "Navigation escaped V2", link)

report = {"programs": len(EXPECTED), "courses": len(slugs), "program_membership": EXPECTED, "registration_links": "All 13 preselect the correct course", "related_courses": "All remain in their parent program", "errors": []}
target = ROOT / "output/qa/v2-catalog.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(report, ensure_ascii=False, indent=2))
