import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { buildTest, dependents, isReady, nextProblem, prerequisiteGaps } from '@krok/core'
import type { GeneratedProblem } from '@krok/core'
import { getSubject, getTopic, subjects, topicIndex } from '@krok/content'
import { getProgress, useProgress, progressActions } from '../store'
import { GRADE_LABEL, MasteryBar } from '../components/ui'
import { LessonView, ExamplesView, CheatSheet } from '../components/Lesson'
import { ProblemCard } from '../components/ProblemCard'
import { Session } from '../components/Session'

type Tab = 'lesson' | 'examples' | 'practice' | 'test' | 'cheat'
const TABS: [Tab, string][] = [
  ['lesson', 'Пояснення'],
  ['examples', 'Приклади'],
  ['practice', 'Практика'],
  ['test', 'Тест'],
  ['cheat', 'Довідка'],
]

function Practice({ topicId }: { topicId: string }) {
  const topic = getTopic(topicId)!
  const progress = useProgress()
  const [recent, setRecent] = useState<string[]>([])
  const [gp, setGp] = useState<GeneratedProblem>(() => nextProblem(topic, progress))
  const [solved, setSolved] = useState(0)
  const [asked, setAsked] = useState(0)

  return (
    <div className="practice">
      <div className="practice-head">
        <span className="muted small">
          Розв’язано правильно у цій сесії: {solved} із {asked}
        </span>
        <MasteryBar progress={progress.topics[topicId]} label />
      </div>
      <ProblemCard
        key={`${gp.templateId}-${gp.seed}`}
        gp={gp}
        mode="learn"
        onResult={(r) => {
          progressActions.attempt({ topicId, skill: gp.skill, correct: r.correct, hintsUsed: r.hintsUsed, solutionShown: r.solutionShown })
          setAsked((a) => a + 1)
          if (r.correct && !r.solutionShown) setSolved((s) => s + 1)
        }}
        onNext={() => {
          const nr = [...recent, gp.templateId].slice(-4)
          setRecent(nr)
          // читаємо свіжий стан: прогрес змінився після onResult
          setGp(nextProblem(topic, getProgress(), { recent: nr }))
        }}
      />
    </div>
  )
}

function TestTab({ topicId }: { topicId: string }) {
  const topic = getTopic(topicId)!
  const [items, setItems] = useState<GeneratedProblem[] | null>(null)
  const count = Math.min(8, Math.max(5, topic.exercises.length + 2))
  const best = useProgress().topics[topicId]?.bestTest
  if (!items) {
    return (
      <div className="test-intro">
        <h2>Тест по темі</h2>
        <p>
          {count} задач різної складності. Без підказок: відповідь приймається одразу, а розбір — у кінці. Найкращий результат зберігається{best !== undefined ? ` (зараз: ${Math.round(best * 100)}%)` : ''}.
        </p>
        <p className="muted small">Не поспішай і перевіряй обчислення. Якщо не знаєш — натисни «Не знаю», це нормально.</p>
        <button className="btn primary" onClick={() => setItems(buildTest(topic, count))}>
          Почати тест
        </button>
      </div>
    )
  }
  return (
    <Session
      title="Тест"
      items={items}
      mode="quiz"
      isTest
      finishLabel="Закрити"
      onFinish={(res) => progressActions.testScore(topicId, res.filter((r) => r.correct).length / res.length)}
      onExit={() => setItems(null)}
    />
  )
}

