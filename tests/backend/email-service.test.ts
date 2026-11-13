// Emails go out through Mailtrap when MAILTRAP_API_TOKEN is set: to a sandbox (caught, never delivered) when
// MAILTRAP_SANDBOX_ID is set, really sent otherwise. `fetch` is faked, so nothing leaves this machine.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { emailService } from '../../server/services/email-service';

const KEYS = ['MAILTRAP_API_TOKEN', 'MAILTRAP_SANDBOX_ID', 'SENDGRID_API_KEY', 'EMAIL_API_KEY', 'EMAIL_FROM', 'EMAIL_FROM_NAME', 'NODE_ENV'];
const saved: Record<string, string | undefined> = {};
const fetchMock = vi.fn();

function reply(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as any;
}

describe('email service', () => {
  beforeEach(() => {
    for (const k of KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends to the Mailtrap sandbox when a sandbox is set', async () => {
    process.env.MAILTRAP_API_TOKEN = 'TEST-TOKEN';
    process.env.MAILTRAP_SANDBOX_ID = '1234567';
    process.env.EMAIL_FROM = 'pulse@example.test';
    fetchMock.mockResolvedValue(reply(200, { success: true, message_ids: ['TEST-ID-1'] }));

    const result = await emailService.sendEmail({
      to: 'TEST-person@example.test',
      subject: 'TEST invite',
      text: 'Join at https://example.test/join/abc',
      attachments: [{ filename: 'TEST.txt', content: 'hello', contentType: 'text/plain' }],
    });

    expect(result).toEqual({ success: true, messageId: 'TEST-ID-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://sandbox.api.mailtrap.io/api/send/1234567');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer TEST-TOKEN');
    expect(init.headers['User-Agent']).toBeTruthy();
    expect(JSON.parse(init.body)).toEqual({
      from: { email: 'pulse@example.test', name: 'Pulse' },
      to: [{ email: 'TEST-person@example.test' }],
      subject: 'TEST invite',
      text: 'Join at https://example.test/join/abc',
      attachments: [{ content: Buffer.from('hello').toString('base64'), filename: 'TEST.txt', type: 'text/plain', disposition: 'attachment' }],
    });
  });

  it('really sends through Mailtrap when no sandbox is set, to every recipient', async () => {
    process.env.MAILTRAP_API_TOKEN = 'TEST-TOKEN';
    process.env.SENDGRID_API_KEY = 'SG.TEST-not-used';
    fetchMock.mockResolvedValue(reply(200, { success: true, message_ids: ['a', 'b'] }));

    const result = await emailService.sendEmail({ to: ['a@example.test', 'b@example.test'], subject: 'TEST', html: '<p>hi</p>' });

    expect(result.success).toBe(true);
    expect(emailService.provider()).toBe('mailtrap');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://send.api.mailtrap.io/api/send');
    expect(JSON.parse(init.body).to).toEqual([{ email: 'a@example.test' }, { email: 'b@example.test' }]);
  });

  it("reports Mailtrap's reason when it refuses an email", async () => {
    process.env.MAILTRAP_API_TOKEN = 'TEST-TOKEN';
    fetchMock.mockResolvedValue(reply(401, { success: false, errors: ['Unauthorized'] }));
    expect(await emailService.sendEmail({ to: 'a@example.test', subject: 'TEST', text: 'x' }))
      .toEqual({ success: false, error: 'Mailtrap: Unauthorized' });

    fetchMock.mockRejectedValue(new Error('network down'));
    expect(await emailService.sendEmail({ to: 'a@example.test', subject: 'TEST', text: 'x' }))
      .toEqual({ success: false, error: 'network down' });
  });

  it('refuses a sandbox id that is not a number, without calling out', async () => {
    process.env.MAILTRAP_API_TOKEN = 'TEST-TOKEN';
    process.env.MAILTRAP_SANDBOX_ID = '../other';
    const result = await emailService.sendEmail({ to: 'a@example.test', subject: 'TEST', text: 'x' });
    expect(result.success).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('with no provider: logs the email in development, and says it did not go when live', async () => {
    expect(emailService.isReady()).toBe(false);
    expect(await emailService.sendEmail({ to: 'a@example.test', subject: 'TEST', text: 'x' }))
      .toMatchObject({ success: true, logged: true });

    process.env.NODE_ENV = 'production';
    expect(await emailService.sendEmail({ to: 'a@example.test', subject: 'TEST', text: 'x' }))
      .toEqual({ success: false, error: 'Email is not set up on this server' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
