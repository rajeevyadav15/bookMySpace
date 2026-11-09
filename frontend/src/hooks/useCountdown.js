import { useEffect, useState } from "react";
import { secondsUntil } from "../utils/time";

// Seconds left until expiresAt, updates every second
export default function useCountdown(expiresAt) {
  const [left, setLeft] = useState(() => secondsUntil(expiresAt));

  useEffect(() => {
    setLeft(secondsUntil(expiresAt));
    if (!expiresAt) return undefined;

    const timer = setInterval(() => {
      const value = secondsUntil(expiresAt);
      setLeft(value);
      if (value <= 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [expiresAt]);

  return left;
}