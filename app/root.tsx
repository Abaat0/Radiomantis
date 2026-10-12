import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

import type { Route } from "./+types/root";
import { ChatDrawer } from "./components/ChatDrawer";
import { Nav } from "./components/Nav";
import { RadioProvider } from "./context/RadioContext";
import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/pictures/logofinal.avif", type: "image/avif" },
  { rel: "apple-touch-icon", href: "/pictures/app-icon.png" },
  { rel: "manifest", href: "/manifest.json" },
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Castoro&family=Fraunces:ital,opsz,wght@0,9..144,100..900;1,9..144,100..900&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-leaf">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="theme-color" content="transparent" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <Meta />
        <Links />
      </head>
      <body className="bg-leaf">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <RadioProvider>
      <img src="/pictures/plant-background.webp" id="plant" alt="" aria-hidden="true" />
      <div id="app-frame">
        <Outlet />
        <Nav />
      </div>
      <ChatDrawer />
    </RadioProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <div id="app-frame">
      <main id="home-view">
        <section id="info-box" className="subpage-box">
          <h2>{message}</h2>
          <p>{details}</p>
          {stack && (
            <pre className="w-full overflow-x-auto p-4">
              <code>{stack}</code>
            </pre>
          )}
        </section>
      </main>
      <Nav />
    </div>
  );
}
