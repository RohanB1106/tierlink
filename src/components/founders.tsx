export const FOUNDERS = [
  { name: "Rohan Bhatia", initials: "RB", linkedin: "https://www.linkedin.com/in/bhatia-rohan/" },
  { name: "Aarav Mathur", initials: "AM", linkedin: "https://www.linkedin.com/in/aaravmat/" },
];

export function Founders({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`flex flex-wrap gap-4 ${compact ? "" : "justify-center"}`}>
      {FOUNDERS.map((f) => (
        <li key={f.name}>
          <a
            href={f.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left hover:border-violet-400 dark:border-neutral-800 dark:bg-neutral-950"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-violet-100 text-sm font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
              {f.initials}
            </span>
            <span>
              <span className="block font-medium">{f.name}</span>
              <span className="block text-xs text-neutral-500">Co-founder · LinkedIn ↗</span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
