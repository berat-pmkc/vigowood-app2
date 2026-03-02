import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SkeletonCardProps {
  count?: number;
}

export function SkeletonCard({ count = 4 }: SkeletonCardProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          className="animate-fade-in"
          style={{ animationDelay: `${i * 75}ms`, animationFillMode: "backwards" }}
        >
          <CardContent className="flex items-center gap-4 pt-0">
            <Skeleton className="size-11 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-14" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
