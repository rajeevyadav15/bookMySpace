import { useMemo } from "react";
import { groupSeatsByRow } from "../utils/seats";
import { formatPrice } from "../utils/format";

const STYLES = {
  available: "border-emerald-500/60 text-emerald-300 hover:bg-emerald-500/20",
  premium: "border-amber-500/70 text-amber-300 hover:bg-amber-500/20",
  selected: "border-rose-500 bg-rose-600 text-white",
  mine: "border-sky-500 bg-sky-600 text-white",
  held: "cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500",
  booked: "cursor-not-allowed border-slate-800 bg-slate-800/60 text-slate-600 line-through",
};

const LEGEND = [
  ["available", "Available"],
  ["premium", "Premium"],
  ["selected", "Selected"],
  ["mine", "Your hold"],
  ["held", "Held by others"],
  ["booked", "Sold"],
];

const CLICKABLE = new Set(["available", "premium", "selected"]);

export default function SeatMap({ seats, selectedIds, mineIds, disabled, onToggle }) {
  const rows = useMemo(() => groupSeatsByRow(seats), [seats]);

  function stateOf(seat) {
    if (mineIds.has(seat.id)) return "mine";
    if (selectedIds.includes(seat.id)) return "selected";
    if (seat.status === "available") {
      return seat.seat_type === "premium" ? "premium" : "available";
    }
    return seat.status; // held or booked
  }

  return (
    <div>
      <div className="overflow-x-auto pb-2">
        <div className="mx-auto w-max min-w-full">
          <div className="mx-auto mb-6 h-1.5 w-3/4 rounded-full bg-slate-600" />
          <p className="mb-4 text-center text-xs text-slate-500">Screen this side</p>

          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.row} className="flex items-center justify-center gap-1.5">
                <span className="w-5 text-center text-xs text-slate-500">{row.row}</span>

                {row.seats.map((seat) => {
                  const state = stateOf(seat);
                  const clickable = CLICKABLE.has(state) && !disabled;
                  const label = `${seat.row_label}${seat.seat_number}`;

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      disabled={!clickable}
                      onClick={() => onToggle(seat)}
                      aria-label={`Seat ${label}, ${seat.seat_type}, ${state}`}
                      aria-pressed={state === "selected"}
                      title={`${label} (${seat.seat_type}) ${formatPrice(seat.price)}`}
                      className={`h-9 w-9 rounded-md border text-xs transition ${STYLES[state]}`}
                    >
                      {seat.seat_number}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-slate-400">
        {LEGEND.map(([state, text]) => (
          <span key={state} className="flex items-center gap-1.5">
            <span className={`inline-block h-4 w-4 rounded border ${STYLES[state]}`} />
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}