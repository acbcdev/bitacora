// Tipos del schema frozen (CONTEXT.md + migrations/0001, 0003).
// Idealmente se regeneran contra el proyecto real:
//   supabase gen types typescript --project-id <id> > src/types/database.ts
// Mientras no exista el proyecto, van a mano — el schema está cerrado, no se inventa nada.

export type CourseStatus = "active" | "paused" | "done"
export type NoteKind = "note" | "flashcard"
export type Grade = "correcto" | "parcial" | "incorrecto"
export type HabitKind = "good" | "bad"
export type HabitMetric = "check" | "count" | "time"
export type HabitPeriod = "day" | "week" | "month"

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
          icon: string | null // 'lucide:Book' o URL de imagen subida
          source: string | null // dónde se estudió (ej. 'Platzi')
          area: string | null // tema/categoría del curso
          imported: boolean
        } & Timestamps
        Insert: {
          id?: string
          user_id?: string // DB default auth.uid()
          name: string
          status?: CourseStatus
          started_at?: string | null
          finished_at?: string | null
          icon?: string | null
          source?: string | null
          area?: string | null
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
          kind: NoteKind
          position: number
          imported: boolean
        } & Timestamps
        Insert: {
          id?: string
          user_id?: string // DB default auth.uid()
          course_id?: string | null
          title?: string
          content?: TiptapDoc
          kind?: NoteKind
          position?: number
          imported?: boolean
          deleted_at?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["notes"]["Insert"]>
        Relationships: []
      }
      read_log: {
        Row: {
          id: string
          user_id: string
          note_id: string
          read_at: string
          grade: Grade | null
        }
        Insert: {
          id?: string
          user_id?: string
          note_id: string
          read_at?: string
          grade?: Grade | null
        }
        Update: Partial<Database["public"]["Tables"]["read_log"]["Insert"]>
        Relationships: []
      }
      habits: {
        Row: {
          id: string
          user_id: string
          name: string
          icon: string | null // 'lucide:Dumbbell' o URL de imagen subida
          kind: HabitKind // good = piso, bad = techo
          metric: HabitMetric // 'time' se mide en minutos
          target: number
          period: HabitPeriod
          days: number[] | null // 0=dom … 6=sáb. Recordatorio, no regla (ADR 0009).
        } & Timestamps
        Insert: {
          id?: string
          user_id?: string // DB default auth.uid()
          name: string
          icon?: string | null
          kind?: HabitKind
          metric?: HabitMetric
          target?: number
          period?: HabitPeriod
          days?: number[] | null
          deleted_at?: string | null
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["habits"]["Insert"]>
        Relationships: []
      }
      // Una fila por (habit_id, day) con la meta congelada — ADR 0009. Sin deleted_at: desmarcar
      // es amount = 0.
      habit_log: {
        Row: {
          id: string
          user_id: string
          habit_id: string | null
          day: string // date en hora local del usuario (dayKey), no timestamptz
          amount: number
          target: number // la meta que regía ese día
        }
        Insert: {
          id?: string
          user_id?: string
          habit_id: string
          day: string
          amount?: number
          target: number
        }
        Update: Partial<Database["public"]["Tables"]["habit_log"]["Insert"]>
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
      courses_page: {
        Args: {
          q?: string
          status_filter?: CourseStatus | null
          sort?: string
          page_size?: number
          page_offset?: number
        }
        Returns: (Database["public"]["Tables"]["courses"]["Row"] & {
          notes: number
          rounds: number
          last_read: string | null
          total_count: number
        })[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Alias cómodos para el resto de la app.
export type Course = Database["public"]["Tables"]["courses"]["Row"]
export type Note = Database["public"]["Tables"]["notes"]["Row"]
export type Habit = Database["public"]["Tables"]["habits"]["Row"]
export type HabitLog = Database["public"]["Tables"]["habit_log"]["Row"]
export type CourseProgress = Database["public"]["Functions"]["course_progress"]["Returns"][number]
export type CourseRow = Database["public"]["Functions"]["courses_page"]["Returns"][number]
