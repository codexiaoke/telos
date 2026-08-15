import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Contact, ContactGroup, DeliveryRecord, MailConfig, MailSettingsView, RecipientDirectory, ReportType, SentMailSyncConfig } from '../contracts.js'
import type { WorkReportClientController } from './controller.js'

export interface WorkReportInjected { controller: WorkReportClientController }

const REPORT_LABELS: Record<ReportType, string> = { daily: '日报', weekly: '周报', monthly: '月报' }
const EMPTY_MAIL: MailConfig = {
  host: '', port: 465, secure: true, username: '', fromName: '', fromAddress: '',
}

function editableMail(config?: MailSettingsView): MailConfig {
  return config === undefined ? { ...EMPTY_MAIL } : {
    host: config.host,
    port: config.port,
    secure: config.secure,
    username: config.username,
    fromName: config.fromName,
    fromAddress: config.fromAddress,
    ...(config.sentSync === undefined ? {} : {
      sentSync: {
        enabled: true,
        host: config.sentSync.host,
        port: config.sentSync.port,
        secure: config.sentSync.secure,
        username: config.sentSync.username,
        passwordMode: config.sentSync.passwordMode,
        ...(config.sentSync.mailbox === undefined ? {} : { mailbox: config.sentSync.mailbox }),
      },
    }),
  }
}

function contactLines(contacts: readonly Contact[]): string {
  return contacts.map(contact => `${contact.id} | ${contact.name} | ${contact.email}`).join('\n')
}

function groupLines(groups: readonly ContactGroup[]): string {
  return groups.map(group => `${group.id} | ${group.name} | ${group.contactIds.join(', ')}`).join('\n')
}

function parseContacts(value: string): Contact[] {
  return value.split('\n').filter(line => line.trim() !== '').map((line, index) => {
    const fields = line.split('|').map(field => field.trim())
    if (fields.length !== 3 || fields.some(field => field === '')) throw new TypeError(`联系人第 ${String(index + 1)} 行应为：标识 | 姓名 | 邮箱`)
    return { id: fields[0]!, name: fields[1]!, email: fields[2]! }
  })
}

function parseGroups(value: string): ContactGroup[] {
  return value.split('\n').filter(line => line.trim() !== '').map((line, index) => {
    const fields = line.split('|').map(field => field.trim())
    if (fields.length !== 3 || fields[0] === '' || fields[1] === '') throw new TypeError(`分组第 ${String(index + 1)} 行应为：标识 | 名称 | 联系人标识列表`)
    return {
      id: fields[0]!,
      name: fields[1]!,
      contactIds: fields[2] === '' ? [] : fields[2]!.split(',').map(id => id.trim()).filter(Boolean),
    }
  })
}

function Standards({ controller, values }: { controller: WorkReportClientController; values: Record<ReportType, string> }) {
  const [selected, setSelected] = useState<ReportType>('daily')
  const [drafts, setDrafts] = useState(values)
  useEffect(() => setDrafts(values), [values])
  return <div className="telosReportPanel">
    <div className="telosReportPanelHeader"><div><h2>报告规范</h2><p>首次生成前，Agent 会在对话中确认受众、语气、篇幅和内容范围。确认后的规范保存在这里。</p></div></div>
    <div className="telosReportTabs">{REPORT_TYPES.map(type => <button aria-pressed={selected === type} data-active={selected === type || undefined} key={type} onClick={() => setSelected(type)} type="button">{REPORT_LABELS[type]}</button>)}</div>
    <label>已确认的{REPORT_LABELS[selected]}规范<textarea onChange={event => setDrafts(current => ({ ...current, [selected]: event.target.value }))} placeholder={`例如：面向直属主管；语气简洁、事实化；控制在 500 字以内……`} rows={8} value={drafts[selected]} /></label>
    <div className="telosReportActions"><button data-primary disabled={drafts[selected].trim() === ''} onClick={() => { void controller.saveStandard(selected, drafts[selected]) }} type="button">保存{REPORT_LABELS[selected]}规范</button></div>
  </div>
}

const REPORT_TYPES: readonly ReportType[] = ['daily', 'weekly', 'monthly']

function Recipients({ controller, directory }: { controller: WorkReportClientController; directory: RecipientDirectory }) {
  const [contacts, setContacts] = useState(contactLines(directory.contacts))
  const [groups, setGroups] = useState(groupLines(directory.groups))
  const [localError, setLocalError] = useState<string>()
  useEffect(() => { setContacts(contactLines(directory.contacts)); setGroups(groupLines(directory.groups)) }, [directory])
  const save = (): void => {
    try {
      setLocalError(undefined)
      void controller.saveDirectory({ version: 1, contacts: parseContacts(contacts), groups: parseGroups(groups) })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error))
    }
  }
  return <div className="telosReportPanel">
    <div className="telosReportPanelHeader"><div><h2>联系人与分组</h2><p>邮件发送时按标识选择联系人或分组；审批窗口会展示展开后的真实收件人。</p></div></div>
    {localError === undefined ? null : <div className="telosReportBanner" data-error>{localError}</div>}
    <div className="telosReportGrid">
      <label>联系人（每行一个）<textarea onChange={event => setContacts(event.target.value)} placeholder="manager | 直属主管 | manager@example.com" rows={7} value={contacts} /><small>格式：标识 | 姓名 | 邮箱</small></label>
      <label>分组（每行一个）<textarea onChange={event => setGroups(event.target.value)} placeholder="weekly-review | 周报收件组 | manager, teammate" rows={7} value={groups} /><small>格式：标识 | 名称 | 联系人标识，用英文逗号分隔</small></label>
    </div>
    <div className="telosReportActions"><button data-primary onClick={save} type="button">保存联系人与分组</button></div>
  </div>
}

