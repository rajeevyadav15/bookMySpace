import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link to="/" className="text-xl font-bold text-rose-500">
          BookMySpace
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <span className="hidden text-slate-300 sm:inline">Hi, {user.name}</span>
              <button
                onClick={logout}
                className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="px-3 py-1.5 text-slate-300 hover:text-white">
                Login
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-rose-600 px-3 py-1.5 text-white hover:bg-rose-500"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}