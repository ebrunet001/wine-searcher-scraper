/**
 * Data extraction utilities for Wine-Searcher
 */

import { log } from '@crawlee/playwright';

/**
 * Parse search results page and extract wine data
 * @param {Page} page - Playwright page object
 * @returns {Array} - Array of wine objects
 */
export async function parseSearchResults(page) {
    const wines = [];

    // Multiple selector strategies for wine cards
    const cardSelectors = [
        '.card.card-sl',
        '.wine-card',
        '[data-wine-id]',
        '.wineCard',
        '.searchResults .card',
        'article.wine',
        '.product-card',
    ];

    let cards = [];
    for (const selector of cardSelectors) {
        cards = await page.$$(selector);
        if (cards.length > 0) {
            log.debug(`Found ${cards.length} cards with selector: ${selector}`);
            break;
        }
    }

    // If no cards found, try to extract from table format
    if (cards.length === 0) {
        return await parseTableResults(page);
    }

    for (const card of cards) {
        try {
            const wine = await extractWineFromCard(card);
            if (wine && wine.wineName) {
                wines.push(wine);
            }
        } catch (error) {
            log.debug(`Error extracting wine from card: ${error.message}`);
        }
    }

    return wines;
}

/**
 * Extract wine data from a card element
 * @param {ElementHandle} card - Card element handle
 * @returns {Object} - Wine data object
 */
async function extractWineFromCard(card) {
    const wine = {
        wineName: null,
        producer: null,
        region: null,
        vintage: null,
        price: null,
        currency: null,
        rating: null,
        merchantCount: null,
        url: null,
    };

    // Wine name - try multiple selectors
    const nameSelectors = [
        '.wine-name',
        '.card-title',
        'h2',
        'h3',
        '[itemprop="name"]',
        '.name',
        'a[href*="/find/"]',
    ];

    for (const selector of nameSelectors) {
        const nameEl = await card.$(selector);
        if (nameEl) {
            wine.wineName = await nameEl.innerText();
            wine.wineName = wine.wineName?.trim();

            // Try to get URL
            const href = await nameEl.getAttribute('href');
            if (href) {
                wine.url = href.startsWith('http') ? href : `https://www.wine-searcher.com${href}`;
            }
            break;
        }
    }

    // Extract vintage from wine name
    if (wine.wineName) {
        const vintageMatch = wine.wineName.match(/\b(19|20)\d{2}\b/);
        if (vintageMatch) {
            wine.vintage = vintageMatch[0];
        }
    }

    // Producer
    const producerSelectors = ['.producer', '.producer-name', '[itemprop="brand"]', '.winery'];
    for (const selector of producerSelectors) {
        const el = await card.$(selector);
        if (el) {
            wine.producer = (await el.innerText())?.trim();
            break;
        }
    }

    // Region
    const regionSelectors = ['.region', '.appellation', '[itemprop="region"]', '.wine-region'];
    for (const selector of regionSelectors) {
        const el = await card.$(selector);
        if (el) {
            wine.region = (await el.innerText())?.trim();
            break;
        }
    }

    // Price
    const priceSelectors = ['.price', '[itemprop="price"]', '.avg-price', '.wine-price'];
    for (const selector of priceSelectors) {
        const el = await card.$(selector);
        if (el) {
            const priceText = (await el.innerText())?.trim();
            const priceData = parsePrice(priceText);
            wine.price = priceData.price;
            wine.currency = priceData.currency;
            break;
        }
    }

    // Rating
    const ratingSelectors = ['.rating', '.score', '.critic-score', '[itemprop="ratingValue"]'];
    for (const selector of ratingSelectors) {
        const el = await card.$(selector);
        if (el) {
            const ratingText = (await el.innerText())?.trim();
            const ratingMatch = ratingText.match(/(\d{2,3})/);
            if (ratingMatch) {
                const rating = parseInt(ratingMatch[1], 10);
                if (rating >= 50 && rating <= 100) {
                    wine.rating = rating;
                }
            }
            break;
        }
    }

    // Merchant count
    const merchantSelectors = ['.merchant-count', '.offers', '.stores'];
    for (const selector of merchantSelectors) {
        const el = await card.$(selector);
        if (el) {
            const text = (await el.innerText())?.trim();
            const countMatch = text.match(/(\d+)/);
            if (countMatch) {
                wine.merchantCount = parseInt(countMatch[1], 10);
            }
            break;
        }
    }

    return wine;
}

/**
 * Parse table-format results (alternative layout)
 * @param {Page} page - Playwright page object
 * @returns {Array} - Array of wine objects
 */
async function parseTableResults(page) {
    const wines = [];

    // Try table rows
    const rows = await page.$$('table tr, .results-table tr');

    for (const row of rows) {
        try {
            const cells = await row.$$('td');
            if (cells.length >= 2) {
                const wine = {
                    wineName: null,
                    price: null,
                    currency: null,
                    url: null,
                };

                // First cell usually contains wine name
                const nameCell = cells[0];
                const nameLink = await nameCell.$('a');
                if (nameLink) {
                    wine.wineName = (await nameLink.innerText())?.trim();
                    wine.url = await nameLink.getAttribute('href');
                } else {
                    wine.wineName = (await nameCell.innerText())?.trim();
                }

                // Look for price in other cells
                for (const cell of cells) {
                    const cellText = (await cell.innerText())?.trim();
                    if (cellText.match(/[\$€£]/)) {
                        const priceData = parsePrice(cellText);
                        wine.price = priceData.price;
                        wine.currency = priceData.currency;
                        break;
                    }
                }

                if (wine.wineName) {
                    wines.push(wine);
                }
            }
        } catch (error) {
            log.debug(`Error parsing table row: ${error.message}`);
        }
    }

    return wines;
}

