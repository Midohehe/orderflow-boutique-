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
          order_fee: number
          shipping_endpoint: string
          subscription_currency: string
          subscription_price: number
          system_name: string
          updated_at: string
          wallet_enabled: boolean
        }
        Insert: {
          id?: string
          order_fee?: number
          shipping_endpoint?: string
          subscription_currency?: string
          subscription_price?: number
          system_name?: string
          updated_at?: string
          wallet_enabled?: boolean
        }
        Update: {
          id?: string
          order_fee?: number
          shipping_endpoint?: string
          subscription_currency?: string
          subscription_price?: number
          system_name?: string
          updated_at?: string
          wallet_enabled?: boolean
        }
        Relationships: []
      }
      carrier_status_mappings: {
        Row: {
          category: string | null
          color: string
          created_at: string
          custom_label: string
          id: string
          owner_id: string
          sort_order: number
          status_code: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          color?: string
          created_at?: string
          custom_label: string
          id?: string
          owner_id: string
          sort_order?: number
          status_code: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          color?: string
          created_at?: string
          custom_label?: string
          id?: string
          owner_id?: string
          sort_order?: number
          status_code?: string
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
      expense_types: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          created_at: string
          expense_type_id: string | null
          id: string
          notes: string | null
          owner_id: string
          product_id: string | null
          safe_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          expense_type_id?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          product_id?: string | null
          safe_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expense_type_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          safe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_expense_type_id_fkey"
            columns: ["expense_type_id"]
            isOneToOne: false
            referencedRelation: "expense_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_safe_id_fkey"
            columns: ["safe_id"]
            isOneToOne: false
            referencedRelation: "safes"
            referencedColumns: ["id"]
          },
        ]
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
      hidden_default_carrier_codes: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          status_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          status_code: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          status_code?: string
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
      order_confirmation_attempts: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_id: string
          owner_id: string
          result: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          owner_id: string
          result: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          owner_id?: string
          result?: string
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
          carrier_cancellation_reason_id: string | null
          carrier_notes: string | null
          carrier_status: string | null
          carrier_status_raw: Json | null
          carrier_status_updated_at: string | null
          city: string
          confirmation_attempts: number
          confirmation_notes: string | null
          confirmation_status: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          customer_name: string
          id: string
          is_deleted: boolean
          link_error: string | null
          locked_insufficient_balance: boolean
          matched_area_id: number | null
          matched_area_name: string | null
          matched_zone_id: number | null
          matched_zone_name: string | null
          owner_id: string
          phone: string
          postponed_until: string | null
          price: number
          product_id: string | null
          product_name: string
          quantity: number
          selected_color: string | null
          selected_product_code: string | null
          selected_size: string | null
          settlement_received: boolean
          settlement_received_at: string | null
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
          carrier_cancellation_reason_id?: string | null
          carrier_notes?: string | null
          carrier_status?: string | null
          carrier_status_raw?: Json | null
          carrier_status_updated_at?: string | null
          city: string
          confirmation_attempts?: number
          confirmation_notes?: string | null
          confirmation_status?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_name: string
          id?: string
          is_deleted?: boolean
          link_error?: string | null
          locked_insufficient_balance?: boolean
          matched_area_id?: number | null
          matched_area_name?: string | null
          matched_zone_id?: number | null
          matched_zone_name?: string | null
          owner_id: string
          phone: string
          postponed_until?: string | null
          price: number
          product_id?: string | null
          product_name: string
          quantity?: number
          selected_color?: string | null
          selected_product_code?: string | null
          selected_size?: string | null
          settlement_received?: boolean
          settlement_received_at?: string | null
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
          carrier_cancellation_reason_id?: string | null
          carrier_notes?: string | null
          carrier_status?: string | null
          carrier_status_raw?: Json | null
          carrier_status_updated_at?: string | null
          city?: string
          confirmation_attempts?: number
          confirmation_notes?: string | null
          confirmation_status?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_name?: string
          id?: string
          is_deleted?: boolean
          link_error?: string | null
          locked_insufficient_balance?: boolean
          matched_area_id?: number | null
          matched_area_name?: string | null
          matched_zone_id?: number | null
          matched_zone_name?: string | null
          owner_id?: string
          phone?: string
          postponed_until?: string | null
          price?: number
          product_id?: string | null
          product_name?: string
          quantity?: number
          selected_color?: string | null
          selected_product_code?: string | null
          selected_size?: string | null
          settlement_received?: boolean
          settlement_received_at?: string | null
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
          deleted_at: string | null
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
          upsell_enabled: boolean
          upsell_offers: Json
          variant_easyorders_ids: Json
          variant_stock: Json
          variant_warehouse_codes: Json
          warehouse_linked: boolean
        }
        Insert: {
          colors?: string[] | null
          created_at?: string
          deleted_at?: string | null
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
          upsell_enabled?: boolean
          upsell_offers?: Json
          variant_easyorders_ids?: Json
          variant_stock?: Json
          variant_warehouse_codes?: Json
          warehouse_linked?: boolean
        }
        Update: {
          colors?: string[] | null
          created_at?: string
          deleted_at?: string | null
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
          upsell_enabled?: boolean
          upsell_offers?: Json
          variant_easyorders_ids?: Json
          variant_stock?: Json
          variant_warehouse_codes?: Json
          warehouse_linked?: boolean
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
      purchases: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          owner_id: string
          product_id: string | null
          safe_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          product_id?: string | null
          safe_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          safe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_safe_id_fkey"
            columns: ["safe_id"]
            isOneToOne: false
            referencedRelation: "safes"
            referencedColumns: ["id"]
          },
        ]
      }
      recharge_cards: {
        Row: {
          batch_id: string | null
          batch_label: string | null
          code: string
          created_at: string
          id: string
          used: boolean
          used_at: string | null
          used_by: string | null
          value: number
        }
        Insert: {
          batch_id?: string | null
          batch_label?: string | null
          code: string
          created_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
          value: number
        }
        Update: {
          batch_id?: string | null
          batch_label?: string | null
          code?: string
          created_at?: string
          id?: string
          used?: boolean
          used_at?: string | null
          used_by?: string | null
          value?: number
        }
        Relationships: []
      }
      return_shipments: {
        Row: {
          area_name: string | null
          collected_fees: number
          created_at: string
          delivered_amount: number
          delivered_or_returned_date: string | null
          external_shipment_id: number | null
          id: string
          order_id: string | null
          owner_id: string
          paid_amount: number
          pieces_count: number
          raw: Json | null
          recipient_name: string | null
          recipient_phone: string | null
          ref_number: string | null
          return_id: string
          shipment_code: string
          shipment_date: string | null
          status_code: string | null
          status_name: string | null
          weight: number
          zone_name: string | null
        }
        Insert: {
          area_name?: string | null
          collected_fees?: number
          created_at?: string
          delivered_amount?: number
          delivered_or_returned_date?: string | null
          external_shipment_id?: number | null
          id?: string
          order_id?: string | null
          owner_id: string
          paid_amount?: number
          pieces_count?: number
          raw?: Json | null
          recipient_name?: string | null
          recipient_phone?: string | null
          ref_number?: string | null
          return_id: string
          shipment_code: string
          shipment_date?: string | null
          status_code?: string | null
          status_name?: string | null
          weight?: number
          zone_name?: string | null
        }
        Update: {
          area_name?: string | null
          collected_fees?: number
          created_at?: string
          delivered_amount?: number
          delivered_or_returned_date?: string | null
          external_shipment_id?: number | null
          id?: string
          order_id?: string | null
          owner_id?: string
          paid_amount?: number
          pieces_count?: number
          raw?: Json | null
          recipient_name?: string | null
          recipient_phone?: string | null
          ref_number?: string | null
          return_id?: string
          shipment_code?: string
          shipment_date?: string | null
          status_code?: string | null
          status_name?: string | null
          weight?: number
          zone_name?: string | null
        }
        Relationships: []
      }
      returns: {
        Row: {
          approved: boolean
          code: string
          created_at: string
          customer_name: string | null
          delivered_amount: number
          due_fees: number
          external_id: number
          id: string
          notes: string | null
          owner_id: string
          payment_amount: number
          pieces_count: number
          raw: Json | null
          received: boolean
          received_at: string | null
          return_date: string | null
          safe_name: string | null
          shipment_count: number
          shipments_synced_at: string | null
          transaction_type: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean
          code: string
          created_at?: string
          customer_name?: string | null
          delivered_amount?: number
          due_fees?: number
          external_id: number
          id?: string
          notes?: string | null
          owner_id: string
          payment_amount?: number
          pieces_count?: number
          raw?: Json | null
          received?: boolean
          received_at?: string | null
          return_date?: string | null
          safe_name?: string | null
          shipment_count?: number
          shipments_synced_at?: string | null
          transaction_type?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean
          code?: string
          created_at?: string
          customer_name?: string | null
          delivered_amount?: number
          due_fees?: number
          external_id?: number
          id?: string
          notes?: string | null
          owner_id?: string
          payment_amount?: number
          pieces_count?: number
          raw?: Json | null
          received?: boolean
          received_at?: string | null
          return_date?: string | null
          safe_name?: string | null
          shipment_count?: number
          shipments_synced_at?: string | null
          transaction_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      safe_movements: {
        Row: {
          amount: number
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          owner_id: string
          reference_id: string | null
          safe_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          movement_type: string
          notes?: string | null
          owner_id: string
          reference_id?: string | null
          safe_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          owner_id?: string
          reference_id?: string | null
          safe_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "safe_movements_safe_id_fkey"
            columns: ["safe_id"]
            isOneToOne: false
            referencedRelation: "safes"
            referencedColumns: ["id"]
          },
        ]
      }
      safes: {
        Row: {
          balance: number
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      settlement_shipments: {
        Row: {
          area_name: string | null
          collected_fees: number
          created_at: string
          delivered_amount: number
          delivered_or_returned_date: string | null
          external_shipment_id: number | null
          id: string
          order_id: string | null
          owner_id: string
          paid_amount: number
          pieces_count: number
          raw: Json | null
          recipient_name: string | null
          recipient_phone: string | null
          ref_number: string | null
          settlement_id: string
          shipment_code: string
          shipment_date: string | null
          status_code: string | null
          status_name: string | null
          weight: number
          zone_name: string | null
        }
        Insert: {
          area_name?: string | null
          collected_fees?: number
          created_at?: string
          delivered_amount?: number
          delivered_or_returned_date?: string | null
          external_shipment_id?: number | null
          id?: string
          order_id?: string | null
          owner_id: string
          paid_amount?: number
          pieces_count?: number
          raw?: Json | null
          recipient_name?: string | null
          recipient_phone?: string | null
          ref_number?: string | null
          settlement_id: string
          shipment_code: string
          shipment_date?: string | null
          status_code?: string | null
          status_name?: string | null
          weight?: number
          zone_name?: string | null
        }
        Update: {
          area_name?: string | null
          collected_fees?: number
          created_at?: string
          delivered_amount?: number
          delivered_or_returned_date?: string | null
          external_shipment_id?: number | null
          id?: string
          order_id?: string | null
          owner_id?: string
          paid_amount?: number
          pieces_count?: number
          raw?: Json | null
          recipient_name?: string | null
          recipient_phone?: string | null
          ref_number?: string | null
          settlement_id?: string
          shipment_code?: string
          shipment_date?: string | null
          status_code?: string | null
          status_name?: string | null
          weight?: number
          zone_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "settlement_shipments_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          approved: boolean
          code: string
          created_at: string
          customer_name: string | null
          delivered_amount: number
          due_fees: number
          external_id: number
          id: string
          notes: string | null
          owner_id: string
          payment_amount: number
          pieces_count: number
          raw: Json | null
          received: boolean
          received_at: string | null
          safe_id: string | null
          safe_name: string | null
          settlement_date: string | null
          shipment_count: number
          shipments_synced_at: string | null
          transaction_type: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean
          code: string
          created_at?: string
          customer_name?: string | null
          delivered_amount?: number
          due_fees?: number
          external_id: number
          id?: string
          notes?: string | null
          owner_id: string
          payment_amount?: number
          pieces_count?: number
          raw?: Json | null
          received?: boolean
          received_at?: string | null
          safe_id?: string | null
          safe_name?: string | null
          settlement_date?: string | null
          shipment_count?: number
          shipments_synced_at?: string | null
          transaction_type?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean
          code?: string
          created_at?: string
          customer_name?: string | null
          delivered_amount?: number
          due_fees?: number
          external_id?: number
          id?: string
          notes?: string | null
          owner_id?: string
          payment_amount?: number
          pieces_count?: number
          raw?: Json | null
          received?: boolean
          received_at?: string | null
          safe_id?: string | null
          safe_name?: string | null
          settlement_date?: string | null
          shipment_count?: number
          shipments_synced_at?: string | null
          transaction_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_safe_id_fkey"
            columns: ["safe_id"]
            isOneToOne: false
            referencedRelation: "safes"
            referencedColumns: ["id"]
          },
        ]
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
          stock: number
          synced_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          external_id: number
          id?: string
          name?: string | null
          owner_id: string
          stock?: number
          synced_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          external_id?: number
          id?: string
          name?: string | null
          owner_id?: string
          stock?: number
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
      sticker_settings: {
        Row: {
          created_at: string
          fields: Json
          font_size: number
          footer_text: string
          header_text: string
          id: string
          owner_id: string
          page_height_mm: number
          page_width_mm: number
          show_barcode: boolean
          show_logo: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          fields?: Json
          font_size?: number
          footer_text?: string
          header_text?: string
          id?: string
          owner_id: string
          page_height_mm?: number
          page_width_mm?: number
          show_barcode?: boolean
          show_logo?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          fields?: Json
          font_size?: number
          footer_text?: string
          header_text?: string
          id?: string
          owner_id?: string
          page_height_mm?: number
          page_width_mm?: number
          show_barcode?: boolean
          show_logo?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          order_id: string | null
          owner_id: string
          product_id: string | null
          product_name: string | null
          qty: number
          reason: string
          return_id: string | null
          variant_key: string | null
          warehouse_code: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          owner_id: string
          product_id?: string | null
          product_name?: string | null
          qty: number
          reason: string
          return_id?: string | null
          variant_key?: string | null
          warehouse_code?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          owner_id?: string
          product_id?: string | null
          product_name?: string | null
          qty?: number
          reason?: string
          return_id?: string | null
          variant_key?: string | null
          warehouse_code?: string | null
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
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          reference_id: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          reference_id?: string | null
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_conversations: {
        Row: {
          created_at: string
          customer_name: string | null
          id: string
          last_message_at: string
          last_message_preview: string | null
          order_id: string | null
          owner_id: string
          phone: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_name?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          order_id?: string | null
          owner_id: string
          phone: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_name?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          order_id?: string | null
          owner_id?: string
          phone?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          direction: string
          error: string | null
          green_message_id: string | null
          id: string
          media_filename: string | null
          media_mime: string | null
          media_url: string | null
          message_type: string
          order_id: string | null
          owner_id: string
          raw: Json | null
          status: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error?: string | null
          green_message_id?: string | null
          id?: string
          media_filename?: string | null
          media_mime?: string | null
          media_url?: string | null
          message_type?: string
          order_id?: string | null
          owner_id: string
          raw?: Json | null
          status?: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error?: string | null
          green_message_id?: string | null
          id?: string
          media_filename?: string | null
          media_mime?: string | null
          media_url?: string | null
          message_type?: string
          order_id?: string | null
          owner_id?: string
          raw?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          ai_auto_reply_enabled: boolean
          api_token: string
          api_url: string
          auto_confirm_enabled: boolean
          confirm_template: string
          created_at: string
          enabled: boolean
          id: string
          instance_id: string
          owner_id: string
          updated_at: string
          webhook_token: string | null
          welcome_template: string
        }
        Insert: {
          ai_auto_reply_enabled?: boolean
          api_token?: string
          api_url?: string
          auto_confirm_enabled?: boolean
          confirm_template?: string
          created_at?: string
          enabled?: boolean
          id?: string
          instance_id?: string
          owner_id: string
          updated_at?: string
          webhook_token?: string | null
          welcome_template?: string
        }
        Update: {
          ai_auto_reply_enabled?: boolean
          api_token?: string
          api_url?: string
          auto_confirm_enabled?: boolean
          confirm_template?: string
          created_at?: string
          enabled?: boolean
          id?: string
          instance_id?: string
          owner_id?: string
          updated_at?: string
          webhook_token?: string | null
          welcome_template?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_recharge_cards: {
        Args: { _count: number; _label?: string; _value: number }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_subscription_active: { Args: { _user_id: string }; Returns: boolean }
      redeem_card: { Args: { _code: string }; Returns: Json }
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
