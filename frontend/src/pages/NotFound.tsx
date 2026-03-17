import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-4xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-base text-muted-foreground">Página não encontrada</p>
        <p className="mt-1 text-sm text-muted-foreground/70">
          O endereço <span className="font-mono text-xs">{location.pathname}</span> não existe.
        </p>
        <Button asChild className="mt-6" size="sm">
          <Link to="/painel">Voltar ao Painel</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
