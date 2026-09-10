type IconName =
  | "plus"
  | "wrench"
  | "folder"
  | "gear"
  | "sword"
  | "scroll"
  | "send"
  | "chat"
  | "user"
  | "bug"
  | "chart"
  | "package";

export function ClassicIcon({
  name,
  className = "",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <img
      className={`classic-icon ${className}`}
      src={`/warcraft/classic-${name}.webp`}
      alt=""
      draggable={false}
    />
  );
}
