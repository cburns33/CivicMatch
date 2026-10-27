import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  ListChecks,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CivicMatch TX | Ballot foundation",
    template: "%s | CivicMatch TX",
  },
  description:
    "Explore CivicMatch TX test ballots and official county source intake. Individual ballot verification and candidate comparisons are not available in this preview.",
  icons: { icon: "/icon.svg" },
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <Link href="/" className="brand" aria-label="CivicMatch TX home">
            <span className="brand-mark">
              c<span>m</span>
              <i />
            </span>
            <span>
              CivicMatch<span className="brand-tx">TX</span>
            </span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/">Ballot explorer</Link>
            <Link href="/methodology">Our methodology</Link>
            <Link href="/sources">
              Sources <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </nav>
          <span className="preview-pill">
            <span /> M2 source intake
          </span>
        </header>
        <div className="workspace">
          <aside className="sidebar">
            <div className="sidebar-label">YOUR ELECTION COMPANION</div>
            <Link className="sidebar-link" href="/">
              <ListChecks size={18} aria-hidden="true" /> Ballot explorer
            </Link>
            <Link className="sidebar-link" href="/methodology">
              <BookOpen size={18} aria-hidden="true" /> How comparisons will
              work
            </Link>
            <Link className="sidebar-link" href="/sources">
              <ShieldCheck size={18} aria-hidden="true" /> Sources & corrections
            </Link>
            <div className="sidebar-note">
              <MapPin size={19} aria-hidden="true" />
              <h2>Local starts with location.</h2>
              <p>
                Austin and Houston cross county lines. A city alone cannot tell
                us what’s on your ballot.
              </p>
              <Link href="/sources">
                About ballot verification{" "}
                <ArrowUpRight size={14} aria-hidden="true" />
              </Link>
            </div>
            <div className="sidebar-bottom">
              <span className="tiny-star">✳</span>
              <p>
                Independent information.
                <br />
                Open methodology.
                <br />
                Your perspective.
              </p>
            </div>
          </aside>
          <main id="main">{children}</main>
        </div>
        <footer>
          <span>© 2026 CivicMatch TX</span>
          <span>Nonpartisan by design. Transparent by default.</span>
          <span>Preview · source review pending</span>
        </footer>
      </body>
    </html>
  );
}
