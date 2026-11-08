const IST = "Asia/Kolkata";

export const formatTime = (value) =>
  new Date(value).toLocaleTimeString("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
  });

export const formatDay = (value) =>
  new Date(value).toLocaleDateString("en-IN", {
    timeZone: IST,
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export const formatPrice = (value) => `₹${Number(value).toLocaleString("en-IN")}`;

export const formatDuration = (minutes) =>
  `${Math.floor(minutes / 60)}h ${minutes % 60}m`;