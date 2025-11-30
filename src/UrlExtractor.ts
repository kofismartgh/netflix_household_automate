export interface ExtractedUrl {
  url: string;
  token: string;
}

export default class UrlExtractor {
  /**
   * Extracts Netflix confirmation URL from email body
   * Pattern: https://www.netflix.com/account/update-primary-location?nftoken=[TOKEN]
   */
  static extractNetflixUrl(emailBody: string): ExtractedUrl | null {
    try {
      // Remove quoted-printable encoding
      const decodedBody = emailBody
        .replace(/=(\r?\n|$)/g, '')
        .replace(/=([a-f0-9]{2})/gi, (m, code) => String.fromCharCode(parseInt(code, 16)));

      // Search for Netflix confirmation link
      const regex = /"(https:\/\/www\.netflix\.com\/account\/update-primary-location[^"]*)"/;
      const match = decodedBody.match(regex);

      if (match && match[1]) {
        const url = match[1];
        const urlObj = new URL(url);
        const token = urlObj.searchParams.get('nftoken');

        if (token) {
          return { url, token };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Validates that the URL is not expired (basic check)
   */
  static isValidUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'www.netflix.com' &&
             urlObj.pathname === '/account/update-primary-location' &&
             urlObj.searchParams.has('nftoken');
    } catch {
      return false;
    }
  }
}

