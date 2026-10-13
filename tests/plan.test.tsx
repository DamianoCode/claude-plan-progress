import { expect, test } from 'claude-code/testing'

const BAND = {
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 60, scroll: { offset: 0, bodyRows: 19 }, view: {} },
} as const

const todos = [
  { content: 'Zbadaj kod', activeForm: 'Badam kod', status: 'completed' },
  { content: 'Napisz moda', activeForm: 'Piszę moda', status: 'in_progress' },
  { content: 'Przetestuj', activeForm: 'Testuję', status: 'pending' },
  { content: 'Opisz', activeForm: 'Opisuję', status: 'pending' },
] as const

test('TodoWrite shows the current step and the share done', async ($, on) => {
  on('tool.call', { tool: 'TodoWrite' }, (_, e) => ({ result: { oldTodos: [], newTodos: [...e.todos] } }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await $.tool.call({ tool: 'TodoWrite', todos: [...todos] })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'plan-progress', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /etap 2\/4/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Piszę moda/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /25%/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'engine' })).toBeDefined()
    await ui.press({ key: 'hide' })
    expect(await ui.find({ type: 'Text', text: /etap/ })).toBeUndefined()
    await ui.unmount()
    await $.tool.call({ tool: 'TodoWrite', todos: [...todos] })
  }
})

test('TaskCreate and TaskUpdate build the plan', async ($, on) => {
  let n = 0
  on('tool.call', { tool: 'TaskCreate' }, (_, e) => ({ result: { task: { id: String(++n), subject: e.subject } } }))
  on('tool.call', { tool: 'TaskUpdate' }, (_, e) => ({ result: { success: true, taskId: e.taskId, updatedFields: ['status'] } }))
  await $.tool.call({ tool: 'TaskCreate', subject: 'A', description: 'a', activeForm: 'Robię A' })
  await $.tool.call({ tool: 'TaskCreate', subject: 'B', description: 'b' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '2', status: 'in_progress' })

  const ui = await $.ui.mount({ plugin: 'plan-progress', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /etap 2\/2/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /50%/ })).toBeDefined()
})

test('the mod\'s own plan tool drives the band', async $ => {
  await $.tool.call({
    tool: 'mcp__plan-progress__plan',
    steps: [
      { title: 'A', status: 'completed' },
      { title: 'B', active: 'Robię B', status: 'in_progress' },
      { title: 'C', status: 'pending' },
    ],
  } as never)
  const ui = await $.ui.mount({ plugin: 'plan-progress', surface: 'terminal', ...BAND })
  expect(await ui.find({ type: 'Text', text: /etap 2\/3/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Robię B/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /33%/ })).toBeDefined()
})

test('the list expands to every step and collapses again', async $ => {
  await $.tool.call({
    tool: 'mcp__plan-progress__plan',
    steps: [
      { title: 'Krok A', status: 'completed' },
      { title: 'Krok B', active: 'Robię B', status: 'in_progress' },
      { title: 'Krok C', status: 'pending' },
    ],
  } as never)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'plan-progress', surface, ...BAND })
    expect(await ui.find({ type: 'Text', text: /Krok C/ })).toBeUndefined()
    await ui.press({ key: 'toggle' })
    expect(await ui.find({ type: 'Text', text: /Krok A/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Krok C/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /▶/ })).toBeDefined()
    await ui.press({ key: 'toggle' })
    expect(await ui.find({ type: 'Text', text: /Krok C/ })).toBeUndefined()
    await ui.unmount()
  }
})
