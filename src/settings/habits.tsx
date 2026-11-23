import { useSnapshot } from "@/core/lib/snapshot"
import { dailyCompliance, readGoal } from "@/core/store/derive"
import { ReadGoalForm } from "@/review/read-goal-form"
import { SoundPicker } from "@/settings/controls"
import { Block, Group, Page, Row } from "@/settings/ui"

export function HabitsPage() {
  const { data: goal } = useSnapshot((s) => readGoal(s))
  const { data: days } = useSnapshot((s) => dailyCompliance(s))
  return (
    <Page title="Hábitos" desc="Tu meta de lectura y cómo se mide el cumplimiento.">
      <Group title="Últimos 14 días">
        <Block>
          <div className="flex items-end justify-between gap-6">
            <div className="flex gap-8">
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {goal?.target ?? "—"}
                  <span className="text-sm font-normal text-muted-foreground"> /día</span>
                </p>
                <p className="text-sm text-muted-foreground">Meta de lectura</p>
              </div>
              <div>
                <p className="text-2xl font-semibold tabular-nums">
                  {goal?.streak ?? 0}
                  <span className="text-sm font-normal text-muted-foreground"> días</span>
                </p>
                <p className="text-sm text-muted-foreground">Racha</p>
              </div>
            </div>
            <div className="flex h-12 items-end gap-1" aria-label="Cumplimiento diario">
              {(days ?? []).map((d, i) => (
                <span
                  key={i}
                  className="w-2 rounded-sm bg-foreground/80"
                  style={{
                    height: `${Math.max(8, Math.min(1, d.progress) * 100)}%`,
                    opacity: d.progress ? 1 : 0.25,
                  }}
                />
              ))}
            </div>
          </div>
        </Block>
      </Group>
      <Group title="Ajustes">
        <Row label="Meta de lectura" desc="Notas por día. La racha cuenta los días que llegás.">
          <ReadGoalForm />
        </Row>
        <Row label="Sonido de hábitos" desc="Suena al completar tu meta de tiempo.">
          <SoundPicker />
        </Row>
      </Group>
      <Group
        title="Cómo se cuenta"
        desc="El cumplimiento diario pondera por período (ADR 0026): un día es una fracción chica de una semana o un mes."
      >
        <Row label="Hábito diario">
          <span className="mono-dim">peso 1</span>
        </Row>
        <Row label="Hábito semanal">
          <span className="mono-dim">peso 0.5</span>
        </Row>
        <Row label="Hábito mensual">
          <span className="mono-dim">peso 0.25</span>
        </Row>
      </Group>
    </Page>
  )
}
