export default function ProjectDetailLoading() {
  return (
    <div className="workspace-shell stack-gap-lg">
      <section className="workspace-hero project-detail-hero">
        <div className="skeleton-panel">
          <div className="skeleton-line" style={{ width: '120px' }} />
          <div className="skeleton-line" style={{ width: '320px', height: '32px' }} />
          <div className="skeleton-line" style={{ width: '520px' }} />
        </div>
      </section>

      <section className="workspace-stage-band">
        <div className="skeleton-panel">
          <div className="skeleton-line" style={{ width: '110px' }} />
          <div className="skeleton-line" style={{ width: '260px', height: '28px' }} />
          <div className="skeleton-line" style={{ width: '460px' }} />
        </div>
        <div className="workspace-stage-pills">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="workspace-stage-pill skeleton-card">
              <div className="skeleton-line" style={{ width: '70px' }} />
              <div className="skeleton-line" style={{ width: '90px' }} />
            </div>
          ))}
        </div>
      </section>

      <section className="workspace-preview-shell">
        <article className="card skeleton-panel">
          <div className="skeleton-line" style={{ width: '180px' }} />
          <div className="skeleton-line" style={{ width: '100%' }} />
          <div className="skeleton-line" style={{ width: '100%' }} />
          <div className="skeleton-line" style={{ width: '92%' }} />
          <div className="skeleton-line" style={{ width: '84%' }} />
        </article>
      </section>
    </div>
  );
}
