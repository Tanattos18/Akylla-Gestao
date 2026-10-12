import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Akylla Gestão",
  description: "Sistema de gestão para pequenos negócios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <div className="flex items-center gap-2">
              <div>
                <h1 className="text-lg font-semibold text-teal-800">Akylla Gestão</h1>
                <p className="text-xs text-slate-500">Gestão para pequenos negócios</p>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          Akylla Gestão © {new Date().getFullYear()} — módulos de negócio em desenvolvimento
        </footer>
      </body>
    </html>
  );
}
