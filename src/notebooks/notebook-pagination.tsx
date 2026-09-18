import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/core/ui/pagination"

export function NotebookPagination({
  page,
  pages,
  goToPage,
}: {
  page: number
  pages: number
  goToPage: (p: number) => void
}) {
  return (
    /* ponytail: sin elipsis — a 59 notebooks son 3 páginas y entran todas. Si `pages` crece,
        `PaginationEllipsis` ya está importable desde el mismo módulo. */
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            text="Anterior"
            href="#"
            aria-disabled={page === 1}
            className={page === 1 ? "pointer-events-none opacity-50" : ""}
            onClick={(e) => {
              e.preventDefault()
              goToPage(Math.max(page - 1, 1))
            }}
          />
        </PaginationItem>
        {Array.from({ length: pages }, (_, i) => (
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              isActive={page === i + 1}
              onClick={(e) => {
                e.preventDefault()
                goToPage(i + 1)
              }}
            >
              {i + 1}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            text="Siguiente"
            href="#"
            aria-disabled={page === pages}
            className={page === pages ? "pointer-events-none opacity-50" : ""}
            onClick={(e) => {
              e.preventDefault()
              goToPage(Math.min(page + 1, pages))
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
