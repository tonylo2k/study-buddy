"use client";
import { BookOpen, Camera, House, ListChecks, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const TABS: { href: string; label: string; Icon: LucideIcon; match: (p: string) => boolean }[] = [
  { href: "/", label: "Today", Icon: House, match: (p) => p === "/" },
  { href: "/practice", label: "Lessons", Icon: BookOpen, match: (p) => ["/practice", "/pack", "/activity", "/test", "/snap"].some((x) => p.startsWith(x)) },
  { href: "/checklist", label: "Checklist", Icon: ListChecks, match: (p) => p.startsWith("/checklist") },
  { href: "/parent", label: "Parent", Icon: Users, match: (p) => p.startsWith("/parent") },
];

function Mark({ size = 36 }: { size?: number }) {
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center bg-sage" style={{ width: size, height: size, borderRadius: size / 3 }}>
      <span className="block rounded-[3px]" style={{ width: size * 0.56, height: size * 0.25, background: "linear-gradient(90deg, #F2C66D 0 38%, #FFFFFF 38% 100%)" }} />
    </span>
  );
}

/**
 * One app, three shapes:
 *   phone            → floating tab bar at the bottom (hidden inside an activity, so the picture gets the screen)
 *   tablet, upright  → slim icon rail on the left
 *   tablet, sideways → full side menu; it shrinks to the rail inside an activity
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const immersive = path.startsWith("/activity") || path.startsWith("/test");
  const wide = path === "/" || path.startsWith("/activity");
  const full = !immersive; // full side menu allowed (only applies at lg and up)

  return (
    <>
      {/* Side navigation: tablets and wider */}
      <nav
        aria-label="Main"
        className={`fixed inset-y-0 left-0 z-20 hidden flex-col border-r border-line bg-white md:flex ${full ? "w-[84px] items-center px-3.5 lg:w-[224px] lg:items-stretch lg:px-4" : "w-[84px] items-center px-3.5"} pb-6 pt-8`}
      >
        <Link href="/" className={`mb-7 flex items-center gap-2.5 ${full ? "lg:px-2" : ""}`} aria-label="Study Buddy home">
          <Mark size={38} />
          <span className={`text-xl font-black text-ink ${full ? "hidden lg:inline" : "hidden"}`}>Study Buddy</span>
        </Link>
        <ul className="flex flex-col gap-1.5">
          {TABS.map(({ href, label, Icon, match }) => {
            const on = match(path);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  aria-label={label}
                  className={`flex h-[52px] items-center gap-3 rounded-2xl text-[17px] font-extrabold ${on ? "bg-sage-light text-sage-dark" : "text-soft"} ${
                    full ? "w-14 justify-center lg:w-auto lg:justify-start lg:px-3.5" : "w-14 justify-center"
                  }`}
                >
                  <Icon size={24} strokeWidth={on ? 2.3 : 2} />
                  <span className={full ? "hidden lg:inline" : "hidden"}>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/snap"
          aria-label="Snap a lesson"
          className={`mt-auto flex h-14 items-center justify-center gap-2.5 rounded-[18px] border-2 border-line bg-cream text-base font-extrabold text-ink ${full ? "w-14 lg:w-auto" : "w-14"}`}
        >
          <Camera size={22} />
          <span className={full ? "hidden lg:inline" : "hidden"}>Snap a lesson</span>
        </Link>
      </nav>

      <main className={`min-h-screen ${full ? "md:pl-[84px] lg:pl-[224px]" : "md:pl-[84px]"}`}>
        <div className={`mx-auto px-5 pt-6 md:px-8 md:pb-8 md:pt-8 ${wide ? "max-w-[1140px]" : "max-w-2xl"} ${immersive ? "pb-8" : "pb-32"}`}>{children}</div>
      </main>

      {/* Bottom tab bar: phones only */}
      {!immersive && (
        <nav aria-label="Main" className="fixed inset-x-3 bottom-[max(0.875rem,env(safe-area-inset-bottom))] z-20 rounded-[26px] border border-line bg-white px-1.5 shadow-float md:hidden">
          <ul className="flex h-[68px] items-center">
            {TABS.map(({ href, label, Icon, match }) => {
              const on = match(path);
              return (
                <li key={href} className="flex-1">
                  <Link
                    href={href}
                    aria-current={on ? "page" : undefined}
                    className={`flex h-14 flex-col items-center justify-center gap-0.5 rounded-[20px] text-xs font-extrabold ${on ? "bg-sage-light text-sage-dark" : "text-soft"}`}
                  >
                    <Icon size={24} strokeWidth={on ? 2.3 : 2} />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
