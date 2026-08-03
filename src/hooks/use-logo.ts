import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useAppSettings() {
  return useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("*")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, size }: { file?: File; size: number }) => {
      let logo_url: string | undefined;

      if (file) {
        const path = `logo-${Date.now()}.${file.name.split(".").pop()}`;
        const { error: uploadError } = await supabase.storage
          .from("logos")
          .upload(path, file, { upsert: true });
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
        .update({ logo_size: size, ...(logo_url ? { logo_url } : {}) })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: () => {
      toast.error("Não foi possível salvar a logo. Tente novamente.");
    },
  });
}
