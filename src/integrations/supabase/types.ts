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
      ad_spends: {
        Row: {
          amount_foreign: number
          amount_local: number
          campaign_name: string | null
          cost_rate: number
          created_at: string
          created_by: string | null
          fb_campaign_id: string | null
          id: string
          notes: string | null
          owner_id: string
          product_id: string | null
          spend_date: string
          store_id: string | null
          wallet_id: string
        }
        Insert: {
          amount_foreign: number
          amount_local: number
          campaign_name?: string | null
          cost_rate: number
          created_at?: string
          created_by?: string | null
          fb_campaign_id?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          product_id?: string | null
          spend_date?: string
          store_id?: string | null
          wallet_id: string
        }
        Update: {
          amount_foreign?: number
          amount_local?: number
          campaign_name?: string | null
          cost_rate?: number
          created_at?: string
          created_by?: string | null
          fb_campaign_id?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          spend_date?: string
          store_id?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_spends_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "ad_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_wallet_topups: {
        Row: {
          amount_foreign: number
          amount_local: number
          created_at: string
          created_by: string | null
          exchange_rate: number
          id: string
          notes: string | null
          owner_id: string
          safe_id: string
          store_id: string | null
          wallet_id: string
        }
        Insert: {
          amount_foreign: number
          amount_local: number
          created_at?: string
          created_by?: string | null
          exchange_rate: number
          id?: string
          notes?: string | null
          owner_id: string
          safe_id: string
          store_id?: string | null
          wallet_id: string
        }
        Update: {
          amount_foreign?: number
          amount_local?: number
          created_at?: string
          created_by?: string | null
          exchange_rate?: number
          id?: string
          notes?: string | null
          owner_id?: string
          safe_id?: string
          store_id?: string | null
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_wallet_topups_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "ad_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_wallets: {
        Row: {
          avg_cost_rate: number
          balance: number
          created_at: string
          currency: string
          id: string
          is_active: boolean
          name: string
          owner_id: string
          platform: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          avg_cost_rate?: number
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name: string
          owner_id: string
          platform?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          avg_cost_rate?: number
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          name?: string
          owner_id?: string
          platform?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_type: string
          fb_ad_id: string | null
          fb_adset_id: string | null
          fb_campaign_id: string | null
          fbclid: string | null
          id: string
          owner_id: string | null
          product_slug: string | null
          store_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_campaign_id?: string | null
          fbclid?: string | null
          id?: string
          owner_id?: string | null
          product_slug?: string | null
          store_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_campaign_id?: string | null
          fbclid?: string | null
          id?: string
          owner_id?: string | null
          product_slug?: string | null
          store_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
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
      cancellation_reasons: {
        Row: {
          created_at: string
          id: string
          label: string
          owner_id: string
          sort_order: number
          store_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          owner_id: string
          sort_order?: number
          store_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          owner_id?: string
          sort_order?: number
          store_id?: string | null
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          store_id: string | null
        }
        Insert: {
          area: string
          city: string
          created_at?: string
          id?: string
          input_text?: string | null
          owner_id: string
          store_id?: string | null
        }
        Update: {
          area?: string
          city?: string
          created_at?: string
          id?: string
          input_text?: string | null
          owner_id?: string
          store_id?: string | null
        }
        Relationships: []
      }
      confirmation_settings: {
        Row: {
          auto_assign_enabled: boolean
          auto_cancel_after_hours: number
          max_no_answer_attempts: number
          owner_id: string
          store_id: string | null
          updated_at: string
          work_hours_end: string
          work_hours_start: string
        }
        Insert: {
          auto_assign_enabled?: boolean
          auto_cancel_after_hours?: number
          max_no_answer_attempts?: number
          owner_id: string
          store_id?: string | null
          updated_at?: string
          work_hours_end?: string
          work_hours_start?: string
        }
        Update: {
          auto_assign_enabled?: boolean
          auto_cancel_after_hours?: number
          max_no_answer_attempts?: number
          owner_id?: string
          store_id?: string | null
          updated_at?: string
          work_hours_end?: string
          work_hours_start?: string
        }
        Relationships: []
      }
      confirmation_templates: {
        Row: {
          body: string
          channel: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          owner_id: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          store_id?: string | null
          updated_at?: string
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
          synced_at?: string
          variants?: Json
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      expense_types: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          store_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          store_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          store_id?: string | null
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
      facebook_app_config: {
        Row: {
          app_id: string | null
          app_secret: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          app_id?: string | null
          app_secret?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          app_id?: string | null
          app_secret?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      facebook_oauth_states: {
        Row: {
          created_at: string
          owner_id: string
          store_id: string
          token: string
        }
        Insert: {
          created_at?: string
          owner_id: string
          store_id: string
          token: string
        }
        Update: {
          created_at?: string
          owner_id?: string
          store_id?: string
          token?: string
        }
        Relationships: []
      }
      fb_ads: {
        Row: {
          creative_thumbnail_url: string | null
          fb_ad_id: string
          fb_adset_id: string | null
          fb_adset_name: string | null
          fb_campaign_id: string | null
          id: string
          landing_url: string | null
          name: string | null
          owner_id: string
          status: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          creative_thumbnail_url?: string | null
          fb_ad_id: string
          fb_adset_id?: string | null
          fb_adset_name?: string | null
          fb_campaign_id?: string | null
          id?: string
          landing_url?: string | null
          name?: string | null
          owner_id: string
          status?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          creative_thumbnail_url?: string | null
          fb_ad_id?: string
          fb_adset_id?: string | null
          fb_adset_name?: string | null
          fb_campaign_id?: string | null
          id?: string
          landing_url?: string | null
          name?: string | null
          owner_id?: string
          status?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fb_campaigns: {
        Row: {
          created_time: string | null
          daily_budget: number | null
          fb_campaign_id: string
          id: string
          lifetime_budget: number | null
          name: string | null
          objective: string | null
          owner_id: string
          start_time: string | null
          status: string | null
          stop_time: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_time?: string | null
          daily_budget?: number | null
          fb_campaign_id: string
          id?: string
          lifetime_budget?: number | null
          name?: string | null
          objective?: string | null
          owner_id: string
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_time?: string | null
          daily_budget?: number | null
          fb_campaign_id?: string
          id?: string
          lifetime_budget?: number | null
          name?: string | null
          objective?: string | null
          owner_id?: string
          start_time?: string | null
          status?: string | null
          stop_time?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fb_insights_daily: {
        Row: {
          actions: Json | null
          clicks: number
          cpc: number | null
          cpm: number | null
          ctr: number | null
          date: string
          fb_ad_id: string | null
          fb_adset_id: string | null
          fb_campaign_id: string | null
          id: string
          impressions: number
          owner_id: string
          reach: number
          spend: number
          store_id: string
          updated_at: string
        }
        Insert: {
          actions?: Json | null
          clicks?: number
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          date: string
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_campaign_id?: string | null
          id?: string
          impressions?: number
          owner_id: string
          reach?: number
          spend?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          actions?: Json | null
          clicks?: number
          cpc?: number | null
          cpm?: number | null
          ctr?: number | null
          date?: string
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_campaign_id?: string | null
          id?: string
          impressions?: number
          owner_id?: string
          reach?: number
          spend?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      fb_sync_log: {
        Row: {
          ads_synced: number | null
          campaigns_synced: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          insights_synced: number | null
          owner_id: string
          started_at: string
          status: string
          store_id: string
        }
        Insert: {
          ads_synced?: number | null
          campaigns_synced?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          insights_synced?: number | null
          owner_id: string
          started_at?: string
          status?: string
          store_id: string
        }
        Update: {
          ads_synced?: number | null
          campaigns_synced?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          insights_synced?: number | null
          owner_id?: string
          started_at?: string
          status?: string
          store_id?: string
        }
        Relationships: []
      }
      form_field_catalog: {
        Row: {
          admin_enabled: boolean
          created_at: string
          default_placeholder: string
          default_required: boolean
          field_key: string
          field_type: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          admin_enabled?: boolean
          created_at?: string
          default_placeholder?: string
          default_required?: boolean
          field_key: string
          field_type?: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          admin_enabled?: boolean
          created_at?: string
          default_placeholder?: string
          default_required?: boolean
          field_key?: string
          field_type?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      header_settings: {
        Row: {
          bg_color: string | null
          created_at: string
          email: string | null
          facebook_url: string | null
          gallery_images: Json
          hero_image: string | null
          hero_subtitle: string | null
          hero_title: string | null
          id: string
          instagram_url: string | null
          logo_image: string | null
          logo_text: string
          owner_id: string
          phone: string | null
          show_search: boolean
          store_id: string | null
          tagline: string | null
          template: string
          tiktok_url: string | null
          updated_at: string
          whatsapp_url: string | null
        }
        Insert: {
          bg_color?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          gallery_images?: Json
          hero_image?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          instagram_url?: string | null
          logo_image?: string | null
          logo_text?: string
          owner_id: string
          phone?: string | null
          show_search?: boolean
          store_id?: string | null
          tagline?: string | null
          template?: string
          tiktok_url?: string | null
          updated_at?: string
          whatsapp_url?: string | null
        }
        Update: {
          bg_color?: string | null
          created_at?: string
          email?: string | null
          facebook_url?: string | null
          gallery_images?: Json
          hero_image?: string | null
          hero_subtitle?: string | null
          hero_title?: string | null
          id?: string
          instagram_url?: string | null
          logo_image?: string | null
          logo_text?: string
          owner_id?: string
          phone?: string | null
          show_search?: boolean
          store_id?: string | null
          tagline?: string | null
          template?: string
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
          store_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          status_code: string
          store_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          status_code?: string
          store_id?: string | null
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
          store_id: string | null
        }
        Insert: {
          area: string
          city: string
          created_at?: string
          id?: string
          owner_id: string
          store_id?: string | null
        }
        Update: {
          area?: string
          city?: string
          created_at?: string
          id?: string
          owner_id?: string
          store_id?: string | null
        }
        Relationships: []
      }
      home_page_sections: {
        Row: {
          config: Json
          created_at: string
          id: string
          is_visible: boolean
          owner_id: string
          position: number
          puck_data: Json | null
          section_type: string
          store_id: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          id?: string
          is_visible?: boolean
          owner_id: string
          position?: number
          puck_data?: Json | null
          section_type: string
          store_id: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          id?: string
          is_visible?: boolean
          owner_id?: string
          position?: number
          puck_data?: Json | null
          section_type?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "home_page_sections_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_page_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          puck_data: Json | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          owner_id: string
          puck_data?: Json | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          puck_data?: Json | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      landing_pages: {
        Row: {
          created_at: string
          description: string | null
          faqs: Json
          id: string
          images: string[]
          is_visible: boolean
          order_form_on_top: boolean
          original_price: number | null
          owner_id: string
          price: number | null
          product_id: string
          puck_data: Json | null
          show_quantity: boolean
          size_chart: Json
          slug: string
          store_id: string | null
          subtitle: string | null
          template_id: string | null
          title: string
          updated_at: string
          upsell_enabled: boolean
          upsell_offers: Json
          upsell_title: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          faqs?: Json
          id?: string
          images?: string[]
          is_visible?: boolean
          order_form_on_top?: boolean
          original_price?: number | null
          owner_id: string
          price?: number | null
          product_id: string
          puck_data?: Json | null
          show_quantity?: boolean
          size_chart?: Json
          slug: string
          store_id?: string | null
          subtitle?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          upsell_enabled?: boolean
          upsell_offers?: Json
          upsell_title?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          faqs?: Json
          id?: string
          images?: string[]
          is_visible?: boolean
          order_form_on_top?: boolean
          original_price?: number | null
          owner_id?: string
          price?: number | null
          product_id?: string
          puck_data?: Json | null
          show_quantity?: boolean
          size_chart?: Json
          slug?: string
          store_id?: string | null
          subtitle?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          upsell_enabled?: boolean
          upsell_offers?: Json
          upsell_title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "landing_pages_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
          store_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          owner_id: string
          result: string
          store_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          owner_id?: string
          result?: string
          store_id?: string | null
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          assigned_to: string | null
          cancellation_reason: string | null
          carrier_cancellation_reason_id: string | null
          carrier_notes: string | null
          carrier_status: string | null
          carrier_status_raw: Json | null
          carrier_status_updated_at: string | null
          city: string
          client_ip: string | null
          confirmation_attempts: number
          confirmation_notes: string | null
          confirmation_status: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          customer_name: string
          fb_ad_id: string | null
          fb_adset_id: string | null
          fb_campaign_id: string | null
          fbclid: string | null
          id: string
          insufficient_stock: boolean
          is_deleted: boolean
          landing_slug: string | null
          last_attempt_at: string | null
          link_error: string | null
          locked_insufficient_balance: boolean
          matched_area_id: number | null
          matched_area_name: string | null
          matched_zone_id: number | null
          matched_zone_name: string | null
          order_code: string | null
          owner_id: string
          phone: string
          postponed_until: string | null
          prep_status: string
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
          store_id: string | null
          updated_at: string
          upsell_offers: Json
          user_agent: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          address: string
          assigned_to?: string | null
          cancellation_reason?: string | null
          carrier_cancellation_reason_id?: string | null
          carrier_notes?: string | null
          carrier_status?: string | null
          carrier_status_raw?: Json | null
          carrier_status_updated_at?: string | null
          city: string
          client_ip?: string | null
          confirmation_attempts?: number
          confirmation_notes?: string | null
          confirmation_status?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_name: string
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_campaign_id?: string | null
          fbclid?: string | null
          id?: string
          insufficient_stock?: boolean
          is_deleted?: boolean
          landing_slug?: string | null
          last_attempt_at?: string | null
          link_error?: string | null
          locked_insufficient_balance?: boolean
          matched_area_id?: number | null
          matched_area_name?: string | null
          matched_zone_id?: number | null
          matched_zone_name?: string | null
          order_code?: string | null
          owner_id: string
          phone: string
          postponed_until?: string | null
          prep_status?: string
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
          store_id?: string | null
          updated_at?: string
          upsell_offers?: Json
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          address?: string
          assigned_to?: string | null
          cancellation_reason?: string | null
          carrier_cancellation_reason_id?: string | null
          carrier_notes?: string | null
          carrier_status?: string | null
          carrier_status_raw?: Json | null
          carrier_status_updated_at?: string | null
          city?: string
          client_ip?: string | null
          confirmation_attempts?: number
          confirmation_notes?: string | null
          confirmation_status?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          customer_name?: string
          fb_ad_id?: string | null
          fb_adset_id?: string | null
          fb_campaign_id?: string | null
          fbclid?: string | null
          id?: string
          insufficient_stock?: boolean
          is_deleted?: boolean
          landing_slug?: string | null
          last_attempt_at?: string | null
          link_error?: string | null
          locked_insufficient_balance?: boolean
          matched_area_id?: number | null
          matched_area_name?: string | null
          matched_zone_id?: number | null
          matched_zone_name?: string | null
          order_code?: string | null
          owner_id?: string
          phone?: string
          postponed_until?: string | null
          prep_status?: string
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
          store_id?: string | null
          updated_at?: string
          upsell_offers?: Json
          user_agent?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
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
      permission_group_items: {
        Row: {
          group_id: string
          permission_key: string
        }
        Insert: {
          group_id: string
          permission_key: string
        }
        Update: {
          group_id?: string
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "permission_group_items_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permission_group_items_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      permission_groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          key: string
          label: string
        }
        Insert: {
          category: string
          created_at?: string
          key: string
          label: string
        }
        Update: {
          category?: string
          created_at?: string
          key?: string
          label?: string
        }
        Relationships: []
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
          tiktok_enabled?: boolean | null
          tiktok_pixel_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      prep_list_orders: {
        Row: {
          created_at: string
          id: string
          list_id: string
          order_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          order_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          order_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_list_orders_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "prep_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_list_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_lists: {
        Row: {
          confirmed_at: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          owner_id: string
          status: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          owner_id: string
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          owner_id?: string
          status?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          sort_order: number
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          sort_order?: number
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          sort_order?: number
          store_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category_id: string | null
          colors: string[] | null
          created_at: string
          deleted_at: string | null
          description: string | null
          easyorders_product_id: string | null
          id: string
          images: string[] | null
          is_visible: boolean
          name: string
          order_form_on_top: boolean
          original_price: number | null
          owner_id: string
          price: number
          product_codes: string[] | null
          purchase_price: number
          reviews: Json
          size_chart_url: string | null
          sizes: string[] | null
          slug: string
          stock: number
          store_id: string | null
          updated_at: string
          upsell_enabled: boolean
          upsell_offers: Json
          upsell_title: string
          variant_easyorders_ids: Json
          variant_skus: Json
          variant_stock: Json
          variant_warehouse_codes: Json
          warehouse_linked: boolean
        }
        Insert: {
          category_id?: string | null
          colors?: string[] | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          easyorders_product_id?: string | null
          id?: string
          images?: string[] | null
          is_visible?: boolean
          name: string
          order_form_on_top?: boolean
          original_price?: number | null
          owner_id: string
          price: number
          product_codes?: string[] | null
          purchase_price?: number
          reviews?: Json
          size_chart_url?: string | null
          sizes?: string[] | null
          slug: string
          stock?: number
          store_id?: string | null
          updated_at?: string
          upsell_enabled?: boolean
          upsell_offers?: Json
          upsell_title?: string
          variant_easyorders_ids?: Json
          variant_skus?: Json
          variant_stock?: Json
          variant_warehouse_codes?: Json
          warehouse_linked?: boolean
        }
        Update: {
          category_id?: string | null
          colors?: string[] | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          easyorders_product_id?: string | null
          id?: string
          images?: string[] | null
          is_visible?: boolean
          name?: string
          order_form_on_top?: boolean
          original_price?: number | null
          owner_id?: string
          price?: number
          product_codes?: string[] | null
          purchase_price?: number
          reviews?: Json
          size_chart_url?: string | null
          sizes?: string[] | null
          slug?: string
          stock?: number
          store_id?: string | null
          updated_at?: string
          upsell_enabled?: boolean
          upsell_offers?: Json
          upsell_title?: string
          variant_easyorders_ids?: Json
          variant_skus?: Json
          variant_stock?: Json
          variant_warehouse_codes?: Json
          warehouse_linked?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          easyorders_api_key: string | null
          easyorders_enabled: boolean
          full_name: string | null
          id: string
          is_active: boolean
          strict_stock_enabled: boolean
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
          easyorders_enabled?: boolean
          full_name?: string | null
          id?: string
          is_active?: boolean
          strict_stock_enabled?: boolean
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
          easyorders_enabled?: boolean
          full_name?: string | null
          id?: string
          is_active?: boolean
          strict_stock_enabled?: boolean
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
          store_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          owner_id: string
          product_id?: string | null
          safe_id: string
          store_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          owner_id?: string
          product_id?: string | null
          safe_id?: string
          store_id?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          store_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          store_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          store_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
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
      rejected_orders: {
        Row: {
          address: string | null
          city: string | null
          client_ip: string | null
          created_at: string
          customer_name: string | null
          elapsed_ms: number | null
          honeypot_value: string | null
          id: string
          landing_slug: string | null
          owner_id: string | null
          payload: Json | null
          phone: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          reason: string
          store_id: string | null
          user_agent: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_ip?: string | null
          created_at?: string
          customer_name?: string | null
          elapsed_ms?: number | null
          honeypot_value?: string | null
          id?: string
          landing_slug?: string | null
          owner_id?: string | null
          payload?: Json | null
          phone?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          reason: string
          store_id?: string | null
          user_agent?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          client_ip?: string | null
          created_at?: string
          customer_name?: string | null
          elapsed_ms?: number | null
          honeypot_value?: string | null
          id?: string
          landing_slug?: string | null
          owner_id?: string | null
          payload?: Json | null
          phone?: string | null
          product_id?: string | null
          product_name?: string | null
          quantity?: number | null
          reason?: string
          store_id?: string | null
          user_agent?: string | null
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          store_id: string | null
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          store_id?: string | null
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          deposit_ref_id: string | null
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
          reversal_ref_id: string | null
          safe_id: string | null
          safe_name: string | null
          settlement_date: string | null
          shipment_count: number
          shipments_synced_at: string | null
          store_id: string | null
          transaction_type: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean
          code: string
          created_at?: string
          customer_name?: string | null
          delivered_amount?: number
          deposit_ref_id?: string | null
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
          reversal_ref_id?: string | null
          safe_id?: string | null
          safe_name?: string | null
          settlement_date?: string | null
          shipment_count?: number
          shipments_synced_at?: string | null
          store_id?: string | null
          transaction_type?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean
          code?: string
          created_at?: string
          customer_name?: string | null
          delivered_amount?: number
          deposit_ref_id?: string | null
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
          reversal_ref_id?: string | null
          safe_id?: string | null
          safe_name?: string | null
          settlement_date?: string | null
          shipment_count?: number
          shipments_synced_at?: string | null
          store_id?: string | null
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
      shipping_error_aliases: {
        Row: {
          created_at: string
          id: string
          match_type: string
          pattern: string
          short_label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_type?: string
          pattern: string
          short_label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          match_type?: string
          pattern?: string
          short_label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      shipping_price_lists: {
        Row: {
          cities: string
          created_at: string
          duration: string | null
          id: string
          price: number
          region: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          cities: string
          created_at?: string
          duration?: string | null
          id?: string
          price?: number
          region: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          cities?: string
          created_at?: string
          duration?: string | null
          id?: string
          price?: number
          region?: string
          sort_order?: number
          updated_at?: string
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
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
          store_id: string | null
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
          store_id?: string | null
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
          store_id?: string | null
          synced_at?: string
        }
        Relationships: []
      }
      shipping_zones: {
        Row: {
          created_at: string
          display_name: string | null
          external_id: number
          id: string
          kind: string
          name: string
          owner_id: string | null
          parent_external_id: number | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          external_id: number
          id?: string
          kind?: string
          name: string
          owner_id?: string | null
          parent_external_id?: number | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          external_id?: number
          id?: string
          kind?: string
          name?: string
          owner_id?: string | null
          parent_external_id?: number | null
          store_id?: string | null
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
          unit_price: number | null
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
          unit_price?: number | null
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
          unit_price?: number | null
          variant_key?: string | null
          warehouse_code?: string | null
        }
        Relationships: []
      }
      store_facebook_connections: {
        Row: {
          access_token: string
          ad_account_id: string | null
          ad_account_name: string | null
          connected_at: string
          fb_user_id: string | null
          fb_user_name: string | null
          id: string
          owner_id: string
          scopes: string | null
          store_id: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          ad_account_id?: string | null
          ad_account_name?: string | null
          connected_at?: string
          fb_user_id?: string | null
          fb_user_name?: string | null
          id?: string
          owner_id: string
          scopes?: string | null
          store_id: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          ad_account_id?: string | null
          ad_account_name?: string | null
          connected_at?: string
          fb_user_id?: string | null
          fb_user_name?: string | null
          id?: string
          owner_id?: string
          scopes?: string | null
          store_id?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_member_permissions: {
        Row: {
          member_id: string
          permission_key: string
        }
        Insert: {
          member_id: string
          permission_key: string
        }
        Update: {
          member_id?: string
          permission_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_member_permissions_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "store_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_member_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      store_member_stores: {
        Row: {
          created_at: string
          id: string
          member_id: string
          store_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          store_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_member_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_members: {
        Row: {
          created_at: string
          display_name: string | null
          group_id: string | null
          id: string
          member_user_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          group_id?: string | null
          id?: string
          member_user_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          group_id?: string | null
          id?: string
          member_user_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "permission_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      store_order_counters: {
        Row: {
          last_value: number
          store_id: string
        }
        Insert: {
          last_value?: number
          store_id: string
        }
        Update: {
          last_value?: number
          store_id?: string
        }
        Relationships: []
      }
      store_page_layouts: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          owner_id: string
          page_key: string
          puck_data: Json
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          owner_id: string
          page_key?: string
          puck_data?: Json
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          owner_id?: string
          page_key?: string
          puck_data?: Json
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_page_layouts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      store_settings: {
        Row: {
          button_text: string
          created_at: string
          currency_code: string
          currency_name: string
          currency_symbol: string
          id: string
          owner_id: string
          success_message: string
          updated_at: string
        }
        Insert: {
          button_text?: string
          created_at?: string
          currency_code?: string
          currency_name?: string
          currency_symbol?: string
          id?: string
          owner_id: string
          success_message?: string
          updated_at?: string
        }
        Update: {
          button_text?: string
          created_at?: string
          currency_code?: string
          currency_name?: string
          currency_symbol?: string
          id?: string
          owner_id?: string
          success_message?: string
          updated_at?: string
        }
        Relationships: []
      }
      store_sku_counters: {
        Row: {
          last_value: number
          store_id: string
        }
        Insert: {
          last_value?: number
          store_id: string
        }
        Update: {
          last_value?: number
          store_id?: string
        }
        Relationships: []
      }
      store_themes: {
        Row: {
          created_at: string
          custom_css: string | null
          custom_html: string | null
          description: string | null
          id: string
          is_template: boolean
          name: string
          owner_id: string
          puck_data: Json
          store_id: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_css?: string | null
          custom_html?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          name: string
          owner_id: string
          puck_data?: Json
          store_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_css?: string | null
          custom_html?: string | null
          description?: string | null
          id?: string
          is_template?: boolean
          name?: string
          owner_id?: string
          puck_data?: Json
          store_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          name: string
          owner_id: string
          push_enabled: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id: string
          push_enabled?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          owner_id?: string
          push_enabled?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      thank_you_settings: {
        Row: {
          contact_message: string
          created_at: string
          id: string
          owner_id: string
          shipping_message: string
          show_contact_info: boolean
          show_order_details: boolean
          subtitle: string
          title: string
          updated_at: string
        }
        Insert: {
          contact_message?: string
          created_at?: string
          id?: string
          owner_id: string
          shipping_message?: string
          show_contact_info?: boolean
          show_order_details?: boolean
          subtitle?: string
          title?: string
          updated_at?: string
        }
        Update: {
          contact_message?: string
          created_at?: string
          id?: string
          owner_id?: string
          shipping_message?: string
          show_contact_info?: boolean
          show_order_details?: boolean
          subtitle?: string
          title?: string
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
          auto_confirm_enabled: boolean
          confirm_template: string
          created_at: string
          enabled: boolean
          id: string
          owner_id: string
          provider: string
          updated_at: string
          wati_access_token: string
          wati_api_endpoint: string
          wati_broadcast_name: string
          wati_template_name: string
          wati_use_template: boolean
          welcome_template: string
          whatchimp_api_key: string
          whatchimp_api_url: string
          whatchimp_conversation_endpoint: string
          whatchimp_phone_number_id: string
          whatchimp_send_endpoint: string
          whatchimp_template_buttons: string | null
          whatchimp_template_endpoint: string
          whatchimp_template_id: string | null
          whatchimp_template_language: string
          whatchimp_template_name: string
          whatchimp_use_template: boolean
        }
        Insert: {
          ai_auto_reply_enabled?: boolean
          auto_confirm_enabled?: boolean
          confirm_template?: string
          created_at?: string
          enabled?: boolean
          id?: string
          owner_id: string
          provider?: string
          updated_at?: string
          wati_access_token?: string
          wati_api_endpoint?: string
          wati_broadcast_name?: string
          wati_template_name?: string
          wati_use_template?: boolean
          welcome_template?: string
          whatchimp_api_key?: string
          whatchimp_api_url?: string
          whatchimp_conversation_endpoint?: string
          whatchimp_phone_number_id?: string
          whatchimp_send_endpoint?: string
          whatchimp_template_buttons?: string | null
          whatchimp_template_endpoint?: string
          whatchimp_template_id?: string | null
          whatchimp_template_language?: string
          whatchimp_template_name?: string
          whatchimp_use_template?: boolean
        }
        Update: {
          ai_auto_reply_enabled?: boolean
          auto_confirm_enabled?: boolean
          confirm_template?: string
          created_at?: string
          enabled?: boolean
          id?: string
          owner_id?: string
          provider?: string
          updated_at?: string
          wati_access_token?: string
          wati_api_endpoint?: string
          wati_broadcast_name?: string
          wati_template_name?: string
          wati_use_template?: boolean
          welcome_template?: string
          whatchimp_api_key?: string
          whatchimp_api_url?: string
          whatchimp_conversation_endpoint?: string
          whatchimp_phone_number_id?: string
          whatchimp_send_endpoint?: string
          whatchimp_template_buttons?: string | null
          whatchimp_template_endpoint?: string
          whatchimp_template_id?: string | null
          whatchimp_template_language?: string
          whatchimp_template_name?: string
          whatchimp_use_template?: boolean
        }
        Relationships: []
      }
      whatsapp_token_stores: {
        Row: {
          created_at: string
          id: string
          store_id: string
          token_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          store_id: string
          token_id: string
        }
        Update: {
          created_at?: string
          id?: string
          store_id?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_token_stores_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_webhook_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_tokens: {
        Row: {
          created_at: string
          id: string
          label: string | null
          last_used_at: string | null
          owner_id: string
          provider: string
          token: string
        }
        Insert: {
          created_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          owner_id: string
          provider?: string
          token: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string | null
          last_used_at?: string | null
          owner_id?: string
          provider?: string
          token?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_order_code: { Args: never; Returns: string }
      generate_order_code_for_store: {
        Args: { _store_id: string }
        Returns: string
      }
      generate_recharge_cards: {
        Args: { _count: number; _label?: string; _value: number }
        Returns: Json
      }
      get_easyorders_enabled: { Args: never; Returns: boolean }
      get_effective_owner_id: { Args: { _uid: string }; Returns: string }
      get_owner_product_costs: {
        Args: { _product_ids?: string[] }
        Returns: {
          id: string
          purchase_price: number
        }[]
      }
      get_owner_profile_safe: {
        Args: { _owner_id: string }
        Returns: {
          full_name: string
          id: string
          is_active: boolean
          subscription_ends_at: string
          subscription_starts_at: string
          user_id: string
          username: string
        }[]
      }
      get_pixel_settings_public: {
        Args: { _owner_id: string; _store_id?: string }
        Returns: {
          facebook_enabled: boolean
          facebook_pixel_id: string
          google_analytics_id: string
          google_enabled: boolean
          snapchat_enabled: boolean
          snapchat_pixel_id: string
          tiktok_enabled: boolean
          tiktok_pixel_id: string
        }[]
      }
      get_public_profile_by_username: {
        Args: { _username: string }
        Returns: {
          is_active: boolean
          user_id: string
        }[]
      }
      has_permission: { Args: { _key: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_store_access: { Args: { _store_id: string }; Returns: boolean }
      is_member_of: { Args: { _owner_id: string }; Returns: boolean }
      is_subscription_active: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      next_skus_for_store: {
        Args: { _count: number; _store_id: string }
        Returns: string[]
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      redeem_card: { Args: { _code: string }; Returns: Json }
      store_used_skus: { Args: { _store_id: string }; Returns: string[] }
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
