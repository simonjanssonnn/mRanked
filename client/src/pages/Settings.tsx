import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/auth";
import { AVATAR_PALETTE, autoColor, autoInitials, loadSettings, saveSettings, type Settings as SettingsT } from "../lib/settings";
import { Avatar } from "../components/Avatar";
import { TitleChip } from "../components/TitleChip";
import { TITLES, TITLE_STYLES, getTitle, isTitleUnlocked } from "../lib/titles";
import { api } from "../lib/api";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2MB hard cap

export function Settings() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const [s, setS] = useState<SettingsT>(loadSettings());
  const [imgError, setImgError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  // Pushes one or more profile fields to the server. Failure surfaces, but we
  // still keep the local change — the user can retry.
  async function syncToServer(body: Partial<Pick<typeof user, "avatarColor" | "avatarInitials" | "avatarImage" | "equippedTitle">>) {
    if (!user) return;
    setSaveStatus("saving");
    try {
      const { user: updated } = await api.saveProfile(body);
      setUser(updated);
      setSaveStatus("idle");
    } catch {
      setSaveStatus("error");
    }
  }

  // Local-only settings (motion, sound, etc.)
  function update<K extends keyof SettingsT>(key: K, value: SettingsT[K]) {
    const next = { ...s, [key]: value };
    setS(next);
    saveSettings(next);
  }

  // Avatar fields persist BOTH locally (instant UI) and on the server
  // (so other players see them).
  function updateAvatarColor(c: string) {
    update("avatarColor", c);
    void syncToServer({ avatarColor: c });
  }
  function updateAvatarInitials(i: string) {
    update("avatarInitials", i);
    void syncToServer({ avatarInitials: i });
  }
  async function updateAvatarImage(dataUrl: string) {
    update("avatarImage", dataUrl);
    await syncToServer({ avatarImage: dataUrl });
  }
  async function equipTitle(titleId: string) {
    if (!user) return;
    if (!isTitleUnlocked(titleId, user.classicPeakElo)) return;
    // Optimistic local; server is the source of truth.
    setUser({ ...user, equippedTitle: titleId });
    await syncToServer({ equippedTitle: titleId });
  }

  async function onPickImage(file: File) {
    setImgError(null);
    if (!file.type.startsWith("image/")) {
      setImgError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImgError("Image too large (max 2MB). Try a smaller picture.");
      return;
    }
    try {
      const dataUrl = await downscaleToDataURL(file, 320);
      await updateAvatarImage(dataUrl);
    } catch {
      setImgError("Could not read that image.");
    }
  }

  const displayedColor = s.avatarColor || user.avatarColor || autoColor(user.username);
  const displayedInitials = s.avatarInitials || user.avatarInitials || autoInitials(user.username);
  const displayedImage = s.avatarImage || user.avatarImage || "";

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between border-b border-cream-200">
        <button className="btn-subtle text-sm" onClick={() => navigate("/", { replace: true })}>← Home</button>
        <div className="font-serif text-xl">Settings</div>
        <span className="w-12 flex justify-end">
          {saveStatus === "saving" && <span className="text-[10px] uppercase tracking-widest text-ink-500">saving…</span>}
          {saveStatus === "error" && <span className="text-[10px] uppercase tracking-widest text-bad">save failed</span>}
        </span>
      </header>

      <main className="max-w-xl mx-auto px-6 py-8 space-y-8">
        {/* Avatar */}
        <section className="card p-6">
          <div className="flex items-center gap-5">
            <Avatar
              username={user.username}
              color={displayedColor}
              initials={displayedInitials}
              imageUrl={displayedImage || undefined}
              size="xl"
              ring
            />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-widest text-ink-600 mb-1">Profile picture</div>
              <div className="font-serif text-2xl flex items-center gap-2 flex-wrap">
                @{user.username}
                <TitleChip titleId={user.equippedTitle} size="sm" />
              </div>
              <div className="text-xs text-ink-600 mt-1">Shown in duels, profile, and leaderboard.</div>
            </div>
          </div>

          <div className="mt-5">
            <div className="label">Custom picture</div>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onPickImage(f);
                  e.target.value = "";
                }}
              />
              <button className="btn-primary text-sm px-4 py-2" onClick={() => fileRef.current?.click()}>
                {displayedImage ? "Replace picture" : "Upload picture"}
              </button>
              {displayedImage && (
                <button className="btn-ghost text-sm px-4 py-2" onClick={() => void updateAvatarImage("")}>
                  Remove
                </button>
              )}
              <span className="text-xs text-ink-600">PNG, JPG, GIF · up to 2MB</span>
            </div>
            {imgError && <div className="text-bad text-xs mt-2">{imgError}</div>}
          </div>

          <div className={`mt-5 ${displayedImage ? "opacity-50 pointer-events-none" : ""}`}>
            <label className="label">Initials (max 2)</label>
            <input
              className="input"
              value={s.avatarInitials}
              maxLength={2}
              placeholder={autoInitials(user.username)}
              onChange={(e) => updateAvatarInitials(e.target.value.toUpperCase())}
            />
          </div>

          <div className={`mt-5 ${displayedImage ? "opacity-50 pointer-events-none" : ""}`}>
            <div className="label">Color</div>
            <div className="flex flex-wrap gap-2">
              {AVATAR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => updateAvatarColor(c)}
                  className={`w-10 h-10 rounded-full transition-transform ${s.avatarColor === c ? "ring-2 ring-clay ring-offset-2 ring-offset-cream-50 scale-110" : "hover:scale-105"}`}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
              <button
                onClick={() => {
                  updateAvatarColor("");
                  updateAvatarInitials("");
                }}
                className="btn-subtle text-xs px-3"
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {/* Titles */}
        <section className="card p-6">
          <div className="flex items-center justify-between mb-1">
            <div className="text-xs uppercase tracking-widest text-ink-600">Title</div>
            <div className="text-[10px] uppercase tracking-widest text-ink-500 tabular-nums">
              Peak {user.classicPeakElo}
            </div>
          </div>
          <div className="text-sm text-ink-700 mb-4">
            Equip a title under your name. Higher tiers unlock as you climb the ladder — and look the part.
          </div>
          <div className="grid grid-cols-1 gap-2">
            {TITLES.map((t) => {
              const unlocked = isTitleUnlocked(t.id, user.classicPeakElo);
              const equipped = user.equippedTitle === t.id;
              const style = TITLE_STYLES[t.tier];
              return (
                <button
                  key={t.id || "none"}
                  disabled={!unlocked}
                  onClick={() => void equipTitle(t.id)}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-colors text-left
                    ${equipped ? "border-clay/60 bg-clay/10" : "border-cream-200 hover:border-cream-300 bg-cream-100/30"}
                    ${unlocked ? "" : "opacity-40 cursor-not-allowed"}`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg ${style.label}`}>{style.icon ?? "·"}</span>
                    <div>
                      <div className={`font-semibold ${style.label}`}>
                        {t.id ? getTitle(t.id)?.label : "No title"}
                      </div>
                      <div className="text-[11px] text-ink-500 uppercase tracking-widest">
                        {t.id ? `Unlocks at ${t.unlockAt} peak ELO` : "Default"}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!unlocked && <span className="text-[10px] uppercase tracking-widest text-ink-500">Locked</span>}
                    {equipped && <span className="chip-clay">Equipped</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Preferences */}
        <section className="card p-6 space-y-5">
          <div className="text-xs uppercase tracking-widest text-ink-600">Preferences</div>

          <Toggle
            label="Reduce motion"
            description="Disable transitions and animations"
            value={s.reducedMotion}
            onChange={(v) => update("reducedMotion", v)}
          />
          <div className="divider" />
          <Toggle
            label="Show accuracy bar"
            description="Display the closeness indicator during duels"
            value={s.showAccuracyBar}
            onChange={(v) => update("showAccuracyBar", v)}
          />
          <div className="divider" />
          <Toggle
            label="Sound"
            description="Beeps for countdown and match-found"
            value={s.sound}
            onChange={(v) => update("sound", v)}
          />

          <div className="divider" />
          <div>
            <div className="label">Language</div>
            <div className="flex gap-2">
              {(["en", "sv"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => update("language", l)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium ${s.language === l ? "bg-clay text-cream-50" : "bg-cream-100 text-ink-700 hover:bg-cream-200"}`}
                >
                  {l === "en" ? "English" : "Svenska"}
                </button>
              ))}
            </div>
            <div className="text-xs text-ink-600 mt-2">Svenska kicks in once Swedish mode ships.</div>
          </div>
        </section>

        {/* Practice */}
        <section className="card p-6">
          <div className="text-xs uppercase tracking-widest text-ink-600 mb-3">Practice difficulty</div>
          <div className="flex flex-wrap gap-2">
            {(["auto", "Initiate", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster"] as const).map((t) => (
              <button
                key={t}
                onClick={() => update("preferredTier", t)}
                className={`px-3 py-1.5 rounded-xl text-sm font-medium ${s.preferredTier === t ? "bg-clay text-cream-50" : "bg-cream-100 text-ink-700 hover:bg-cream-200"}`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="text-xs text-ink-600 mt-2">"Auto" picks based on your current rating.</div>
        </section>
      </main>
    </div>
  );
}

function Toggle({ label, description, value, onChange }: {
  label: string; description: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="font-medium text-ink-950">{label}</div>
        <div className="text-sm text-ink-600">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? "bg-clay" : "bg-cream-300"}`}
        aria-pressed={value}
      >
        <span className={`absolute top-0.5 ${value ? "left-5" : "left-0.5"} w-5 h-5 rounded-full bg-white shadow transition-all`} />
      </button>
    </div>
  );
}

function downscaleToDataURL(file: File, maxDim: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("decode_failed"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no_ctx"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
