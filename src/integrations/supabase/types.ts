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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      case_test_results: {
        Row: {
          actual_value: number
          case_test_id: string
          created_at: string | null
          id: string
          lower_limit: number | null
          parameter_name: string
          particle_size: string | null
          status: string | null
          unit: string | null
          upper_limit: number | null
        }
        Insert: {
          actual_value: number
          case_test_id: string
          created_at?: string | null
          id?: string
          lower_limit?: number | null
          parameter_name: string
          particle_size?: string | null
          status?: string | null
          unit?: string | null
          upper_limit?: number | null
        }
        Update: {
          actual_value?: number
          case_test_id?: string
          created_at?: string | null
          id?: string
          lower_limit?: number | null
          parameter_name?: string
          particle_size?: string | null
          status?: string | null
          unit?: string | null
          upper_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "case_test_results_case_test_id_fkey"
            columns: ["case_test_id"]
            isOneToOne: false
            referencedRelation: "case_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      case_tests: {
        Row: {
          case_id: string
          created_at: string | null
          id: string
          image_url: string | null
          test_name: string
        }
        Insert: {
          case_id: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          test_name: string
        }
        Update: {
          case_id?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          test_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          created_at: string | null
          customer_address: string | null
          customer_email: string | null
          customer_mobile: string | null
          customer_name: string
          id: string
          lubricant_condition: string
          machine_condition: string
          recommendations: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_mobile?: string | null
          customer_name: string
          id?: string
          lubricant_condition: string
          machine_condition: string
          recommendations?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_mobile?: string | null
          customer_name?: string
          id?: string
          lubricant_condition?: string
          machine_condition?: string
          recommendations?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          company_name: string
          contact_number: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          company_name?: string
          contact_number?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          company_name?: string
          contact_number?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      test_parameters: {
        Row: {
          created_at: string | null
          id: string
          lower_limit: number | null
          parameter_name: string
          template_id: string
          unit: string | null
          upper_limit: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          lower_limit?: number | null
          parameter_name: string
          template_id: string
          unit?: string | null
          upper_limit?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          lower_limit?: number | null
          parameter_name?: string
          template_id?: string
          unit?: string | null
          upper_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "test_parameters_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "test_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      test_templates: {
        Row: {
          created_at: string | null
          id: string
          test_name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          test_name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          test_name?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
