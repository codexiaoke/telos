import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  ArrowUp,
  Bell,
  CircleHelp,
  Clock3,
  Folder,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Settings2,
  Sparkles
} from 'lucide-react'
import { motion } from 'motion/react'
import { Input, SearchField, TextArea, TextField } from 'react-aria-components'
import { Group, Panel, Separator } from 'react-resizable-panels'
import { AgentOrb } from './components/agent-orb/AgentOrb'
import { Button } from './components/ui/Button'

const easeOut = [0.22, 1, 0.36, 1] as const

function ConversationSidebar(): ReactNode {
  return (
    <aside className="flex h-full min-w-0 flex-col bg-[var(--telos-sidebar)]">
      <div className="window-drag h-11 shrink-0" />

      <div className="flex items-center justify-between px-4 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="grid size-7 shrink-0 place-items-center rounded-[9px] bg-[var(--telos-ink)] text-[11px] font-semibold text-white">
            T
          </div>
          <div className="truncate text-[14px] font-semibold tracking-[-0.01em]">TELOS</div>
        </div>
        <Button aria-label="更多" size="icon" variant="ghost">
          <MoreHorizontal size={16} strokeWidth={1.8} />
        </Button>
      </div>

      <div className="px-3">
        <Button className="w-full justify-start" variant="soft">
          <Plus size={16} />
          新会话
        </Button>

        <SearchField aria-label="搜索会话" className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--telos-text-tertiary)]" size={14} />
          <Input className="h-9 w-full rounded-[10px] border border-transparent bg-black/[0.035] pl-9 pr-3 text-[12px] outline-none transition placeholder:text-[var(--telos-text-tertiary)] hover:bg-black/[0.05] focus:border-black/10 focus:bg-white" placeholder="搜索" />
        </SearchField>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col px-3">
        <div className="flex items-center justify-between px-1.5 text-[10px] font-medium text-[var(--telos-text-tertiary)]">
          <span>会话</span>
          <Clock3 size={13} strokeWidth={1.7} />
        </div>

        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-1 flex-col items-center justify-center px-5 pb-16 text-center"
          initial={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.45, ease: easeOut }}
        >
          <div className="grid size-10 place-items-center rounded-[13px] border border-black/[0.06] bg-white/70 text-[var(--telos-text-tertiary)] shadow-[0_2px_10px_rgba(0,0,0,0.025)]">
            <MessageSquare size={17} strokeWidth={1.5} />
          </div>
          <p className="mt-3 text-[12px] font-medium text-[var(--telos-text-secondary)]">还没有会话</p>
          <p className="mt-1 max-w-40 text-[10px] leading-4 text-[var(--telos-text-tertiary)]">从一个想法、问题或长期目标开始。</p>
        </motion.div>
      </div>

      <div className="border-t border-black/[0.055] p-3">
        <Button className="w-full justify-start" variant="ghost">
          <span className="grid size-6 place-items-center rounded-full bg-[#d8cfb7] text-[9px] font-semibold text-[#665c45]">X</span>
          <span className="min-w-0 flex-1 truncate text-left">本地个人空间</span>
          <Settings2 size={14} strokeWidth={1.7} />
        </Button>
      </div>
    </aside>
  )
}

function Composer(): ReactNode {
  const [draft, setDraft] = useState('')

  return (
    <TextField
      aria-label="给 TELOS 发消息"
      className="mx-auto w-full max-w-[760px]"
      onChange={setDraft}
      value={draft}
    >
      <motion.div
        className="rounded-[22px] border border-black/[0.09] bg-white px-4 pb-3 pt-3 shadow-[0_10px_35px_rgba(25,25,25,0.08),0_1px_2px_rgba(0,0,0,0.03)]"
        layout
        transition={{ duration: 0.28, ease: easeOut }}
      >
        <TextArea
          className="max-h-40 min-h-12 w-full resize-none bg-transparent px-1 py-1 text-[14px] leading-6 text-[var(--telos-text-primary)] outline-none placeholder:text-[var(--telos-text-tertiary)]"
          placeholder="向 TELOS 描述你想做的事情…"
          rows={2}
        />

        <div className="mt-1 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button aria-label="添加附件" size="icon" variant="ghost">
              <Paperclip size={16} strokeWidth={1.7} />
            </Button>
            <Button aria-label="更多能力" size="icon" variant="ghost">
              <Plus size={17} strokeWidth={1.7} />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button aria-label="语音输入" size="icon" variant="ghost">
              <Mic size={16} strokeWidth={1.7} />
            </Button>
            <Button aria-label="发送" isDisabled={!draft.trim()} size="icon" variant="primary">
              <ArrowUp size={16} strokeWidth={2} />
            </Button>
          </div>
        </div>
      </motion.div>
    </TextField>
  )
}

