import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./use-auth-context";

// Configuração é por usuário desde a migração
// 20260908120000_app_settings_e_logos_por_usuario.sql: antes havia uma única
// linha global (id = 1) visível e editável por qualquer autenticado.
export function useAppSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["app_settings", user?.id],
    // Sem isso a consulta rodava antes da sessão existir e voltava vazia,
    // deixando a logo sumir até algum outro evento revalidar o cache.
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// Extrai o caminho do objeto a partir da URL assinada gravada em `logo_url`.
// O formato é `.../storage/v1/object/sign/logos/<caminho>?token=...`.
function caminhoDaUrl(url: string | null | undefined) {
  if (!url) return null;
  const m = /\/object\/sign\/logos\/([^?]+)/.exec(url);
  return m ? decodeURIComponent(m[1]) : null;
}

export function useUpdateLogo() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ file, size }: { file?: File; size: number }) => {
      if (!user) throw new Error("Sessão expirada. Entre novamente.");
      let logo_url: string | undefined;
      let anterior: string | null = null;

      if (file) {
        const atual = await supabase
          .from("app_settings")
          .select("logo_url")
          .eq("user_id", user.id)
          .maybeSingle();
        anterior = caminhoDaUrl(atual.data?.logo_url);

        // Prefixo com o id do usuário: as políticas do bucket `logos` casam
        // pela primeira pasta do caminho.
        const path = `${user.id}/logo-${Date.now()}.${file.name.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage.from("logos").upload(path, file);
        if (uploadError) throw uploadError;

        // Bucket "logos" é privado (workspace bloqueia buckets públicos),
        // então getPublicUrl não serve o arquivo. URL assinada de 10 anos
        // evita depender de sessão do usuário.
        const TEN_YEARS_IN_SECONDS = 60 * 60 * 24 * 365 * 10;
        const { data: signed, error: signError } = await supabase.storage
          .from("logos")
          .createSignedUrl(path, TEN_YEARS_IN_SECONDS);
        if (signError) throw signError;
        logo_url = signed.signedUrl;
      }

      const { error } = await supabase
        .from("app_settings")
        .upsert({ user_id: user.id, logo_size: size, ...(logo_url ? { logo_url } : {}) });
      if (error) throw error;

      // Só depois de a nova logo estar gravada: cada upload usa um caminho
      // novo (timestamp), então sem esta remoção o bucket acumulava um arquivo
      // órfão por troca de logo, para sempre. Falhar aqui não invalida a troca.
      if (anterior && anterior !== caminhoDaUrl(logo_url)) {
        await supabase.storage.from("logos").remove([anterior]);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: () => {
      toast.error("Não foi possível salvar a logo. Tente novamente.");
    },
  });
}
