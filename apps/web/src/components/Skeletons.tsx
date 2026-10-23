import Skeleton from "@mui/material/Skeleton";
import useMediaQuery from "@mui/material/useMediaQuery";

export function Skeletons({ rows = 4 }: { rows?: number }) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  return (
    <div className="flex flex-col gap-2 p-4" aria-hidden="true">
      {Array.from({ length: rows }, (_unused, index) => (
        <Skeleton
          key={index}
          variant="rounded"
          height="var(--row-height)"
          animation={reduced ? false : "wave"}
        />
      ))}
    </div>
  );
}
