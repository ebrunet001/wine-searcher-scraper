/**
 * Human behavior simulation utilities
 * Designed to bypass anti-bot detection systems like Human Security
 */

/**
 * Generate a random integer between min and max (inclusive)
 */
export function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a gaussian (normal) distributed random delay
 * More realistic than uniform random delays
 * @param {number} mean - Mean delay in milliseconds
 * @param {number} stdDev - Standard deviation
 * @returns {Promise} - Resolves after the delay
 */
export function humanDelay(mean = 3000, stdDev = 1000) {
    const u1 = Math.random();
    const u2 = Math.random();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const delay = Math.max(100, Math.round(mean + normal * stdDev));

    return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Simulate natural mouse movements across the page
 * @param {Page} page - Playwright page object
 */
export async function simulateMouseMovement(page) {
    const viewport = await page.viewportSize();
    if (!viewport) return;

    const movements = randomInt(3, 8);

    for (let i = 0; i < movements; i++) {
        const x = randomInt(100, viewport.width - 100);
        const y = randomInt(100, viewport.height - 100);

        // Move with random steps for more natural movement
        await page.mouse.move(x, y, { steps: randomInt(5, 15) });
        await humanDelay(100, 50);
    }
}

/**
 * Simulate natural scrolling behavior
 * @param {Page} page - Playwright page object
 */
export async function simulateScrolling(page) {
    const scrolls = randomInt(2, 5);

    for (let i = 0; i < scrolls; i++) {
        const scrollAmount = randomInt(100, 400);
        await page.mouse.wheel(0, scrollAmount);
        await humanDelay(800, 300);
    }

    // Sometimes scroll back up a bit
    if (Math.random() > 0.7) {
        await page.mouse.wheel(0, -randomInt(50, 150));
        await humanDelay(500, 200);
    }
}

/**
 * Type text character by character with human-like delays
 * @param {Page} page - Playwright page object
 * @param {ElementHandle} element - Element to type into
 * @param {string} text - Text to type
 */
export async function typeHumanLike(page, element, text) {
    for (const char of text) {
        await element.type(char, { delay: randomInt(50, 150) });

        // Occasionally pause longer (thinking)
        if (Math.random() > 0.9) {
            await humanDelay(300, 100);
        }
    }
}

/**
 * Simulate reading behavior - stay on page and scroll
 * @param {Page} page - Playwright page object
 * @param {number} duration - Approximate reading time in ms
 */
export async function simulateReading(page, duration = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
        // Random scroll
        if (Math.random() > 0.5) {
            await simulateScrolling(page);
        }

        // Random mouse movement
        if (Math.random() > 0.7) {
            await simulateMouseMovement(page);
        }

        await humanDelay(1000, 300);
    }
}

/**
 * Click on an element with human-like behavior
 * @param {Page} page - Playwright page object
 * @param {string} selector - Element selector
 */
export async function humanClick(page, selector) {
    const element = await page.$(selector);
    if (!element) return false;

    // Get element bounding box
    const box = await element.boundingBox();
    if (!box) return false;

    // Move to element with some randomness
    const x = box.x + box.width / 2 + randomInt(-10, 10);
    const y = box.y + box.height / 2 + randomInt(-5, 5);

    await page.mouse.move(x, y, { steps: randomInt(10, 20) });
    await humanDelay(200, 100);

    await page.mouse.click(x, y);
    return true;
}

/**
 * Get a random realistic user agent
 */
export function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:133.0) Gecko/20100101 Firefox/133.0',
        'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
    ];

    return userAgents[randomInt(0, userAgents.length - 1)];
}

/**
 * Generate random but consistent browser fingerprint data
 */
export function generateFingerprint() {
    const screenResolutions = [
        { width: 1920, height: 1080 },
        { width: 1366, height: 768 },
        { width: 1536, height: 864 },
        { width: 1440, height: 900 },
        { width: 2560, height: 1440 },
    ];

    const timezones = [
        'America/New_York',
        'America/Chicago',
        'America/Los_Angeles',
        'America/Denver',
    ];

    const resolution = screenResolutions[randomInt(0, screenResolutions.length - 1)];
    const timezone = timezones[randomInt(0, timezones.length - 1)];

    return {
        screen: resolution,
        timezone,
        language: 'en-US',
        platform: Math.random() > 0.3 ? 'Win32' : 'MacIntel',
        colorDepth: 24,
        hardwareConcurrency: [4, 8, 12, 16][randomInt(0, 3)],
    };
}