function ChatWorkspace(): ReactNode {
  return (
    <main className="relative flex h-full min-w-0 flex-col bg-[var(--telos-surface)]">
      <header className="window-drag flex h-[52px] shrink-0 items-center justify-between border-b border-black/[0.06] px-5">
        <div className="flex min-w-0 items-center gap-2 text-[12px] text-[var(--telos-text-secondary)]">
          <Folder size={15} strokeWidth={1.7} />
          <span className="truncate font-medium text-[var(--telos-text-primary)]">新会话</span>
        </div>
        <div className="window-no-drag flex items-center gap-1">
          <Button aria-label="通知" size="icon" variant="ghost">
            <Bell size={15} strokeWidth={1.7} />
          </Button>
          <Button aria-label="会话选项" size="icon" variant="ghost">
            <MoreHorizontal size={16} strokeWidth={1.8} />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        <motion.section
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 pb-8 text-center"
          initial={{ opacity: 0, scale: 0.985, y: 8 }}
          transition={{ delay: 0.06, duration: 0.55, ease: easeOut }}
        >
          <div className="grid size-12 place-items-center rounded-[16px] border border-black/[0.07] bg-[var(--telos-sidebar)] text-[var(--telos-text-secondary)] shadow-[0_4px_18px_rgba(0,0,0,0.035)]">
            <Sparkles size={20} strokeWidth={1.5} />
          </div>
          <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.035em] text-[var(--telos-text-primary)]">从这里开始</h1>
          <p className="mt-2 max-w-[390px] text-[12px] leading-5 text-[var(--telos-text-tertiary)]">
            这是 TELOS 的桌面工作区。未来，会话会与目标、记忆和持续活动保持连接。
          </p>
        </motion.section>

        <div className="shrink-0 px-7 pb-6">
          <Composer />
          <p className="mt-2 text-center text-[9px] text-[var(--telos-text-tertiary)]">本地优先 · 当前为空壳，尚未连接 Agent Runtime</p>
        </div>
      </div>
    </main>
  )
}

function ActivityPanel(): ReactNode {
  return (
    <aside className="flex h-full min-w-0 flex-col bg-[var(--telos-panel)]">
      <header className="window-drag flex h-[52px] shrink-0 items-center justify-between border-b border-black/[0.06] px-4">
        <div className="flex items-center gap-2 text-[12px] font-medium">
          <Activity size={15} strokeWidth={1.7} />
          <span>活动</span>
        </div>
        <div className="window-no-drag">
          <Button aria-label="活动面板选项" size="icon" variant="ghost">
            <MoreHorizontal size={16} strokeWidth={1.8} />
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-5 py-6">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center border-b border-black/[0.06] pb-7 text-center"
          initial={{ opacity: 0, y: 8 }}
          transition={{ delay: 0.12, duration: 0.52, ease: easeOut }}
        >
          <div className="relative grid size-[86px] place-items-center rounded-full bg-white/65 shadow-[0_10px_35px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.055]">
            <AgentOrb aria-label="TELOS 已准备就绪" size={64} state="idle" />
          </div>
          <h2 className="mt-4 text-[13px] font-semibold tracking-[-0.01em]">TELOS 已就绪</h2>
          <p className="mt-1.5 text-[10px] leading-4 text-[var(--telos-text-tertiary)]">当前没有 Agent 正在运行</p>
        </motion.div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-[10px] font-medium text-[var(--telos-text-tertiary)]">
            <span>最近活动</span>
            <span>0</span>
          </div>
          <div className="mt-5 flex items-start gap-3">
            <div className="mt-1.5 size-1.5 shrink-0 rounded-full bg-black/15" />
            <div>
              <p className="text-[11px] font-medium text-[var(--telos-text-secondary)]">等待第一个任务</p>
              <p className="mt-1 text-[10px] leading-4 text-[var(--telos-text-tertiary)]">运行过程、工具调用和产物会按时间出现在这里。</p>
            </div>
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-black/[0.06] pt-4 text-[9px] text-[var(--telos-text-tertiary)]">
          <span className="inline-flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-emerald-500/70" /> 本地状态正常</span>
          <Button aria-label="帮助" size="icon" variant="ghost">
            <CircleHelp size={14} strokeWidth={1.7} />
          </Button>
        </div>
      </div>
    </aside>
  )
}

export function App(): ReactNode {
  const [appVersion, setAppVersion] = useState('0.1.0')

  useEffect(() => {
    void window.telos.system.getAppInfo().then((info) => setAppVersion(info.version))
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-[var(--telos-surface)] text-[var(--telos-text-primary)]">
      <Group className="h-full" id={`telos-shell-${appVersion}`} orientation="horizontal">
        <Panel defaultSize="19%" groupResizeBehavior="preserve-pixel-size" id="conversations" maxSize="380px" minSize="240px">
          <ConversationSidebar />
        </Panel>
        <Separator className="resize-separator" id="conversation-separator">
          <span />
        </Separator>
        <Panel defaultSize="57%" id="workspace" minSize="480px">
          <ChatWorkspace />
        </Panel>
        <Separator className="resize-separator" id="activity-separator">
          <span />
        </Separator>
        <Panel defaultSize="24%" groupResizeBehavior="preserve-pixel-size" id="activity" maxSize="440px" minSize="280px">
          <ActivityPanel />
        </Panel>
      </Group>
    </div>
  )
}
