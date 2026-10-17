/** PIN dos pais: 4–6 dígitos (mesmo check do Postgres users_security_pin_format). */
export function isValidSecurityPin(pin: string | null | undefined): boolean {
  return typeof pin === "string" && /^[0-9]{4,6}$/.test(pin);
}

/** Descarta placeholders de cookie ("set", "") e qualquer valor inválido. */
export function normalizeSecurityPin(
  pin: string | null | undefined,
): string | null {
  if (!isValidSecurityPin(pin)) return null;
  return pin!;
}
