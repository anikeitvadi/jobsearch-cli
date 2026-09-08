import * as net from 'net';
import * as dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

export interface EmailGuess {
  email: string;
  pattern: string;
  confidence: number;
}

/**
 * Generate possible email addresses based on company pattern and name
 */
export function generateEmailGuesses(
  firstName: string,
  lastName: string,
  domain: string,
  pattern?: string
): EmailGuess[] {
  const first = firstName.toLowerCase().trim();
  const last = lastName.toLowerCase().trim();
  const f = first.charAt(0);
  const l = last.charAt(0);

  const guesses: EmailGuess[] = [];

  // If we know the company's pattern, use it
  if (pattern) {
    const email = pattern
      .replace('{first}', first)
      .replace('{last}', last)
      .replace('{f}', f)
      .replace('{l}', l);
    guesses.push({ email, pattern, confidence: 0.9 });
  }

  // Common patterns (in order of likelihood)
  const commonPatterns = [
    { pattern: '{first}.{last}@', confidence: 0.7 },
    { pattern: '{first}{last}@', confidence: 0.6 },
    { pattern: '{f}{last}@', confidence: 0.5 },
    { pattern: '{first}@', confidence: 0.4 },
    { pattern: '{first}_{last}@', confidence: 0.3 },
    { pattern: '{last}.{first}@', confidence: 0.2 },
    { pattern: '{f}.{last}@', confidence: 0.2 },
  ];

  for (const p of commonPatterns) {
    const email =
      p.pattern
        .replace('{first}', first)
        .replace('{last}', last)
        .replace('{f}', f)
        .replace('{l}', l) + domain;

    // Don't duplicate if it matches the known pattern
    if (!guesses.some((g) => g.email === email)) {
      guesses.push({ email, pattern: p.pattern + domain, confidence: p.confidence });
    }
  }

  return guesses;
}

/**
 * Verify if an email exists using SMTP
 * Note: This is a basic check and may not work for all servers
 */
export async function verifyEmailSMTP(email: string): Promise<{
  valid: boolean;
  reason: string;
}> {
  const domain = email.split('@')[1];

  try {
    // Get MX records
    const mxRecords = await resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return { valid: false, reason: 'No MX records found' };
    }

    // Sort by priority and get the first one
    const mxHost = mxRecords.sort((a, b) => a.priority - b.priority)[0].exchange;

    return new Promise((resolve) => {
      const socket = new net.Socket();
      let response = '';

      socket.setTimeout(10000);

      socket.on('connect', () => {
        // Wait for server greeting
      });

      socket.on('data', (data) => {
        response += data.toString();

        if (response.includes('220') && !response.includes('HELO')) {
          socket.write('HELO verify.local\r\n');
        } else if (response.includes('250') && response.includes('HELO')) {
          socket.write(`MAIL FROM:<verify@verify.local>\r\n`);
        } else if (response.includes('250') && response.includes('MAIL FROM')) {
          socket.write(`RCPT TO:<${email}>\r\n`);
        } else if (response.includes('RCPT TO')) {
          socket.write('QUIT\r\n');

          if (response.includes('250')) {
            resolve({ valid: true, reason: 'Email exists' });
          } else if (response.includes('550') || response.includes('553')) {
            resolve({ valid: false, reason: 'Email does not exist' });
          } else if (response.includes('451') || response.includes('452')) {
            resolve({ valid: false, reason: 'Server rejected (greylisting)' });
          } else {
            resolve({ valid: false, reason: 'Unknown response' });
          }
        }
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ valid: false, reason: 'Connection timeout' });
      });

      socket.on('error', (err) => {
        resolve({ valid: false, reason: `Connection error: ${err.message}` });
      });

      socket.connect(25, mxHost);
    });
  } catch (error) {
    return { valid: false, reason: `DNS error: ${error}` };
  }
}

/**
 * Extract domain from company email pattern or website
 */
export function extractDomain(companyData: {
  email_pattern?: string;
  careers_url?: string;
}): string | null {
  if (companyData.email_pattern) {
    const match = companyData.email_pattern.match(/@(.+)$/);
    if (match) return match[1];
  }

  if (companyData.careers_url) {
    try {
      const url = new URL(companyData.careers_url);
      // Remove www. and careers. prefixes
      return url.hostname.replace(/^(www\.|careers\.)/, '');
    } catch {
      return null;
    }
  }

  return null;
}
