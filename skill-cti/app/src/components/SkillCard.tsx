import type { Skill } from '../lib/types'

interface Props {
  skill: Skill
  onLaunch: (skill: Skill) => void
}

export default function SkillCard({ skill, onLaunch }: Props) {
  if (skill.external && skill.url) {
    return (
      <a
        href={skill.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-surface border border-border rounded-lg shadow-card p-4 hover:border-border2 transition-colors group no-underline"
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <span
            className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-[3px] rounded border"
            style={{ color: skill.badgeColor, borderColor: skill.badgeColor + '55' }}
          >
            {skill.badge}
          </span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-txt-3 flex-shrink-0 mt-0.5"
          >
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
        </div>
        <div className="text-[13px] font-bold text-txt mb-1 leading-snug group-hover:text-txt transition-colors">
          {skill.name}
        </div>
        <div className="text-[10px] text-txt-3 leading-relaxed">{skill.tagline}</div>
      </a>
    )
  }

  return (
    <button
      onClick={() => onLaunch(skill)}
      className="text-left bg-surface border border-border rounded-lg shadow-card p-4 hover:border-border2 transition-colors group cursor-pointer w-full"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className="text-[10px] font-bold tracking-[0.12em] uppercase px-2 py-[3px] rounded border"
          style={{ color: skill.badgeColor, borderColor: skill.badgeColor + '55' }}
        >
          {skill.badge}
        </span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-txt-3 flex-shrink-0 mt-0.5 group-hover:text-txt transition-colors"
        >
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      </div>
      <div className="text-[13px] font-bold text-txt mb-1 leading-snug group-hover:text-txt transition-colors">
        {skill.name}
      </div>
      <div className="text-[10px] text-txt-3 leading-relaxed">{skill.tagline}</div>
    </button>
  )
}
