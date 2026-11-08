import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="py-20 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="mt-2 text-slate-400">This page does not exist.</p>
      <Link to="/" className="mt-4 inline-block text-rose-400 hover:underline">
        Go home
      </Link>
    </div>
  );
}