import nodemailer from "nodemailer";
import type { Logger } from "pino";
export interface PushNotificationProvider {
  send(message: {
    recipient: string;
    title: string;
    body: string;
    metadata: Record<string, string>;
  }): Promise<void>;
}
export class ConsolePushProvider implements PushNotificationProvider {
  constructor(private readonly logger: Logger) {}
  async send(message: {
    recipient: string;
    title: string;
    body: string;
    metadata: Record<string, string>;
  }) {
    this.logger.info(
      { recipientId: message.recipient, eventId: message.metadata.eventId },
      "Local push delivery",
    );
  }
}
export interface MailProvider {
  send(message: {
    to: string;
    subject: string;
    text: string;
    id: string;
  }): Promise<void>;
}
export class MailpitProvider implements MailProvider {
  private readonly transport;
  constructor(
    host: string,
    port: number,
    private readonly from: string,
  ) {
    this.transport = nodemailer.createTransport({
      host,
      port,
      secure: false,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  async send(message: {
    to: string;
    subject: string;
    text: string;
    id: string;
  }) {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      messageId: `<${message.id}@nodra.local>`,
    });
  }
}
