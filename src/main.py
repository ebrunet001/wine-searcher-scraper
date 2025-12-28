"""
Wine Searcher Domain Scraper

Scrapes wine data from wine-searcher.com merchant/domain pages.
Extracts: name, appellation, rating, style, search rank, and average price.
"""

import asyncio
import re
from urllib.parse import urljoin

from apify import Actor
from playwright.async_api import async_playwright, Page, TimeoutError as PlaywrightTimeout


async def extract_wine_links(page: Page) -> list[str]:
    """Extract all wine links from a merchant/domain page."""
    wine_links = []

    # Wait for the wine list to load
    await page.wait_for_load_state("networkidle", timeout=30000)
    await asyncio.sleep(2)  # Additional wait for dynamic content

    # Find all wine links - they typically link to /find/ pages
    links = await page.query_selector_all('a[href*="/find/"]')

    for link in links:
        href = await link.get_attribute("href")
        if href and "/find/" in href:
            full_url = urljoin("https://www.wine-searcher.com", href)
            if full_url not in wine_links:
                wine_links.append(full_url)

    Actor.log.info(f"Found {len(wine_links)} wine links")
    return wine_links


async def extract_wine_data(page: Page, url: str, include_analytics: bool) -> dict | None:
    """Extract wine data from a wine detail page."""
    try:
        await page.goto(url, wait_until="networkidle", timeout=60000)
        await asyncio.sleep(2)

        wine_data = {
            "url": url,
            "name": None,
            "appellation": None,
            "rating": None,
            "style": None,
            "search_rank": None,
            "avg_price": None,
        }

        # Extract wine name - usually in h1 or main title
        name_selectors = [
            'h1.wine-name',
            'h1[class*="wine"]',
            'h1',
            '.wine-name',
            '[data-testid="wine-name"]',
            '.header-name',
        ]
        for selector in name_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    text = await element.inner_text()
                    if text and len(text) > 2:
                        wine_data["name"] = text.strip()
                        break
            except Exception:
                continue

        # Extract appellation
        appellation_selectors = [
            '[class*="appellation"]',
            '[data-testid="appellation"]',
            '.wine-appellation',
            'a[href*="/regions/"]',
        ]
        for selector in appellation_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    text = await element.inner_text()
                    if text:
                        wine_data["appellation"] = text.strip()
                        break
            except Exception:
                continue

        # Extract rating - look for score out of 100
        rating_selectors = [
            '[class*="rating"]',
            '[class*="score"]',
            '.critic-score',
            '[data-testid="rating"]',
        ]
        for selector in rating_selectors:
            try:
                elements = await page.query_selector_all(selector)
                for element in elements:
                    text = await element.inner_text()
                    # Look for pattern like "94" or "94/100"
                    match = re.search(r'(\d{2,3})(?:/100)?', text)
                    if match:
                        rating = int(match.group(1))
                        if 50 <= rating <= 100:
                            wine_data["rating"] = rating
                            break
                if wine_data["rating"]:
                    break
            except Exception:
                continue

        # Try to find rating in page text
        if not wine_data["rating"]:
            try:
                page_text = await page.inner_text("body")
                # Look for critic score patterns
                patterns = [
                    r'Critic Score[:\s]*(\d{2,3})',
                    r'Rating[:\s]*(\d{2,3})/100',
                    r'(\d{2,3})/100',
                ]
                for pattern in patterns:
                    match = re.search(pattern, page_text, re.IGNORECASE)
                    if match:
                        rating = int(match.group(1))
                        if 50 <= rating <= 100:
                            wine_data["rating"] = rating
                            break
            except Exception:
                pass

        # Extract style
        style_selectors = [
            '[class*="style"]',
            '.wine-style',
            '[data-testid="style"]',
        ]
        for selector in style_selectors:
            try:
                element = await page.query_selector(selector)
                if element:
                    text = await element.inner_text()
                    if text and "style" not in text.lower():
                        wine_data["style"] = text.strip()
                        break
            except Exception:
                continue

        # Try to extract style from page content
        if not wine_data["style"]:
            try:
                page_text = await page.inner_text("body")
                style_match = re.search(r'Style[:\s]*([A-Za-z\s,]+(?:Red|White|Rosé|Sparkling|Dessert)[A-Za-z\s,]*)', page_text, re.IGNORECASE)
                if style_match:
                    wine_data["style"] = style_match.group(1).strip()
            except Exception:
                pass

        # Extract average price
        price_selectors = [
            '[class*="price"]',
            '[class*="avg"]',
            '.average-price',
            '[data-testid="price"]',
        ]
        for selector in price_selectors:
            try:
                elements = await page.query_selector_all(selector)
                for element in elements:
                    text = await element.inner_text()
                    # Look for price patterns
                    price_match = re.search(r'[\$€£]?\s*(\d+(?:[.,]\d{2})?)\s*(?:€|\$|£|EUR|USD)?', text)
                    if price_match:
                        wine_data["avg_price"] = text.strip()
                        break
                if wine_data["avg_price"]:
                    break
            except Exception:
                continue

        # Try to find avg price in page text
        if not wine_data["avg_price"]:
            try:
                page_text = await page.inner_text("body")
                avg_patterns = [
                    r'Avg\.?\s*Price[:\s]*([\$€£]?\s*\d+(?:[.,]\d{2})?)',
                    r'Average[:\s]*([\$€£]\s*\d+(?:[.,]\d{2})?)',
                ]
                for pattern in avg_patterns:
                    match = re.search(pattern, page_text, re.IGNORECASE)
                    if match:
                        wine_data["avg_price"] = match.group(1).strip()
                        break
            except Exception:
                pass

        # Extract search rank from analytics tab if requested
        if include_analytics:
            try:
                # Look for analytics tab
                analytics_tab = await page.query_selector('a[href*="analytics"], button:has-text("Analytics"), [data-tab="analytics"]')
                if analytics_tab:
                    await analytics_tab.click()
                    await asyncio.sleep(2)

                    # Look for search rank
                    page_text = await page.inner_text("body")
                    rank_patterns = [
                        r'Search Rank[:\s]*#?(\d+)',
                        r'Rank[:\s]*#?(\d+)',
                        r'#(\d+)\s*(?:this month|last month)',
                    ]
                    for pattern in rank_patterns:
                        match = re.search(pattern, page_text, re.IGNORECASE)
                        if match:
                            wine_data["search_rank"] = int(match.group(1))
                            break
            except Exception as e:
                Actor.log.warning(f"Could not extract analytics: {e}")

        return wine_data

    except PlaywrightTimeout:
        Actor.log.warning(f"Timeout loading {url}")
        return None
    except Exception as e:
        Actor.log.error(f"Error extracting data from {url}: {e}")
        return None


