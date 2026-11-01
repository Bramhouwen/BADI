import type { GroupWrapped, PersonalWrapped } from "@/lib/wrapped";

/** Draws a 1080x1920 personal recap card on a canvas and returns a PNG blob. */
export async function renderRecapImage({
  name,
  challengeName,
  personal,
  group,
}: {
  name: string;
  challengeName: string;
  personal: PersonalWrapped;
  group: GroupWrapped;
}): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas niet beschikbaar");

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#111F32");
  bg.addColorStop(1, "#08111F");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 300, 50, W / 2, 300, 700);
  glow.addColorStop(0, "rgba(125,211,252,0.22)");
  glow.addColorStop(1, "rgba(125,211,252,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Soft snowflakes.
  ctx.fillStyle = "rgba(240,249,255,0.12)";
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    ctx.arc(rnd() * W, rnd() * H, 2 + rnd() * 5, 0, Math.PI * 2);
    ctx.fill();
  }

  const font = (weight: number, size: number) => `${weight} ${size}px Geist, Inter, -apple-system, system-ui, sans-serif`;
  const spacing = (px: string) => {
    if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = px;
  };
  ctx.textAlign = "center";
  ctx.fillStyle = "#FBBF24";
  ctx.font = font(700, 34);
  spacing("10px");
  ctx.fillText("WINTER ARC WRAPPED", W / 2, 220);
  spacing("0px");

  ctx.fillStyle = "#F0F9FF";
  ctx.font = font(800, 96);
  ctx.fillText(name, W / 2, 360);
  ctx.fillStyle = "#94AFC8";
  ctx.font = font(500, 36);
  ctx.fillText(challengeName, W / 2, 420);

  const card = (y: number, h: number) => {
    ctx.fillStyle = "#172B42";
    roundRect(ctx, 90, y, W - 180, h, 40);
    ctx.fill();
    ctx.strokeStyle = "rgba(125,211,252,0.35)";
    ctx.lineWidth = 3;
    ctx.stroke();
  };

  card(520, 420);
  const stats: [string, string, string][] = [
    [String(personal.totalDays), "dagen", "#F0F9FF"],
    [String(personal.longestStreak), "langste streak", "#FB923C"],
    [String(personal.complimentsReceived), "complimenten", "#FBBF24"],
  ];
  stats.forEach(([v, l, c], i) => {
    const x = 90 + ((W - 180) / 3) * (i + 0.5);
    ctx.fillStyle = c;
    ctx.font = font(800, 120);
    ctx.fillText(v, x, 700);
    ctx.fillStyle = "#94AFC8";
    ctx.font = font(500, 30);
    ctx.fillText(l, x, 760);
  });
  ctx.fillStyle = "#7DD3FC";
  ctx.font = font(600, 34);
  ctx.fillText(
    personal.topActivity ? `Vaakst gekozen: ${personal.topActivity.emoji} ${personal.topActivity.label}` : "Show up for yourself.",
    W / 2,
    870,
  );

  card(1000, 300);
  ctx.fillStyle = "#94AFC8";
  ctx.font = font(600, 28);
  spacing("6px");
  ctx.fillText("SAMEN MET DE SQUAD", W / 2, 1070);
  spacing("0px");
  ctx.fillStyle = "#F0F9FF";
  ctx.font = font(700, 40);
  ctx.fillText(`${group.totalCheckinDays} check-in dagen · ${group.totalPhotos} foto's · ${group.totalRecipes} recepten`, W / 2, 1150);
  ctx.font = font(500, 34);
  ctx.fillStyle = "#94AFC8";
  ctx.fillText(`${group.fullSquadDays} dagen met de hele squad actief`, W / 2, 1215);

  ctx.fillStyle = "#F0F9FF";
  ctx.font = font(800, 64);
  ctx.fillText("WE SHOWED UP.", W / 2, 1480);
  ctx.fillText("WE GREW TOGETHER.", W / 2, 1560);
  ctx.fillStyle = "#7DD3FC";
  ctx.fillText("THIS WAS OUR WINTER ARC.", W / 2, 1640);
  ctx.font = font(500, 80);
  ctx.fillText("❄️", W / 2, 1790);

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("export failed"))), "image/png"));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
