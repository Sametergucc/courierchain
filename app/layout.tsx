import type { Metadata, Viewport } from "next";
import "./globals.css";
import WalletContextProvider from "@/components/WalletProvider";
import { JobProvider } from "@/lib/JobContext";
import { ThemeProvider } from "@/lib/ThemeContext";
import { LangProvider } from "@/lib/LangContext";
import { AuthProvider } from "@/lib/AuthContext";

export const metadata: Metadata = {
  title: "CourierChain — Decentralized Courier Platform on Solana",
  description: "Hire blockchain-verified couriers on Solana.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0a0a12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body style={{ margin: 0 }}>
        <ThemeProvider>
          <LangProvider>
            <WalletContextProvider>
              <AuthProvider>
                <JobProvider>
                  {children}
                </JobProvider>
              </AuthProvider>
            </WalletContextProvider>
          </LangProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
