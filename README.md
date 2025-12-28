# Wine Searcher Domain Scraper

Scrapes wine data from wine-searcher.com merchant/domain pages.

## Features

- Scrapes all wines from a domain/merchant page
- Extracts: wine name, appellation, rating, style, search rank, average price
- Uses Playwright for JavaScript rendering and anti-bot bypass
- Configurable maximum wines limit
- Optional analytics data (search rank)

## Input

| Field | Type | Description |
|-------|------|-------------|
| `domain_url` | string | URL of the merchant/domain page |
| `max_wines` | integer | Maximum wines to scrape (0 = unlimited) |
| `include_analytics` | boolean | Fetch search rank from analytics tab |

### Example Input

```json
{
    "domain_url": "https://www.wine-searcher.com/merchant/22643-domaine-de-la-romanee-conti",
    "max_wines": 10,
    "include_analytics": true
}
```

## Output

Each wine record contains:

```json
{
    "name": "Domaine de la Romanee-Conti Romanee-Conti Grand Cru",
    "appellation": "Romanee-Conti",
    "rating": 98,
    "style": "Red Wine",
    "search_rank": 1,
    "avg_price": "$25,000",
    "url": "https://www.wine-searcher.com/find/..."
}
```

## Notes

- Wine-searcher.com has anti-bot protection; the scraper uses stealth techniques
- Delays are added between requests to avoid rate limiting
- Some fields may be null if not available on the page
