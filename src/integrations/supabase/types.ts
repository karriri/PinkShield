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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_restrictions: {
        Row: {
          created_at: string
          created_by: string | null
          kind: string
          reason: string | null
          until: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          kind: string
          reason?: string | null
          until?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          kind?: string
          reason?: string | null
          until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      appointments: {
        Row: {
          created_at: string
          id: string
          notes: string
          place: string
          remind_day_before: boolean
          remind_same_day: boolean
          start_time: string
          starts_on: string
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string
          place?: string
          remind_day_before?: boolean
          remind_same_day?: boolean
          start_time?: string
          starts_on: string
          status?: string
          type: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string
          place?: string
          remind_day_before?: boolean
          remind_same_day?: boolean
          start_time?: string
          starts_on?: string
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocked_name: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocked_name?: string
          blocker_id?: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocked_name?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: []
      }
      comments: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          created_at: string
          edited_at: string | null
          id: string
          is_demo: boolean
          parent_id: string | null
          post_id: string
          removed_at: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          body: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_demo?: boolean
          parent_id?: string | null
          post_id: string
          removed_at?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_demo?: boolean
          parent_id?: string | null
          post_id?: string
          removed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      content_reports: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          note: string
          post_id: string | null
          reason: string
          reporter_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          note?: string
          post_id?: string | null
          reason: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          note?: string
          post_id?: string | null
          reason?: string
          reporter_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reports_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_actions: {
        Row: {
          action: string
          admin_id: string
          comment_id: string | null
          created_at: string
          id: string
          note: string
          post_id: string | null
          report_id: string | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          note?: string
          post_id?: string | null
          report_id?: string | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          comment_id?: string | null
          created_at?: string
          id?: string
          note?: string
          post_id?: string | null
          report_id?: string | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          appointment_id: string
          created_at: string
          dismissed_at: string | null
          due_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          appointment_id: string
          created_at?: string
          dismissed_at?: string | null
          due_at: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          appointment_id?: string
          created_at?: string
          dismissed_at?: string | null
          due_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          category: string
          created_at: string
          edited_at: string | null
          id: string
          is_demo: boolean
          likes_count: number
          removed_at: string | null
          removed_reason: string | null
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          body: string
          category: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_demo?: boolean
          likes_count?: number
          removed_at?: string | null
          removed_reason?: string | null
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          category?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_demo?: boolean
          likes_count?: number
          removed_at?: string | null
          removed_reason?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          language: string
          pseudonym: string
          rules_accepted_at: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          language?: string
          pseudonym: string
          rules_accepted_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          pseudonym?: string
          rules_accepted_at?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_articles: {
        Row: {
          article_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          article_id: string
          created_at?: string
          user_id?: string
        }
        Update: {
          article_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      is_blocked: {
        Args: { _blocked: string; _blocker: string }
        Returns: boolean
      }
      is_restricted: { Args: { _user_id: string }; Returns: boolean }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
