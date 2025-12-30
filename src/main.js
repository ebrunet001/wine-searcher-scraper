/**
 * Wine-Searcher Scraper using Crawlee + Playwright + Camoufox
 * Designed to bypass Human Security anti-bot protection
 */

import { PlaywrightCrawler, log } from '@crawlee/playwright';
import { Actor } from 'apify';
import { firefox } from 'playwright';
import { router } from './routes.js';
import { getRandomUserAgent } from './utils/human.js';

await Actor.init();

// Get input configuration
const input = await Actor.getInput() ?? {};
const {
    searchQueries = [],
    startUrls = [],
    vintage = '-',
    country = 'us',
    currency = 'usd',
    maxResults = 50,
    maxConcurrency = 3,
} = input;

log.info('Starting Wine-Searcher scraper', {
    searchQueries: searchQueries.length,
    startUrls: startUrls.length,
    country,
    currency,
    maxConcurrency
});

// Configure proxy - RESIDENTIAL is MANDATORY for Human Security
let proxyConfiguration;
try {
    proxyConfiguration = await Actor.createProxyConfiguration({
        groups: ['RESIDENTIAL'],
        countryCode: 'US',
    });
    log.info('Proxy configuration created successfully');
} catch (error) {
    log.warning(`Could not create proxy configuration: ${error.message}`);
}

// Build start URLs from search queries
const urls = [...startUrls];
for (const query of searchQueries) {
    const formattedQuery = query.toLowerCase().replace(/\s+/g, '+');
    urls.push({
        url: `https://www.wine-searcher.com/find/${formattedQuery}/${vintage}/${country}/${currency}`,
        label: 'SEARCH_RESULTS',
        userData: { query, vintage, country, currency }
    });
}

// If no URLs provided, start from homepage
if (urls.length === 0) {
    urls.push({
        url: 'https://www.wine-searcher.com',
        label: 'HOMEPAGE'
    });
}

// Launch options for stealth - HEADFUL mode (less detected)
const stealthLaunchOptions = {
    headless: false,  // Headful mode - less detected by anti-bot
    args: [
        '--disable-blink-features=AutomationControlled',
    ],
    firefoxUserPrefs: {
        'dom.webdriver.enabled': false,
        'useAutomationExtension': false,
        'privacy.trackingprotection.enabled': false,
        'network.http.referer.XOriginPolicy': 0,
    },
};

log.info('Using HEADFUL mode (non-headless) for better anti-detection');

const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    requestHandler: router,

    // Use Firefox for better anti-detection
    launchContext: {
        launcher: firefox,
        launchOptions: stealthLaunchOptions,
    },

    // Browser context options
    browserPoolOptions: {
        useFingerprints: true,
        fingerprintOptions: {
            fingerprintGeneratorOptions: {
                browsers: ['firefox'],
                devices: ['desktop'],
                operatingSystems: ['windows', 'macos'],
                locales: ['en-US', 'en-GB'],
            },
        },
    },

    // Anti-detection settings
    maxConcurrency,
    navigationTimeoutSecs: 90,
    requestHandlerTimeoutSecs: 180,

    // Retry configuration
    maxRequestRetries: 3,

    // Session management - retire blocked sessions aggressively
    sessionPoolOptions: {
        maxPoolSize: 20,
        sessionOptions: {
            maxUsageCount: 10,
        },
    },

    // Pre-navigation hook for stealth
    preNavigationHooks: [
        async ({ page, request }, gotoOptions) => {
            // Warm-up delay - let browser fully initialize
            log.debug('Warming up browser before navigation...');
            await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

            // Set realistic viewport
            await page.setViewportSize({
                width: 1920,
                height: 1080,
            });

            // Override navigator.webdriver
            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });

                // Override plugins
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });

                // Override languages
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
            });

            // Set extra headers
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
            });

            log.debug(`Navigating to: ${request.url}`);
        },
    ],

    // Post-navigation hook to check for blocks
    postNavigationHooks: [
        async ({ page, request, session }) => {
            const title = await page.title();
            const content = await page.content();

            // Check for security blocks
            if (title.includes('Access Denied') ||
                title.includes('Access to this page has been denied') ||
                content.includes('security check') ||
                content.includes('Access Denied')) {

                log.warning(`Security block detected on ${request.url}`);
                session?.retire();
                throw new Error('SECURITY_BLOCK_DETECTED');
            }

            // Check for CAPTCHA
            const hasCaptcha = await page.$('iframe[src*="captcha"], [class*="captcha"]');
            if (hasCaptcha) {
                log.warning(`CAPTCHA detected on ${request.url}`);
                session?.retire();
                throw new Error('CAPTCHA_DETECTED');
            }

            log.info(`Successfully loaded: ${title}`);
        },
    ],

    // Handle failed requests
    failedRequestHandler: async ({ request, error }) => {
        log.error(`Request failed: ${request.url}`, { error: error.message });
    },
});

// Store configuration in crawler for use in handlers
crawler.userData = { maxResults, country, currency, vintage };

log.info(`Starting crawl with ${urls.length} URLs`);
await crawler.run(urls);

log.info('Scraping completed!');
await Actor.exit();
