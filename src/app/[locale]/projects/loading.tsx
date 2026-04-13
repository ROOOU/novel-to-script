export default function ProjectsLoading() {
  return (
    <div className="workspace-shell stack-gap-lg">
      <section className="workspace-hero projects-hero">
        <div className="skeleton-panel">
          <div className="skeleton-line" style={{ width: '120px' }} />
          <div className="skeleton-line" style={{ width: '280px', height: '28px' }} />
          <div className="skeleton-line" style={{ width: '420px' }} />
        </div>
      </section>

      <section className="workspace-grid">
        <article className="card skeleton-panel">
          <div className="skeleton-line" style={{ width: '140px' }} />
          <div className="skeleton-line" style={{ width: '100%' }} />
          <div className="skeleton-line" style={{ width: '100%' }} />
          <div className="skeleton-line" style={{ width: '100%' }} />
          <div className="skeleton-line" style={{ width: '180px', height: '44px' }} />
        </article>

        <div className="project-list-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <article key={index} className="card skeleton-panel skeleton-card">
              <div className="skeleton-line" style={{ width: '56%' }} />
              <div className="skeleton-line" style={{ width: '100%' }} />
              <div className="skeleton-line" style={{ width: '74%' }} />
              <div className="skeleton-line" style={{ width: '48%' }} />
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
