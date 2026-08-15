import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useDshWebStatus } from './useDshWebStatus'

export function BootstrapApp(): ReactNode {
  const { snapshot, retry, retrying, bridgeError } = useDshWebStatus()
  const failed = snapshot.state === 'failed' || bridgeError !== undefined
  const diagnostic = bridgeError ?? snapshot.detail?.split('\n')[0]

  return (
    <main className="bootstrap-shell window-drag">
      {failed ? (
        <section className="bootstrap-recovery window-no-drag" role="alert">
          <h1>Telos 启动失败</h1>
          {diagnostic !== undefined && <p>{diagnostic}</p>}
          <Button isDisabled={retrying} onPress={retry} variant="primary">
            <RefreshCw className={retrying ? 'animate-spin' : undefined} size={14} strokeWidth={1.9} />
            {retrying ? '正在重试' : '重试'}
          </Button>
        </section>
      ) : (
        <div aria-label="Telos 正在启动" className="bootstrap-loader" role="status">
          <span className="sr-only">Telos 正在启动</span>
        </div>
      )}
    </main>
  )
}
