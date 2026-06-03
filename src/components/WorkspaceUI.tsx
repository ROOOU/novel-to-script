import {
  Fragment,
  createElement,
  isValidElement,
  type FormHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

export type WorkspaceFeedbackTone = 'success' | 'danger' | 'running' | 'muted';
export type WorkspaceStatusTone = WorkspaceFeedbackTone | 'pending' | 'queued';
export type WorkspaceMetricTone = 'matcha' | 'slushie' | 'lemon' | 'ube' | 'blueberry';
export type WorkspaceNoteTone = 'matcha' | 'slushie' | 'lemon' | 'blueberry';
export type WorkspaceCapabilityTone = 'source' | 'script' | 'storyboard' | 'delivery';
export type WorkspaceHeroVariant = 'projects' | 'pricing' | 'detail';

export interface WorkspaceMiniListItem {
  key?: string;
  label: ReactNode;
  value: ReactNode;
}

export interface WorkspaceCapabilityMetaItem {
  key?: string;
  label: ReactNode;
  value: ReactNode;
}

interface WorkspaceFeedbackProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  tone: WorkspaceFeedbackTone;
  title?: ReactNode;
  children: ReactNode;
}

interface WorkspaceStatusPillProps extends HTMLAttributes<HTMLSpanElement> {
  tone: WorkspaceStatusTone;
  children: ReactNode;
}

interface WorkspaceMetricCardProps extends HTMLAttributes<HTMLDivElement> {
  tone: WorkspaceMetricTone | string;
  label: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
}

interface WorkspaceHeroProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'section' | 'article' | 'div';
  variant?: WorkspaceHeroVariant;
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  beforeHeader?: ReactNode;
  afterDescription?: ReactNode;
  tags?: ReactNode[];
  aside?: ReactNode;
  footer?: ReactNode;
}

interface WorkspaceMiniListProps extends HTMLAttributes<HTMLDivElement> {
  items: WorkspaceMiniListItem[];
}

interface WorkspaceFormHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}

interface WorkspaceFormActionsProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

type WorkspaceFormCardProps =
  | ({
      as?: 'article' | 'section';
      children: ReactNode;
      className?: string;
    } & HTMLAttributes<HTMLElement>)
  | ({
      as: 'form';
      children: ReactNode;
      className?: string;
    } & FormHTMLAttributes<HTMLFormElement>);

interface WorkspaceNoteCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  as?: 'article' | 'section' | 'div';
  tone: WorkspaceNoteTone | string;
  eyebrow?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  titleAs?: 'h2' | 'h3';
  framed?: boolean;
  children?: ReactNode;
  headerClassName?: string;
}

interface WorkspaceCapabilityCardProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  tone: WorkspaceCapabilityTone | string;
  eyebrow?: ReactNode;
  title: ReactNode;
  badge?: ReactNode;
  description?: ReactNode;
  meta?: WorkspaceCapabilityMetaItem[];
  metaOrder?: 'label-first' | 'value-first';
  titlePlacement?: 'top' | 'body';
  action?: ReactNode;
  active?: boolean;
  children?: ReactNode;
}

interface WorkspaceListRowProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

interface WorkspaceListRowMetaProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function WorkspaceFeedback({
  tone,
  title,
  children,
  className,
  role = 'status',
  ...rest
}: WorkspaceFeedbackProps) {
  return (
    <div
      className={joinClassNames('workspace-feedback', `workspace-feedback-${tone}`, className)}
      role={role}
      aria-live="polite"
      {...rest}
    >
      {title ? <strong>{title}</strong> : null}
      {renderContent(children)}
    </div>
  );
}

export function WorkspaceStatusPill({
  tone,
  children,
  className,
  ...rest
}: WorkspaceStatusPillProps) {
  return (
    <span
      className={joinClassNames('status-pill', `status-pill-${tone}`, className)}
      {...rest}
    >
      {children}
    </span>
  );
}

export function WorkspaceMetricCard({
  tone,
  label,
  value,
  detail,
  className,
  ...rest
}: WorkspaceMetricCardProps) {
  return (
    <div className={joinClassNames('metric-card', `metric-card-${tone}`, className)} {...rest}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? renderMetricDetail(detail) : null}
    </div>
  );
}

export function WorkspaceHero({
  as = 'section',
  variant = 'projects',
  eyebrow,
  title,
  description,
  beforeHeader,
  afterDescription,
  tags,
  aside,
  footer,
  className,
  ...rest
}: WorkspaceHeroProps) {
  const copyClassName =
    variant === 'pricing'
      ? 'pricing-hero-copy'
      : variant === 'detail'
        ? 'project-detail-hero-copy'
        : 'projects-hero-copy';
  const asideClassName =
    variant === 'pricing'
      ? 'pricing-hero-panel'
      : variant === 'detail'
        ? 'project-detail-hero-aside'
        : 'projects-hero-aside';

  return createElement(
    as,
    {
      className: joinClassNames(
        'workspace-hero',
        variant === 'pricing'
          ? 'pricing-hero'
          : variant === 'detail'
            ? 'project-detail-hero'
            : 'projects-hero',
        className
      ),
      ...rest,
    },
    <>
      <div className={copyClassName}>
        {beforeHeader}
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? renderContent(description) : null}
        {afterDescription}
        {tags?.length ? <div className="project-hero-tags">{tags.map(renderHeroTag)}</div> : null}
      </div>
      {aside ? <div className={asideClassName}>{aside}</div> : null}
      {footer}
    </>
  );
}

