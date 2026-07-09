"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Users, Activity, LayoutTemplate, Palette, Settings, Search, Bell, ChevronDown, Menu, X } from "lucide-react";
import { useSearch } from "./SearchContext";
import { useMissionControl } from "./MissionControlContext";
import s from "./AppShell.module.css";

function navItems(base) {
  return [
    { label: "Clients", path: base, icon: Users },
    { label: "Activity", path: `${base}/activity`, icon: Activity },
    { label: "Templates", path: `${base}/templates`, icon: LayoutTemplate },
    { label: "Branding", path: `${base}/branding`, icon: Palette },
    { label: "Settings", path: `${base}/settings`, icon: Settings },
  ];
}

function isItemActive(pathname, item, base) {
  if (item.path === base) return pathname === base || pathname.startsWith(`${base}/clients/`);
  return pathname.startsWith(item.path);
}

function SidebarContents({ base, pathname, tenant, onNavigate }) {
  const initials = (tenant?.name || "?").trim().charAt(0).toUpperCase();
  return (
    <>
      <div className={s.brandRow}>
        <div className={s.brandMark} />
        <span className={s.brandName}>Lab HQ</span>
      </div>

      <nav className={s.nav}>
        {navItems(base).map((item) => {
          const active = isItemActive(pathname, item, base);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              onClick={onNavigate}
              className={`${s.navItem} ${active ? s.navItemActive : ""}`}
            >
              <Icon size={15} strokeWidth={active ? 2.5 : 2} className={s.navIcon} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={s.tenantSwitcher}>
        <div className={s.tenantSwitcherLeft}>
          <div className={s.tenantAvatar}>{initials}</div>
          <span className={s.tenantName}>{tenant?.name}</span>
        </div>
        <ChevronDown size={13} className={s.tenantChevron} />
      </div>
    </>
  );
}

export function AppShell({ base, tenant, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { searchQuery, setSearchQuery } = useSearch();
  const { unreadCount } = useMissionControl();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const initials = (tenant?.name || "?")
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <div className={s.shell}>
      <aside className={s.sidebarDesktop}>
        <SidebarContents base={base} pathname={pathname} tenant={tenant} />
      </aside>

      {mobileNavOpen && (
        <div className={s.mobileOverlay}>
          <div className={s.mobileScrim} onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
          <aside className={s.mobileSidebar}>
            <div className={s.mobileSidebarHeader}>
              <div className={s.brandRow} style={{ padding: 0 }}>
                <div className={s.brandMark} />
                <span className={s.brandName}>Lab HQ</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" className={s.iconButton}>
                <X size={16} />
              </button>
            </div>
            <SidebarContents base={base} pathname={pathname} tenant={tenant} onNavigate={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      <div className={s.main}>
        <header className={s.topbar}>
          <button onClick={() => setMobileNavOpen(true)} aria-label="Open navigation" className={`${s.iconButton} ${s.mobileOnly}`}>
            <Menu size={18} />
          </button>

          <div className={s.breadcrumb} id="mc-breadcrumb-portal" />

          <div className={s.topbarRight}>
            <div className={s.searchWrap}>
              <Search size={13} className={s.searchIcon} />
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={s.searchInput}
              />
            </div>

            <button
              onClick={() => router.push(`${base}/activity`)}
              aria-label="Activity notifications"
              className={s.bellButton}
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className={s.bellBadge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </button>

            <div aria-label="Your account" className={s.avatar}>
              {initials || "MC"}
            </div>
          </div>
        </header>

        <main className={s.content}>
          <div className={s.contentInner}>{children}</div>
        </main>
      </div>
    </div>
  );
}
