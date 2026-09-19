import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // As telas carregam tabelas inteiras e navegar entre elas repete as mesmas
  // consultas. Sem `staleTime`, toda montagem refaz tudo. 30s é curto o
  // bastante para não mascarar uma gravação: as mutações já invalidam as
  // queries afetadas, e invalidação vence o `staleTime`.
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload usa o cache do Query, que agora tem `staleTime` próprio.
    defaultPreloadStaleTime: 0,
  });

  return router;
};
