import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/shell";
import { DialogProvider } from "@/components/ui/Dialog";
import { ToastProvider } from "@/components/ui/Toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Akylla Gestão",
  description: "Sistema de gestão para pequenos negócios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen antialiased">
        <a
          href="#conteudo"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow"
        >
          Pular para o conteúdo
        </a>
        <ToastProvider>
          <DialogProvider>
            <AppShell>{children}</AppShell>
          </DialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
