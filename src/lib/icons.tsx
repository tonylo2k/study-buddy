import {
  ArrowRight,
  Building2,
  Calendar,
  CircleCheck,
  CircleHelp,
  Clock,
  Cloud,
  CloudRain,
  CloudSun,
  Copy,
  Diff,
  Droplet,
  Eye,
  Fish,
  Flower,
  Flower2,
  Highlighter,
  House,
  Leaf,
  Moon,
  Mountain,
  Pencil,
  Pizza,
  RectangleVertical,
  Route,
  Ruler,
  Snowflake,
  Sun,
  TreeDeciduous,
  Truck,
  Underline,
  User,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";

/**
 * IconRegistry: the single allowlist of icon_id values.
 * Keep this in sync with the list in prompts/08_visual_explainer.md and
 * prompts/09_visual_flashcards.md. Anything not listed here still renders
 * safely: emoji if the spec supplied one, otherwise a labeled shape.
 */
export const ICON_REGISTRY: Record<string, { Icon: LucideIcon; emoji: string; tint: string }> = {
  sun: { Icon: Sun, emoji: "☀️", tint: "#E0A526" },
  moon: { Icon: Moon, emoji: "🌙", tint: "#6C78A8" },
  cloud: { Icon: Cloud, emoji: "☁️", tint: "#8A97A6" },
  cloud_sun: { Icon: CloudSun, emoji: "🌤️", tint: "#D9A53A" },
  rain: { Icon: CloudRain, emoji: "🌧️", tint: "#4B8DB8" },
  snow: { Icon: Snowflake, emoji: "❄️", tint: "#6BAED0" },
  clock: { Icon: Clock, emoji: "⏰", tint: "#5E6C7B" },
  calendar: { Icon: Calendar, emoji: "📅", tint: "#4F8F80" },
  spring: { Icon: Flower2, emoji: "🌸", tint: "#D98BA4" },
  summer: { Icon: Sun, emoji: "☀️", tint: "#E0A526" },
  fall: { Icon: Leaf, emoji: "🍂", tint: "#C77B3B" },
  winter: { Icon: Snowflake, emoji: "❄️", tint: "#6BAED0" },
  tree: { Icon: TreeDeciduous, emoji: "🌳", tint: "#4E9A63" },
  mountain: { Icon: Mountain, emoji: "⛰️", tint: "#6F8A6B" },
  ocean: { Icon: Waves, emoji: "🌊", tint: "#3F8FBF" },
  fish: { Icon: Fish, emoji: "🐟", tint: "#3F8FBF" },
  truck: { Icon: Truck, emoji: "🚚", tint: "#B9783F" },
  road: { Icon: Route, emoji: "🛣️", tint: "#5E6C7B" },
  house: { Icon: House, emoji: "🏠", tint: "#B9783F" },
  city: { Icon: Building2, emoji: "🏙️", tint: "#5B6FA3" },
  pizza: { Icon: Pizza, emoji: "🍕", tint: "#D98A3A" },
  person: { Icon: User, emoji: "👤", tint: "#5B6FA3" },
  check: { Icon: CircleCheck, emoji: "✅", tint: "#4F8F80" },
  plus_minus: { Icon: Diff, emoji: "➕", tint: "#5B6FA3" },
  ruler: { Icon: Ruler, emoji: "📏", tint: "#C79A2E" },
  pencil: { Icon: Pencil, emoji: "✏️", tint: "#C77B3B" },
  highlight: { Icon: Highlighter, emoji: "🔖", tint: "#D9A53A" },
  eye: { Icon: Eye, emoji: "👀", tint: "#4F8F80" },
  copy: { Icon: Copy, emoji: "🔢", tint: "#5B6FA3" },
  question: { Icon: CircleHelp, emoji: "❓", tint: "#8A97A6" },
  underline: { Icon: Underline, emoji: "➖", tint: "#5E6C7B" },
  arrow: { Icon: ArrowRight, emoji: "➡️", tint: "#4F8F80" },
  bar: { Icon: RectangleVertical, emoji: "▮", tint: "#4F8F80" },
  drop: { Icon: Droplet, emoji: "💧", tint: "#3F8FBF" },
  leaf: { Icon: Leaf, emoji: "🍃", tint: "#4E9A63" },
  flower: { Icon: Flower, emoji: "🌸", tint: "#D98BA4" },
  wind: { Icon: Wind, emoji: "💨", tint: "#8A97A6" },
};

export const ICON_ALLOWLIST = Object.keys(ICON_REGISTRY);

/** HTML-context picture: allowlisted icon, else emoji, else a labeled rounded shape. Never throws. */
export function IconView({
  iconId,
  emoji,
  label,
  size = 40,
  className = "",
}: {
  iconId?: string | null;
  emoji?: string | null;
  label?: string | null;
  size?: number;
  className?: string;
}) {
  const entry = iconId ? ICON_REGISTRY[iconId] : undefined;
  const alt = label || iconId || "picture";
  if (entry) {
    const { Icon, tint } = entry;
    return (
      <Icon
        size={size}
        color={tint}
        strokeWidth={1.75}
        role="img"
        aria-label={alt}
        className={className}
      />
    );
  }
  if (emoji) {
    return (
      <span
        role="img"
        aria-label={alt}
        className={className}
        style={{ fontSize: size * 0.85, lineHeight: 1, display: "inline-block" }}
      >
        {emoji}
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={alt}
      className={`inline-flex items-center justify-center rounded-xl border-2 border-line bg-white px-2 text-center text-xs text-soft ${className}`}
      style={{ minWidth: size, height: size }}
    >
      {(label || "?").slice(0, 14)}
    </span>
  );
}
