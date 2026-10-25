import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

function NavTab({
  to,
  label,
  exact,
}: {
  to: "/" | "/terminal" | "/lift";
  label: string;
  exact?: boolean;
}) {
  const base =
    "inline-flex min-h-11 items-center justify-center rounded-lg border px-3 text-sm font-semibold";
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact ?? false }}
      className={`${base} border-line bg-surface text-fg`}
      activeProps={{
        className: `${base} border-primary bg-primary text-primary-fg`,
      }}
    >
      {label}
    </Link>
  );
}

export function Shell({
  title,
  lede,
  children,
}: {
  title: string;
  lede: string;
  children: ReactNode;
}) {
  return (
    <div className="app-shell flex min-h-dvh flex-col bg-canvas">
      <header className="app-header sticky top-0 z-20 shrink-0 border-b border-line bg-canvas">
        <div className="header-row mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-baseline gap-3">
            <p className="text-xs font-semibold tracking-widest text-primary uppercase">Mechanics note</p>
            <p className="font-display text-xl leading-tight text-fg">Force Notes</p>
          </div>
          <nav className="grid grid-cols-3 gap-2 sm:flex" aria-label="Simulations">
            <NavTab to="/" label="Friction" exact />
            <NavTab to="/terminal" label="Terminal" />
            <NavTab to="/lift" label="Lift" />
          </nav>
        </div>
      </header>
      <main className="app-main mx-auto flex w-full min-w-0 max-w-6xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <div className="app-intro shrink-0">
          <h1 className="app-title font-display text-3xl leading-tight text-fg sm:text-4xl">{title}</h1>
          <p className="app-lede mt-2 max-w-3xl text-sm leading-6 text-muted sm:text-base">{lede}</p>
        </div>
        <div className="app-body flex min-w-0 flex-col">{children}</div>
      </main>
    </div>
  );
}
