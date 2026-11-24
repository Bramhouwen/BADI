/**
 * Everyone in the squad is in World of Badi from the start: whoever has not
 * been in yet sits asleep on the sofa in the living room (offline, with the
 * moon), on a seat nobody else has. Once they come in themselves, their own
 * place takes over.
 */
import { SCENES } from "./scenes";

export const HOME_SCENE = "huis";

interface Placed {
  scene: string | null;
  x: number | null;
  y: number | null;
  activity?: string | null;
}

/** True for someone who never had a place in the world. */
export function hasNoPlace(p: Placed | null | undefined): boolean {
  return !p || !p.scene || !SCENES[p.scene] || p.x === null || p.y === null;
}

/**
 * Gives everyone without a place a free seat in the living room, in order.
 * `taken` are the seats already in use there (by anyone, you included).
 * More newcomers than seats: the rest stands in front of the sofa.
 */
export function seatNewcomers<T extends Placed>(list: T[], taken: Iterable<string>): T[] {
  const home = SCENES[HOME_SCENE];
  const busy = new Set(taken);
  return list.map((p) => {
    if (!hasNoPlace(p)) return p;
    const seat = home.seats.find((s) => !busy.has(s.id));
    if (seat) {
      busy.add(seat.id);
      return { ...p, scene: HOME_SCENE, x: seat.hip[0], y: seat.hip[1], activity: seat.id };
    }
    const at = home.seats[0]?.approach ?? [home.width / 2, home.height / 2];
    return { ...p, scene: HOME_SCENE, x: at[0], y: at[1], activity: null };
  });
}
