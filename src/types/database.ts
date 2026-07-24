// Tipos del schema frozen (CONTEXT.md + migrations/0001, 0003).
// Idealmente se regeneran contra el proyecto real:
//   supabase gen types typescript --project-id <id> > src/types/database.ts
// Mientras no exista el proyecto, van a mano — el schema está cerrado, no se inventa nada.

export type CourseStatus = "active" | "paused" | "done"

// Documento Tiptap (JSON). Se guarda tal cual en notes.content.
export type TiptapDoc = { type: "doc"; content?: unknown[] }

type Timestamps = {
  deleted_at: string | null
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      courses: {
        Row: {
          id: string
          user_id: string
          name: string
          status: CourseStatus
          started_at: string | null
          finished_at: string | null
          imported: boolean
        } & Timestamps
        Insert: {
          id?: string
          user_id?: string // DB default auth.uid()
          name: string
          status?: CourseStatus
          started_at?: string | null
          finished_at?: string | null
          imported?: boolean
          deleted_at?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["courses"]["Insert"]>
        Relationships: []
      }
      notes: {
        Row: {
          id: string
          user_id: string
          course_id: string | null
          title: string
          content: TiptapDoc
          position: number
          imported: boolean
        } & Timestamps
        Insert: {
          id?: string
          user_id?: string // DB default auth.uid()
          course_id?: string | null
          title?: string
          content?: TiptapDoc
          position?: number
          imported?: boolean
          deleted_at?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>
        Relationships: []
      }
      read_log: {
        Row: { id: string; user_id: string; note_id: string; read_at: string }
        Insert: { id?: string; user_id?: string; note_id: string; read_at?: string }
        Update: Partial<Database["public"]["Tables"]["read_log"]["Insert"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      review_queue: {
        Args: Record<string, never>
        Returns: Database["public"]["Tables"]["notes"]["Row"][]
      }
      course_progress: {
        Args: Record<string, never>
        Returns: { course_id: string; total: number; read: number }[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Alias cómodos para el resto de la app.
export type Course = Database["public"]["Tables"]["courses"]["Row"]
export type Note = Database["public"]["Tables"]["notes"]["Row"]
export type CourseProgress = Database["public"]["Functions"]["course_progress"]["Returns"][number]
