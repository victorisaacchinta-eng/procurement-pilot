import { NavBar, GlobalStyles } from "../lib/ui";

export const metadata = {
  title: "Procurement Co-Pilot",
  description: "Reasoning view and dashboard for the procurement co-pilot demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          margin: 0,
          background: "#FAF8F4",
          minHeight: "100vh",
        }}
      >
        <GlobalStyles />
        <NavBar />
        {children}
      </body>
    </html>
  );
}
