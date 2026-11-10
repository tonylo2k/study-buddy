"use client";
import { BookOpen, House, ListChecks, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", Icon: House, match: (p: string) => p === "/" },
  { href: "/practice", label: "Practice", Icon: BookOpen, match: (p: string) => ["/practice", "/pack", "/activity", "/test", "/snap"].some((x) => p.startsWith(x)) },
  { href: "/checklist", label: "Checklist", Icon: ListChecks, match: (p: string) => p.startsWith("/checklist") },
  { href: "/parent", label: "Parent", Icon: Users, match: (p: string) => p.startsWith("/parent") },
];

export default function BottomNav() {
  const path = usePathname() || "/";
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, Icon, match }) => {
          const on = match(path);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-[60px] flex-col items-center justify-center gap-0.5 text-xs font-bold ${on ? "text-sage-dark" : "text-soft"}`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full ${on ? "bg-sage-light" : ""}`}>
                  <Icon size={22} strokeWidth={on ? 2.4 : 1.8} />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
