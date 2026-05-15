import { useEffect, useState } from "react";
import { autoColor, autoInitials, loadSettings } from "../lib/settings";
import type { PublicProfile } from "../lib/types";
import { useAuth } from "../store/auth";

type Size = "sm" | "md" | "lg" | "xl" | "2xl";
const SIZES: Record<Size, string> = {
  sm: "w-7 h-7 text-[10px]",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
  xl: "w-24 h-24 text-3xl",
  "2xl": "w-28 h-28 text-4xl",
};

export function Avatar({
  username,
  profile,
  color,
  initials,
  imageUrl,
  size = "md",
  ring = false,
  self = false,
}: {
  username?: string;
  /** Public profile fields fetched from the server (other users). */
  profile?: Partial<PublicProfile>;
  color?: string;
  initials?: string;
  imageUrl?: string;
  size?: Size;
  ring?: boolean;
  /** When true, this avatar represents the logged-in user — pull from local settings (including uploaded image). */
  self?: boolean;
}) {
  // For `self` avatars, the logged-in user from the auth store is the
  // server-authoritative fallback: a fresh browser / private tab has empty
  // localStorage but the user object still carries the avatar fields the
  // server returned at login.
  const authUser = useAuth((s) => s.user);
  const selfProfile = self ? authUser : null;
  const name = profile?.username ?? username ?? selfProfile?.username ?? "?";

  // Re-render when local settings change (the logged-in user just picked a new
  // color / uploaded a picture). Only attached for `self` avatars.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!self) return;
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener("mr:settings", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("mr:settings", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [self]);

  const local = self ? loadSettings() : null;
  // Resolution order:
  //   explicit prop  >  local settings (self only)  >  server profile (passed in)
  //   >  server user (auth store, self only)  >  auto-generated from name.
  const finalImage =
    imageUrl ??
    (local?.avatarImage || profile?.avatarImage || selfProfile?.avatarImage || "");
  const finalColor =
    color ??
    (local?.avatarColor || profile?.avatarColor || selfProfile?.avatarColor || autoColor(name));
  const finalInitials =
    initials ??
    (local?.avatarInitials || profile?.avatarInitials || selfProfile?.avatarInitials || autoInitials(name));

  const ringClass = ring
    ? "ring-2 ring-clay/60 ring-offset-2 ring-offset-cream-50 shadow-[0_0_24px_-6px_rgba(34,211,238,0.55)]"
    : "";

  return (
    <div
      className={`${SIZES[size]} relative rounded-full overflow-hidden flex items-center justify-center font-bold text-white select-none ${ringClass}`}
      style={{ background: finalImage ? "transparent" : finalColor }}
      title={`@${name}`}
    >
      {finalImage ? (
        <img src={finalImage} alt={`@${name}`} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <span className="relative z-10 drop-shadow-sm">{finalInitials}</span>
      )}
    </div>
  );
}
