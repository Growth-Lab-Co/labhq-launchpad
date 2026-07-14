"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, MoreVertical } from "lucide-react";
import { useMissionControl } from "@/components/missioncontrol/MissionControlContext";
import { useSearch } from "@/components/missioncontrol/SearchContext";
import { mcFetch } from "@/components/missioncontrol/api";
import { StatusBadge } from "@/components/missioncontrol/StatusBadge";
import { displayStatus, progressColor, initialsFor, relativeTime, ghlLocationUrl } from "@/components/missioncontrol/statusHelpers";
import s from "./clients.module.css";

function RowActionsMenu({ deployment, slug, base }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <div className={s.rowMenu} onClick={(e) => { e.stopPropagation(); setOpen(!open); }} onMouseLeave={() => setOpen(false)}>
      <button className={s.rowMenuButton}>
        <MoreVertical size={14} />
      </button>
      {open && (
        <div className={s.rowMenuDropdown}>
          <button className={s.rowMenuItem} onClick={() => router.push(`${base}/clients/${deployment.id}`)}>
            View details
          </button>
          {deployment.locationId && (
            <a
              className={s.rowMenuItem}
              href={ghlLocationUrl(deployment.locationId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in GoHighLevel
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClientsPage() {
  const { slug, mcKey, tenant, copyToClipboard } = useMissionControl();
  const { searchQuery, setSearchQuery } = useSearch();
  const router = useRouter();
  const base = `/${slug}/missioncontrol`;

  const [deployments, setDeployments] = useState(null);
  const [progressMap, setProgressMap] = useState({});
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  useEffect(() => {
    let cancelled = false;
    mcFetch(`/api/deployments?tenant=${encodeURIComponent(slug)}`, { mcKey })
      .then((data) => {
        if (cancelled) return;
        setDeployments(data.deployments || []);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [slug, mcKey]);

  useEffect(() => {
    if (!deployments || deployments.length === 0) return;
    const ids = deployments.map((d) => d.id).join(",");
    mcFetch(`/api/checklist/progress?tenant=${encodeURIComponent(slug)}&ids=${encodeURIComponent(ids)}`, { mcKey })
      .then((data) => setProgressMap(data.progress || {}))
      .catch(() => {});
  }, [deployments, slug, mcKey]);

  const handleCopyLink = () => {
    copyToClipboard(`${slug}.labhq.co`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      if (sortDir === "asc") setSortDir("desc");
      else {
        setSortCol(null);
        setSortDir("asc");
      }
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const rows = useMemo(() => {
    if (!deployments) return [];
    return deployments.map((d) => ({ deployment: d, status: displayStatus(d) }));
  }, [deployments]);

  const filteredRows = useMemo(() => {
    let result = rows.filter((r) =>
      (r.deployment.businessName || "").toLowerCase().includes(searchQuery.toLowerCase())
    );
    if (sortCol) {
      const rank = { Live: 4, QA: 3, "Setting up": 2, Attention: 1 };
      result = [...result].sort((a, b) => {
        let valA, valB;
        if (sortCol === "status") {
          valA = rank[a.status] ?? 0;
          valB = rank[b.status] ?? 0;
        } else {
          valA = new Date(a.deployment.createdAt).getTime();
          valB = new Date(b.deployment.createdAt).getTime();
        }
        if (valA < valB) return sortDir === "asc" ? -1 : 1;
        if (valA > valB) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [rows, searchQuery, sortCol, sortDir]);

  const stats = useMemo(() => {
    const total = rows.length;
    const live = rows.filter((r) => r.status === "Live").length;
    const setup = rows.filter((r) => r.status === "Setting up" || r.status === "QA").length;
    const attention = rows.filter((r) => r.status === "Attention").length;
    return { total, live, setup, attention };
  }, [rows]);

  const SortIcon = ({ col }) =>
    sortCol === col ? (
      sortDir === "asc" ? <ChevronUp size={12} className={s.sortIcon} /> : <ChevronDown size={12} className={s.sortIcon} />
    ) : (
      <ChevronDown size={12} className={`${s.sortIcon} ${s.sortIconHidden}`} />
    );

  return (
    <>
      <div className={s.header}>
        <div>
          <h1 className={s.title}>Clients</h1>
          <p className={s.subtitle}>Every system you've deployed, tracked to live.</p>
        </div>
        <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className={s.newClientButton}>
          New client
        </a>
      </div>

      <div className={s.statsRow}>
        <div className={s.statBlock} style={{ paddingRight: 20 }}>
          <div className={s.statLabel}>Total clients</div>
          <div className={s.statValue}>{stats.total}</div>
        </div>
        <div className={s.statDivider} />
        <div className={s.statBlock} style={{ padding: "0 20px" }}>
          <div className={s.statLabel}>Live</div>
          <div className={s.statValue}>{stats.live}</div>
        </div>
        <div className={s.statDivider} />
        <div className={s.statBlock} style={{ padding: "0 20px" }}>
          <div className={s.statLabel}>In setup</div>
          <div className={s.statValue}>{stats.setup}</div>
        </div>
        <div className={s.statDivider} />
        <div className={s.statBlock} style={{ paddingLeft: 20 }}>
          <div className={s.statLabel}>Attention</div>
          <div className={s.statValue}>{stats.attention}</div>
        </div>
      </div>

      <div className={s.linkBar}>
        <span className={s.linkBarLabel}>Client onboarding link</span>
        <div className={s.linkBarCode}>{slug}.labhq.co</div>
        <button onClick={handleCopyLink} className={s.linkBarCopy}>
          {copied ? <span className={s.linkBarCopied}>Copied!</span> : "Copy"}
        </button>
      </div>

      {error && <p className={s.errorText}>{error}</p>}

      {deployments === null && !error && <p className={s.muted}>Loading…</p>}

      {deployments && deployments.length === 0 && (
        <div className={s.emptyState}>
          <h3 className={s.emptyTitle}>No clients yet</h3>
          <p className={s.emptySubtitle}>They'll show up here the moment one lands.</p>
        </div>
      )}

      {deployments && deployments.length > 0 && (
        <div className={s.table}>
          <div className={s.tableHeader}>
            <div className={s.colClient}>Client</div>
            <div className={s.colStatus} onClick={() => handleSort("status")}>
              Status <SortIcon col="status" />
            </div>
            <div className={s.colProgress}>Progress</div>
            <div className={s.colDeployed} onClick={() => handleSort("deployedAt")}>
              Deployed <SortIcon col="deployedAt" />
            </div>
            <div className={s.colActions} />
          </div>

          {filteredRows.length > 0 ? (
            filteredRows.map(({ deployment: d, status }) => {
              const progress = progressMap[d.id] ?? 0;
              return (
                <div
                  key={d.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`${base}/clients/${d.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`${base}/clients/${d.id}`);
                    }
                  }}
                  className={s.row}
                >
                  <div className={s.colClient}>
                    <div className={s.avatar}>{initialsFor(d.businessName)}</div>
                    <div className={s.clientText}>
                      <span className={s.clientName}>{d.businessName || "Unnamed business"}</span>
                      {status === "Attention" ? (
                        <span className={s.needsAuthBadge}>Needs authorisation</span>
                      ) : (
                        <span className={s.clientSubline}>{d.contactName || "—"}</span>
                      )}
                    </div>
                  </div>

                  <div className={s.colStatus}>
                    <StatusBadge status={status} />
                  </div>

                  <div className={s.colProgress}>
                    <div className={s.progressTrack}>
                      <div className={s.progressFill} style={{ width: `${progress}%`, background: progressColor(status) }} />
                    </div>
                    <span className={s.progressLabel}>{progress}%</span>
                  </div>

                  <div className={s.colDeployed}>
                    <span className={s.deployedText}>{relativeTime(d.createdAt)}</span>
                  </div>

                  <div className={s.colActions}>
                    <div className={s.rowMenuWrap} onClick={(e) => e.stopPropagation()}>
                      <RowActionsMenu deployment={d} slug={slug} base={base} />
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className={s.emptyState}>
              <h3 className={s.emptyTitle}>No clients match your search</h3>
              <p className={s.emptySubtitle}>Try adjusting your search.</p>
              <button onClick={() => setSearchQuery("")} className={s.clearSearchButton}>
                Clear search
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
