import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { getUsuarioWeb, iniciarSesionWeb, cerrarSesionWeb, obtenerPerfilWeb } from '../services/sesionService.js';

export const SesionContext = createContext(null);

export function SesionProvider({ children }) {
  const [usuario, setUsuario] = useState(getUsuarioWeb);

  // Revalida el token guardado al abrir la app: si venció o la cuenta se
  // desactivó, se limpia la sesión. Solo se ejecuta una vez, al montar.
  useEffect(() => {
    let activo = true;
    obtenerPerfilWeb().then((perfil) => {
      if (activo) setUsuario(perfil);
    });
    return () => { activo = false; };
  }, []);

  const iniciarSesion = useCallback(async (email, password) => {
    const perfil = await iniciarSesionWeb(email, password);
    setUsuario(perfil);
    return perfil;
  }, []);

  const cerrarSesion = useCallback(() => {
    cerrarSesionWeb();
    setUsuario(null);
  }, []);

  const valor = useMemo(() => ({
    usuario,
    esMayorista: usuario?.rol === 'mayorista',
    iniciarSesion,
    cerrarSesion,
  }), [usuario, iniciarSesion, cerrarSesion]);

  return <SesionContext.Provider value={valor}>{children}</SesionContext.Provider>;
}
