export default function StampBoard({
  checkpoints,
  stampedIds,
  selectedCheckpointId,
  onSelect,
  scoreByCheckpoint,
  radiusMeter,
}) {
  function getDifficultyLabel(level) {
    if (level === 'hard') {
      return '상'
    }
    if (level === 'medium') {
      return '중'
    }
    return '하'
  }

  return (
    <section className="panel stamp-board">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">위치 도착 인증</p>
          <h2>체크포인트 스탬프</h2>
        </div>
        <span className="status-chip">GPS {radiusMeter}m 반경 자동 획득</span>
      </div>

      <div className="checkpoint-list">
        {checkpoints.map((checkpoint, index) => {
          const isStamped = stampedIds.includes(checkpoint.id)
          const isSelected = checkpoint.id === selectedCheckpointId
          const directionText = (checkpoint.directionHints ?? []).join(' / ') || '정보 없음'
          const score = scoreByCheckpoint?.[checkpoint.id] ?? 0
          const difficultyLevel = checkpoint.difficulty ?? 'easy'

          return (
            <article
              key={checkpoint.id}
              className={`checkpoint-card ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelect(checkpoint)}
            >
              <div className="checkpoint-header">
                <div>
                  <span className="checkpoint-index">#{index + 1}</span>
                  <h3>{checkpoint.title}</h3>
                </div>
                <span className={`stamp-state ${isStamped ? 'done' : 'todo'}`}>
                  {isStamped ? '인증 완료' : '대기'}
                </span>
              </div>

              <p className="checkpoint-note">{checkpoint.note ?? '설명 정보 없음'}</p>

              <dl className="checkpoint-meta">
                <div>
                  <dt>구간</dt>
                  <dd>{checkpoint.section ?? '-'}</dd>
                </div>
                <div>
                  <dt>획득 방식</dt>
                  <dd>현위치 반경 도착</dd>
                </div>
                <div>
                  <dt>점수</dt>
                  <dd>{score.toLocaleString()}점</dd>
                </div>
                <div>
                  <dt>난이도</dt>
                  <dd>{getDifficultyLabel(difficultyLevel)}</dd>
                </div>
                <div>
                  <dt>방향</dt>
                  <dd>{directionText}</dd>
                </div>
              </dl>
            </article>
          )
        })}
      </div>
    </section>
  )
}
