/** Rendered email content (see templates/). */
export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

export interface MailMessage extends MailContent {
  to: string;
  /** Template name, for logs (e.g. "verification-code"). Never the content. */
  template: string;
}
