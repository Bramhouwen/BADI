"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { ReactionBar, type ReactionState } from "@/components/app/reaction-bar";
import { useToast } from "@/components/ui/toast";
import { Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { deletePost, setReaction, updateCaption } from "@/app/actions/wall";
import { relativeTimeNl } from "@/lib/dates";

export interface PostCardData {
  id: string;
  imageUrl: string | null;
  caption: string | null;
  created_at: string;
  author: { name: string; avatar: string | null };
  isOwner: boolean;
  reactions: ReactionState;
}

export function PostCard({ post, linkToDetail = true }: { post: PostCardData; linkToDetail?: boolean }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  return (
    <article className="overflow-hidden rounded-[22px] border border-border/70 bg-card">
      <header className="flex items-center gap-3 px-4 py-3">
        <Avatar name={post.author.name} src={post.author.avatar} size="sm" />
        <div className="flex-1 leading-tight">
          <p className="text-sm font-semibold">{post.author.name}</p>
          <p className="text-xs text-muted">{relativeTimeNl(post.created_at)}</p>
        </div>
        {post.isOwner ? (
          <div className="flex gap-1">
            <button type="button" onClick={() => setEditing((e) => !e)} className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-card-2 hover:text-text" aria-label="Bijschrift bewerken">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm("Post verwijderen?")) return;
                start(async () => {
                  const r = await deletePost(post.id);
                  if (r && !r.ok) toast(r.error, "error");
                });
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-card-2 hover:text-danger"
              aria-label="Post verwijderen"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </header>

      {linkToDetail ? (
        <Link href={`/wall/${post.id}`} className="relative block aspect-[4/5] bg-bg-2">
          {post.imageUrl ? <Image src={post.imageUrl} alt={post.caption ?? `Foto van ${post.author.name}`} fill sizes="(max-width: 512px) 100vw, 512px" className="object-cover" unoptimized /> : <div className="skeleton absolute inset-0 rounded-none" />}
        </Link>
      ) : (
        <div className="relative aspect-[4/5] bg-bg-2">
          {post.imageUrl ? <Image src={post.imageUrl} alt={post.caption ?? `Foto van ${post.author.name}`} fill priority sizes="(max-width: 512px) 100vw, 512px" className="object-cover" unoptimized /> : null}
        </div>
      )}

      <div className="space-y-3 px-4 py-3">
        {editing ? (
          <form
            className="space-y-2"
            action={(fd) =>
              start(async () => {
                const r = await updateCaption(post.id, fd);
                if (!r.ok) toast(r.error, "error");
                else {
                  toast("Bijschrift opgeslagen", "success");
                  setEditing(false);
                }
              })
            }
          >
            <Textarea name="caption" defaultValue={post.caption ?? ""} maxLength={500} className="min-h-[64px]" aria-label="Bijschrift" />
            <div className="flex gap-2">
              <Button type="submit" size="sm" loading={pending}>
                Opslaan
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Annuleren
              </Button>
            </div>
          </form>
        ) : post.caption ? (
          <p className="text-[15px] leading-relaxed">{post.caption}</p>
        ) : null}
        <ReactionBar
          state={post.reactions}
          onSet={async (r) => {
            const res = await setReaction(post.id, r);
            if (!res.ok) toast(res.error, "error");
          }}
        />
      </div>
    </article>
  );
}
