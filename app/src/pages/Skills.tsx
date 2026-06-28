import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { SKILLS, CATEGORY_LABELS, CATEGORY_ORDER } from '../lib/skills'
import type { Skill } from '../lib/types'
import SkillCard from '../components/SkillCard'
import LaunchDrawer from '../components/LaunchDrawer'
import ReportModal from '../components/ReportModal'

export default function Skills() {
  const [activeSkill, setActiveSkill] = useState<Skill | null>(null)
  const [report, setReport] = useState<{ html: string; reportId?: string } | null>(null)
  const queryClient = useQueryClient()

  function handleReportReady(html: string, reportId?: string) {
    setActiveSkill(null)
    setReport({ html, reportId })
    queryClient.invalidateQueries({ queryKey: ['reports'] })
  }

  const skillsByCategory = CATEGORY_ORDER.reduce<Record<string, Skill[]>>((acc, cat) => {
    acc[cat] = SKILLS.filter((s) => s.category === cat && !s.hidden)
    return acc
  }, {})

  return (
    <div className="p-6 flex-1 overflow-y-auto">
      <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase mb-3">Skills</p>
      <h1 className="text-[22px] font-bold text-txt tracking-tight mb-1">Skill Launcher</h1>
      <p className="text-[13px] text-txt-2 mb-8">
        Select a skill to launch a Claude-powered CTI report. HTML reports are saved to your reports library.
      </p>

      <div className="flex flex-col gap-10">
        {CATEGORY_ORDER.map((cat) => {
          const catSkills = skillsByCategory[cat]
          if (!catSkills || catSkills.length === 0) return null
          return (
            <section key={cat}>
              <div className="flex items-center gap-3 mb-4">
                <p className="text-[11px] font-bold tracking-[0.2em] text-txt-3 uppercase flex-shrink-0">
                  {CATEGORY_LABELS[cat]}
                </p>
                <span className="text-[10px] font-bold text-txt-3 tabular-nums bg-surface border border-border px-1.5 py-[2px] rounded flex-shrink-0">
                  {catSkills.length}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catSkills.map((skill) => (
                  <SkillCard key={skill.id} skill={skill} onLaunch={setActiveSkill} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <LaunchDrawer
        skill={activeSkill}
        onClose={() => setActiveSkill(null)}
        onReportReady={handleReportReady}
      />

      {report && (
        <ReportModal
          html={report.html}
          reportId={report.reportId}
          onClose={() => setReport(null)}
        />
      )}
    </div>
  )
}
