import { createHash } from "crypto";

/** SHA-256 hex lowercase — Meta CAPI / Enhanced Conversions. */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const v = email.trim().toLowerCase();
  return v || null;
}

export function normalizePhoneE164Digits(
  phone: string | null | undefined,
): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  // BR: se 10/11 dígitos sem DDI, prefixa 55
  if (digits.length >= 10 && digits.length <= 11 && !digits.startsWith("55")) {
    digits = `55${digits}`;
  }
  return digits;
}

export function toTitleCaseName(full: string | null | undefined): string | null {
  if (!full) return null;
  const cleaned = full.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  return cleaned
    .split(" ")
    .map((part) => {
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
}

export function splitName(full: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
} {
  const titled = toTitleCaseName(full);
  if (!titled) return { firstName: null, lastName: null, fullName: null };
  const parts = titled.split(" ");
  const firstName = parts[0] || null;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { firstName, lastName, fullName: titled };
}

export function hashEmail(email: string | null | undefined): string | null {
  const n = normalizeEmail(email);
  return n ? sha256Hex(n) : null;
}

export function hashPhone(phone: string | null | undefined): string | null {
  const n = normalizePhoneE164Digits(phone);
  return n ? sha256Hex(n) : null;
}

export function hashNamePart(value: string | null | undefined): string | null {
  if (!value) return null;
  const n = value.trim().toLowerCase();
  return n ? sha256Hex(n) : null;
}
