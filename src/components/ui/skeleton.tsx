import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4 px-4 pt-4">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-40 w-full rounded-[20px]" />
      <Skeleton className="h-24 w-full rounded-[20px]" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-44 rounded-[20px]" />
        <Skeleton className="h-44 rounded-[20px]" />
      </div>
    </div>
  );
}
