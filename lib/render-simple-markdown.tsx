import type { ReactNode } from "react";

function formatInline(t: string): ReactNode {
  const parts = t.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return t;
  return parts.map((part, idx) =>
    idx % 2 === 1 ? (
      <strong key={idx} className="font-semibold text-[var(--foreground)]">
        {part}
      </strong>
    ) : (
      part
    )
  );
}

/**
 * Markdown mínimo para documentação interna: # / ## / ###, listas -, ---, parágrafos, **bold**.
 */
export function renderSimpleMarkdown(md: string): ReactNode {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let key = 0;
  let i = 0;
  let para: string[] = [];

  const flushPara = () => {
    if (para.length === 0) return;
    const text = para.join(" ").trim();
    if (text) {
      out.push(
        <p
          key={key++}
          className="mb-4 text-[var(--muted)] leading-relaxed text-base"
        >
          {formatInline(text)}
        </p>
      );
    }
    para = [];
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.replace(/\r$/, "");

    if (line.trim() === "") {
      flushPara();
      i++;
      continue;
    }

    if (line.trim() === "---") {
      flushPara();
      out.push(<hr key={key++} className="my-10 border-[var(--border)]" />);
      i++;
      continue;
    }

    if (line.startsWith("# ")) {
      flushPara();
      out.push(
        <h1
          key={key++}
          className="editorial-serif text-3xl sm:text-4xl text-[var(--foreground)] leading-tight mt-12 mb-4 first:mt-0"
        >
          {line.slice(2).trim()}
        </h1>
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      flushPara();
      out.push(
        <h2
          key={key++}
          className="text-xl sm:text-2xl font-bold text-[var(--foreground)] mt-10 mb-3"
        >
          {line.slice(3).trim()}
        </h2>
      );
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      flushPara();
      out.push(
        <h3
          key={key++}
          className="text-lg font-semibold text-[var(--foreground)] mt-8 mb-2"
        >
          {line.slice(4).trim()}
        </h3>
      );
      i++;
      continue;
    }

    if (line.startsWith("- ")) {
      flushPara();
      const items: string[] = [];
      while (i < lines.length && lines[i].replace(/\r$/, "").startsWith("- ")) {
        items.push(lines[i].replace(/\r$/, "").slice(2).trim());
        i++;
      }
      out.push(
        <ul
          key={key++}
          className="mb-6 list-disc space-y-2 pl-6 text-[var(--muted)] marker:text-[var(--accent)]"
        >
          {items.map((it, liIdx) => (
            <li key={`${liIdx}-${it.slice(0, 48)}`} className="leading-relaxed">
              {formatInline(it)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.includes("|") && line.trim().startsWith("|")) {
      flushPara();
      const tableLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].replace(/\r$/, "").trim().startsWith("|")
      ) {
        tableLines.push(lines[i].replace(/\r$/, ""));
        i++;
      }
      out.push(
        <pre
          key={key++}
          className="mb-6 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-xs font-mono text-[var(--foreground)]"
        >
          {tableLines.join("\n")}
        </pre>
      );
      continue;
    }

    para.push(line.trim());
    i++;
  }

  flushPara();
  return <>{out}</>;
}
