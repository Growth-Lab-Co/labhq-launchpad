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
  Menu,
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

function isActive(pathname, itemPath, base) {
  if (itemPath === base) return pathname === base;
  return pathname.startsWith(itemPath);
}

function SidebarNav({ base, pathname, onNavigate }) {
  return (
    <>
      <div className={styles.brandRow}>
        <TwoDots size="md" />
        <span className={styles.brandName}>miia</span>
      </div>

      <nav className={styles.nav}>
        {NAV.map((item) => {
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

export function DashboardShell({ base, tenant, businessName, searchValue, onSearchChange, searchPlaceholder, children }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const initials = (businessName || tenant?.name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <div className="miia-dashboard">
      <div className={styles.shell}>
        <aside className={styles.sidebarDesktop}>
          <SidebarNav base={base} pathname={pathname} />
        </aside>

        {mobileNavOpen && (
          <div className={styles.mobileOverlay}>
            <div className={styles.mobileScrim} onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
            <aside className={styles.mobileSidebar}>
              <div className={styles.mobileSidebarHeader}>
                <div className={styles.brandRow} style={{ padding: 0 }}>
                  <TwoDots size="md" />
                  <span className={styles.brandName}>miia</span>
                </div>
                <button onClick={() => setMobileNavOpen(false)} aria-label="Close navigation" className={styles.iconButton}>
                  <X size={18} />
                </button>
              </div>
              <SidebarNav base={base} pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
            </aside>
          </div>
        )}

        <div className={styles.main}>
          <header className={styles.topbar}>
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className={[styles.iconButton, styles.mobileOnly].join(" ")}
            >
              <Menu size={20} />
            </button>

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
                  <p className={styles.accountName}>{tenant?.contactName || "Your team"}</p>
                  <p className={styles.accountBusiness}>{businessName || tenant?.name}</p>
                </div>
              </div>
            </div>
          </header>

          <main className={styles.content}>{children}</main>
        </div>
      </div>
    </div>
  );
}
