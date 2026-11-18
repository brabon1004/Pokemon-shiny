import type { MouseEvent, ReactNode, Ref } from 'react'

interface CalculatorSheetProps {
  ref: Ref<HTMLDialogElement>
  /** Id of the calculator heading inside, which names the dialog. */
  labelledBy: string
  /** Id of the line naming the Pokémon the sheet was opened for, read out when the sheet opens. */
  describedBy?: string | undefined
  children: ReactNode
}

/** Bottom sheet for the calculator on phones. Opened with showModal(), which traps focus and closes on Escape. */
export function CalculatorSheet({ ref, labelledBy, describedBy, children }: CalculatorSheetProps) {
  function closeOnBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    // The dialog has no padding, so a click whose target is the dialog itself landed on the backdrop.
    if (event.target === event.currentTarget) event.currentTarget.close()
  }

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onClick={closeOnBackdropClick}>
      <div className="sheet__body">
        <button
          type="button"
          className="sheet__close"
          aria-label="Close calculator"
          onClick={(event) => event.currentTarget.closest('dialog')?.close()}
        >
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
            <path d="M6 6 L18 18 M18 6 L6 18" />
          </svg>
        </button>
        {children}
      </div>
    </dialog>
  )
}
