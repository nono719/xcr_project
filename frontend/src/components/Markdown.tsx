import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface Props { source: string }

export default function Markdown({ source }: Props) {
  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code(props) {
            const { children, className, ...rest } = props as any;
            const match = /language-(\w+)/.exec(className || '');
            const inline = !match;
            if (inline) {
              return (
                <code className="bg-slate-100 text-rose-600 px-1 rounded text-[0.92em]" {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <SyntaxHighlighter
                style={vscDarkPlus as any}
                language={match[1]}
                PreTag="div"
                customStyle={{ borderRadius: 10, marginTop: 12, marginBottom: 12, fontSize: 13 }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            );
          },
          h1: (p) => <h1 className="text-2xl font-bold mt-6 mb-3 border-b pb-2" {...p} />,
          h2: (p) => <h2 className="text-xl font-semibold mt-6 mb-2 text-slate-800" {...p} />,
          h3: (p) => <h3 className="text-base font-semibold mt-4 mb-2 text-slate-700" {...p} />,
          p:  (p) => <p className="leading-7 my-2 text-slate-700" {...p} />,
          ul: (p) => <ul className="list-disc pl-6 my-2 space-y-1 text-slate-700" {...p} />,
          ol: (p) => <ol className="list-decimal pl-6 my-2 space-y-1 text-slate-700" {...p} />,
          blockquote: (p) => <blockquote className="border-l-4 border-blue-300 bg-blue-50 px-4 py-1 my-3 italic text-slate-700" {...p} />,
          table: (p) => <table className="border-collapse border my-3 text-sm" {...p} />,
          th: (p) => <th className="border bg-slate-50 px-3 py-1 text-left" {...p} />,
          td: (p) => <td className="border px-3 py-1" {...p} />,
          a:  (p) => <a target="_blank" rel="noreferrer" className="text-blue-600 hover:underline" {...p as any} />,
          hr: (p) => <hr className="my-4 border-slate-200" {...p} />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
