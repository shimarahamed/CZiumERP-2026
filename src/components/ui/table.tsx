import * as React from "react"

import { cn } from "@/lib/utils"

/** Recursively extract the plain-text content of a React node (for header labels). */
function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node)
  if (Array.isArray(node)) return node.map(extractText).join("")
  if (React.isValidElement(node)) return extractText(node.props.children)
  return ""
}

/** Pull the column labels out of a <TableHeader> element's first row. */
function getHeaderLabels(children: React.ReactNode): string[] {
  let labels: string[] = []
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return
    if (child.type === TableHeader || child.type === "thead") {
      const rows = React.Children.toArray(child.props.children)
      const firstRow = rows.find((r) => React.isValidElement(r)) as
        | React.ReactElement
        | undefined
      if (firstRow) {
        labels = React.Children.toArray(firstRow.props.children).map((cell) =>
          React.isValidElement(cell) ? extractText(cell.props.children).trim() : ""
        )
      }
    }
  })
  return labels
}

/** Stamp data-label (from header text) onto each body cell so the mobile
 * card CSS can render "Label: value" lines. Skips colSpan cells and cells
 * that already carry an explicit data-label. */
function labelBodyCells(children: React.ReactNode, labels: string[]): React.ReactNode {
  if (labels.length === 0) return children
  return React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child
    if (child.type !== TableBody && child.type !== "tbody") return child
    const body = child as React.ReactElement<{ children?: React.ReactNode }>
    const rows = React.Children.map(body.props.children, (row) => {
      if (!React.isValidElement(row)) return row
      const rowEl = row as React.ReactElement<{ children?: React.ReactNode }>
      if (!rowEl.props.children) return row
      let cellIndex = 0
      const cells = React.Children.map(rowEl.props.children, (cell) => {
        if (!React.isValidElement(cell)) return cell
        const isCell = cell.type === TableCell || cell.type === "td"
        if (!isCell) return cell
        const idx = cellIndex++
        const props = cell.props as React.TdHTMLAttributes<HTMLTableCellElement> & {
          "data-label"?: string
        }
        if (props.colSpan || props["data-label"] || !labels[idx]) return cell
        return React.cloneElement(cell, { "data-label": labels[idx] } as any)
      })
      return React.cloneElement(row, undefined, cells)
    })
    return React.cloneElement(child, undefined, rows)
  })
}

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Renders rows as stacked cards on phones (<640px). Desktop/tablet unchanged.
   * Set to false for matrix-style tables that must stay tabular everywhere. */
  mobileCards?: boolean
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, mobileCards = true, children, ...props }, ref) => {
    const content = mobileCards
      ? labelBodyCells(children, getHeaderLabels(children))
      : children
    return (
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          className={cn(
            "w-full caption-bottom text-sm",
            mobileCards && "responsive-cards",
            className
          )}
          {...props}
        >
          {content}
        </table>
      </div>
    )
  }
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
