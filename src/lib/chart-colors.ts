/**
 * Dashboard chart colours, validated for colour vision deficiency on the card
 * surface (#fdf8f4): green, blue and orange; green and orange are never
 * neighbours, and every chart also has labels or a legend.
 */
export const CHART = {
  green: "#5e9a4c",
  blue: "#3f7fb5",
  orange: "#c4622d",
  grid: "rgba(95,53,41,0.10)",
  track: "rgba(95,53,41,0.08)",
} as const;
