# Netflix Household Auto-Confirm

> Automatically detect Netflix household confirmation emails and submit confirmation within the 15-minute link expiration window.

- ✉️ Compatible with All Email Providers That Use IMAP
- ⚡️️ Blazing-Fast Acceptance (<5 minutes from email detection)
- 🛠️ Up to Zero Configuration
- 🍃 Even Runs on Raspberry Pi
- 🔒 Secure credential handling

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Gmail account with IMAP enabled (or any IMAP-compatible email provider)

**Enable IMAP in Gmail:**
1. Go to Settings > Forwarding and POP/IMAP
2. Enable "Enable IMAP"
3. Create an App Password: Google Account > Security > 2-Step Verification > App passwords

### Installation

1. **Clone or navigate to the project directory**
   ```sh
   cd netflix-auto-confirm
   ```

2. **Copy environment template**
   ```sh
   cp .env.dist .env
   ```

3. **Configure your `.env` file**
   ```env
   IMAP_USER=your-email@gmail.com
   IMAP_PASSWORD=your-app-password
   IMAP_HOST=imap.gmail.com
   IMAP_PORT=993
   TARGET_EMAIL_ADDRESS=noreply@netflix.com
   TARGET_EMAIL_SUBJECT=Important: How to update your Netflix Household
   ```

4. **Start with Docker Compose**
   ```sh
   docker compose up -d
   ```

5. **View logs**
   ```sh
   docker compose logs -f
   ```

That's it! The application will now monitor your inbox for Netflix household confirmation emails and automatically confirm them.

## 📋 Features

### Email Detection
- Monitors INBOX for new emails
- Filters by sender (configurable: `noreply@netflix.com`, `security-noreply@netflix.com`)
- Filters by subject line (configurable)
- Extracts Netflix confirmation URLs from email body

### Automation
- Automatically navigates to Netflix confirmation URL
- Clicks "Confirm Update" button
- Verifies successful confirmation
- Retries on failure (configurable attempts)
- Saves browser session/cookies to prevent repeated device notifications

### Reliability
- Automatic reconnection if IMAP connection is lost
- Retry logic with exponential backoff
- Comprehensive error logging
- Graceful shutdown handling

## ⚙️ Configuration

### Environment Variables

#### Required
- `IMAP_USER`: Your IMAP username (usually your email address)
- `IMAP_PASSWORD`: Your IMAP password or app password
- `IMAP_HOST`: IMAP server hostname (e.g., `imap.gmail.com`)
- `IMAP_PORT`: IMAP port (usually `993` for TLS)

#### Email Filtering
- `TARGET_EMAIL_ADDRESS`: Single email address to monitor (e.g., `noreply@netflix.com`)
- `TARGET_EMAIL_ADDRESSES`: Multiple email addresses (comma-separated, e.g., `noreply@netflix.com,security-noreply@netflix.com`)
- `TARGET_EMAIL_SUBJECT`: Email subject to filter (e.g., `Important: How to update your Netflix Household`)

#### Optional Configuration
- `LOG_LEVEL`: Logging level (`info`, `warn`, `error`) - Default: `info`
- `MAX_EMAIL_AGE_MINUTES`: Maximum email age in minutes (only process emails newer than this) - Default: `3`
  - Prevents processing expired Netflix links (links expire after ~10 minutes)
  - Recommended: 3-5 minutes to ensure links are still valid
- `PAGE_LOAD_TIMEOUT`: Browser page load timeout in milliseconds - Default: `3000`
- `CLICK_TIMEOUT`: Button click timeout in milliseconds - Default: `5000`
- `RETRY_ATTEMPTS`: Number of retry attempts for button click - Default: `2`

## 📊 How It Works

1. **IMAP Connection**: Connects to your email server and monitors INBOX
2. **Email Detection**: Listens for new emails matching configured filters
3. **URL Extraction**: Extracts Netflix confirmation URL from email body
4. **Browser Automation**: Opens headless browser and navigates to URL
5. **Confirmation**: Clicks "Confirm Update" button and verifies success
6. **Session Persistence**: Saves cookies/session to prevent device notifications

## 🔍 Monitoring

The application logs all events with timestamps:

```
[Timestamp] | INFO | IMAP connection ready | Start listening for emails on INBOX
[Timestamp] | INFO | Email detected | Found 1 unread Netflix email(s)
[Timestamp] | INFO | URL extracted | Token: xxxxx...
[Timestamp] | INFO | Browser opened | Launching headless browser
[Timestamp] | INFO | Button clicked | Attempt 1/2
[Timestamp] | INFO | Confirmation completed | Token: xxxxx...
[Timestamp] | INFO | Confirmation successful | Completed in 2.34s
```

## 🛠️ Development

### Local Development (without Docker)

1. **Install dependencies**
   ```sh
   yarn install
   ```

2. **Create `.env` file** (see Configuration section)

3. **Run the application**
   ```sh
   yarn start
   ```

### Project Structure

```
netflix-auto-confirm/
├── src/
│   ├── index.ts              # Main entry point
│   ├── ImapMonitor.ts        # IMAP email monitoring
│   ├── UrlExtractor.ts       # URL extraction from emails
│   ├── NetflixAutomation.ts  # Playwright browser automation
│   ├── Logger.ts             # Logging utility
│   └── ErrorLogger.ts        # Error logging utility
├── compose.yml               # Docker Compose configuration
├── package.json              # Dependencies and scripts
├── tsconfig.json             # TypeScript configuration
└── README.md                 # This file
```

## 🐛 Troubleshooting

### IMAP Connection Issues
- Verify IMAP is enabled in your email provider settings
- Check that your credentials are correct
- For Gmail, ensure you're using an App Password (not your regular password)
- Verify firewall/network allows IMAP connections

### Browser Automation Issues
- Ensure Docker has sufficient resources allocated
- Check that Playwright browser binaries are installed (handled automatically by Docker)
- Verify Netflix URL hasn't expired (15-minute window)

### Email Not Detected
- Verify email filters match your Netflix emails exactly
- Check that emails are in INBOX (not other folders)
- Ensure emails are unread when they arrive

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- [node-imap](https://github.com/mscdex/node-imap) - IMAP client library
- [playwright](https://github.com/microsoft/playwright) - Browser automation
- Inspired by [imap-netflix-household-automation](https://github.com/ducphu0ng/imap-netflix-household-automation)

