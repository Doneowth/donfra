import "@excalidraw/excalidraw/index.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata = {
  title: "Donfra — British Tactical Elegance",
  description: "Precision. Preparation. Placement.",
  icons: {
    icon: "/donfra.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700&family=Rajdhani:wght@400;500;700&family=IBM+Plex+Mono:wght@400;600&family=Share+Tech+Mono&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="/styles/tokens.css" />
        <link rel="stylesheet" href="/styles/main.css" />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
