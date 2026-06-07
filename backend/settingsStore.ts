import crypto from "crypto";
import { dbFindOne, dbUpdateOne, ConnOpts } from "./dbStore";
import { ApiSettings, AppSettings } from "./interfaces";

// ─── Constants ───────────────────────────────────────────────────────────────

const COLLECTION = "app_settings";
const APISETTINGS_DOC_ID = "api_settings";
const ALGORITHM = "aes-256-gcm" as const;

// ─── Encryption helpers ──────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const secret = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!secret) throw new Error("SETTINGS_ENCRYPTION_KEY is not set.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(stored: string): string {
  const key = getEncryptionKey();
  const [ivHex, tagHex, dataHex] = stored.split(":");
  if (!ivHex || !tagHex || !dataHex)
    throw new Error("Invalid encrypted value format.");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return (
    decipher.update(Buffer.from(dataHex, "hex")).toString("utf8") +
    decipher.final("utf8")
  );
}

// ─── Public operations ───────────────────────────────────────────────────────

export async function getSettings(connOpts?: ConnOpts): Promise<ApiSettings | {}> {
  const doc = await dbFindOne<AppSettings>(COLLECTION, {
    _id: APISETTINGS_DOC_ID,
  } as never, connOpts);
  if (!doc) return {};

  let ai_api_key = "";
  if (doc.apiSettings.ai_api_key) {
    try {
      ai_api_key = decrypt(doc.apiSettings.ai_api_key);
    } catch {
      ai_api_key = "";
    }
  }
  const apiSettings: ApiSettings = { ...doc.apiSettings, ai_api_key };
  return apiSettings;
}

async function validateApiKey(provider: string, apiKey: string, model: string): Promise<void> {
  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    });
    if (!res.ok) {
      throw new Error('Invalid Anthropic API key.');
    }
  } else if (provider === 'gemini') {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-pro-latest'}?key=${apiKey}`
    );
    if (!res.ok) {
      throw new Error('Invalid Gemini API key.');
    }
  } else {
    throw new Error(`Unsupported provider: ${provider}`);
  }
}

export async function saveSettings(params: ApiSettings, connOpts?: ConnOpts): Promise<{ ok: boolean }> {
  const { ai_configured, ai_provider, ai_model, ai_api_key } = params;
  if (ai_api_key) {
    await validateApiKey(ai_provider, ai_api_key, ai_model);
  }

  const now = new Date();
  const record = await dbFindOne<AppSettings>(COLLECTION, { _id: APISETTINGS_DOC_ID } as never, connOpts);
  const apiSettings: ApiSettings = {
    ai_configured: Boolean(ai_configured),
    ai_provider: ai_provider,
    ai_model: ai_model,
    ai_api_key: ai_api_key ? encrypt(ai_api_key) : '',
  };

  const result = await dbUpdateOne<AppSettings>(
    COLLECTION,
    { _id: APISETTINGS_DOC_ID } as never,
    {
      $set: {
        apiSettings,
        ...(record ? { updatedTime: now } : { createdTime: now }),
      },
    },
    { upsert: true },
    connOpts,
  );

  return { ok: result.modifiedCount > 0 || result.upsertedCount > 0 };
}
