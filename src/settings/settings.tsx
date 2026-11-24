import { useState, type ReactNode } from "react"
import { Tabs as T } from "radix-ui"
import {
  Bot,
  Database,
  Download,
  Info,
  Keyboard,
  KeyRound,
  Palette,
  Sparkles,
  Timer,
} from "lucide-react"
import { Drialog, DrialogContent, DrialogHeader, DrialogTitle } from "@/core/ui/drialog"
import { DRAWER_TALL } from "@/core/ui/drawer"
import { AppearancePage } from "@/settings/appearance"
import { HabitsPage } from "@/settings/habits"
import { ModelPage, ProvidersPage, SkillsPage } from "@/settings/agent"
import { ExportPage, StoragePage } from "@/settings/data"
import { AboutPage, ShortcutsPage } from "@/settings/system"

// Ajustes como Drialog y no como ruta: un overlay no reabre "solo 3 pantallas" (ui-principles),
// mismo criterio que el dialog de hábitos. Sidebar de navegación (Radix Tabs vertical: ↑/↓ y roving
// focus gratis) + una página por ítem. En mobile la lista pasa a tira horizontal.

const trigger =
  "flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none data-[state=active]:bg-muted data-[state=active]:font-medium data-[state=active]:text-foreground"
const group =
  "mt-4 px-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground/70 uppercase max-md:hidden"

function Item({ value, icon, children }: { value: string; icon: ReactNode; children: ReactNode }) {
  return (
    <T.Trigger value={value} className={trigger}>
      {icon}
      {children}
    </T.Trigger>
  )
}

export function Settings({
  onClose,
  dark,
  onToggleTheme,
}: {
  onClose: () => void
  dark: boolean
  onToggleTheme: () => void
}) {
  const [page, setPage] = useState("appearance")
  const pages: Record<string, ReactNode> = {
    appearance: <AppearancePage dark={dark} onToggleTheme={onToggleTheme} />,
    habits: <HabitsPage />,
    providers: <ProvidersPage />,
    model: <ModelPage go={setPage} />,
    skills: <SkillsPage />,
    storage: <StoragePage />,
    export: <ExportPage />,
    shortcuts: <ShortcutsPage />,
    about: <AboutPage />,
  }
  return (
    <Drialog open onOpenChange={(next) => !next && onClose()}>
      {/* Mismo tamaño que el NoteDialog en desktop. El padding extra y la X más adentro son por
          Curved: su esquina (36px) se comía el título con el padding de 16px. */}
      <DrialogContent
        className={`${DRAWER_TALL} flex flex-col max-md:px-4 md:h-[85vh] md:w-5xl md:max-w-5xl md:p-8 md:**:data-[slot=dialog-close]:top-5 md:**:data-[slot=dialog-close]:right-5`}
      >
        <DrialogHeader>
          <DrialogTitle className="text-lg font-semibold">Ajustes</DrialogTitle>
        </DrialogHeader>
        <T.Root
          value={page}
          onValueChange={setPage}
          orientation="vertical"
          className="flex min-h-0 flex-1 gap-2 max-md:flex-col md:gap-0"
        >
          <T.List className="flex shrink-0 gap-1 overflow-x-auto p-1 max-md:mb-2 max-md:pb-2 md:w-52 md:flex-col md:overflow-y-auto md:border-r md:pr-3">
            <Item value="appearance" icon={<Palette />}>
              Apariencia
            </Item>
            <Item value="habits" icon={<Timer />}>
              Hábitos
            </Item>
            <p className={group}>Agente</p>
            <Item value="providers" icon={<KeyRound />}>
              Proveedores
            </Item>
            <Item value="model" icon={<Sparkles />}>
              Modelo y aprobaciones
            </Item>
            <Item value="skills" icon={<Bot />}>
              Skills
            </Item>
            <p className={group}>Datos</p>
            <Item value="storage" icon={<Database />}>
              Almacenamiento
            </Item>
            <Item value="export" icon={<Download />}>
              Exportar
            </Item>
            <p className={group}>Sistema</p>
            <Item value="shortcuts" icon={<Keyboard />}>
              Atajos
            </Item>
            <Item value="about" icon={<Info />}>
              Acerca de
            </Item>
          </T.List>
          {Object.entries(pages).map(([id, node]) => (
            <T.Content
              key={id}
              value={id}
              className="min-h-0 flex-1 overflow-y-auto pt-1 pr-2 pb-4 max-md:pl-1 data-[state=inactive]:hidden md:pr-4 md:pl-10"
            >
              <div className="max-w-2xl">{node}</div>
            </T.Content>
          ))}
        </T.Root>
      </DrialogContent>
    </Drialog>
  )
}
