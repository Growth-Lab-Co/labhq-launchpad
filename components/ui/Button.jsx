import styles from "./Button.module.css";

const VARIANTS = ["primary", "secondary", "ghost", "destructive"];
const SIZES = { sm: styles.sm, md: "", lg: styles.lg };

export default function Button({
  variant = "primary",
  size = "md",
  as,
  href,
  type,
  className = "",
  children,
  ...props
}) {
  const cls = [styles.btn, styles[VARIANTS.includes(variant) ? variant : "primary"], SIZES[size], className]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <a href={href} className={cls} {...props}>
        {children}
      </a>
    );
  }

  const Component = as || "button";
  return (
    <Component className={cls} type={Component === "button" ? type || "button" : type} {...props}>
      {children}
    </Component>
  );
}
