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
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          owner_id: string | null
          product_slug: string | null
          utm_source: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          owner_id?: string | null
          product_slug?: string | null
          utm_source?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          owner_id?: string | null
          product_slug?: string | null
          utm_source?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          subscription_currency: string
          subscription_price: number
          system_name: string
          updated_at: string
        }
        Insert: {
          id?: string
          subscription_currency?: string
          subscription_price?: number
          system_name?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subscription_currency?: string
          subscription_price?: number
          system_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      city_corrections: {
        Row: {
          area: string
          city: string
          created_at: string
          id: string
          input_text: string | null
          owner_id: string
        }
        Insert: {
          area: string
          city: string
          created_at?: string
          id?: string
          input_text?: string | null
          owner_id: string
        }
        Update: {
          area?: string
          city?: string
          created_at?: string
          id?: string
          input_text?: string | null
          owner_id?: string
        }
        Relationships: []
      }
      easyorders_products: {
        Row: {
          created_at: string
          external_id: string
          id: string
          name: string | null
          owner_id: string
          raw: Json | null
          sku: string | null
          synced_at: string
          variants: Json
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          name?: string | null
          owner_id: string
          raw?: Json | null
          sku?: string | null
          synced_at?: string
          variants?: Json
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          name?: string | null
          owner_id?: string
          raw?: Json | null
          sku?: string | null
          synced_at?: string
          variants?: Json
        }
        Relationships: []
      }
      header_settings: {
        Row: {
          created_at: string
          email: string | null
          facebook_url: string | null
          id: string
          instagram_url: string | null
          logo_image: string | null
          logo_text: string
          owner_id: string
          phone: string | null
          show_search: boolean
          tagline: string | null
          tiktok_url: string | null
          updated_at: string
          whatsapp_url: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_image?: string | null
          logo_text?: string
          owner_id: string
          phone?: string | null
          show_search?: boolean
          tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_url?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          id?: string
          instagram_url?: string | null
          logo_image?: string | null
          logo_text?: string
          owner_id?: string
          phone?: string | null
          show_search?: boolean
          tagline?: string | null
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_url?: string | null
        }
        Relationships: []
      }
      hidden_default_cities: {
        Row: {
          area: string
          city: string
          created_at: string
          id: string
          owner_id: string
        }
        Insert: {
          area: string
          city: string
          created_at?: string
          id?: string
          owner_id: string
        }
        Update: {
          area?: string
          city?: string
          created_at?: string
          id?: string
          owner_id?: string
        }
        Relationships: []
      }
      order_form_fields: {
        Row: {
          created_at: string
          enabled: boolean
          field_key: string
          field_type: string
          id: string
          label: string
          owner_id: string
          placeholder: string
          required: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          field_key: string
          field_type?: string
          id?: string
          label: string
          owner_id: string
          placeholder?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          field_key?: string
          field_type?: string
          id?: string
          label?: string
          owner_id?: string
          placeholder?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          easyorders_product_id: string | null
          easyorders_variant_id: string | null
          id: string
          order_id: string
          owner_id: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          selected_color: string | null
          selected_product_code: string | null
          selected_size: string | null
          warehouse_code: string | null
        }
        Insert: {
          created_at?: string
          easyorders_product_id?: string | null
          easyorders_variant_id?: string | null
          id?: string
          order_id: string
          owner_id: string
          price?: number
          product_id?: string | null
          product_name: string
          quantity?: number
          selected_color?: string | null
          selected_product_code?: string | null
          selected_size?: string | null
          warehouse_code?: string | null
        }
        Update: {
          created_at?: string
          easyorders_product_id?: string | null
          easyorders_variant_id?: string | null
          id?: string
          order_id?: string
          owner_id?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          selected_color?: string | null
          selected_product_code?: string | null
          selected_size?: string | null
          warehouse_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          carrier_status: string | null
          carrier_status_raw: Json | null
          carrier_status_updated_at: string | null
          city: string
          created_at: string
          customer_name: string
          id: string
          link_error: string | null
          matched_area_id: number | null
          matched_area_name: string | null
          matched_zone_id: number | null
          matched_zone_name: string | null
          owner_id: string
          phone: string
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          selected_color: string | null
          selected_product_code: string | null
          selected_size: string | null
          shipped_to_company: boolean
          shipping_error: string | null
          shipping_id: string | null
          shipping_included: boolean
          shipping_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address: string
          carrier_status?: string | null
          carrier_status_raw?: Json | null
          carrier_status_updated_at?: string | null
          city: string
          created_at?: string
          customer_name: string
          id?: string
          link_error?: string | null
          matched_area_id?: number | null
          matched_area_name?: string | null
          matched_zone_id?: number | null
          matched_zone_name?: string | null
          owner_id: string
          phone: string
          price: number
          product_id?: string | null
          product_name: string
          quantity?: number
          selected_color?: string | null
          selected_product_code?: string | null
          selected_size?: string | null
          shipped_to_company?: boolean
          shipping_error?: string | null
          shipping_id?: string | null
          shipping_included?: boolean
          shipping_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string
          carrier_status?: string | null
          carrier_status_raw?: Json | null
          carrier_status_updated_at?: string | null
          city?: string
          created_at?: string
          customer_name?: string
          id?: string
          link_error?: string | null
          matched_area_id?: number | null
          matched_area_name?: string | null
          matched_zone_id?: number | null
          matched_zone_name?: string | null
          owner_id?: string
          phone?: string
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          selected_color?: string | null
          selected_product_code?: string | null
          selected_size?: string | null
          shipped_to_company?: boolean
          shipping_error?: string | null
          shipping_id?: string | null
          shipping_included?: boolean
          shipping_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pixel_settings: {
        Row: {
          created_at: string
          facebook_enabled: boolean | null
          facebook_pixel_id: string | null
          google_analytics_id: string | null
          google_enabled: boolean | null
          id: string
          owner_id: string
          snapchat_enabled: boolean | null
          snapchat_pixel_id: string | null
          tiktok_enabled: boolean | null
          tiktok_pixel_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          facebook_enabled?: boolean | null
          facebook_pixel_id?: string | null
          google_analytics_id?: string | null
          google_enabled?: boolean | null
          id?: string
          owner_id: string
          snapchat_enabled?: boolean | null
          snapchat_pixel_id?: string | null
          tiktok_enabled?: boolean | null
          tiktok_pixel_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          facebook_enabled?: boolean | null
          facebook_pixel_id?: string | null
          google_analytics_id?: string | null
          google_enabled?: boolean | null
          id?: string
          owner_id?: string
          snapchat_enabled?: boolean | null
          snapchat_pixel_id?: string | null
          tiktok_enabled?: boolean | null
          tiktok_pixel_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          colors: string[] | null
          created_at: string
          description: string | null
          easyorders_product_id: string | null
          id: string
          images: string[] | null
          is_visible: boolean
          name: string
          original_price: number | null
          owner_id: string
          price: number
          product_codes: string[] | null
          purchase_price: number
          sizes: string[] | null
          slug: string
          stock: number
          updated_at: string
          variant_easyorders_ids: Json
          variant_stock: Json
          variant_warehouse_codes: Json
        }
        Insert: {
          colors?: string[] | null
          created_at?: string
          description?: string | null
          easyorders_product_id?: string | null
          id?: string
          images?: string[] | null
          is_visible?: boolean
          name: string
          original_price?: number | null
          owner_id: string
          price: number
          product_codes?: string[] | null
          purchase_price?: number
          sizes?: string[] | null
          slug: string
          stock?: number
          updated_at?: string
          variant_easyorders_ids?: Json
          variant_stock?: Json
          variant_warehouse_codes?: Json
        }
        Update: {
          colors?: string[] | null
          created_at?: string
          description?: string | null
          easyorders_product_id?: string | null
          id?: string
          images?: string[] | null
          is_visible?: boolean
          name?: string
          original_price?: number | null
          owner_id?: string
          price?: number
          product_codes?: string[] | null
          purchase_price?: number
          sizes?: string[] | null
          slug?: string
          stock?: number
          updated_at?: string
          variant_easyorders_ids?: Json
          variant_stock?: Json
          variant_warehouse_codes?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          easyorders_api_key: string | null
          full_name: string | null
          id: string
          is_active: boolean
          subscription_ends_at: string | null
          subscription_starts_at: string
          updated_at: string
          user_id: string
          username: string
          webhook_token: string | null
        }
        Insert: {
          created_at?: string
          easyorders_api_key?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          subscription_ends_at?: string | null
          subscription_starts_at?: string
          updated_at?: string
          user_id: string
          username: string
          webhook_token?: string | null
        }
        Update: {
          created_at?: string
          easyorders_api_key?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          subscription_ends_at?: string | null
          subscription_starts_at?: string
          updated_at?: string
          user_id?: string
          username?: string
          webhook_token?: string | null
        }
        Relationships: []
      }
      shipping_settings: {
        Row: {
          created_at: string
          email: string
          enabled: boolean
          endpoint: string
          id: string
          owner_id: string
          password: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          owner_id: string
          password?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          owner_id?: string
          password?: string
          updated_at?: string
        }
        Relationships: []
      }
      shipping_warehouse_products: {
        Row: {
          code: string | null
          created_at: string
          external_id: number
          id: string
          name: string | null
          owner_id: string
          synced_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          external_id: number
          id?: string
          name?: string | null
          owner_id: string
          synced_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          external_id?: number
          id?: string
          name?: string | null
          owner_id?: string
          synced_at?: string
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          created_at: string
          external_id: number
          id: string
          kind: string
          name: string
          owner_id: string
          parent_external_id: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id: number
          id?: string
          kind?: string
          name: string
          owner_id: string
          parent_external_id?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: number
          id?: string
          kind?: string
          name?: string
          owner_id?: string
          parent_external_id?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          created_at: string
          currency_code: string
          currency_name: string
          currency_symbol: string
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          currency_name?: string
          currency_symbol?: string
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          currency_name?: string
          currency_symbol?: string
          id?: string
          owner_id?: string
          updated_at?: string
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
      is_subscription_active: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