async def main() -> None:
    """Main entry point for the Apify Actor."""
    async with Actor:
        # Get input
        actor_input = await Actor.get_input() or {}
        domain_url = actor_input.get("domain_url", "")
        max_wines = actor_input.get("max_wines", 0)
        include_analytics = actor_input.get("include_analytics", True)

        if not domain_url:
            Actor.log.error("No domain_url provided in input")
            return

        Actor.log.info(f"Starting scraper for: {domain_url}")
        Actor.log.info(f"Max wines: {max_wines if max_wines > 0 else 'unlimited'}")
        Actor.log.info(f"Include analytics: {include_analytics}")

        async with async_playwright() as p:
            # Launch browser with stealth settings
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                ]
            )

            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                locale="en-US",
            )

            # Add stealth scripts
            await context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
            """)

            page = await context.new_page()

            try:
                # Navigate to domain page
                Actor.log.info("Loading domain page...")
                await page.goto(domain_url, wait_until="networkidle", timeout=60000)

                # Check for Cloudflare or other challenges
                page_content = await page.content()
                if "challenge" in page_content.lower() or "captcha" in page_content.lower():
                    Actor.log.warning("Detected anti-bot challenge, waiting...")
                    await asyncio.sleep(10)
                    await page.reload(wait_until="networkidle")

                # Extract wine links
                wine_links = await extract_wine_links(page)

                if max_wines > 0:
                    wine_links = wine_links[:max_wines]

                Actor.log.info(f"Processing {len(wine_links)} wines...")

                # Scrape each wine
                for i, wine_url in enumerate(wine_links):
                    Actor.log.info(f"Processing wine {i + 1}/{len(wine_links)}: {wine_url}")

                    wine_data = await extract_wine_data(page, wine_url, include_analytics)

                    if wine_data and wine_data.get("name"):
                        await Actor.push_data(wine_data)
                        Actor.log.info(f"Saved: {wine_data.get('name')}")
                    else:
                        Actor.log.warning(f"Could not extract data from {wine_url}")

                    # Small delay between requests
                    await asyncio.sleep(2)

            except Exception as e:
                Actor.log.error(f"Error during scraping: {e}")
                raise
            finally:
                await browser.close()

        Actor.log.info("Scraping completed!")


if __name__ == "__main__":
    asyncio.run(main())
