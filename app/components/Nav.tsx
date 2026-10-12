import { NavLink } from "react-router";

const LINKS = [
  { to: "/", label: "home" },
  { to: "/residents", label: "residents" },
  { to: "/past-shows", label: "past shows" },
  { to: "/about", label: "about us" },
];

export function Nav() {
  return (
    <nav id="main-menu">
      {LINKS.map(({ to, label }) => (
        <NavLink key={to} to={to} end className="nav-link" prefetch="intent">
          {label}
        </NavLink>
      ))}
      <a
        href="https://buymeacoffee.com/radiomantis"
        target="_blank"
        rel="noreferrer"
        className="nav-link"
      >
        donate
      </a>
    </nav>
  );
}
