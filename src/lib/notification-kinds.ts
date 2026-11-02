export const NOTIFICATION_KINDS = ["chat", "mentions", "recipes", "jokers", "compliments"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_LABELS: Record<NotificationKind, { label: string; hint: string }> = {
  chat: { label: "Squadchat", hint: "Nieuwe berichten in de groep" },
  mentions: { label: "Als iemand je tagt", hint: "Een @-vermelding in de chat" },
  recipes: { label: "Nieuwe recepten", hint: "Een recept in de Kitchen, ook van Baddy" },
  jokers: { label: "Jokers", hint: "Als iemand een joker inzet" },
  compliments: { label: "Complimenten", hint: "Een compliment voor jou" },
};

export type NotificationSettings = Record<NotificationKind, boolean>;

export function settingsFromRow(row: Record<string, unknown> | null | undefined): NotificationSettings {
  return Object.fromEntries(NOTIFICATION_KINDS.map((k) => [k, typeof row?.[k] === "boolean" ? (row[k] as boolean) : true])) as NotificationSettings;
}