export function WorkspaceMiniList({
  items,
  className,
  ...rest
}: WorkspaceMiniListProps) {
  return (
    <div className={joinClassNames('workspace-mini-list', className)} {...rest}>
      {items.map((item, index) => (
        <div key={item.key ?? String(index)}>
          <strong>{item.label}</strong>
          <span>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function WorkspaceListRow({
  children,
  className,
  ...rest
}: WorkspaceListRowProps) {
  return (
    <div className={joinClassNames('list-row', className)} {...rest}>
      {children}
    </div>
  );
}

export function WorkspaceListRowMeta({
  children,
  className,
  ...rest
}: WorkspaceListRowMetaProps) {
  return (
    <div className={joinClassNames('list-row-meta', className)} {...rest}>
      {children}
    </div>
  );
}

export function WorkspaceFormCard(props: WorkspaceFormCardProps) {
  const { as = 'article', className, children, ...rest } = props as WorkspaceFormCardProps & {
    as: 'article' | 'section' | 'form';
  };
  const classes = joinClassNames('card', 'stack-gap', 'workspace-form-card', className);

  if (as === 'form') {
    return (
      <form className={classes} {...(rest as FormHTMLAttributes<HTMLFormElement>)}>
        {children}
      </form>
    );
  }

  if (as === 'section') {
    return (
      <section className={classes} {...(rest as HTMLAttributes<HTMLElement>)}>
        {children}
      </section>
    );
  }

  return (
    <article className={classes} {...(rest as HTMLAttributes<HTMLElement>)}>
      {children}
    </article>
  );
}

export function WorkspaceFormHeader({
  eyebrow,
  title,
  description,
  className,
  ...rest
}: WorkspaceFormHeaderProps) {
  return (
    <div className={joinClassNames('workspace-form-header', className)} {...rest}>
      {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
      <h2>{title}</h2>
      {description ? renderContent(description) : null}
    </div>
  );
}

export function WorkspaceFormActions({
  children,
  className,
  ...rest
}: WorkspaceFormActionsProps) {
  return (
    <div className={joinClassNames('workspace-form-actions', className)} {...rest}>
      {children}
    </div>
  );
}

export function WorkspaceNoteCard({
  as = 'article',
  tone,
  eyebrow,
  title,
  description,
  titleAs = 'h2',
  framed = true,
  children,
  className,
  headerClassName = 'stack-gap-sm',
  ...rest
}: WorkspaceNoteCardProps) {
  const header =
    eyebrow || title || description ? (
      <div className={joinClassNames(headerClassName)}>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        {title ? createElement(titleAs, null, title) : null}
        {description ? renderContent(description) : null}
      </div>
    ) : null;

  return createElement(
    as,
    {
      className: joinClassNames(
        framed && 'card',
        'workspace-note-card',
        `workspace-note-card-${tone}`,
        className
      ),
      ...rest,
    },
    header,
    children
  );
}

export function WorkspaceCapabilityCard({
  tone,
  eyebrow,
  title,
  badge,
  description,
  meta,
  metaOrder = 'label-first',
  titlePlacement = 'top',
  action,
  active = false,
  children,
  className,
  ...rest
}: WorkspaceCapabilityCardProps) {
  return (
    <article
      className={joinClassNames(
        'workspace-capability-card',
        `workspace-capability-card-${tone}`,
        active && 'active',
        className
      )}
      {...rest}
    >
      <div className="workspace-capability-card-top">
        <div className={joinClassNames(titlePlacement === 'top' && 'stack-gap-sm')}>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          {titlePlacement === 'top' ? <h2>{title}</h2> : null}
        </div>
        {badge ? <span className="chip">{badge}</span> : null}
      </div>
      {titlePlacement === 'body' ? (
        <div className="stack-gap-sm">
          <h2>{title}</h2>
          {description ? renderContent(description) : null}
        </div>
      ) : description ? (
        renderContent(description)
      ) : null}
      {meta?.length ? (
        <div className="workspace-capability-meta">
          {meta.map((item, index) => (
            <span key={item.key ?? String(index)}>
              {metaOrder === 'value-first' ? (
                <>
                  <strong>{item.value}</strong>
                  {item.label}
                </>
              ) : (
                <>
                  {item.label}
                  <strong>{item.value}</strong>
                </>
              )}
            </span>
          ))}
        </div>
      ) : null}
      {action}
      {children}
    </article>
  );
}

function renderContent(content: ReactNode) {
  if (typeof content === 'string' || typeof content === 'number') {
    return <p>{content}</p>;
  }

  return content;
}

function renderMetricDetail(content: ReactNode) {
  if (typeof content === 'string' || typeof content === 'number') {
    return <small>{content}</small>;
  }

  return content;
}

function renderHeroTag(tag: ReactNode, index: number) {
  if (typeof tag === 'string' || typeof tag === 'number') {
    return (
      <span key={`${tag}-${index}`} className="chip">
        {tag}
      </span>
    );
  }

  if (isValidElement(tag)) {
    return <Fragment key={tag.key ?? index}>{tag}</Fragment>;
  }

  return <span key={index}>{tag}</span>;
}

function joinClassNames(...parts: Array<string | null | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}
