#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TFDA (Taiwan FDA) Announcement Scraper
Scrapes https://www.fda.gov.tw/ for latest regulatory announcements,
compares with previous scrape, and alerts if relevant to tracked projects.

Usage:
    python tfda_scraper.py                         # scrape all categories
    python tfda_scraper.py --category drug         # filter by category
    python tfda_scraper.py --days 7                # announcements from last 7 days
    python tfda_scraper.py --compare               # compare with previous save
    python tfda_scraper.py --category food --days 14 --compare
"""

import argparse
import io
import json
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlencode

# Force UTF-8 on Windows
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

try:
    import requests
    from bs4 import BeautifulSoup
    SCRAPER_AVAILABLE = True
except ImportError:
    SCRAPER_AVAILABLE = False
    print("Install with: pip install requests beautifulsoup4")

# ── Configuration ──────────────────────────────────────────────────────────────

BASE_URL = "https://www.fda.gov.tw"

# Category → URL path and keywords for filtering
CATEGORY_CONFIG: Dict[str, Dict] = {
    "drug": {
        "label": "藥品",
        "url_paths": [
            "/upload/133",   # Drug announcements
            "/upload/111",   # Drug registration
        ],
        "keywords": ["藥品", "藥物", "查驗登記", "許可證", "GMP", "展延", "drug", "pharmaceutical"],
    },
    "food": {
        "label": "食品",
        "url_paths": [
            "/upload/135",   # Food announcements
        ],
        "keywords": ["食品", "食品添加物", "保健食品", "food", "nutrition", "衛生安全"],
    },
    "device": {
        "label": "醫療器材",
        "url_paths": [
            "/upload/136",   # Medical device announcements
        ],
        "keywords": ["醫療器材", "medical device", "器材", "ISO 13485", "許可證"],
    },
    "cosmetic": {
        "label": "化粧品",
        "url_paths": [
            "/upload/134",
        ],
        "keywords": ["化粧品", "cosmetic"],
    },
}

# Keywords that are likely relevant to tracked projects
PROJECT_KEYWORDS = [
    "查驗登記", "展延", "許可證", "GMP", "補正", "核准",
    "registration", "extension", "renewal", "deficiency",
]

# Output directory for scraped data
DEFAULT_OUTPUT_DIR = Path.home() / "productivity" / "tfda-data"

# ── Scraper class ──────────────────────────────────────────────────────────────

class TFDAScraper:
    """Scrapes Taiwan FDA website for announcements."""

    def __init__(self, output_dir: Path = DEFAULT_OUTPUT_DIR, delay: float = 1.5):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.delay = delay  # seconds between requests (be polite)
        self.session = requests.Session() if SCRAPER_AVAILABLE else None
        if self.session:
            self.session.headers.update({
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
            })

    # ── Internal helpers ────────────────────────────────────────────────────

    def _get(self, url: str, timeout: int = 15) -> Optional[BeautifulSoup]:
        """GET a URL and return BeautifulSoup, or None on failure."""
        try:
            resp = self.session.get(url, timeout=timeout)
            resp.raise_for_status()
            resp.encoding = "utf-8"
            return BeautifulSoup(resp.text, "html.parser")
        except Exception as e:
            print(f"[WARN] Failed to fetch {url}: {e}", file=sys.stderr)
            return None

    def _parse_date(self, text: str) -> Optional[datetime]:
        """Try several date formats common on TFDA site."""
        text = text.strip()
        for fmt in ("%Y/%m/%d", "%Y-%m-%d", "%Y.%m.%d", "%Y年%m月%d日"):
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                continue
        return None

    # ── Announcement discovery ───────────────────────────────────────────────

    def scrape_news_list(self, category: str = "drug", days: int = 30) -> List[Dict]:
        """
        Scrape announcements page for a given category.
        Returns list of announcement dicts.
        """
        if not SCRAPER_AVAILABLE:
            print("requests/bs4 not installed — returning mock data")
            return self._mock_announcements(category, days)

        cfg = CATEGORY_CONFIG.get(category, CATEGORY_CONFIG["drug"])
        cutoff = datetime.now() - timedelta(days=days)
        announcements: List[Dict] = []

        # Try the main news/announcement pages
        news_urls = [
            f"{BASE_URL}/upload/133",
            f"{BASE_URL}/upload/135",
            f"{BASE_URL}/upload/136",
            f"{BASE_URL}/news_list.aspx?newsid=1",
        ]
        # Use category-specific paths if defined
        for path in cfg.get("url_paths", []):
            news_urls.insert(0, f"{BASE_URL}{path}")

        scraped_urls = set()
        for url in news_urls:
            if url in scraped_urls:
                continue
            scraped_urls.add(url)

            soup = self._get(url)
            if not soup:
                continue

            # Extract list items — TFDA uses <ul class="list"> or table rows
            items = (
                soup.select("ul.list li")
                or soup.select("table.listTable tr")
                or soup.select("div.news_list li")
                or soup.select(".newslist li")
            )

            for elem in items:
                entry = self._parse_list_item(elem, category, cfg["keywords"])
                if entry:
                    pub_date = entry.get("published_date")
                    if pub_date and pub_date < cutoff:
                        continue  # Too old
                    announcements.append(entry)

            time.sleep(self.delay)

        # Deduplicate by URL
        seen = set()
        unique = []
        for a in announcements:
            key = a.get("url", a.get("title", ""))
            if key not in seen:
                seen.add(key)
                unique.append(a)

        return unique

    def _parse_list_item(self, elem, category: str, keywords: List[str]) -> Optional[Dict]:
        """Extract announcement data from a list/table element."""
        try:
            # Title
            link_tag = elem.find("a")
            if not link_tag:
                return None
            title = link_tag.get_text(strip=True)
            if not title:
                return None

            # URL
            href = link_tag.get("href", "")
            url = urljoin(BASE_URL, href) if href else ""

            # Date — look for span/td containing date-like text
            date_text = ""
            for tag in elem.find_all(["span", "td", "div"]):
                text = tag.get_text(strip=True)
                if len(text) in (8, 10) and ("/" in text or "-" in text):
                    date_text = text
                    break

            pub_date = self._parse_date(date_text) if date_text else None

            # Relevance score — count matching keywords
            score = sum(1 for kw in keywords if kw.lower() in title.lower())

            return {
                "title": title,
                "url": url,
                "category": category,
                "published_date": pub_date.isoformat() if pub_date else None,
                "date_raw": date_text,
                "relevance_score": score,
                "is_project_relevant": any(
                    kw.lower() in title.lower() for kw in PROJECT_KEYWORDS
                ),
            }
        except Exception:
            return None

    def fetch_announcement_detail(self, url: str) -> Optional[str]:
        """Fetch full text of a single announcement page."""
        soup = self._get(url)
        if not soup:
            return None
        # Try common content containers
        for selector in ["div.content", "div#content", "article", "div.main-content"]:
            container = soup.select_one(selector)
            if container:
                return container.get_text(separator="\n", strip=True)
        return soup.get_text(separator="\n", strip=True)[:2000]

    # ── Mock data for testing without network ───────────────────────────────

    def _mock_announcements(self, category: str, days: int) -> List[Dict]:
        """Return synthetic announcements for testing."""
        now = datetime.now()
        return [
            {
                "title": f"[MOCK] 藥品查驗登記展延注意事項公告 ({category})",
                "url": f"{BASE_URL}/upload/133/mock-1",
                "category": category,
                "published_date": (now - timedelta(days=2)).isoformat(),
                "date_raw": (now - timedelta(days=2)).strftime("%Y/%m/%d"),
                "relevance_score": 3,
                "is_project_relevant": True,
            },
            {
                "title": f"[MOCK] 原料藥 GMP 文件審查說明 ({category})",
                "url": f"{BASE_URL}/upload/111/mock-2",
                "category": category,
                "published_date": (now - timedelta(days=5)).isoformat(),
                "date_raw": (now - timedelta(days=5)).strftime("%Y/%m/%d"),
                "relevance_score": 2,
                "is_project_relevant": True,
            },
            {
                "title": f"[MOCK] 一般行政公告 (not relevant)",
                "url": f"{BASE_URL}/upload/133/mock-3",
                "category": category,
                "published_date": (now - timedelta(days=1)).isoformat(),
                "date_raw": (now - timedelta(days=1)).strftime("%Y/%m/%d"),
                "relevance_score": 0,
                "is_project_relevant": False,
            },
        ]

    # ── Persistence ─────────────────────────────────────────────────────────

    def _previous_save_path(self, category: str) -> Path:
        return self.output_dir / f"tfda-{category}-latest.json"

    def load_previous(self, category: str) -> List[Dict]:
        """Load previous scrape results."""
        path = self._previous_save_path(category)
        if path.exists():
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data.get("announcements", [])
        return []

    def save_results(self, category: str, announcements: List[Dict]) -> Path:
        """Save scraped results to JSON."""
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")

        payload = {
            "scraped_at": datetime.now().isoformat(),
            "category": category,
            "count": len(announcements),
            "announcements": announcements,
        }

        # Timestamped archive copy
        archive_path = self.output_dir / f"tfda-{category}-{timestamp}.json"
        with open(archive_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        # Overwrite "latest" pointer
        latest_path = self._previous_save_path(category)
        with open(latest_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        return latest_path

    # ── Diffing ─────────────────────────────────────────────────────────────

    def find_new_items(
        self, current: List[Dict], previous: List[Dict]
    ) -> List[Dict]:
        """Return items in current that are not in previous (by URL or title)."""
        prev_keys = {a.get("url") or a.get("title") for a in previous}
        return [a for a in current if (a.get("url") or a.get("title")) not in prev_keys]

    # ── Alert generation ─────────────────────────────────────────────────────

    def generate_alert(self, new_items: List[Dict], category: str) -> Optional[str]:
        """Generate a plain-text alert if relevant new items found."""
        relevant = [i for i in new_items if i.get("is_project_relevant")]
        if not relevant:
            return None

        lines = [
            "=" * 60,
            f"TFDA ALERT — {len(relevant)} New Relevant Announcement(s)",
            f"Category: {CATEGORY_CONFIG.get(category, {}).get('label', category)}",
            f"Detected at: {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            "=" * 60,
        ]
        for item in relevant:
            lines.append(f"\n  Title : {item['title']}")
            lines.append(f"  Date  : {item.get('date_raw', 'N/A')}")
            lines.append(f"  URL   : {item.get('url', 'N/A')}")
            lines.append(f"  Score : {item.get('relevance_score', 0)}")
        lines.append("=" * 60)
        return "\n".join(lines)

    def save_alert(self, alert_text: str, category: str) -> Path:
        """Save alert text to file."""
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        path = self.output_dir / f"alert-{category}-{timestamp}.txt"
        with open(path, "w", encoding="utf-8") as f:
            f.write(alert_text)
        return path


# ── CLI ────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Scrape Taiwan FDA announcements",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python tfda_scraper.py
  python tfda_scraper.py --category drug --days 7
  python tfda_scraper.py --category food --days 30 --compare
  python tfda_scraper.py --all-categories --days 14
        """,
    )
    parser.add_argument(
        "--category",
        choices=list(CATEGORY_CONFIG.keys()),
        default="drug",
        help="Announcement category to scrape (default: drug)",
    )
    parser.add_argument(
        "--all-categories",
        action="store_true",
        help="Scrape all categories",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Only include announcements from the last N days (default: 30)",
    )
    parser.add_argument(
        "--compare",
        action="store_true",
        help="Compare with previous scrape and show new items",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory to save results",
    )
    parser.add_argument(
        "--no-save",
        action="store_true",
        help="Print results only, do not save files",
    )
    parser.add_argument(
        "--detail",
        action="store_true",
        help="Fetch full text for relevant items (slower)",
    )

    args = parser.parse_args()

    output_dir = Path(args.output_dir).expanduser()
    scraper = TFDAScraper(output_dir=output_dir)

    categories = list(CATEGORY_CONFIG.keys()) if args.all_categories else [args.category]

    total_new = 0
    for category in categories:
        print(f"\n{'=' * 60}")
        print(f"Category: {CATEGORY_CONFIG[category]['label']} ({category})")
        print(f"Looking back: {args.days} days")
        print("=" * 60)

        # Load previous results for comparison
        previous = scraper.load_previous(category) if args.compare else []

        # Scrape
        print(f"Scraping TFDA ({BASE_URL})...")
        announcements = scraper.scrape_news_list(category=category, days=args.days)
        print(f"Found {len(announcements)} announcement(s)")

        # Print results
        relevant_count = sum(1 for a in announcements if a.get("is_project_relevant"))
        print(f"Project-relevant: {relevant_count}")
        print()

        for i, ann in enumerate(announcements, 1):
            marker = "★" if ann.get("is_project_relevant") else " "
            print(f"  [{marker}] {ann.get('date_raw', '----/--/--')}  {ann['title'][:60]}")
            if ann.get("url"):
                print(f"        {ann['url']}")

        # Optionally fetch detail for relevant items
        if args.detail and SCRAPER_AVAILABLE:
            for ann in announcements:
                if ann.get("is_project_relevant") and ann.get("url"):
                    print(f"\n  [Detail] {ann['title']}")
                    text = scraper.fetch_announcement_detail(ann["url"])
                    if text:
                        print(f"  {text[:400]}...")
                    time.sleep(scraper.delay)

        # Compare and alert
        if args.compare and previous:
            new_items = scraper.find_new_items(announcements, previous)
            print(f"\nNew since last scrape: {len(new_items)}")
            total_new += len(new_items)

            alert = scraper.generate_alert(new_items, category)
            if alert:
                print(alert)
                if not args.no_save:
                    alert_path = scraper.save_alert(alert, category)
                    print(f"Alert saved to: {alert_path}")

        # Save results
        if not args.no_save:
            save_path = scraper.save_results(category, announcements)
            print(f"\nResults saved to: {save_path}")

    if args.compare:
        print(f"\nTotal new items across all categories: {total_new}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
