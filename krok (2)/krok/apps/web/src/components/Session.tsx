import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { GeneratedProblem } from '@krok/core'
import { answerToText } from '@krok/core'
import { getTopic } from '@krok/content'
import { Md, Tex } from '../md'
import { ProblemCard, type CardResult } from './ProblemCard'
import { progressActions } from '../store'

export interface SessionResult extends CardResult {
  gp: GeneratedProblem
}

interface Props {
  title: string
  items: GeneratedProblem[]
  mode: 'learn' | 'quiz'
  /** запис як «тест» (вища вага) */
  isTest?: boolean
  onFinish?: (results: SessionResult[]) => void
  summaryExtra?: (results: SessionResult[]) => React.ReactNode
  finishLabel?: string
  onExit?: () => void
}

/** Послідовність задач: тест, діагностика, повторення. Усі результати пишуться у прогрес. */
export function Session({ title, items, mode, isTest, onFinish, summaryExtra, finishLabel = 'Завершити', onExit }: Props) {
  const [idx, setIdx] = useState(0)
  const [results, setResults] = useState<SessionResult[]>([])
  const [done, setDone] = useState(false)

  const gp = items[idx]
  const record = (r: CardResult) => {
    progressActions.attempt({ topicId: gp.topicId, skill: gp.skill, correct: r.correct, hintsUsed: r.hintsUsed, solutionShown: r.solutionShown, isTest })
    setResults((prev) => [...prev, { ...r, gp }])
  }
  const next = () => {
    if (idx + 1 >= items.length) {
      setDone(true)
    } else setIdx(idx + 1)
  }

  if (done) {
    const finalResults = results
    const good = finalResults.filter((r) => r.correct && !r.solutionShown).length
    return (
      <div className="session-summary">
        <h2>{title}: результат</h2>
        <p className="big-score">
          {good} з {items.length}
        </p>
        <p className="muted">
          {good === items.length ? 'Бездоганно!' : good >= items.length * 0.7 ? 'Дуже добре. Розберись із помилками нижче — і буде ще краще.' : 'Це нормально — тепер видно, що повторити. Розберемо помилки.'}
        </p>
        {summaryExtra?.(finalResults)}
        <ul className="review-list">
          {finalResults.map((r, i) => {
            const t = getTopic(r.gp.topicId)
            return (
              <li key={i} className={r.correct && !r.solutionShown ? 'ok' : 'bad'}>
                <details>
                  <summary>
                    <span className="mark">{r.correct && !r.solutionShown ? '✓' : '✗'}</span>
                    <span className="sum-text">
                      <Md text={r.gp.problem.prompt} inline />
                    </span>
                  </summary>
                  <div className="review-body">
                    {t && (
                      <p className="muted small">
                        Тема: <Link to={`/t/${t.id}`}>{t.title}</Link>
                      </p>
                    )}
                    {r.answer !== undefined && r.answer !== '' && !(r.correct && !r.solutionShown) && (
                      <p className="small">
                        Твоя відповідь: <code>{r.gp.problem.answer.kind === 'choice' ? r.answer.split(',').map((i) => r.gp.problem.answer.kind === 'choice' ? (r.gp.problem.answer as { options: string[] }).options[Number(i)] : '').join('; ') : r.answer}</code>
                      </p>
                    )}
                    <p className="small">
                      Правильно: <strong>{r.gp.problem.answerTex ? <Tex tex={r.gp.problem.answerTex} /> : answerToText(r.gp.problem.answer)}</strong>
                    </p>
                    <ol>
                      {r.gp.problem.solution.map((s, k) => (
                        <li key={k}>
                          <Md text={s} />
                        </li>
                      ))}
                    </ol>
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
        <div className="actions">
          <button
            className="btn primary"
            onClick={() => {
              onFinish?.(finalResults)
              onExit?.()
            }}
          >
            {finishLabel}
          </button>
        </div>
      </div>
    )
  }

  return (
    <section className="session">
      <div className="session-head">
        <h2>{title}</h2>
        <div className="progress-track" aria-label={`Задача ${idx + 1} з ${items.length}`}>
          <div className="progress-fill" style={{ width: `${(idx / items.length) * 100}%` }} />
        </div>
        <span className="muted small">
          {idx + 1} / {items.length}
        </span>
      </div>
      {mode === 'learn' && getTopic(gp.topicId) && (
        <p className="muted small">
          Тема: <Link to={`/t/${gp.topicId}`}>{getTopic(gp.topicId)!.title}</Link>
        </p>
      )}
      <ProblemCard
        key={`${gp.topicId}-${gp.templateId}-${gp.seed}-${idx}`}
        gp={gp}
        mode={mode}
        onResult={record}
        onNext={next}
        nextLabel={idx + 1 >= items.length ? 'До результатів' : 'Далі'}
      />
    </section>
  )
}
