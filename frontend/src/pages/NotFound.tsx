import { useLocation, Link } from "react-router-dom";
import { Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background tim-mesh-gradient">
      <div className="relative mx-4 max-w-md text-center">
        <p className="text-8xl font-bold tracking-tighter tim-gradient-text sm:text-9xl">
          404
        </p>
        <h1 className="mt-4 text-xl font-bold text-foreground sm:text-2xl">
          Página não encontrada
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          O endereço <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{location.pathname}</span> não existe.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="sm">
            <Link to="/painel">
              <Home className="mr-1.5 h-4 w-4" />
              Voltar ao Painel
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Voltar atrás
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
