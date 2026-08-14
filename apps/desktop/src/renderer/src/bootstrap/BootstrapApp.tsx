import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, RefreshCw, ShieldCheck } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { DshWebSnapshot } from '../../../shared/dsh-web'
import { AgentOrb } from '../components/agent-orb/AgentOrb'
import { Button } from '../components/ui/Button'
import { useDshWebStatus } from './useDshWebStatus'

const easeOut = [0.22, 1, 0.36, 1] as const

interface BootstrapCopy {
  eyebrow: string
  title: string
  description: string
}

function copyFor(snapshot: DshWebSnapshot): BootstrapCopy {
  switch (snapshot.state) {
    case 'ready':
      return {
        eyebrow: '工作台已就绪',
        title: '正在进入 TELOS',
        description: '个人工作台已经连接，正在交接给完整界面。',
      }
    case 'failed':
      return {
        eyebrow: '需要处理',
        title: '个人工作台暂时没有启动',
        description: '你的本地数据没有受到影响。可以重新启动运行时，再继续刚才的工作。',
      }
    case 'stopping':
      return {
        eyebrow: '正在恢复',
        title: '正在重置本地运行时',
        description: 'TELOS 正在安全停止旧进程，然后重新连接工作台。',
      }
    case 'stopped':
      return {
        eyebrow: '运行时已停止',
        title: '个人工作台等待重新启动',
        description: '本地状态仍然保留，可以随时重新连接完整工作台。',
      }
    case 'starting':
      return {
        eyebrow: '本地优先 · 正在启动',
        title: '正在准备你的个人工作台',
        description: '正在加载 DSH Runtime、TELOS Renderer 和本地个人空间。',
      }
    case 'idle':
      return {
        eyebrow: '本地优先',
        title: '正在唤醒 TELOS',
        description: '你的个人上下文与运行能力将在本机完成连接。',
      }
  }
}

function StartupTrack({ state }: { state: DshWebSnapshot['state'] }): ReactNode {
  const failure = state === 'failed'
  const ready = state === 'ready'
  const activeStep = state === 'idle' ? 0 : state === 'starting' || state === 'stopping' ? 1 : 2
  const steps = ['读取本地配置', '启动 DSH Runtime', '载入 TELOS 工作台']

  return (
    <ol aria-label="启动进度" className="bootstrap-track">
      {steps.map((label, index) => {
        const complete = ready || index < activeStep
        const active = index === activeStep && !failure
        const failed = failure && index === 1
        return (
          <li className="bootstrap-step" data-active={active || undefined} data-complete={complete || undefined} data-failed={failed || undefined} key={label}>
            <span className="bootstrap-step-marker" aria-hidden>
              {complete ? <Check size={11} strokeWidth={2.4} /> : failed ? <AlertTriangle size={11} strokeWidth={2} /> : <span />}
            </span>
            <span>{label}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function BootstrapApp(): ReactNode {
  const { snapshot, retry, retrying, bridgeError } = useDshWebStatus()
  const [version, setVersion] = useState('0.1.0')
  const [platform, setPlatform] = useState(() => (
    navigator.platform.startsWith('Mac') ? 'darwin' : navigator.platform.startsWith('Win') ? 'win32' : 'linux'
  ))
  const copy = copyFor(snapshot)
  const failed = snapshot.state === 'failed' || bridgeError !== undefined
  const diagnostic = bridgeError ?? snapshot.detail?.split('\n')[0]

  useEffect(() => {
    void window.telos.system.getAppInfo().then((info) => {
      setVersion(info.version)
      setPlatform(info.platform)
    })
  }, [])

  return (
    <main className="bootstrap-shell" data-platform={platform}>
      <div className="bootstrap-ambient bootstrap-ambient-one" />
      <div className="bootstrap-ambient bootstrap-ambient-two" />

      <header className="bootstrap-titlebar window-drag">
        <div className="bootstrap-brand window-no-drag" aria-label="TELOS">
          <span className="bootstrap-brand-mark">T</span>
          <span>TELOS</span>
        </div>
        <div className="bootstrap-local-badge">
          <ShieldCheck size={13} strokeWidth={1.8} />
          本地个人空间
        </div>
      </header>

      <section className="bootstrap-stage" aria-live="polite">
        <motion.div
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="bootstrap-orb-shell"
          initial={{ opacity: 0, scale: 0.94, y: 10 }}
          transition={{ duration: 0.65, ease: easeOut }}
        >
          <span className="bootstrap-orb-ring" />
          <AgentOrb
            aria-label={failed ? 'TELOS 运行时需要恢复' : 'TELOS 正在启动'}
            size={96}
            state={failed ? 'idle' : 'working'}
          />
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="bootstrap-copy"
            exit={{ opacity: 0, y: -4 }}
            initial={{ opacity: 0, y: 5 }}
            key={`${snapshot.state}-${bridgeError === undefined ? 'runtime' : 'bridge'}`}
            transition={{ duration: 0.28, ease: easeOut }}
          >
            <p className="bootstrap-eyebrow" data-failed={failed || undefined}>{bridgeError === undefined ? copy.eyebrow : '连接异常'}</p>
            <h1>{bridgeError === undefined ? copy.title : '无法读取本地启动状态'}</h1>
            <p className="bootstrap-description">{bridgeError === undefined ? copy.description : '桌面桥接暂时不可用，请重新打开 TELOS。'}</p>
          </motion.div>
        </AnimatePresence>

        <StartupTrack state={snapshot.state} />

        {failed && (
          <motion.div animate={{ opacity: 1, y: 0 }} className="bootstrap-recovery" initial={{ opacity: 0, y: 6 }}>
            {diagnostic !== undefined && <p role="alert">{diagnostic}</p>}
            <Button isDisabled={retrying} onPress={retry} variant="primary">
              <RefreshCw className={retrying ? 'animate-spin' : undefined} size={14} strokeWidth={1.9} />
              {retrying ? '正在重新连接' : '重新启动工作台'}
            </Button>
          </motion.div>
        )}
      </section>

      <footer className="bootstrap-footer">
        <span>TELOS {version}</span>
        <span>DSH Runtime · TELOS Renderer</span>
      </footer>
    </main>
  )
}
