// Microsoft Graph mail integration. Phase 0 stub: logs instead of sending —
// Mail.Send requires the Graph admin consent that is planned for Phase 2
// (PLAN.md §7). The real implementation must go through the job queue with
// retry + error logging, never the request path (CLAUDE.md rules).

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export async function sendMail(message: MailMessage): Promise<void> {
  if (process.env.NODE_ENV === "production" && process.env.CI !== "true") {
    console.warn(
      `[graph/mail] Mail.Send not configured yet (Phase 2) — mail to ${message.to} (“${message.subject}”) was NOT sent.`,
    );
    return;
  }
  console.log(
    `[graph/mail] (dev stub) To: ${message.to}\nSubject: ${message.subject}\n${message.text}`,
  );
}
