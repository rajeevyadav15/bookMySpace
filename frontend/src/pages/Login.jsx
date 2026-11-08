import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import FormError from "../components/FormError";
import { buttonCls, inputCls } from "../components/styles";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state && location.state.from) || "/";

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(form.email, form.password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Login</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <FormError error={error} />

        <input
          className={inputCls}
          type="email"
          name="email"
          placeholder="Email"
          autoComplete="email"
          value={form.email}
          onChange={onChange}
          required
        />
        <input
          className={inputCls}
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          value={form.password}
          onChange={onChange}
          required
        />

        <button className={`${buttonCls} w-full`} disabled={submitting}>
          {submitting ? "Logging in..." : "Login"}
        </button>
      </form>

      <p className="mt-4 text-sm text-slate-400">
        New here?{" "}
        <Link to="/register" className="text-rose-400 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}