import { existsSync, mkdirSync } from "fs";
import { chromium, expect } from '@playwright/test';
import ErrorLogger from './ErrorLogger';
import Logger from './Logger';
import { ExtractedUrl } from './UrlExtractor';

const STORAGE_STATE_PATH = './tmp/storageState.json';
const PAGE_LOAD_TIMEOUT = Number(process.env.PAGE_LOAD_TIMEOUT) || 3000;
const CLICK_TIMEOUT = Number(process.env.CLICK_TIMEOUT) || 5000;
const RETRY_ATTEMPTS = Number(process.env.RETRY_ATTEMPTS) || 2;

export default async function netflixAutomation(
  extractedUrl: ExtractedUrl,
  logger: Logger
): Promise<void> {
  // Ensure tmp directory exists
  if (!existsSync('./tmp')) {
    mkdirSync('./tmp', { recursive: true });
  }

  const storageStateExists = existsSync(STORAGE_STATE_PATH);

  logger.info('Browser opened', 'Launching headless browser');

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-gl-drawing-for-tests'], // disable GPU drawing for improved performance in headless mode.
  });

  // Load the storage state (cookies/session) from previous runs if it exists.
  // STORAGE STATE EXPLANATION:
  // - Storage state = cookies, local storage, and session data saved from previous browser sessions
  // - When Netflix sees the same cookies/session, it recognizes this as the same "device"
  // - This prevents Netflix from sending "new device detected" emails on every run
  // - File location: ./tmp/storageState.json (created after first successful confirmation)
  // - Only saved after successful confirmation, so failed attempts don't create invalid sessions
  const browserContext = await browser.newContext({
    storageState: storageStateExists ? STORAGE_STATE_PATH : undefined
  });
  const page = await browserContext.newPage();

  try {
    logger.info('Navigating to Netflix URL', `URL: ${extractedUrl.url.substring(0, 50)}...`);
    await page.goto(extractedUrl.url, { waitUntil: "domcontentloaded", timeout: PAGE_LOAD_TIMEOUT });

    logger.info('Page loaded', 'Waiting for confirmation button');

    // Check if link is expired first
    const expiredLinkText = await page.locator('text="This link is no longer valid"').count();
    if (expiredLinkText > 0) {
      throw new ErrorLogger(`Netflix link has expired (10 minute limit): ${extractedUrl.url}`);
    }

    // Check if the confirmation button exists
    const confirmButton = page.locator("button[data-uia='set-primary-location-action']");
    const buttonExists = await confirmButton.count();
    
    if (buttonExists === 0) {
      // Check if it's the expired link page
      const pageContent = await page.textContent('body');
      if (pageContent && pageContent.includes('no longer valid')) {
        throw new ErrorLogger(`Netflix link has expired (10 minute limit): ${extractedUrl.url}`);
      }
      throw new ErrorLogger(`Confirmation button not found on page. Link may be expired or invalid: ${extractedUrl.url}`);
    }

    // Retry logic for button click with exponential backoff
    let confirmationSuccess = false;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
      try {
        logger.info('Attempting button click', `Attempt ${attempt}/${RETRY_ATTEMPTS}`);
        
        // Click the button
        await confirmButton.click({ force: true, timeout: CLICK_TIMEOUT });
        logger.info('Button clicked', `Attempt ${attempt}/${RETRY_ATTEMPTS}`);

        // Wait for success indicator
        const isSuccessLocator = page.locator('div[data-uia="upl-success"]');
        await expect(isSuccessLocator).toBeAttached({ timeout: 5000 });
        
        // Verify success by checking the success message exists
        const successCount = await isSuccessLocator.count();
        if (successCount > 0) {
          confirmationSuccess = true;
          if (attempt > 1) {
            logger.info('Confirmation completed on retry', `Succeeded on attempt ${attempt}/${RETRY_ATTEMPTS} | Token: ${extractedUrl.token.substring(0, 10)}...`);
          } else {
            logger.info('Confirmation completed', `Succeeded on first attempt | Token: ${extractedUrl.token.substring(0, 10)}...`);
          }
          break; // Success, exit retry loop
        }
      } catch (error: any) {
        lastError = error;
        logger.warn(`Button click attempt ${attempt} failed`, error?.message ?? 'Unknown error');
        
        if (attempt < RETRY_ATTEMPTS) {
          logger.info('Retrying', `Waiting ${attempt} second(s) before retry...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        }
      }
    }

    // Only proceed if confirmation was actually successful
    if (!confirmationSuccess) {
      const errorMsg = lastError 
        ? `Confirmation failed after ${RETRY_ATTEMPTS} attempts: ${lastError.message}`
        : `Confirmation failed after ${RETRY_ATTEMPTS} attempts: Success indicator not found`;
      throw new ErrorLogger(errorMsg);
    }

    // Only save storage state if confirmation was successful
    // This saves cookies/session so Netflix recognizes this device/browser
    // and won't send "new device" emails on future runs
    await browserContext.storageState({ path: STORAGE_STATE_PATH });
    logger.info('Storage state saved', 'Session persisted for future runs (prevents new device emails)');

  } catch (error: any) {
    logger.error('Netflix automation failed', error?.message ?? error);
    throw new ErrorLogger(`Netflix automation error: ${error?.message ?? error}`);
  } finally {
    await browser.close();
    logger.info('Browser closed', 'Automation completed');
  }

  return Promise.resolve();
}

