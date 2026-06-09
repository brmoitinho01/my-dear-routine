export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          how: string | null
          id: string
          non_conformity_id: string
          status: Database["public"]["Enums"]["action_status"]
          updated_at: string
          what: string
          when_due: string | null
          who: string | null
          why: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          how?: string | null
          id?: string
          non_conformity_id: string
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
          what: string
          when_due?: string | null
          who?: string | null
          why?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          how?: string | null
          id?: string
          non_conformity_id?: string
          status?: Database["public"]["Enums"]["action_status"]
          updated_at?: string
          what?: string
          when_due?: string | null
          who?: string | null
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_non_conformity_id_fkey"
            columns: ["non_conformity_id"]
            isOneToOne: false
            referencedRelation: "non_conformities"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_executions: {
        Row: {
          checklist_id: string
          created_at: string
          executed_by: string | null
          finished_at: string | null
          id: string
          scheduled_date: string
          sector_id: string
          started_at: string
          status: Database["public"]["Enums"]["execution_status"]
          updated_at: string
        }
        Insert: {
          checklist_id: string
          created_at?: string
          executed_by?: string | null
          finished_at?: string | null
          id?: string
          scheduled_date?: string
          sector_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["execution_status"]
          updated_at?: string
        }
        Update: {
          checklist_id?: string
          created_at?: string
          executed_by?: string | null
          finished_at?: string | null
          id?: string
          scheduled_date?: string
          sector_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["execution_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_executions_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_executions_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_item_responses: {
        Row: {
          answered_by: string | null
          created_at: string
          execution_id: string
          id: string
          item_id: string
          observation: string | null
          photo_urls: string[]
          response: Database["public"]["Enums"]["response_kind"]
          updated_at: string
        }
        Insert: {
          answered_by?: string | null
          created_at?: string
          execution_id: string
          id?: string
          item_id: string
          observation?: string | null
          photo_urls?: string[]
          response: Database["public"]["Enums"]["response_kind"]
          updated_at?: string
        }
        Update: {
          answered_by?: string | null
          created_at?: string
          execution_id?: string
          id?: string
          item_id?: string
          observation?: string | null
          photo_urls?: string[]
          response?: Database["public"]["Enums"]["response_kind"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_item_responses_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "checklist_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_item_responses_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          checklist_id: string
          created_at: string
          help_text: string | null
          id: string
          is_critical: boolean
          position: number
          question: string
          requires_photo: boolean
        }
        Insert: {
          checklist_id: string
          created_at?: string
          help_text?: string | null
          id?: string
          is_critical?: boolean
          position?: number
          question: string
          requires_photo?: boolean
        }
        Update: {
          checklist_id?: string
          created_at?: string
          help_text?: string | null
          id?: string
          is_critical?: boolean
          position?: number
          question?: string
          requires_photo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      checklists: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          moment: Database["public"]["Enums"]["moment_kind"]
          sector_id: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          moment: Database["public"]["Enums"]["moment_kind"]
          sector_id: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          moment?: Database["public"]["Enums"]["moment_kind"]
          sector_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklists_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      non_conformities: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          evidence_urls: string[]
          execution_id: string | null
          id: string
          item_id: string | null
          response_id: string | null
          responsible_user_id: string | null
          sector_id: string | null
          severity: Database["public"]["Enums"]["severity_kind"]
          status: Database["public"]["Enums"]["nc_status"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          evidence_urls?: string[]
          execution_id?: string | null
          id?: string
          item_id?: string | null
          response_id?: string | null
          responsible_user_id?: string | null
          sector_id?: string | null
          severity?: Database["public"]["Enums"]["severity_kind"]
          status?: Database["public"]["Enums"]["nc_status"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          evidence_urls?: string[]
          execution_id?: string | null
          id?: string
          item_id?: string | null
          response_id?: string | null
          responsible_user_id?: string | null
          sector_id?: string | null
          severity?: Database["public"]["Enums"]["severity_kind"]
          status?: Database["public"]["Enums"]["nc_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "non_conformities_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "checklist_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformities_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformities_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "checklist_item_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "non_conformities_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["sector_kind"]
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["sector_kind"]
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["sector_kind"]
          name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sectors: {
        Row: {
          created_at: string
          sector_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          sector_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          sector_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      users_profile: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          primary_sector_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          primary_sector_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          primary_sector_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_profile_primary_sector_id_fkey"
            columns: ["primary_sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_manager: { Args: { _user_id: string }; Returns: boolean }
      user_in_sector: {
        Args: { _sector_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      action_status: "pendente" | "em_andamento" | "concluida" | "atrasada"
      app_role: "admin" | "gerente" | "lider_setor" | "operador"
      execution_status: "em_andamento" | "finalizada"
      moment_kind: "abertura" | "fechamento"
      nc_status: "aberta" | "em_tratamento" | "resolvida" | "cancelada"
      response_kind: "conforme" | "nao_conforme" | "na"
      sector_kind: "salao" | "cozinha" | "bar"
      severity_kind: "baixa" | "media" | "alta" | "critica"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      action_status: ["pendente", "em_andamento", "concluida", "atrasada"],
      app_role: ["admin", "gerente", "lider_setor", "operador"],
      execution_status: ["em_andamento", "finalizada"],
      moment_kind: ["abertura", "fechamento"],
      nc_status: ["aberta", "em_tratamento", "resolvida", "cancelada"],
      response_kind: ["conforme", "nao_conforme", "na"],
      sector_kind: ["salao", "cozinha", "bar"],
      severity_kind: ["baixa", "media", "alta", "critica"],
    },
  },
} as const
