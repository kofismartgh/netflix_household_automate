import Imap from 'imap';
import ErrorLogger from './ErrorLogger';
import Logger from './Logger';
import UrlExtractor, { ExtractedUrl } from './UrlExtractor';

export interface EmailHandler {
  (url: ExtractedUrl): Promise<void>;
}

export default class ImapMonitor {
  private imap: Imap;
  private logger: Logger;
  private emailHandler: EmailHandler;
  private targetEmailAddresses: string[];
  private targetSubject: string;
  private pollInterval: number;
  private maxEmailAgeMinutes: number;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor(
    emailHandler: EmailHandler,
    logger: Logger
  ) {
    this.emailHandler = emailHandler;
    this.logger = logger;

    // Parse target email addresses (support comma-separated)
    const emailAddresses = process.env.TARGET_EMAIL_ADDRESSES || process.env.TARGET_EMAIL_ADDRESS || '';
    this.targetEmailAddresses = emailAddresses
      .split(',')
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);

    this.targetSubject = process.env.TARGET_EMAIL_SUBJECT || 'Important: How to update your Netflix Household';

    // Polling interval (default: 30 seconds)
    this.pollInterval = Number(process.env.POLL_INTERVAL) || 30000;

    // Maximum email age in minutes (default: 3 minutes)
    // Only process emails newer than this to avoid expired Netflix links
    this.maxEmailAgeMinutes = Number(process.env.MAX_EMAIL_AGE_MINUTES) || 3;

    // Log filter configuration
    this.logger.info('Email filter configured', `From: ${this.targetEmailAddresses.join(', ')} | Subject: ${this.targetSubject}`);
    this.logger.info('Polling interval configured', `${this.pollInterval / 1000}s (${this.pollInterval}ms)`);
    this.logger.info('Email age filter configured', `Max age: ${this.maxEmailAgeMinutes} minutes (only process emails newer than this)`);

