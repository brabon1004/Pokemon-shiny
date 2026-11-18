/**
 * In GitHub Actions a plain console.warn is buried in the log; a `::warning::` workflow command also shows the
 * message on the run summary. `%`, CR, and LF must be escaped or the runner misreads the command.
 */
export function formatWarning(message: string, env: Readonly<Record<string, string | undefined>>): string {
  return formatAnnotation('warning', message, env)
}

/** The fatal-error counterpart of formatWarning, as a `::error::` command in GitHub Actions. */
export function formatError(message: string, env: Readonly<Record<string, string | undefined>>): string {
  return formatAnnotation('error', message, env)
}

function formatAnnotation(
  level: 'warning' | 'error',
  message: string,
  env: Readonly<Record<string, string | undefined>>,
): string {
  if (env['GITHUB_ACTIONS'] !== 'true') return message
  const escaped = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A')
  return `::${level}::${escaped}`
}
