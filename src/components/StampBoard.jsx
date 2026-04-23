export default function StampBoard({
  checkpoints,
  stampedIds,
  selectedCheckpointId,
  onSelect,
  onStamp,
}) {
  return (
    <section className="panel stamp-board">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">비콘 인증</p>
          <h2>체크포인트 스탬프</h2>
        </div>
        <span className="status-chip">ESP32 비콘 준비</span>
      </div>

      <div className="checkpoint-list">
        {checkpoints.map((checkpoint, index) => {
          const isStamped = stampedIds.includes(checkpoint.id)
          const isSelected = checkpoint.id === selectedCheckpointId
          const directionText = (checkpoint.directionHints ?? []).join(' / ') || '정보 없음'

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
                  <dt>비콘 ID</dt>
                  <dd>{checkpoint.beaconId ?? '-'}</dd>
                </div>
                <div>
                  <dt>방향</dt>
                  <dd>{directionText}</dd>
                </div>
              </dl>

              <button
                type="button"
                className="stamp-button"
                onClick={(event) => {
                  event.stopPropagation()
                  onStamp(checkpoint.id)
                }}
                disabled={isStamped}
              >
                {isStamped ? '기록됨' : '비콘 체크인 시뮬레이션'}
              </button>
            </article>
          )
        })}
      </div>
    </section>
  )
}