    this.imap = new Imap({
      user: process.env.IMAP_USER ?? '',
      password: process.env.IMAP_PASSWORD ?? '',
      host: process.env.IMAP_HOST ?? '',
      port: Number(process.env.IMAP_PORT) ?? 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 3_600_000, // 1 hour to reconnect if connection is lost
      keepalive: {
        interval: 10000, // Send NOOP commands every 10 seconds
        idleInterval: 300000, // Re-send IDLE command every 5 minutes
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.imap.once('ready', () => {
      this.imap.openBox('INBOX', false, (err) => {
        if (err) {
          throw new ErrorLogger(`Failed to open INBOX: ${err}`);
        }

        this.logger.info('IMAP connection ready', 'Start listening for emails on INBOX');
        this.imap.on('mail', () => {
          this.logger.info('New email event received', 'Checking for matching emails...');
          this.handleNewEmails();
        });
        
        // Check for existing emails on startup
        this.handleNewEmails();
        
        // Start periodic polling as backup (in addition to event-driven)
        this.startPolling();
      });
    });

    this.imap.once('error', (err: Error) => {
      throw new ErrorLogger(`IMAP connection error. Make sure IMAP is enabled and credentials are correct: ${err.message}`);
    });

    this.imap.once('end', () => {
      this.logger.warn('IMAP connection ended');
    });
  }

  private handleNewEmails() {
    // Build search criteria for multiple email addresses
    const searchCriteria: any[] = ['UNSEEN'];
    
    if (this.targetEmailAddresses.length === 1) {
      searchCriteria.push(['HEADER', 'FROM', this.targetEmailAddresses[0]]);
    } else if (this.targetEmailAddresses.length > 1) {
      // For multiple addresses, build nested OR conditions (OR only accepts 2 arguments)
      // Build a binary tree of OR conditions
      let fromCondition: any = ['HEADER', 'FROM', this.targetEmailAddresses[0]];
      for (let i = 1; i < this.targetEmailAddresses.length; i++) {
        fromCondition = ['OR', fromCondition, ['HEADER', 'FROM', this.targetEmailAddresses[i]]];
      }
      searchCriteria.push(fromCondition);
    }

    if (this.targetSubject) {
      searchCriteria.push(['HEADER', 'SUBJECT', this.targetSubject]);
    }

    this.logger.info('Checking for emails', `Filter: From (${this.targetEmailAddresses.join(', ')}) + Subject (${this.targetSubject})`);

    this.imap.search(searchCriteria, (err, results) => {
      if (err) {
        this.logger.error('Email search failed', err.message);
        return;
      }

      if (!results || !results.length) {
        this.logger.info('No emails found', 'No unread emails matching filter criteria');
        return;
      }

      this.logger.info('Email detected', `Found ${results.length} unread email(s) matching filter criteria`);

      // First, fetch headers to get From, Subject, and Date
      const headerFetch = this.imap.fetch(results, { 
        bodies: 'HEADER.FIELDS (FROM SUBJECT DATE)'
      });

      const emailHeaders: Map<number, { from: string; subject: string; date: Date | null }> = new Map();

      headerFetch.on('message', (msg, seqno) => {
        let headerBuffer = '';
        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            headerBuffer += chunk.toString('utf-8');
          });

          stream.on('end', () => {
            const fromMatch = headerBuffer.match(/From:\s*([^\r\n]+)/i);
            const subjectMatch = headerBuffer.match(/Subject:\s*([^\r\n]+)/i);
            const dateMatch = headerBuffer.match(/Date:\s*([^\r\n]+)/i);
            
            const from = fromMatch ? fromMatch[1].trim() : 'Unknown';
            const subject = subjectMatch ? subjectMatch[1].trim() : 'Unknown';
            
            // Parse email date
            let emailDate: Date | null = null;
            if (dateMatch) {
              try {
                emailDate = new Date(dateMatch[1].trim());
                // Check if date is valid
                if (isNaN(emailDate.getTime())) {
                  emailDate = null;
                }
              } catch (e) {
                emailDate = null;
              }
            }
            
            emailHeaders.set(seqno, { from, subject, date: emailDate });
          });
        });
      });

      headerFetch.once('end', () => {
        // Now fetch the email body (don't mark as seen yet - only after success)
        // results array contains UIDs, so we'll use those directly
        const fetchingData = this.imap.fetch(results, { 
          bodies: 'TEXT', 
          markSeen: false 
        });

        let messageIndex = 0;
        fetchingData.on('message', (msg, seqno) => {
          let body = '';
          const headers = emailHeaders.get(seqno) || { from: 'Unknown', subject: 'Unknown', date: null };
          // Use the UID from results array (results are UIDs from search)
          const uid = results[messageIndex];
          messageIndex++;

          // Get UID from message attributes as backup
          msg.on('attributes', (attrs) => {
            // UID from attributes will override if available (more reliable)
            if (attrs.uid) {
              // Note: We'll use the UID from results array, but attributes.uid is available if needed
            }
          });

          msg.on('body', (stream) => {
            stream.on('data', (chunk) => {
              body += chunk.toString('utf-8');
            });

            stream.on('end', async () => {
              // Check if email is too old (configurable via MAX_EMAIL_AGE_MINUTES)
              if (headers.date) {
                const emailAge = Date.now() - headers.date.getTime();
                const emailAgeMinutes = emailAge / (1000 * 60);
                
                if (emailAgeMinutes > this.maxEmailAgeMinutes) {
                  this.logger.warn('Email too old', `Email is ${emailAgeMinutes.toFixed(1)} minutes old (max: ${this.maxEmailAgeMinutes} minutes) - skipping to avoid expired links`);
                  return;
                }
                
                this.logger.info('Processing email', `From: ${headers.from} | Subject: ${headers.subject} | Age: ${emailAgeMinutes.toFixed(1)} minutes`);
              } else {
                this.logger.info('Processing email', `From: ${headers.from} | Subject: ${headers.subject} | Date: Unknown (processing anyway)`);
              }

              const extractedUrl = UrlExtractor.extractNetflixUrl(body);

              if (!extractedUrl) {
                this.logger.warn('URL extraction failed', 'No Netflix confirmation link found in email - email will remain unread');
                return;
              }

              if (!UrlExtractor.isValidUrl(extractedUrl.url)) {
                this.logger.warn('Invalid URL', 'Extracted URL is not valid or may be expired - email will remain unread');
                return;
              }

              this.logger.info('URL extracted', `Token: ${extractedUrl.token.substring(0, 10)}...`);

              try {
                await this.emailHandler(extractedUrl);
                
                // Only mark as read after successful confirmation
                if (uid) {
                  this.logger.info('Marking email as read', 'Confirmation successful');
                  this.imap.addFlags(uid, '\\Seen', (err) => {
                    if (err) {
                      this.logger.warn('Failed to mark email as read', err.message);
                    } else {
                      this.logger.info('Email marked as read', 'Successfully processed');
                    }
                  });
                } else {
                  this.logger.warn('Cannot mark email as read', 'UID not available');
                }
              } catch (error: any) {
                this.logger.error('Email handler failed', `${error?.message ?? error} - email will remain unread for retry`);
              }
            });
          });
        });

        fetchingData.on('error', (fetchingError) => {
          this.logger.error('Fetching error', fetchingError.message);
        });
      });

      headerFetch.on('error', (headerError) => {
        this.logger.error('Header fetch error', headerError.message);
      });
    });
  }

  private startPolling() {
    // Clear any existing timer
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    // Set up periodic polling
    this.pollTimer = setInterval(() => {
      this.logger.info('Periodic poll', `Checking for emails (every ${this.pollInterval / 1000}s)`);
      this.handleNewEmails();
    }, this.pollInterval);

    this.logger.info('Polling started', `Will check every ${this.pollInterval / 1000} seconds`);
  }

  connect() {
    this.logger.info('Connecting to IMAP server', `${process.env.IMAP_HOST}:${process.env.IMAP_PORT}`);
    this.imap.connect();
  }

  disconnect() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.imap.end();
  }
}

