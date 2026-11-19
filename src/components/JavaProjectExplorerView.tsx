import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Copy, Download, FileCode2 } from 'lucide-react';
import type { AppView } from '../types/cinebook';
import { api } from '../lib/api';

interface JavaProjectExplorerViewProps {
  onNavigate: (view: AppView) => void;
}

export function JavaProjectExplorerView({ onNavigate }: JavaProjectExplorerViewProps) {
  const [files, setFiles] = useState<Array<{ path: string; isBinary: boolean; size: number }>>([]);
  const [selectedPath, setSelectedPath] = useState<string>('README.md');
  const [content, setContent] = useState<string>('');
  const [loadingFile, setLoadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    setError(null);
    api
      .getJavaProjectFiles()
      .then((res) => {
        if (!active) return;
        setFiles(res.files);
        const defaultFile = res.files.find((f) => f.path === 'README.md') || res.files[0];
        if (defaultFile) setSelectedPath(defaultFile.path);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Unable to load Java project file list.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedPath) return;
    let active = true;
    setLoadingFile(true);
    setError(null);
    api
      .getJavaProjectFile(selectedPath)
      .then((res) => {
        if (active) setContent(res.content);
      })
      .catch((err) => {
        if (active) {
          setContent('');
          setError(err instanceof Error ? err.message : `Unable to load ${selectedPath}.`);
        }
      })
      .finally(() => {
        if (active) setLoadingFile(false);
      });
    return () => {
      active = false;
    };
  }, [selectedPath]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const ta = document.createElement('textarea');
        ta.value = content;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Clipboard access is blocked in this browser context.');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={() => onNavigate({ name: 'home' })}
        className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to CineBook
      </button>

      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            Java Spring Boot + MySQL Source Project
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Complete Maven project with Java 17, Spring Boot 3.3, Spring MVC, Spring Data JPA, Spring Security (BCrypt), Thymeleaf, Bootstrap 5, ZXing QR Generator, and MySQL 8 schema.
          </p>
        </div>

        <a
          href="/api/java-project/download"
          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 dark:hover:bg-rose-500 transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Download className="h-4 w-4" />
          Download Maven ZIP ({files.length} files)
        </a>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/35 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* File Tree */}
        <aside className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-4 max-h-[680px] overflow-y-auto shadow-xs dark:border-white/[0.08] dark:bg-[#101522] dark:shadow-none">
          <div className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
            cinebook-java/ ({files.length} files)
          </div>
          <div className="space-y-1">
            {files.map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => setSelectedPath(f.path)}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left font-mono text-xs transition-colors cursor-pointer ${
                  selectedPath === f.path
                    ? 'bg-rose-50 text-rose-800 border border-rose-300 dark:bg-rose-600/20 dark:text-white dark:border-rose-500/40'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/[0.04]'
                }`}
              >
                <FileCode2 className="h-3.5 w-3.5 shrink-0 text-rose-600 dark:text-rose-400" />
                <span className="truncate">{f.path}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* File Viewer */}
        <section className="lg:col-span-8 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex flex-col max-h-[680px] shadow-xs dark:border-white/[0.08] dark:bg-[#0B0F19] dark:shadow-none">
          <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 dark:border-white/[0.08] dark:bg-[#101522]">
            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
              cinebook-java/{selectedPath}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-slate-400 dark:border-white/15 dark:text-slate-200 dark:hover:border-white/30 cursor-pointer shrink-0"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? 'Copied' : 'Copy Code'}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {loadingFile ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">Loading source file...</div>
            ) : (
              <pre className="font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200 whitespace-pre">
                <code>{content}</code>
              </pre>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
