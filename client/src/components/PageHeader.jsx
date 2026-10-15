import { Fragment } from 'react'

/** Investor-portal page heading: breadcrumb, large title, subtitle and an optional action. */
export default function PageHeader({ title, description, breadcrumb, action }) {
  return (
    <div className="mb-[30px] flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumb && (
          <nav aria-label="Breadcrumb" className="mb-[15px] text-title font-medium text-muted-foreground">
            {breadcrumb.map((item, i) => (
              <Fragment key={item}>
                {i > 0 && <span className="mx-1.5 text-subtle">/</span>}
                <span aria-current={i === breadcrumb.length - 1 ? 'page' : undefined}>{item}</span>
              </Fragment>
            ))}
          </nav>
        )}
        <h1 className="text-[28px] leading-tight font-bold tracking-[-0.015em] sm:text-display">{title}</h1>
        {description && <p className="pt-[8.75px] text-title text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
