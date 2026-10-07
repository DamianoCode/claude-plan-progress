import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Plan, Step } from '../types'

const plan = atom({ plugin: 'plan-progress', key: 'plan' } as const, null)
const isExpanded = atom({ plugin: 'plan-progress', key: 'isExpanded' } as const, false)
const isHidden = atom({ plugin: 'plan-progress', key: 'isHidden' } as const, false)

const PAD = 1
const PLAN_TOOL = 'mcp__plan-progress__plan'

const isDone = (p: Plan | null) => p !== null && p.steps.every(s => s.status === 'completed')

const bar = (ratio: number, width: number) => {
  const filled = Math.round(ratio * width)
  return ['█'.repeat(filled), '░'.repeat(width - filled)] as const
}

export const register: Register = on => {
  // TodoWrite sends the whole list each time.
  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      const steps: Step[] = e.todos.map((t, i) => ({
        id: String(i),
        title: t.content,
        active: t.activeForm,
        status: t.status,
      }))
      await update($, plan, () => (steps.length ? { steps } : null))
      await update($, isHidden, () => false)
    }
    return ran
  }).catch(($, e, next) => next(e))

  // TaskCreate/TaskUpdate build the list one task at a time.
  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      const step: Step = {
        id: ran.result.task.id,
        title: e.subject,
        active: e.activeForm ?? e.subject,
        status: 'pending',
      }
      // A new task after a finished plan starts a new plan.
      await update($, plan, p => ({ steps: [...(p === null || isDone(p) ? [] : p.steps), step] }))
      await update($, isHidden, () => false)
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError && ran.result.success) {
      await update($, plan, p => {
        if (p === null) return p
        const { status } = e
        const steps = status === 'deleted'
          ? p.steps.filter(s => s.id !== e.taskId)
          : p.steps.map(s =>
              s.id !== e.taskId
                ? s
                : {
                    ...s,
                    title: e.subject ?? s.title,
                    active: e.activeForm ?? s.active,
                    status: status ?? s.status,
                  },
            )
        return steps.length ? { steps } : null
      })
    }
    return ran
  }).catch(($, e, next) => next(e))

  // TaskList is the source of truth: reconcile with it.
  on('tool.call', { tool: 'TaskList' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      await update($, plan, p => {
        const known = new Map((p?.steps ?? []).map(s => [s.id, s]))
        const steps: Step[] = ran.result.tasks.map(t => ({
          id: t.id,
          title: t.subject,
          active: known.get(t.id)?.active ?? t.subject,
          status: t.status,
        }))
        return steps.length ? { steps } : null
      })
    }
    return ran
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'plan-progress' }, async $ => {
    const hidden = await update($, isHidden, h => !h)
    return { text: hidden ? 'Plan band hidden.' : 'Plan band shown.' }
  })

  // The mod's own planning tool, for sessions without TodoWrite / Task tools.
  on('tool.call', { tool: PLAN_TOOL }, async ($, e) => {
    const input = e as unknown as { steps?: { title?: unknown; active?: unknown; status?: unknown }[] }
    const steps: Step[] = (input.steps ?? []).map((s, i) => ({
      id: String(i),
      title: String(s.title ?? ''),
      active: String(s.active ?? s.title ?? ''),
      status: s.status === 'completed' || s.status === 'in_progress' ? s.status : 'pending',
    }))
    await update($, plan, () => (steps.length ? { steps } : null))
    await update($, isHidden, () => false)
    const done = steps.filter(s => s.status === 'completed').length
    return { result: `Plan updated: ${done}/${steps.length} steps completed.` }
  })

  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'plan',
      description:
        'Show the user the plan for multi-step work as a progress band above the prompt. ' +
        'Send the whole list every time: set a step in_progress when you start it and completed as soon as it is done. ' +
        'Send an empty list to clear the band.',
      inputSchema: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Imperative step name, e.g. "Run tests"' },
                active: { type: 'string', description: 'Present continuous form shown while in progress, e.g. "Running tests"' },
                status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
              },
              required: ['title', 'status'],
            },
          },
        },
        required: ['steps'],
      },
    })
    await $.command.register({ name: 'plan-progress', description: 'Show or hide the plan progress band' })
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const p = await read($, plan)
    if (e.props.hasSurvey || p === null || (await read($, isHidden))) {
      return next(e)
    }

    const { Box, Text, Button } = $.ui.resolve(e)
    const total = p.steps.length
    const done = p.steps.filter(s => s.status === 'completed').length
    const currentIdx = p.steps.findIndex(s => s.status === 'in_progress')
    const nextIdx = p.steps.findIndex(s => s.status !== 'completed')
    const idx = currentIdx >= 0 ? currentIdx : nextIdx
    const ratio = total ? done / total : 0
    const pct = Math.round(ratio * 100)
    const finished = done === total

    const label = finished
      ? 'Wszystkie etapy ukończone'
      : idx >= 0
        ? (currentIdx >= 0 ? p.steps[idx]!.active : `Następny: ${p.steps[idx]!.title}`)
        : ''
    const stage = finished ? `${total}/${total}` : `${idx + 1}/${total}`

    // One cell of padding each side, so the bar lines up with the header row.
    const width = Math.max(10, e.props.bodyColumns - 2 * PAD)
    const [full, empty] = bar(ratio, width)
    const tone = finished ? 'success' : 'claude'
    const expanded = await read($, isExpanded)

    return (
      <Box flexDirection="column" paddingX={PAD} paddingTop={1}>
        <Box>
          <Text color="claude" bold>◆ plan </Text>
          <Text bold>etap {stage} </Text>
          <Text dimColor>· </Text>
          <Text wrap="truncate-end">{label}</Text>
          <Box flexGrow={1} />
          <Text color={tone} bold> {pct}% </Text>
          <Button
            key="toggle"
            label={expanded ? 'Zwiń' : 'Lista'}
            onPress={() => update($, isExpanded, x => !x)}
          />
          <Text> </Text>
          <Button key="hide" label="Ukryj" onPress={() => update($, isHidden, () => true)} />
        </Box>
        <Box>
          <Text color={tone}>{full}</Text>
          <Text color="subtle">{empty}</Text>
        </Box>
        {expanded ? (
          <Box flexDirection="column" paddingTop={1}>
            {p.steps.map((step, i) => (
              <Box key={`step-${step.id}`}>
                <Text color={step.status === 'completed' ? 'success' : step.status === 'in_progress' ? 'claude' : 'inactive'}>
                  {step.status === 'completed' ? ' ✓ ' : step.status === 'in_progress' ? ' ▶ ' : ' ○ '}
                </Text>
                <Text dimColor>{String(i + 1).padStart(String(total).length)}. </Text>
                <Text
                  wrap="truncate-end"
                  bold={step.status === 'in_progress'}
                  dimColor={step.status === 'completed'}
                  color={step.status === 'pending' ? 'inactive' : undefined}
                >
                  {step.status === 'in_progress' ? step.active : step.title}
                </Text>
              </Box>
            ))}
          </Box>
        ) : null}
      </Box>
    )
  })
}
