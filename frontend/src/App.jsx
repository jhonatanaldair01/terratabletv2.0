import { CarritoProvider } from './context/CarritoContext.jsx';
import { ClienteProvider } from './context/ClienteContext.jsx';
import { SesionProvider } from './context/SesionContext.jsx';
import AppRoutes from './routes/AppRoutes.jsx';

export default function App() {
  return (
    <SesionProvider>
      <ClienteProvider>
        <CarritoProvider>
          <AppRoutes />
        </CarritoProvider>
      </ClienteProvider>
    </SesionProvider>
  );
}