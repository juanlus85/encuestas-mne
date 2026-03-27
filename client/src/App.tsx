import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SurveyForm from "./pages/SurveyForm";
import Resultados from "./pages/Resultados";
import Estadisticas from "./pages/Estadisticas";
import Mapa from "./pages/Mapa";
import Exportar from "./pages/Exportar";
import Usuarios from "./pages/Usuarios";
import Configuracion from "./pages/Configuracion";
import ConteoPeatonal from "./pages/ConteoPeatonal";
import ConteoResultados from "./pages/ConteoResultados";
import ConteoSentidos from "./pages/ConteoSentidos";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={Home} />
      <Route path="/encuesta" component={SurveyForm} />
      <Route path="/encuesta/:id" component={SurveyForm} />
      <Route path="/resultados" component={Resultados} />
      <Route path="/estadisticas" component={Estadisticas} />
      <Route path="/mapa" component={Mapa} />
      <Route path="/exportar" component={Exportar} />
      <Route path="/usuarios" component={Usuarios} />
      <Route path="/configuracion" component={Configuracion} />
      <Route path="/conteo" component={ConteoPeatonal} />
      <Route path="/conteo-resultados" component={ConteoResultados} />
      <Route path="/conteo-sentidos" component={ConteoSentidos} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
