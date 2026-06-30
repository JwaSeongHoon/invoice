export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      allocation_result: {
        Row: {
          alloc_basis: string | null;
          batch_id: string;
          bl_no: string | null;
          etc_amount: number | null;
          fee: number | null;
          freight: number | null;
          fx_rate: number | null;
          id: string;
          inventory_item_id: string;
          supply_amount: number | null;
          unit_price_fx_adjusted: number | null;
          unit_price_krw: number | null;
          vat: number | null;
        };
        Insert: {
          alloc_basis?: string | null;
          batch_id: string;
          bl_no?: string | null;
          etc_amount?: number | null;
          fee?: number | null;
          freight?: number | null;
          fx_rate?: number | null;
          id?: string;
          inventory_item_id: string;
          supply_amount?: number | null;
          unit_price_fx_adjusted?: number | null;
          unit_price_krw?: number | null;
          vat?: number | null;
        };
        Update: {
          alloc_basis?: string | null;
          batch_id?: string;
          bl_no?: string | null;
          etc_amount?: number | null;
          fee?: number | null;
          freight?: number | null;
          fx_rate?: number | null;
          id?: string;
          inventory_item_id?: string;
          supply_amount?: number | null;
          unit_price_fx_adjusted?: number | null;
          unit_price_krw?: number | null;
          vat?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "allocation_result_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batch";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "allocation_result_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_item";
            referencedColumns: ["id"];
          },
        ];
      };
      declaration_item: {
        Row: {
          amount_usd: number | null;
          batch_id: string;
          bl_no: string | null;
          confidence: number | null;
          declaration_no: string | null;
          fx_rate_65: number | null;
          id: string;
          model: string | null;
          page_index: number;
          qty_35: number | null;
          qty_41_total: number | null;
          unit_price_usd: number | null;
        };
        Insert: {
          amount_usd?: number | null;
          batch_id: string;
          bl_no?: string | null;
          confidence?: number | null;
          declaration_no?: string | null;
          fx_rate_65?: number | null;
          id?: string;
          model?: string | null;
          page_index: number;
          qty_35?: number | null;
          qty_41_total?: number | null;
          unit_price_usd?: number | null;
        };
        Update: {
          amount_usd?: number | null;
          batch_id?: string;
          bl_no?: string | null;
          confidence?: number | null;
          declaration_no?: string | null;
          fx_rate_65?: number | null;
          id?: string;
          model?: string | null;
          page_index?: number;
          qty_35?: number | null;
          qty_41_total?: number | null;
          unit_price_usd?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "declaration_item_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batch";
            referencedColumns: ["id"];
          },
        ];
      };
      fx_rate_cache: {
        Row: {
          currency: string;
          fetched_at: string;
          id: string;
          quote_date: string;
          rate: number;
          source: string;
        };
        Insert: {
          currency: string;
          fetched_at?: string;
          id?: string;
          quote_date: string;
          rate: number;
          source: string;
        };
        Update: {
          currency?: string;
          fetched_at?: string;
          id?: string;
          quote_date?: string;
          rate?: number;
          source?: string;
        };
        Relationships: [];
      };
      import_batch: {
        Row: {
          created_at: string;
          id: string;
          pdf_path: string | null;
          status: string;
          user_id: string;
          xlsx_path: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          pdf_path?: string | null;
          status?: string;
          user_id: string;
          xlsx_path?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          pdf_path?: string | null;
          status?: string;
          user_id?: string;
          xlsx_path?: string | null;
        };
        Relationships: [];
      };
      instruments: {
        Row: {
          id: number;
          name: string;
        };
        Insert: {
          id?: never;
          name: string;
        };
        Update: {
          id?: never;
          name?: string;
        };
        Relationships: [];
      };
      inventory_item: {
        Row: {
          batch_id: string;
          currency_code: string;
          id: string;
          in_date: string | null;
          item_code: string;
          item_name: string;
          qty: number;
          row_no: number;
          unit_price_fx: number | null;
        };
        Insert: {
          batch_id: string;
          currency_code: string;
          id?: string;
          in_date?: string | null;
          item_code: string;
          item_name: string;
          qty: number;
          row_no: number;
          unit_price_fx?: number | null;
        };
        Update: {
          batch_id?: string;
          currency_code?: string;
          id?: string;
          in_date?: string | null;
          item_code?: string;
          item_name?: string;
          qty?: number;
          row_no?: number;
          unit_price_fx?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_item_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batch";
            referencedColumns: ["id"];
          },
        ];
      };
      item_match: {
        Row: {
          batch_id: string;
          confirmed_by: string | null;
          declaration_item_id: string | null;
          id: string;
          inventory_item_id: string | null;
          method: string;
          score: number | null;
          status: string;
        };
        Insert: {
          batch_id: string;
          confirmed_by?: string | null;
          declaration_item_id?: string | null;
          id?: string;
          inventory_item_id?: string | null;
          method: string;
          score?: number | null;
          status: string;
        };
        Update: {
          batch_id?: string;
          confirmed_by?: string | null;
          declaration_item_id?: string | null;
          id?: string;
          inventory_item_id?: string | null;
          method?: string;
          score?: number | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "item_match_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batch";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_match_declaration_item_id_fkey";
            columns: ["declaration_item_id"];
            isOneToOne: false;
            referencedRelation: "declaration_item";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "item_match_inventory_item_id_fkey";
            columns: ["inventory_item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_item";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          bio: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
          username: string | null;
          website: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
          username?: string | null;
          website?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          bio?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
          username?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
      settlement: {
        Row: {
          batch_id: string;
          bl_no: string | null;
          customs_fee: number | null;
          customs_vat: number | null;
          duty_amount: number | null;
          duty_rate: number | null;
          freight_subtotal: number | null;
          id: string;
          raw_json: Json | null;
        };
        Insert: {
          batch_id: string;
          bl_no?: string | null;
          customs_fee?: number | null;
          customs_vat?: number | null;
          duty_amount?: number | null;
          duty_rate?: number | null;
          freight_subtotal?: number | null;
          id?: string;
          raw_json?: Json | null;
        };
        Update: {
          batch_id?: string;
          bl_no?: string | null;
          customs_fee?: number | null;
          customs_vat?: number | null;
          duty_amount?: number | null;
          duty_rate?: number | null;
          freight_subtotal?: number | null;
          id?: string;
          raw_json?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "settlement_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batch";
            referencedColumns: ["id"];
          },
        ];
      };
      todos: {
        Row: {
          created_at: string;
          id: string;
          is_completed: boolean;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_completed?: boolean;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_completed?: boolean;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      validation_log: {
        Row: {
          actual: number | null;
          batch_id: string;
          created_at: string;
          expected: number | null;
          id: string;
          message: string | null;
          passed: boolean;
          type: string;
        };
        Insert: {
          actual?: number | null;
          batch_id: string;
          created_at?: string;
          expected?: number | null;
          id?: string;
          message?: string | null;
          passed: boolean;
          type: string;
        };
        Update: {
          actual?: number | null;
          batch_id?: string;
          created_at?: string;
          expected?: number | null;
          id?: string;
          message?: string | null;
          passed?: boolean;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "validation_log_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "import_batch";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
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
