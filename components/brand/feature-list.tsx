import type { LucideIcon } from "lucide-react";

export type FeatureListItem = {
  title: string;
  text: string;
  icon?: LucideIcon;
};

export function FeatureList({ items }: { items: FeatureListItem[] }) {
  return (
    <div className="grid border-l border-t border-[var(--line)] sm:grid-cols-2">
      {items.map(({ title, text, icon: Icon }) => (
        <article key={title} className="min-h-56 border-b border-r border-[var(--line)] p-6 sm:p-8">
          {Icon ? <Icon size={22} strokeWidth={1.6} aria-hidden="true" /> : null}
          <h3 className="display mt-10 text-2xl font-bold tracking-[-.03em]">{title}</h3>
          <p className="mt-4 max-w-md text-sm leading-6 text-[var(--muted)]">{text}</p>
        </article>
      ))}
    </div>
  );
}
