const STYLES = {
  confirmed: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-slate-700 text-slate-300",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        STYLES[status] || STYLES.cancelled
      }`}
    >
      {status}
    </span>
  );
}