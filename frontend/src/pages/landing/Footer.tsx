import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import { Mail, Shield, Lock } from "lucide-react";

export function Footer() {
  const { isSignedIn } = useAuth();

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand column */}
          <div className="sm:col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary shadow-sm shadow-primary/20">
                <span className="text-xs font-extrabold text-primary-foreground">X</span>
              </div>
              <span className="text-lg font-extrabold tracking-tight text-foreground">xtim<span className="text-primary">.ai</span></span>
            </Link>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Contabilidade automatizada para negócios portugueses. Simples, seguro e 100% em português.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Produto</h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href="#funcionalidades" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Funcionalidades
                </a>
              </li>
              <li>
                <a href="#como-funciona" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Como funciona
                </a>
              </li>
              <li>
                <a href="#precos" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                  Preços
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Conta</h4>
            <ul className="mt-4 space-y-2.5">
              {isSignedIn ? (
                <li>
                  <Link to="/painel" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    Painel
                  </Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link to="/auth/sign-in" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      Entrar
                    </Link>
                  </li>
                  <li>
                    <Link to="/auth/sign-up" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      Criar conta
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">Contacto</h4>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a
                  href="mailto:info@xtim.ai"
                  className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5" />
                  info@xtim.ai
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Trust badges + copyright */}
        <div className="mt-10 border-t pt-8 sm:mt-12 sm:pt-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-xs text-muted-foreground/60">
              &copy; {new Date().getFullYear()} xtim.ai — Contabilidade Inteligente. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-5">
              <span className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Shield className="h-3 w-3 text-tim-success" />
                RGPD
              </span>
              <span className="flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <Lock className="h-3 w-3 text-tim-info" />
                Encriptado
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
