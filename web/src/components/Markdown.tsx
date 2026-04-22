"use client";

import { ExternalLinkIcon } from "@/components/ui/Icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function getDomain(href: string | undefined): string {
  if (!href) return "";
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-4 mb-2 text-white">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold mt-4 mb-2 text-white">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-bold mt-3 mb-1 text-white">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-bold mt-2 mb-1 text-white">{children}</h4>
        ),
        p: ({ children }) => <p className="mb-2 text-[#aaa]">{children}</p>,
        ul: ({ children }) => (
          <ul className="list-disc list-inside mb-2 text-[#aaa]">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside mb-2 text-[#aaa]">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="mb-1">{children}</li>,
        strong: ({ children }) => (
          <strong className="font-bold text-white">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ children, className }) => {
          const isInline = !className;
          return isInline ? (
            <code className="bg-[#222] px-1 py-0.5 text-sm text-[#ccc]">
              {children}
            </code>
          ) : (
            <code className="block bg-[#222] p-3 text-sm text-[#ccc] overflow-x-auto mb-2">
              {children}
            </code>
          );
        },
        pre: ({ children }) => <pre className="mb-2">{children}</pre>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#444] pl-4 italic text-[#888] mb-2">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => {
          const domain = getDomain(href);
          return (
            <a
              href={href}
              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300 underline decoration-blue-400/50"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
              <ExternalLinkIcon className="w-3 h-3 inline-block" />
              {domain && (
                <span className="text-xs text-[#666] no-underline">
                  ({domain})
                </span>
              )}
            </a>
          );
        },
        hr: () => <hr className="border-[#333] my-4" />,
        table: ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="w-full border-collapse text-sm">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-[#222]">{children}</thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-[#333]">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="border border-[#333] px-3 py-2 text-left text-white font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-[#333] px-3 py-2 text-[#aaa]">
            {children}
          </td>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
