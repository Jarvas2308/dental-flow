export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      atendimento_procedimentos: {
        Row: {
          atendimento_id: string;
          created_at: string;
          id: string;
          procedimento: string;
          user_id: string;
          valor: number;
        };
        Insert: {
          atendimento_id: string;
          created_at?: string;
          id?: string;
          procedimento: string;
          user_id: string;
          valor?: number;
        };
        Update: {
          atendimento_id?: string;
          created_at?: string;
          id?: string;
          procedimento?: string;
          user_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "atendimento_procedimentos_atendimento_id_fkey";
            columns: ["atendimento_id"];
            isOneToOne: false;
            referencedRelation: "atendimentos";
            referencedColumns: ["id"];
          },
        ];
      };
      atendimentos: {
        Row: {
          created_at: string;
          data: string;
          forma_pagamento: string;
          id: string;
          nota_fiscal: boolean;
          nota_fiscal_status: string;
          paciente: string;
          paciente_id: string | null;
          parcelado: boolean;
          parcelas_total: number;
          procedimento: string;
          status_pagamento: string;
          taxa: number;
          user_id: string;
          valor_bruto: number;
          valor_liquido: number;
        };
        Insert: {
          created_at?: string;
          data: string;
          forma_pagamento: string;
          id?: string;
          nota_fiscal?: boolean;
          nota_fiscal_status?: string;
          paciente: string;
          paciente_id?: string | null;
          parcelado?: boolean;
          parcelas_total?: number;
          procedimento: string;
          status_pagamento?: string;
          taxa?: number;
          user_id: string;
          valor_bruto: number;
          valor_liquido: number;
        };
        Update: {
          created_at?: string;
          data?: string;
          forma_pagamento?: string;
          id?: string;
          nota_fiscal?: boolean;
          nota_fiscal_status?: string;
          paciente?: string;
          paciente_id?: string | null;
          parcelado?: boolean;
          parcelas_total?: number;
          procedimento?: string;
          status_pagamento?: string;
          taxa?: number;
          user_id?: string;
          valor_bruto?: number;
          valor_liquido?: number;
        };
        Relationships: [
          {
            foreignKeyName: "atendimentos_paciente_id_fkey";
            columns: ["paciente_id"];
            isOneToOne: false;
            referencedRelation: "pacientes";
            referencedColumns: ["id"];
          },
        ];
      };
      consultas_previstas: {
        Row: {
          created_at: string;
          data_prevista: string;
          id: string;
          observacao: string | null;
          paciente: string;
          paciente_id: string | null;
          realizada: boolean;
          user_id: string;
          valor_estimado: number;
        };
        Insert: {
          created_at?: string;
          data_prevista: string;
          id?: string;
          observacao?: string | null;
          paciente: string;
          paciente_id?: string | null;
          realizada?: boolean;
          user_id: string;
          valor_estimado?: number;
        };
        Update: {
          created_at?: string;
          data_prevista?: string;
          id?: string;
          observacao?: string | null;
          paciente?: string;
          paciente_id?: string | null;
          realizada?: boolean;
          user_id?: string;
          valor_estimado?: number;
        };
        Relationships: [
          {
            foreignKeyName: "consultas_previstas_paciente_id_fkey";
            columns: ["paciente_id"];
            isOneToOne: false;
            referencedRelation: "pacientes";
            referencedColumns: ["id"];
          },
        ];
      };
      custos_laboratorio: {
        Row: {
          atendimento_id: string | null;
          created_at: string;
          data: string;
          id: string;
          laboratorio: string;
          paciente: string;
          procedimento: string | null;
          tipo_trabalho: string;
          user_id: string;
          valor: number;
        };
        Insert: {
          atendimento_id?: string | null;
          created_at?: string;
          data: string;
          id?: string;
          laboratorio: string;
          paciente: string;
          procedimento?: string | null;
          tipo_trabalho: string;
          user_id: string;
          valor: number;
        };
        Update: {
          atendimento_id?: string | null;
          created_at?: string;
          data?: string;
          id?: string;
          laboratorio?: string;
          paciente?: string;
          procedimento?: string | null;
          tipo_trabalho?: string;
          user_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "custos_laboratorio_atendimento_id_fkey";
            columns: ["atendimento_id"];
            isOneToOne: false;
            referencedRelation: "atendimentos";
            referencedColumns: ["id"];
          },
        ];
      };
      despesas: {
        Row: {
          created_at: string;
          data_pagamento: string | null;
          id: string;
          nome: string;
          observacoes: string | null;
          origem_id: string | null;
          recorrente: boolean;
          status: string;
          tipo_recorrencia: string;
          user_id: string;
          valor: number | null;
          vencimento: string;
        };
        Insert: {
          created_at?: string;
          data_pagamento?: string | null;
          id?: string;
          nome: string;
          observacoes?: string | null;
          origem_id?: string | null;
          recorrente?: boolean;
          status?: string;
          tipo_recorrencia?: string;
          user_id: string;
          valor?: number | null;
          vencimento: string;
        };
        Update: {
          created_at?: string;
          data_pagamento?: string | null;
          id?: string;
          nome?: string;
          observacoes?: string | null;
          origem_id?: string | null;
          recorrente?: boolean;
          status?: string;
          tipo_recorrencia?: string;
          user_id?: string;
          valor?: number | null;
          vencimento?: string;
        };
        Relationships: [];
      };
      formas_pagamento: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          taxa: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          taxa?: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          taxa?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      gastos_fixos: {
        Row: {
          categoria: string | null;
          created_at: string;
          data: string;
          id: string;
          nome: string;
          observacoes: string | null;
          user_id: string;
          valor: number;
        };
        Insert: {
          categoria?: string | null;
          created_at?: string;
          data: string;
          id?: string;
          nome: string;
          observacoes?: string | null;
          user_id: string;
          valor: number;
        };
        Update: {
          categoria?: string | null;
          created_at?: string;
          data?: string;
          id?: string;
          nome?: string;
          observacoes?: string | null;
          user_id?: string;
          valor?: number;
        };
        Relationships: [];
      };
      gastos_variaveis: {
        Row: {
          categoria: string | null;
          created_at: string;
          data: string;
          id: string;
          nome: string;
          observacoes: string | null;
          user_id: string;
          valor: number;
        };
        Insert: {
          categoria?: string | null;
          created_at?: string;
          data: string;
          id?: string;
          nome: string;
          observacoes?: string | null;
          user_id: string;
          valor: number;
        };
        Update: {
          categoria?: string | null;
          created_at?: string;
          data?: string;
          id?: string;
          nome?: string;
          observacoes?: string | null;
          user_id?: string;
          valor?: number;
        };
        Relationships: [];
      };
      laboratorios: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pacientes: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      parcelas: {
        Row: {
          atendimento_id: string;
          created_at: string;
          data_pagamento: string | null;
          forma_pagamento: string | null;
          id: string;
          numero: number;
          paciente: string | null;
          procedimento: string | null;
          status: string;
          total: number;
          user_id: string;
          valor_bruto: number;
          valor_liquido: number;
          vencimento: string;
        };
        Insert: {
          atendimento_id: string;
          created_at?: string;
          data_pagamento?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          numero: number;
          paciente?: string | null;
          procedimento?: string | null;
          status?: string;
          total: number;
          user_id: string;
          valor_bruto?: number;
          valor_liquido?: number;
          vencimento: string;
        };
        Update: {
          atendimento_id?: string;
          created_at?: string;
          data_pagamento?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          numero?: number;
          paciente?: string | null;
          procedimento?: string | null;
          status?: string;
          total?: number;
          user_id?: string;
          valor_bruto?: number;
          valor_liquido?: number;
          vencimento?: string;
        };
        Relationships: [
          {
            foreignKeyName: "parcelas_atendimento_id_fkey";
            columns: ["atendimento_id"];
            isOneToOne: false;
            referencedRelation: "atendimentos";
            referencedColumns: ["id"];
          },
        ];
      };
      procedimentos: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      recebimentos: {
        Row: {
          atendimento_id: string;
          created_at: string;
          data: string;
          forma_pagamento: string | null;
          id: string;
          observacao: string | null;
          taxa: number;
          user_id: string;
          valor: number;
          valor_liquido: number;
        };
        Insert: {
          atendimento_id: string;
          created_at?: string;
          data: string;
          forma_pagamento?: string | null;
          id?: string;
          observacao?: string | null;
          taxa: number;
          user_id: string;
          valor?: number;
          valor_liquido: number;
        };
        Update: {
          atendimento_id?: string;
          created_at?: string;
          data?: string;
          forma_pagamento?: string | null;
          id?: string;
          observacao?: string | null;
          taxa?: number;
          user_id?: string;
          valor?: number;
          valor_liquido?: number;
        };
        Relationships: [];
      };
      receitas_extras: {
        Row: {
          created_at: string;
          data: string;
          descricao: string;
          id: string;
          observacoes: string | null;
          tipo: string;
          user_id: string;
          valor: number;
        };
        Insert: {
          created_at?: string;
          data: string;
          descricao: string;
          id?: string;
          observacoes?: string | null;
          tipo?: string;
          user_id: string;
          valor: number;
        };
        Update: {
          created_at?: string;
          data?: string;
          descricao?: string;
          id?: string;
          observacoes?: string | null;
          tipo?: string;
          user_id?: string;
          valor?: number;
        };
        Relationships: [];
      };
      tentativas_contato: {
        Row: {
          created_at: string;
          data: string;
          id: string;
          observacao: string | null;
          tratamento_proposto_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          data: string;
          id?: string;
          observacao?: string | null;
          tratamento_proposto_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          data?: string;
          id?: string;
          observacao?: string | null;
          tratamento_proposto_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tentativas_contato_tratamento_proposto_id_fkey";
            columns: ["tratamento_proposto_id"];
            isOneToOne: false;
            referencedRelation: "tratamentos_propostos";
            referencedColumns: ["id"];
          },
        ];
      };
      tipos_trabalho: {
        Row: {
          created_at: string;
          id: string;
          nome: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          nome: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nome?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      tratamentos_propostos: {
        Row: {
          created_at: string;
          data_proposta: string;
          fase1_intervalo_dias: number;
          fase1_qtd: number;
          fase2_intervalo_dias: number;
          fase2_qtd: number;
          fase3_intervalo_dias: number;
          id: string;
          paciente: string;
          paciente_id: string | null;
          status: string;
          tentativas_feitas: number;
          tratamento: string;
          user_id: string;
          valor_estimado: number | null;
        };
        Insert: {
          created_at?: string;
          data_proposta: string;
          fase1_intervalo_dias?: number;
          fase1_qtd?: number;
          fase2_intervalo_dias?: number;
          fase2_qtd?: number;
          fase3_intervalo_dias?: number;
          id?: string;
          paciente: string;
          paciente_id?: string | null;
          status?: string;
          tentativas_feitas?: number;
          tratamento: string;
          user_id: string;
          valor_estimado?: number | null;
        };
        Update: {
          created_at?: string;
          data_proposta?: string;
          fase1_intervalo_dias?: number;
          fase1_qtd?: number;
          fase2_intervalo_dias?: number;
          fase2_qtd?: number;
          fase3_intervalo_dias?: number;
          id?: string;
          paciente?: string;
          paciente_id?: string | null;
          status?: string;
          tentativas_feitas?: number;
          tratamento?: string;
          user_id?: string;
          valor_estimado?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "tratamentos_propostos_paciente_id_fkey";
            columns: ["paciente_id"];
            isOneToOne: false;
            referencedRelation: "pacientes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      gerar_despesas_recorrentes: {
        Args: { p_competencia: string };
        Returns: Json;
      };
      salvar_atendimento_completo: {
        Args: {
          p_atendimento_id?: string;
          p_data?: string;
          p_forma_pagamento?: string;
          p_nota_fiscal_status?: string;
          p_paciente?: string;
          p_paciente_id?: string;
          p_parcelado?: boolean;
          p_parcelas_total?: number;
          p_procedimento?: string;
          p_procedimentos?: Json;
          p_recebimentos?: Json;
          p_status_pagamento?: string;
          p_taxa?: number;
          p_valor_bruto?: number;
          p_valor_liquido?: number;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
