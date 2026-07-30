"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MessageSquare,
  CalendarDays,
  Radio,
  CreditCard,
  LifeBuoy,
  Search,
  Bell,
  MoreHorizontal,
  X,
} from "lucide-react";
import { TwoDots } from "./TwoDots";
import styles from "./DashboardShell.module.css";

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, path: (base) => base },
  { label: "Conversations", icon: MessageSquare, path: (base) => `${base}/conversations` },
  { label: "Bookings", icon: CalendarDays, path: (base) => `${base}/bookings` },
  { label: "Channels", icon: Radio, path: (base) => `${base}/channels` },
  { label: "Billing", icon: CreditCard, path: (base) => `${base}/billing` },
  { label: "Help", icon: LifeBuoy, path: (base) => `${base}/help` },
];

// Bottom tab bar covers the four most-visited destinations; Billing and
// Help live one tap away behind "More" - see the mobile-nav decision in
// the mobile-polish morning report for why a bottom bar over a hamburger
// drawer (tradies/clinic owners live in this app day to day; a persistent
// bar reads as an app, a drawer reads as a settings menu).
const PRIMARY_TABS = NAV.slice(0, 4);
const MORE_ITEMS = NAV.slice(4);

function isActive(pathname, itemPath, base) {
  if (itemPath === base) return pathname === base;
  return pathname.startsWith(itemPath);
}

function SidebarNav({ items, base, pathname, onNavigate }) {
  return (
    <>
      <div className={styles.brandRow}>
        <TwoDots size="md" />
        <span className={styles.brandName}>miia</span>
      </div>

      <nav className={styles.nav}>
        {items.map((item) => {
          const itemPath = item.path(base);
          const active = isActive(pathname, itemPath, base);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={itemPath}
              onClick={onNavigate}
              className={[styles.navItem, active ? styles.navItemActive : ""].filter(Boolean).join(" ")}
            >
              <Icon size={18} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className={styles.statusCard}>
        <div className={styles.statusRow}>
          <TwoDots size="sm" pulse />
          <span className={styles.statusTitle}>Miia is live</span>
        </div>
        <p className={styles.statusBody}>Answering 24 hours a day, never misses a call.</p>
      </div>
    </>
  );
}

function BottomTabBar({ base, pathname, moreOpen, onToggleMore }) {
  const moreActive = MORE_ITEMS.some((item) => isActive(pathname, item.path(base), base)) || moreOpen;
  return (
    <nav className={styles.bottomBar} aria-label="Primary">
      {PRIMARY_TABS.map((item) => {
        const itemPath = item.path(base);
        const active = isActive(pathname, itemPath, base);
        const Icon = item.icon;
        return (
          <Link
            key={item.label}
            href={itemPath}
            className={[styles.bottomTab, active ? styles.bottomTabActive : ""].filter(Boolean).join(" ")}
          >
            <Icon size={20} strokeWidth={2} />
            <span>{item.label}</span>
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onToggleMore}
        className={[styles.bottomTab, moreActive ? styles.bottomTabActive : ""].filter(Boolean).join(" ")}
      >
        <MoreHorizontal size={20} strokeWidth={2} />
        <span>More</span>
      </button>
    </nav>
  );
}

export function DashboardShell({ base, tenant, businessName, searchValue, onSearchChange, searchPlaceholder, children }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  // Only real letters count as an initial - a business name like "Miia (by
  // Growth Lab Co)" was producing "M(" (the "(" from the second word),
  // which then rendered off-centre in the fixed-size avatar circle.
  const initials = (businessName || tenant?.name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase())
    .filter((c) => /[A-Z]/.test(c))
    .slice(0, 2)
    .join("");

  return (
    <div className="miia-dashboard">
      <div className={styles.shell}>
        <aside className={styles.sidebarDesktop}>
          <SidebarNav items={NAV} base={base} pathname={pathname} />
        </aside>

        {moreOpen && (
          <div className={styles.mobileOverlay}>
            <div className={styles.mobileScrim} onClick={() => setMoreOpen(false)} aria-hidden="true" />
            <aside className={styles.mobileSidebar}>
              <div className={styles.mobileSidebarHeader}>
                <div className={styles.brandRow} style={{ padding: 0 }}>
                  <TwoDots size="md" />
                  <span className={styles.brandName}>miia</span>
                </div>
                <button onClick={() => setMoreOpen(false)} aria-label="Close menu" className={styles.iconButton}>
                  <X size={18} />
                </button>
              </div>
              <SidebarNav items={MORE_ITEMS} base={base} pathname={pathname} onNavigate={() => setMoreOpen(false)} />
            </aside>
          </div>
        )}

        <div className={styles.main}>
          <header className={styles.topbar}>
            <div className={styles.statusPillMobile}>
              <TwoDots size="sm" pulse />
              <span>Miia is live</span>
            </div>

            <div className={styles.topbarRight}>
              {onSearchChange && (
                <div className={styles.searchWrap}>
                  <Search size={16} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder={searchPlaceholder || "Search"}
                    value={searchValue || ""}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className={styles.searchInput}
                  />
                </div>
              )}
              <button className={styles.bellButton} aria-label="Notifications">
                <Bell size={18} />
                <span className={styles.bellDot} />
              </button>
              <div className={styles.accountChip}>
                <div className={styles.accountAvatar}>{initials || "M"}</div>
                <div className={styles.accountText}>
                  <p className={styles.accountName}>{businessName || tenant?.name}</p>
                  <p className={styles.accountBusiness}>{tenant?.contactName || "Your team"}</p>
                </div>
              </div>
            </div>
          </header>

          <main className={styles.content}>{children}</main>
        </div>

        <BottomTabBar base={base} pathname={pathname} moreOpen={moreOpen} onToggleMore={() => setMoreOpen((v) => !v)} />
      </div>
    </div>
  );
}