function Mail({ controller, configured }: { controller: WorkReportClientController; configured?: MailSettingsView }) {
  const [mail, setMail] = useState<MailConfig>(() => editableMail(configured))
  const [password, setPassword] = useState('')
  const [imapPassword, setImapPassword] = useState('')
  useEffect(() => setMail(editableMail(configured)), [configured])
  const update = (patch: Partial<MailConfig>) => setMail(current => ({ ...current, ...patch }))
  const updateSync = (patch: Partial<SentMailSyncConfig>) => setMail(current => current.sentSync === undefined
    ? current
    : { ...current, sentSync: { ...current.sentSync, ...patch } })
  const setSyncEnabled = (enabled: boolean): void => update({
    sentSync: enabled ? mail.sentSync ?? {
      enabled: true,
      host: '',
      port: 993,
      secure: true,
      username: mail.username,
      passwordMode: 'smtp',
    } : undefined,
  })
  const save = (): void => {
    void controller.saveMail(
      mail,
      password.trim() === '' ? undefined : password,
      mail.sentSync?.passwordMode !== 'imap' || imapPassword.trim() === '' ? undefined : imapPassword,
    )
    setPassword('')
    setImapPassword('')
  }
  return <div className="telosReportPanel">
    <div className="telosReportPanelHeader"><div><h2>邮件发送与已发送同步</h2><p>SMTP 负责投递；可选的 IMAP 同步会在完整投递后，把同一份排版邮件写入邮箱“已发送”。密码交给 DSH 凭据存储。</p></div><span className="telosReportStatus" data-ready={configured?.passwordConfigured || undefined}>{configured?.passwordConfigured ? `SMTP 密码已配置${configured.passwordSource === undefined ? '' : ` · ${configured.passwordSource}`}` : 'SMTP 密码未配置'}</span></div>
    <div className="telosReportGrid telosReportMailGrid">
      <label>SMTP 主机<input onChange={event => update({ host: event.target.value })} placeholder="smtp.example.com" value={mail.host} /></label>
      <label>端口<input min="1" max="65535" onChange={event => update({ port: Number(event.target.value) })} type="number" value={mail.port} /></label>
      <label>用户名<input onChange={event => update({ username: event.target.value })} placeholder="sender@example.com" value={mail.username} /></label>
      <label>发件人名称<input onChange={event => update({ fromName: event.target.value })} placeholder="小可" value={mail.fromName} /></label>
      <label>发件邮箱<input onChange={event => update({ fromAddress: event.target.value })} placeholder="sender@example.com" value={mail.fromAddress} /></label>
      <label>SMTP 密码<input autoComplete="new-password" onChange={event => setPassword(event.target.value)} placeholder={configured?.passwordConfigured ? '留空则保持现有密码' : '输入密码或应用专用密码'} type="password" value={password} /></label>
    </div>
    <label className="telosReportCheckbox"><input checked={mail.secure} onChange={event => update({ secure: event.target.checked })} type="checkbox" />使用 TLS 直连（常用于 465 端口）</label>
    <div className="telosReportSubsection">
      <label className="telosReportCheckbox"><input checked={mail.sentSync !== undefined} onChange={event => setSyncEnabled(event.target.checked)} type="checkbox" />发送全部成功后，同步到邮箱“已发送”文件夹</label>
      {mail.sentSync === undefined ? null : <>
        <div className="telosReportGrid telosReportImapGrid">
          <label>IMAP 主机<input onChange={event => updateSync({ host: event.target.value })} placeholder="imap.example.com" value={mail.sentSync.host} /></label>
          <label>端口<input min="1" max="65535" onChange={event => updateSync({ port: Number(event.target.value) })} type="number" value={mail.sentSync.port} /></label>
          <label>IMAP 用户名<input onChange={event => updateSync({ username: event.target.value })} placeholder="sender@example.com" value={mail.sentSync.username} /></label>
          <label>已发送文件夹<input onChange={event => updateSync({ mailbox: event.target.value.trim() === '' ? undefined : event.target.value })} placeholder="留空则自动识别" value={mail.sentSync.mailbox ?? ''} /><small>无法自动识别时填写服务器中的准确路径，例如 Sent Messages。</small></label>
        </div>
        <div className="telosReportInlineOptions">
          <label className="telosReportCheckbox"><input checked={mail.sentSync.secure} onChange={event => updateSync({ secure: event.target.checked })} type="checkbox" />使用 IMAP TLS 直连（常用于 993 端口）</label>
          <label className="telosReportCheckbox"><input checked={mail.sentSync.passwordMode === 'smtp'} onChange={event => updateSync({ passwordMode: event.target.checked ? 'smtp' : 'imap' })} type="checkbox" />复用 SMTP 密码</label>
        </div>
        {mail.sentSync.passwordMode === 'smtp' ? null : <label className="telosReportImapPassword">IMAP 密码<input autoComplete="new-password" onChange={event => setImapPassword(event.target.value)} placeholder={configured?.sentSync?.passwordConfigured ? '留空则保持现有密码' : '输入 IMAP 密码或应用专用密码'} type="password" value={imapPassword} /></label>}
        <p className="telosReportHint">IMAP 同步失败不会重新发送邮件；可在对话中要求“重试同步已发送”。</p>
      </>}
    </div>
    <div className="telosReportActions">
      {configured?.sentSync?.passwordMode === 'imap' && configured.sentSync.passwordConfigured && configured.sentSync.passwordWritable !== false ? <button data-danger onClick={() => { setImapPassword(''); void controller.saveMail(mail, undefined, null) }} type="button">清除 IMAP 密码</button> : null}
      {configured?.passwordConfigured && configured.passwordWritable !== false ? <button data-danger onClick={() => { setPassword(''); void controller.saveMail(mail, null) }} type="button">清除 SMTP 密码</button> : null}
      <button data-primary onClick={save} type="button">保存邮件配置</button>
    </div>
  </div>
}

