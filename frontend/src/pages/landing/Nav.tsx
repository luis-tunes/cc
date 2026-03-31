import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { ArrowRight, Menu, X } from "lucide-react";

const NAV_LINKS = [
  { href: "#funcionalidades", label: "Funcionalidades" },
  { href: "#como-funciona", label: "Como funciona" },
  { href: "#precos", label: "Preços" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const { isSignedIn } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const ctaTo = isSignedIn ? "/painel" : "/auth/sign-up";
  const ctaLabel = isSignedIn ? "Ir para o painel" : "Experimentar grátis";

  return (
    <nav
      ref={navRef}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b-2 border-border/30 bg-card/80 backdrop-blur-xl shadow-[0_2px_8px_rgb(0_0_0/0.06)]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border-2 border-primary/20">
            <span className="text-sm font-black text-primary">⛵</span>
          </div>
          <div className="flex items-baseline">
            <span className="text-xl font-black tracking-tight text-foreground">xtim</span>
            <span className="text-xl font-black tracking-tight text-primary">.ai</span>
          </div>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative text-sm font-bold text-muted-foreground transition-colors hover:text-foreground after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-0 after:rounded-full after:bg-primary after:transition-all hover:after:w-full"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {!isSignedIn && (
            <Link
              to="/auth/sign-in"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Entrar
            </Link>
          )}
          <Link
            to={ctaTo}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 sm:px-5 sm:py-2.5"
          >
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden tim-touch-target"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <div
        className={`fixed inset-x-0 top-0 bottom-0 z-40 bg-background/95 backdrop-blur-md transition-all duration-300 md:hidden ${
          open ? "opacity-100 visible" : "opacity-0 invisible pointer-events-none"
        }`}
        style={{ paddingTop: navRef.current?.offsetHeight ?? 56 }}
      >
        <div className="flex flex-col gap-1 px-4 pt-4">
          {NAV_LINKS.map((l, i) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-4 text-base font-medium text-foreground transition-all hover:bg-muted tim-touch-target"
              style={{
                transitionDelay: open ? `${i * 50}ms` : "0ms",
                transform: open ? "translateX(0)" : "translateX(-12px)",
                opacity: open ? 1 : 0,
              }}
            >
              {l.label}
            </a>
          ))}
          <div className="my-3 h-px bg-border" />
          {!isSignedIn && (
            <Link
              to="/auth/sign-in"
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-4 text-base font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground tim-touch-target"
              style={{
                transitionDelay: open ? `${NAV_LINKS.length * 50}ms` : "0ms",
                transform: open ? "translateX(0)" : "translateX(-12px)",
                opacity: open ? 1 : 0,
              }}
            >
              Entrar
            </Link>
          )}
          <Link
            to={ctaTo}
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 tim-touch-target"
            style={{
              transitionDelay: open ? `${(NAV_LINKS.length + 1) * 50}ms` : "0ms",
              transform: open ? "translateX(0)" : "translateX(-12px)",
              opacity: open ? 1 : 0,
            }}
          >
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
