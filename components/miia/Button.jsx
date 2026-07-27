import Link from "next/link";
import styles from "./Button.module.css";

// Single button primitive for the whole Miia site. variant: primary | outline | ghost | onDark
export function Button({ href, variant = "primary", size, className = "", children, ...rest }) {
  const cls = [styles.btn, styles[variant], size === "sm" ? styles.sm : "", className].filter(Boolean).join(" ");
  if (href) {
    const isExternal = /^https?:\/\//.test(href) || href.startsWith("mailto:");
    if (isExternal) {
      return (
        <a href={href} className={cls} target="_blank" rel="noopener noreferrer" {...rest}>
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={cls} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...rest}>
      {children}
    </button>
  );
}

export const PRIMARY_CTA_LABEL = "Be one of the first to try";
