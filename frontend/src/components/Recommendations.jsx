import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import MovieCard from "./MovieCard";

const CACHE_MS = 5 * 60 * 1000;

export default function Recommendations() {
  const { user } = useAuth();
  const userId = user ? user.id : null;
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!userId) {
      setResult(null);
      return undefined;
    }

    // Client cache: saves the hourly AI rate limit when user reloads often
    const cacheKey = `bms_rec_${userId}`;
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.at < CACHE_MS) {
        setResult(cached.data);
        return undefined;
      }
    } catch (err) {
      // ignore broken cache
    }

    const controller = new AbortController();
    api("/ai/recommendations", { signal: controller.signal })
      .then((data) => {
        setResult(data);
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data }));
        } catch (err) {
          // ignore
        }
      })
      .catch(() => {
        // Recommendations are optional, so errors stay hidden
      });

    return () => controller.abort();
  }, [userId]);

  if (!result || result.items.length === 0) return null;

  return (
    <section className="mb-10">
      <h2 className="mb-4 flex items-center gap-2 text-xl font-bold">
        Recommended for you
        {result.source === "ai" && (
          <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-300">
            AI
          </span>
        )}
      </h2>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {result.items.map((item) => (
          <div key={item.movie.id}>
            <MovieCard movie={item.movie} />
            <p className="mt-1 text-xs text-slate-400">{item.reason}</p>
          </div>
        ))}
      </div>
    </section>
  );
}