"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import imageCompression from "browser-image-compression";
import { Camera, ChefHat, HandHeart, ImagePlus } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Avatar } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import type { MessageAttachment } from "@/app/actions/chat";
import { ComplimentSheet } from "./compliment-sheet";
import type { ChatMember } from "./squad-chat";

export interface RecipeOption {
  id: string;
  title: string;
  image: string | null;
}
export interface PostOption {
  id: string;
  image: string | null;
  caption: string | null;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function randomName() {
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

interface Props {
  open: boolean;
  onClose: () => void;
  challengeId: string;
  me: string;
  members: Record<string, ChatMember>;
  recipes: RecipeOption[];
  posts: PostOption[];
  /** Called with the attachment to send and, for uploads, a local preview URL. */
  onAttach: (attachment: MessageAttachment, previewUrl?: string) => void;
  onError: (message: string) => void;
}

type Picker = "recipe" | "post" | "compliment";

/** The "+" menu of the chat: upload a photo or PDF, link a recipe or Wall photo, or send a compliment. */
export function ChatAttach({ open, onClose, challengeId, me, members, recipes, posts, onAttach, onError }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [busy, setBusy] = useState(false);
  const [complimentFor, setComplimentFor] = useState<string | null>(null);

  function closeAll() {
    setPicker(null);
    onClose();
  }

  function pickFile() {
    fileInput.current?.click();
  }

  const options = [
    { icon: ChefHat, title: "Recept uit de Kitchen", body: "Deel een recept als kaartje.", onClick: () => setPicker("recipe" as Picker) },
    { icon: Camera, title: "Foto van de Wall", body: "Verwijs naar een foto van de squad.", onClick: () => setPicker("post" as Picker) },
    { icon: HandHeart, title: "Compliment", body: "Privé, met één tik verstuurd.", onClick: () => setPicker("compliment" as Picker) },
  ];

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";
      if (!isImage && !isPdf) throw new Error("Kies een foto of een PDF.");
      if (file.size > MAX_FILE_BYTES) throw new Error("Maximaal 10 MB.");
      const supabase = createClient();
      const base = `${challengeId}/${me}/${Date.now().toString(36)}-${randomName()}`;
      if (isImage) {
        const compressed = await imageCompression(file, { maxSizeMB: 0.9, maxWidthOrHeight: 1600, useWebWorker: true, fileType: "image/jpeg", initialQuality: 0.84 });
        const path = `${base}.jpg`;
        const { error } = await supabase.storage.from("chat").upload(path, compressed, { contentType: "image/jpeg", upsert: false, cacheControl: "3600" });
        if (error) throw error;
        onAttach({ type: "image", path }, URL.createObjectURL(compressed));
      } else {
        const path = `${base}.pdf`;
        const { error } = await supabase.storage.from("chat").upload(path, file, { contentType: "application/pdf", upsert: false, cacheControl: "3600" });
        if (error) throw error;
        onAttach({ type: "file", path, name: file.name.slice(0, 200) }, URL.createObjectURL(file));
      }
      closeAll();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Uploaden mislukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  const others = Object.entries(members).filter(([id]) => id !== me);

  return (
    <>
      <input ref={fileInput} type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />

      <Sheet open={open && picker === null} onClose={onClose} title="Toevoegen">
        <ul className="space-y-2 pb-1">
          <li>
            <button type="button" disabled={busy} onClick={pickFile} className="glass flex w-full items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-4 text-left hover:bg-blush/40 disabled:opacity-60">
              <span className="soft flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                <ImagePlus className="h-5 w-5" strokeWidth={1.6} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium text-text">{busy ? "Uploaden…" : "Foto of bestand"}</span>
                <span className="block text-[11.5px] text-muted">Een foto uit je galerij of camera, of een PDF.</span>
              </span>
            </button>
          </li>
          {options.map((o) => (
            <li key={o.title}>
              <button type="button" disabled={busy} onClick={o.onClick} className="glass flex w-full items-center gap-3 rounded-[18px] py-2.5 pl-2.5 pr-4 text-left hover:bg-blush/40 disabled:opacity-60">
                <span className="soft flex h-11 w-11 shrink-0 items-center justify-center rounded-full">
                  <o.icon className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-medium text-text">{o.title}</span>
                  <span className="block text-[11.5px] text-muted">{o.body}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={open && picker === "recipe"} onClose={() => setPicker(null)} title="Recept kiezen">
        {recipes.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">Nog geen recepten in de Kitchen.</p>
        ) : (
          <ul className="space-y-2 pb-1">
            {recipes.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    onAttach({ type: "recipe", refId: r.id });
                    closeAll();
                  }}
                  className="glass flex w-full items-center gap-3 rounded-[18px] p-2 text-left hover:bg-blush/40"
                >
                  <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[12px] bg-blush">
                    {r.image ? <Image src={r.image} alt="" fill className="object-cover" unoptimized /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-text">{r.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={open && picker === "post"} onClose={() => setPicker(null)} title="Foto van de Wall">
        {posts.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-muted">{"Nog geen foto's op de Wall."}</p>
        ) : (
          <ul className="grid grid-cols-3 gap-2 pb-1">
            {posts.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  aria-label={p.caption ?? "Foto"}
                  onClick={() => {
                    onAttach({ type: "post", refId: p.id });
                    closeAll();
                  }}
                  className="relative block aspect-square w-full overflow-hidden rounded-[14px] bg-blush"
                >
                  {p.image ? <Image src={p.image} alt="" fill className="object-cover" unoptimized /> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet open={open && picker === "compliment" && !complimentFor} onClose={() => setPicker(null)} title="Compliment voor wie?">
        <ul className="space-y-2 pb-1">
          {others.map(([id, m]) => (
            <li key={id}>
              <button type="button" onClick={() => setComplimentFor(id)} className="glass flex w-full items-center gap-3 rounded-[18px] p-2 text-left hover:bg-blush/40">
                <Avatar name={m.name} src={m.avatar} size="md" />
                <span className="text-[14px] font-medium text-text">{m.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {complimentFor ? (
        <ComplimentSheet
          open
          onClose={() => {
            setComplimentFor(null);
            closeAll();
          }}
          receiver={{ id: complimentFor, name: members[complimentFor]?.name ?? "Lid" }}
        />
      ) : null}
    </>
  );
}
