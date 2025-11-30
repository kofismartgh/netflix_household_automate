import 'dotenv/config';
import ImapMonitor from './ImapMonitor';
import Logger from './Logger';
import ErrorLogger from './ErrorLogger';
import netflixAutomation from './NetflixAutomation';
import { ExtractedUrl } from './UrlExtractor';

const logger = new Logger(process.env.LOG_LEVEL || 'info');

async function handleNetflixEmail(extractedUrl: ExtractedUrl): Promise<void> {
  logger.info('Processing Netflix email', `Token: ${extractedUrl.token.substring(0, 10)}...`);
  
  const startTime = Date.now();
  
  try {
    await netflixAutomation(extractedUrl, logger);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('Confirmation successful', `Completed in ${duration}s`);
  } catch (error: any) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.error('Confirmation failed', `Failed after ${duration}s: ${error?.message ?? error}`);
    throw error;
  }
}

(function main() {
  logger.info('Netflix Auto-Confirm Starting', 'Initializing IMAP monitor...');

  // Validate required environment variables
  const requiredEnvVars = ['IMAP_USER', 'IMAP_PASSWORD', 'IMAP_HOST'];
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingVars.length > 0) {
    throw new ErrorLogger(`Missing required environment variables: ${missingVars.join(', ')}`);
  }

  const monitor = new ImapMonitor(handleNetflixEmail, logger);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down', 'Received SIGINT signal');
    monitor.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('Shutting down', 'Received SIGTERM signal');
    monitor.disconnect();
    process.exit(0);
  });

  // Start monitoring
  monitor.connect();
}());

