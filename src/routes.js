/**
 * Request routing for Wine-Searcher scraper
 */

import { createPlaywrightRouter, log } from '@crawlee/playwright';
import { Actor } from 'apify';
import { humanDelay, simulateScrolling, simulateMouseMovement, typeHumanLike } from './utils/human.js';
import { parseSearchResults, parseWineDetails } from './utils/parsers.js';

export const router = createPlaywrightRouter();

/**
 * Homepage handler - natural entry point
 */
router.addHandler('HOMEPAGE', async ({ page, request, enqueueLinks }) => {
    log.info('Processing homepage');

    // Simulate human behavior
    await humanDelay(2000, 500);
    await simulateMouseMovement(page);
    await simulateScrolling(page);

    // If we have a search query in userData, perform search
    const searchQuery = request.userData?.searchQuery;
    if (searchQuery) {
        await performSearch(page, searchQuery);
    }
});

/**
 * Search results page handler
 */
router.addHandler('SEARCH_RESULTS', async ({ page, request, crawler }) => {
    log.info(`Processing search results: ${request.url}`);
    const { query, vintage, country, currency } = request.userData || {};

    // Simulate human behavior before extraction
    await humanDelay(3000, 1000);
    await simulateScrolling(page);

    // Wait for results to load
    try {
        await page.waitForSelector('.wine-card, .card, [data-wine], .wineCard', {
            timeout: 30000,
        });
    } catch (error) {
        log.warning('No wine cards found, trying alternative selectors');
    }

    // Extract wine data from search results
    const wines = await parseSearchResults(page);

    log.info(`Found ${wines.length} wines on page`);

    // Save results
    for (const wine of wines) {
        await Actor.pushData({
            ...wine,
            searchQuery: query,
            vintage,
            country,
            currency,
            sourceUrl: request.url,
            scrapedAt: new Date().toISOString(),
        });
    }

    // Check for pagination
    await humanDelay(2000, 500);

    const nextPageLink = await page.$('a[rel="next"], .pagination-next, [aria-label="Next page"]');
    if (nextPageLink && wines.length > 0) {
        const nextUrl = await nextPageLink.getAttribute('href');
        if (nextUrl) {
            log.info('Found next page, enqueueing...');
            await crawler.addRequests([{
                url: new URL(nextUrl, request.url).href,
                label: 'SEARCH_RESULTS',
                userData: request.userData,
            }]);
        }
    }
});

/**
 * Wine detail page handler
 */
router.addHandler('WINE_DETAIL', async ({ page, request }) => {
    log.info(`Processing wine detail: ${request.url}`);

    // Simulate human behavior
    await humanDelay(2000, 800);
    await simulateScrolling(page);
    await simulateMouseMovement(page);

    // Extract detailed wine data
    const wineData = await parseWineDetails(page);

    // Save to dataset
    await Actor.pushData({
        ...wineData,
        url: request.url,
        scrapedAt: new Date().toISOString(),
    });

    log.info(`Saved wine: ${wineData.wineName || 'Unknown'}`);
});

/**
 * Default handler for unmatched routes
 */
router.addDefaultHandler(async ({ page, request, enqueueLinks }) => {
    log.info(`Processing default route: ${request.url}`);

    // Simulate human behavior
    await humanDelay(2000, 500);
    await simulateScrolling(page);

    // Try to detect page type and extract accordingly
    const url = request.url;

    if (url.includes('/find/')) {
        // This is a search results page
        const wines = await parseSearchResults(page);
        for (const wine of wines) {
            await Actor.pushData({
                ...wine,
                sourceUrl: url,
                scrapedAt: new Date().toISOString(),
            });
        }
        log.info(`Extracted ${wines.length} wines from default handler`);
    }
});

/**
 * Perform a natural search from homepage
 */
async function performSearch(page, searchQuery) {
    log.info(`Performing natural search for: ${searchQuery}`);

    // Find search input
    const searchInput = await page.$('input[name="Xwinename"], input[type="search"], #search-input, .search-input');

    if (!searchInput) {
        log.warning('Search input not found');
        return;
    }

    // Click on search field
    await searchInput.click();
    await humanDelay(500, 200);

    // Type search query character by character
    await typeHumanLike(page, searchInput, searchQuery);

    // Wait for autocomplete suggestions
    await humanDelay(1500, 500);

    // Press Enter or click search button
    const searchButton = await page.$('button[type="submit"], .search-button, [aria-label="Search"]');
    if (searchButton) {
        await searchButton.click();
    } else {
        await page.keyboard.press('Enter');
    }

    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await humanDelay(2000, 500);
}
