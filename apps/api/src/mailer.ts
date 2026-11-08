export interface Mailer {
  sendLoginCode(email: string, code: string): Promise<void>;
}

/**
 * Development mailer: prints the code to the API console. Swap for a real
 * provider (Postmark, SES, Resend) behind the same interface in production.
 */
export const consoleMailer: Mailer = {
  async sendLoginCode(email, code) {
    console.log(`[dev-mailer] sign-in code for ${email}: ${code}`);
  },
};

/** Test mailer that remembers the last code per address. */
export function memoryMailer(): Mailer & { lastCode(email: string): string | undefined } {
  const codes = new Map<string, string>();
  return {
    async sendLoginCode(email, code) {
      codes.set(email, code);
    },
    lastCode: (email) => codes.get(email),
  };
}
