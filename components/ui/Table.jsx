import styles from "./Table.module.css";

export default function Table({ maxHeight, className = "", children }) {
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(" ")} style={maxHeight ? { maxHeight } : undefined}>
      <table className={styles.table}>{children}</table>
    </div>
  );
}

Table.Row = function TableRow({ interactive, className = "", children, ...props }) {
  const cls = [styles.row, interactive && styles.rowInteractive, className].filter(Boolean).join(" ");
  return (
    <tr className={cls} {...props}>
      {children}
    </tr>
  );
};

Table.ExpandRow = function TableExpandRow({ colSpan, children }) {
  return (
    <tr>
      <td className={styles.expandCell} colSpan={colSpan}>
        <div className={styles.expandInner}>{children}</div>
      </td>
    </tr>
  );
};
