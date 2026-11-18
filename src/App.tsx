import { ShinyOddsPage } from './components/ShinyOddsPage.tsx'
import { useCombinedData } from './hooks/useCombinedData.ts'
import { useNow } from './hooks/useNow.ts'

export default function App() {
  const { state, retry } = useCombinedData()
  const now = useNow()

  if (state.status === 'loaded') {
    return <ShinyOddsPage data={state.data} now={now} isSample={state.isSample} />
  }
  return (
    <div className="page">
      <main className="page__inner status-screen" aria-busy={state.status === 'loading'}>
        <h1 className="brand__title">Shiny Odds</h1>
        {state.status === 'loading' ? (
          <p role="status" className="muted">
            Loading the latest data…
          </p>
        ) : (
          <>
            <p role="alert">Couldn't load the latest data.</p>
            <button type="button" className="button button--primary" onClick={retry}>
              Retry
            </button>
          </>
        )}
      </main>
    </div>
  )
}
