import { Lock, User } from 'lucide-react';
import { useState } from 'react';

export default function Login({ onSubmit, isLoading }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ login, password });
  };

  return (
    <main className="app-shell min-h-screen p-4 md:p-8">
      <section className="panel mx-auto mt-16 w-full max-w-md rounded-3xl p-6 md:p-8">
        <h1 className="text-2xl font-extrabold text-slate-900">Tizimga kirish</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">
          Boshqaruv panelidan foydalanish uchun login va parolni kiriting.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <User size={16} />
              Login
            </span>
            <input
              type="text"
              autoComplete="username"
              value={login}
              onChange={(event) => setLogin(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-teal-600"
              placeholder="admin"
              required
              minLength={2}
            />
          </label>

          <label className="block">
            <span className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Lock size={16} />
              Parol
            </span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none transition focus:border-teal-600"
              placeholder="********"
              required
              minLength={4}
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-teal-700 px-4 py-2.5 font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isLoading ? 'Kirilmoqda...' : 'Kirish'}
          </button>
        </form>
      </section>
    </main>
  );
}