/**
 * Parse wine detail page
 * @param {Page} page - Playwright page object
 * @returns {Object} - Detailed wine data
 */
export async function parseWineDetails(page) {
    const wine = {
        wineName: null,
        producer: null,
        region: null,
        appellation: null,
        country: null,
        vintage: null,
        grapes: [],
        alcoholContent: null,
        bottleSize: null,
        lwin: null,
        pricing: {
            currency: null,
            minPrice: null,
            maxPrice: null,
            avgPrice: null,
            offersCount: null,
        },
        ratings: {
            wineSearcherScore: null,
            critics: [],
        },
        merchants: [],
    };

    // Wine name
    const nameSelectors = ['h1', '.wine-name', '[itemprop="name"]', '.product-title'];
    for (const selector of nameSelectors) {
        const el = await page.$(selector);
        if (el) {
            wine.wineName = (await el.innerText())?.trim();
            break;
        }
    }

    // Extract vintage from name
    if (wine.wineName) {
        const vintageMatch = wine.wineName.match(/\b(19|20)\d{2}\b/);
        if (vintageMatch) {
            wine.vintage = vintageMatch[0];
        }
    }

    // Region/Appellation
    const regionEl = await page.$('.region, [itemprop="region"], .wine-region, .appellation');
    if (regionEl) {
        wine.region = (await regionEl.innerText())?.trim();
    }

    // Grapes
    const grapesEl = await page.$('.grapes, .grape-variety, [itemprop="additionalType"]');
    if (grapesEl) {
        const grapesText = (await grapesEl.innerText())?.trim();
        wine.grapes = grapesText.split(/[,;]/).map(g => g.trim()).filter(Boolean);
    }

    // Wine-Searcher Score
    const scoreEl = await page.$('.ws-score, .critic-score, .aggregate-score');
    if (scoreEl) {
        const scoreText = (await scoreEl.innerText())?.trim();
        const scoreMatch = scoreText.match(/(\d{2,3})/);
        if (scoreMatch) {
            wine.ratings.wineSearcherScore = parseInt(scoreMatch[1], 10);
        }
    }

    // Price information
    const priceEl = await page.$('.price, .avg-price, [itemprop="price"]');
    if (priceEl) {
        const priceText = (await priceEl.innerText())?.trim();
        const priceData = parsePrice(priceText);
        wine.pricing.avgPrice = priceData.price;
        wine.pricing.currency = priceData.currency;
    }

    // Merchant list
    const merchantRows = await page.$$('.merchant-row, .offer-row, .store-listing');
    for (const row of merchantRows.slice(0, 10)) { // Limit to first 10
        try {
            const merchant = await extractMerchant(row);
            if (merchant.name) {
                wine.merchants.push(merchant);
            }
        } catch (error) {
            log.debug(`Error extracting merchant: ${error.message}`);
        }
    }

    if (wine.merchants.length > 0) {
        wine.pricing.offersCount = wine.merchants.length;
        const prices = wine.merchants.map(m => m.price).filter(p => p !== null);
        if (prices.length > 0) {
            wine.pricing.minPrice = Math.min(...prices);
            wine.pricing.maxPrice = Math.max(...prices);
        }
    }

    return wine;
}

/**
 * Extract merchant data from a row element
 * @param {ElementHandle} row - Merchant row element
 * @returns {Object} - Merchant data
 */
async function extractMerchant(row) {
    const merchant = {
        name: null,
        price: null,
        location: null,
        inStock: true,
        offerType: 'retail',
    };

    // Merchant name
    const nameEl = await row.$('.merchant-name, .store-name, a');
    if (nameEl) {
        merchant.name = (await nameEl.innerText())?.trim();
    }

    // Price
    const priceEl = await row.$('.price, .offer-price');
    if (priceEl) {
        const priceText = (await priceEl.innerText())?.trim();
        const priceData = parsePrice(priceText);
        merchant.price = priceData.price;
    }

    // Location
    const locationEl = await row.$('.location, .merchant-location');
    if (locationEl) {
        merchant.location = (await locationEl.innerText())?.trim();
    }

    return merchant;
}

/**
 * Parse price string to extract numeric value and currency
 * @param {string} priceText - Price text to parse
 * @returns {Object} - { price: number, currency: string }
 */
function parsePrice(priceText) {
    if (!priceText) return { price: null, currency: null };

    // Detect currency
    let currency = 'USD';
    if (priceText.includes('€')) currency = 'EUR';
    else if (priceText.includes('£')) currency = 'GBP';
    else if (priceText.includes('$')) currency = 'USD';

    // Extract numeric value
    const cleaned = priceText.replace(/[^\d.,]/g, '');
    const normalized = cleaned.replace(',', '.');
    const price = parseFloat(normalized);

    return {
        price: isNaN(price) ? null : price,
        currency,
    };
}