export function TopicPage() {
  const { id } = useParams()
  const topic = getTopic(id ?? '')
  const [params, setParams] = useSearchParams()
  const progress = useProgress()
  const tab = (params.get('tab') as Tab) || 'lesson'
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true })

  const subject = topic ? getSubject(topic.subject) : undefined
  const gaps = useMemo(() => (topic ? prerequisiteGaps(topic.id, topicIndex, progress) : []), [topic, progress])
  const next = useMemo(() => (topic ? dependents(topic.id, subjects).slice(0, 4) : []), [topic])

  if (!topic || !subject) return <div className="page"><h1>Тему не знайдено</h1><Link to="/">На головну</Link></div>

  const p = progress.topics[topic.id]
  const ready = isReady(topic)
  const direct = topic.prereqs.map((x) => topicIndex.get(x)).filter(Boolean)

  return (
    <div className="page topic" style={{ ['--accent' as string]: subject.color }}>
      <nav className="crumbs" aria-label="Навігація">
        <Link to={`/s/${subject.id}`}>{subject.title}</Link> <span>›</span> <span>{GRADE_LABEL(topic.grade)}</span> <span>›</span>{' '}
        <span>{subject.chapters.find((c) => c.id === topic.chapter)?.title}</span>
      </nav>
      <header className="topic-head">
        <h1>{topic.title}</h1>
        <p className="lead">{topic.summary}</p>
        <div className="topic-head-meta">
          <MasteryBar progress={p} label />
          <span className="muted small">{topic.estMinutes} хв на розбір</span>
          {p?.attempts ? (
            <span className="muted small">
              Задач: {p.attempts}, правильно без розв’язання: {p.correct}
            </span>
          ) : null}
          {progress.flagged.includes(topic.id) ? (
            <button className="btn small ghost" onClick={() => progressActions.unflag(topic.id)}>
              Прибрати з «повторити»
            </button>
          ) : (
            <button className="btn small ghost" onClick={() => progressActions.flag([topic.id])}>
              Хочу повторити
            </button>
          )}
        </div>
      </header>

      {gaps.length > 0 && (
        <aside className="callout warning gap-box">
          <div className="callout-title">Спершу варто повторити</div>
          <p>Ця тема спирається на те, що ще не закріплено:</p>
          <div className="gaps">
            {gaps.map((g) => (
              <Link key={g.id} to={`/t/${g.id}`} className="chip">
                {g.title} <span className="muted small">({GRADE_LABEL(g.grade)})</span>
              </Link>
            ))}
          </div>
        </aside>
      )}

      {!ready ? (
        <div className="callout tip">
          <div className="callout-title">Матеріали цієї теми ще в розробці</div>
          <p>Тут буде пояснення, розібрані приклади, задачі з підказками й тест.</p>
          {direct.length > 0 && (
            <p>
              Тим часом можна повторити передумови:{' '}
              {direct.map((d) => (
                <Link key={d!.id} to={`/t/${d!.id}`} className="chip">
                  {d!.title}
                </Link>
              ))}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="tabs sticky" role="tablist" aria-label="Розділи теми">
            {TABS.map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} className={`tab ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>

          <div className="tab-body">
            {tab === 'lesson' && (
              <>
                <div className="notebook">
                  <LessonView topic={topic} />
                </div>
                <div className="actions end">
                  <button
                    className="btn primary"
                    onClick={() => {
                      progressActions.lessonRead(topic.id)
                      setTab('examples')
                    }}
                  >
                    Зрозуміло — до прикладів
                  </button>
                </div>
              </>
            )}
            {tab === 'examples' && (
              <>
                <ExamplesView topic={topic} />
                <div className="actions end">
                  <button className="btn primary" onClick={() => setTab('practice')}>
                    До практики
                  </button>
                </div>
              </>
            )}
            {tab === 'practice' && <Practice topicId={topic.id} />}
            {tab === 'test' && <TestTab topicId={topic.id} />}
            {tab === 'cheat' && <CheatSheet topic={topic} />}
          </div>
        </>
      )}

      {next.length > 0 && (
        <section className="after">
          <h2>Що відкривається далі</h2>
          <div className="gaps">
            {next.map((n) => (
              <Link key={n.id} to={`/t/${n.id}`} className="chip">
                {n.title} <span className="muted small">({GRADE_LABEL(n.grade)})</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
