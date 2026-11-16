import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

import { generateUuid } from '@common/utils/uuid.util';
import { mailConfig } from '@config/configuration';
import { MetricsService } from '@modules/metrics/metrics.service';

import { MailMessage } from './interfaces/mail-message.interface';

/**
 * Sends email.
 * - smtp:   real delivery through the configured SMTP server.
 * - outbox: development only. Each email is written as an .eml file to
 *           MAIL_OUTBOX_DIR (open it in any mail client or text editor).
 *
 * Logs never contain recipients or content (codes, links), only the template.
 */
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter!: Transporter;

  constructor(
    private readonly metricsService: MetricsService,
    @Inject(mailConfig.KEY)
    private readonly mail: ConfigType<typeof mailConfig>,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.mail.transport === 'outbox') {
      this.transporter = createTransport({
        streamTransport: true,
        buffer: true,
        newline: 'unix',
      });
      this.logger.log(
        `Mail transport: outbox (emails are written to ./${this.mail.outboxDirectory})`,
      );
      return;
    }

    const { host, port, isSecure, user, password } = this.mail.smtp;
    this.transporter = createTransport({
      host,
      port,
      secure: isSecure,
      requireTLS: !isSecure,
      auth: user ? { user, pass: password } : undefined,
    });
    try {
      await this.transporter.verify();
      this.logger.log(`Mail transport: smtp (${host}:${port}) connected`);
    } catch (error) {
      // Don't block startup; sending will retry the connection.
      this.logger.warn(
        `Mail transport: smtp (${host}:${port}) connection check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** Sends one email. Throws if delivery fails; callers decide how to react. */
  async send(message: MailMessage): Promise<void> {
    let info: { message?: unknown };
    try {
      info = await this.transporter.sendMail({
        from: this.mail.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
    } catch (error) {
      this.metricsService.countEmail(message.template, 'failed');
      throw error;
    }
    this.metricsService.countEmail(message.template, 'sent');

    if (this.mail.transport === 'outbox') {
      await this.writeToOutbox(message.template, info.message);
      return;
    }
    this.logger.log({ message: 'Email sent', template: message.template });
  }

  private async writeToOutbox(template: string, raw: unknown): Promise<void> {
    if (!Buffer.isBuffer(raw)) {
      throw new Error('Outbox transport did not return the message');
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${timestamp}-${template}-${generateUuid().slice(-8)}.eml`;
    await mkdir(this.mail.outboxDirectory, { recursive: true });
    await writeFile(join(this.mail.outboxDirectory, fileName), raw);
    this.logger.log({
      message: `Email written to outbox: ${fileName}`,
      template,
    });
  }
}
