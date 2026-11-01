/** Maps database and auth error codes to friendly Dutch messages. */
export function friendlyError(error: unknown): string {
  const message = typeof error === "string" ? error : error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "");
  const table: Record<string, string> = {
    MEMBER_LIMIT_REACHED: "De groep zit vol: Winter Arc is voor precies vier vrienden.",
    ALREADY_MEMBER: "Je zit al in een Winter Arc groep.",
    NOT_ADMIN: "Alleen de beheerder kan uitnodigen.",
    NOT_A_MEMBER: "Je bent geen lid van deze groep.",
    NOT_AUTHENTICATED: "Je bent niet ingelogd.",
    INVITE_INVALID: "Deze uitnodiging bestaat niet.",
    INVITE_USED: "Deze uitnodiging is al gebruikt.",
    INVITE_EXPIRED: "Deze uitnodiging is verlopen. Vraag een nieuwe link.",
    INVITE_EMAIL_MISMATCH: "Deze uitnodiging hoort bij een ander e-mailadres.",
    CHECKIN_OUTSIDE_CHALLENGE: "Deze datum valt buiten de Winter Arc periode.",
    CHECKIN_OUTSIDE_WINDOW: "Je kunt alleen vandaag of gisteren inchecken.",
    CHECKIN_DATE_IMMUTABLE: "De datum van een check-in kun je niet wijzigen.",
    COMPLIMENT_TOO_FAST: "Rustig aan, wacht even voor je nog een compliment stuurt.",
    COMPLIMENT_RATE_LIMIT: "Je hebt dit uur al veel complimenten gestuurd. Probeer het straks weer.",
    ALCOHOL_EXCEPTION_LIMIT: "Je kunt maximaal twee uitzonderingsmomenten vastleggen.",
  };
  for (const key of Object.keys(table)) {
    if (message.includes(key)) return table[key];
  }
  if (message.includes("duplicate key")) return "Dit bestaat al.";
  if (message.includes("row-level security")) return "Je hebt hier geen toegang toe.";
  if (message.includes("Invalid login credentials")) return "Onjuist e-mailadres of wachtwoord.";
  if (message.includes("Email not confirmed")) return "Bevestig eerst je e-mailadres via de mail die je hebt ontvangen.";
  if (message.includes("Password should be")) return "Kies een wachtwoord van minimaal 8 tekens.";
  if (message.includes("rate limit")) return "Even geduld, probeer het zo opnieuw.";
  return message || "Er ging iets mis. Probeer het opnieuw.";
}