function syncLabel(record: DeliveryRecord): string {
  if (record.sentFolderSync.status === 'synced') return `已同步${record.sentFolderSync.mailbox === undefined ? '' : ` · ${record.sentFolderSync.mailbox}`}`
  if (record.sentFolderSync.status === 'failed') return '同步失败'
  if (record.sentFolderSync.status === 'pending') return '等待同步'
  return '未启用同步'
}

function DeliveryHistory({ records }: { records: readonly DeliveryRecord[] }) {
  return <div className="telosReportPanel">
    <div className="telosReportPanelHeader"><div><h2>已发送工作报告</h2><p>记录实际收件人、SMTP 投递结果和“已发送”文件夹同步状态。记录仅保存在本机。</p></div></div>
    {records.length === 0 ? <div className="telosReportEmpty">还没有已发送的工作报告。</div> : <div className="telosReportDeliveryList">
      {records.map(record => <div className="telosReportDelivery" key={record.deliveryId}>
        <div><strong>{record.report.title}</strong><small>{record.subject} · {new Date(record.sentAt ?? record.createdAt).toLocaleString('zh-CN')}</small></div>
        <div><span>{record.status === 'sent' ? `已发送给 ${String(record.sentCount)} 人` : `${String(record.sentCount)} 人成功，${String(record.failedCount)} 人失败`}</span><small title={record.recipients.map(recipient => recipient.email).join('、')}>{record.recipients.map(recipient => recipient.name).join('、')}</small></div>
        <div data-sync={record.sentFolderSync.status}><span>{syncLabel(record)}</span>{record.sentFolderSync.error === undefined ? null : <small title={record.sentFolderSync.error}>在对话中说“重试同步已发送”</small>}</div>
      </div>)}
    </div>}
  </div>
}

export function WorkReportSettingsSection({ controller }: WorkReportInjected) {
  const state = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  useEffect(() => { void controller.refresh() }, [controller])
  const settings = state.settings
  const reportSummary = useMemo(() => {
    const counts = { daily: 0, weekly: 0, monthly: 0 }
    for (const report of state.reports) counts[report.type] += 1
    return counts
  }, [state.reports])
  return <section aria-label="工作报告设置" className="telosReportSettings">
    <header className="telosReportHeader">
      <div><h1>工作报告</h1><p>通过自然对话生成日报，并从本地已有报告汇总周报和月报。报告正文始终是普通 Markdown 文件。</p></div>
      <button disabled={state.loading} onClick={() => { void controller.refresh() }} type="button">刷新</button>
    </header>
    {state.error === undefined ? null : <div className="telosReportBanner" data-error>{state.error}</div>}
    {state.notice === undefined ? null : <div className="telosReportBanner">{state.notice}</div>}
    {settings === undefined ? <div className="telosReportEmpty">{state.loading ? '正在读取本地配置…' : '尚未读取到工作报告配置。'}</div> : <>
      <div className="telosReportSummary">
        <span><strong>{reportSummary.daily}</strong> 篇日报</span><span><strong>{reportSummary.weekly}</strong> 篇周报</span><span><strong>{reportSummary.monthly}</strong> 篇月报</span><small>报告和配置全部保存在本机</small>
      </div>
      <Standards controller={controller} values={settings.standards} />
      <Recipients controller={controller} directory={settings.directory} />
      <Mail controller={controller} configured={settings.mail} />
      <DeliveryHistory records={state.deliveries} />
    </>}
  </section>
}
