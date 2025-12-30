# Wine Searcher Scraper

Scrapes wine data from wine-searcher.com using **Crawlee + Playwright + Firefox** with advanced anti-bot bypass techniques.

## Features

- Search for wines by name or scrape specific URLs
- Extracts: wine name, producer, region, vintage, price, ratings, merchant count
- **Anti-bot bypass**: Human behavior simulation, fingerprint randomization, residential proxies
- Uses Firefox (less detected than Chromium)
- Configurable concurrency and result limits

## Anti-Detection Techniques

- Gaussian-distributed delays between actions
- Mouse movement and scrolling simulation
- Character-by-character typing
- Session rotation on block detection
- Residential proxy support (recommended)
- Firefox with stealth configurations

## Input

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `searchQueries` | array | - | Wine names to search |
| `startUrls` | array | - | Specific URLs to scrape |
| `vintage` | string | `-` | Vintage year or `-` for all |
| `country` | string | `us` | Country code (us, uk, fr, etc.) |
| `currency` | string | `usd` | Currency (usd, eur, gbp) |
| `maxResults` | integer | `50` | Max wines per search |
| `maxConcurrency` | integer | `3` | Parallel browsers (3-5 recommended) |

### Example Input

```json
{
    "searchQueries": ["Chateau Margaux", "Opus One"],
    "vintage": "2015",
    "country": "us",
    "currency": "usd",
    "maxResults": 20,
    "maxConcurrency": 3
}
```

## Output

```json
{
    "wineName": "Chateau Margaux 2015",
    "producer": "Chateau Margaux",
    "region": "Margaux, Bordeaux",
    "vintage": "2015",
    "price": 589.00,
    "currency": "USD",
    "rating": 98,
    "merchantCount": 45,
    "url": "https://www.wine-searcher.com/find/chateau+margaux/2015/usa/usd",
    "scrapedAt": "2025-12-30T10:30:00Z"
}
```

## Technical Notes

- **Proxy**: Residential proxies are strongly recommended for Wine-Searcher
- **Concurrency**: Keep low (3-5) to avoid detection
- **Rate limiting**: Built-in delays simulate human browsing patterns
- Wine-Searcher uses Human Security anti-bot protection

## Project Structure

```
wine-searcher-scraper/
├── src/
│   ├── main.js           # Entry point with Crawlee config
│   ├── routes.js         # Request handlers
│   └── utils/
│       ├── human.js      # Human behavior simulation
│       └── parsers.js    # Data extraction
├── .actor/
│   ├── actor.json
│   ├── input_schema.json
│   └── Dockerfile
└── package.json
```
