import type { ReactNode } from "react";
import { AlertCircle, CircleDashed } from "lucide-react";
import { Container } from "@/components/ui/container";

export function ProductPage({ children }: { children: ReactNode }) {
  return <Container className="py-10 md:py-14">{children}</Container>;
}

export function ProductGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-5 md:grid-cols-2 xl:grid-cols-3 ${className}`}>{children}</div>;
}

export function DataPanel({ title, description, children, className = "", aside }: { title: string; description?: string; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={`rounded-card border border-[var(--line)] bg-white p-5 md:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="display text-xl font-semibold tracking-[-.02em]">{title}</h2>
          {description && <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function Metric({ label, value = "—", hint }: { label: string; value?: string; hint?: string }) {
  return (
    <div className="min-h-28 rounded-control border border-[var(--line)] bg-[#fbfaf8] p-4">
      <p className="eyebrow text-[var(--muted)]">{label}</p>
      <p className="display mt-4 text-2xl font-semibold tabular">{value}</p>
      {hint && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export function StateNotice({ title, message, tone = "neutral" }: { title: string; message: string; tone?: "neutral" | "warning" }) {
  return (
    <div className={`flex gap-3 rounded-control border p-4 ${tone === "warning" ? "border-[var(--ink)] bg-[var(--sticky-yellow)]/35" : "border-[var(--line)] bg-[#fbfaf8]"}`} role="status">
      {tone === "warning" ? <AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden="true" /> : <CircleDashed className="mt-0.5 shrink-0" size={18} aria-hidden="true" />}
      <div className="min-w-0"><p className="text-sm font-semibold">{title}</p><p className="mt-1 break-words text-sm leading-6 text-[var(--muted)]">{message}</p></div>
    </div>
  );
}

export function DefinitionRows({ rows }: { rows: Array<{ label: string; value?: ReactNode }> }) {
  return (
    <dl className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
      {rows.map((row) => <div key={row.label} className="grid gap-1 py-4 sm:grid-cols-[minmax(140px,0.7fr)_1.3fr] sm:gap-5"><dt className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--muted)]">{row.label}</dt><dd className="text-sm font-semibold tabular">{row.value ?? "—"}</dd></div>)}
    </dl>
  );
}

export function TableEmpty({ columns, title, message }: { columns: string[]; title: string; message: string }) {
  return (
    <div className="overflow-x-auto rounded-control border border-[var(--line)]">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <thead className="bg-[#fbfaf8]"><tr>{columns.map((column) => <th key={column} scope="col" className="border-b border-[var(--line)] px-4 py-3 text-xs font-semibold uppercase tracking-[.1em] text-[var(--muted)]">{column}</th>)}</tr></thead>
        <tbody><tr><td colSpan={columns.length} className="px-6 py-14 text-center"><p className="font-semibold">{title}</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--muted)]">{message}</p></td></tr></tbody>
      </table>
    </div>
  );
}

export function FieldShell({ label, value = "—", hint }: { label: string; value?: string; hint?: string }) {
  return <div><p className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--muted)]">{label}</p><p className="mt-2 min-h-12 rounded-control border border-[var(--line)] bg-[#fbfaf8] px-4 py-3 text-sm font-semibold tabular">{value}</p>{hint && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{hint}</p>}</div>;
}
