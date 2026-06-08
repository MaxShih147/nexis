import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveAsMock = vi.fn()
const readProjectMock = vi.fn()
const errorKeyMock = vi.fn()
const writeProjectMock = vi.fn()
const showSaveFilePickerMock = vi.fn()

vi.mock('file-saver', () => ({
  saveAs: saveAsMock,
}))

vi.mock('../ProjectReader', () => ({
  readProject: readProjectMock,
}))

vi.mock('../ProjectWriter', () => ({
  writeProject: writeProjectMock,
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    errorKey: errorKeyMock,
  }),
}))

async function createProjectManager() {
  const module = await import('../ProjectManager')
  return module.ProjectManager
}

function createSceneApi() {
  return {
    clearScene: vi.fn(),
    getModels: vi.fn(() => []),
    drillParameters: {},
    hollowParams: {},
    getCameraState: vi.fn(() => null),
    getSupportMesh: vi.fn(() => null),
  }
}

beforeEach(() => {
  saveAsMock.mockClear()
  readProjectMock.mockClear()
  writeProjectMock.mockClear()
  errorKeyMock.mockClear()
  showSaveFilePickerMock.mockReset()
  delete globalThis.showSaveFilePicker
})

describe('projectManager', () => {
  it('resets the project name to untitled for new projects', async () => {
    const ProjectManager = await createProjectManager()
    const sceneApi = createSceneApi()
    const manager = new ProjectManager(sceneApi, {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    })

    manager.setProjectName('Case A')
    manager.newProject()

    expect(sceneApi.clearScene).toHaveBeenCalledTimes(1)
    expect(manager.projectName).toBe('untitled')
  })

  it('updates the project name from the loaded 3mf filename', async () => {
    readProjectMock.mockResolvedValueOnce({ ok: true })

    const ProjectManager = await createProjectManager()
    const manager = new ProjectManager(createSceneApi(), {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    })

    await manager.loadFile({ name: 'case-a.3mf' })

    expect(readProjectMock).toHaveBeenCalledTimes(1)
    expect(manager.projectName).toBe('case-a')
  })

  it('exports untitled projects with a timestamped filename', async () => {
    writeProjectMock.mockResolvedValueOnce(new Blob(['3mf']))
    const writeMock = vi.fn()
    const closeMock = vi.fn()
    showSaveFilePickerMock.mockResolvedValueOnce({
      createWritable: vi.fn().mockResolvedValue({
        write: writeMock,
        close: closeMock,
      }),
    })
    globalThis.showSaveFilePicker = showSaveFilePickerMock

    const ProjectManager = await createProjectManager()
    const sceneApi = createSceneApi()
    sceneApi.getModels.mockReturnValueOnce([{ uuid: 'model-1' }])
    const manager = new ProjectManager(sceneApi, {
      getNow: () => new Date('2026-05-08T02:03:04Z'),
      getTimeZone: () => 'UTC',
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    })

    await manager.save()

    expect(showSaveFilePickerMock).toHaveBeenCalledWith({
      suggestedName: 'untitled-20260508020304.3mf',
      excludeAcceptAllOption: true,
      types: [
        {
          description: '3MF Project File',
          accept: {
            'application/octet-stream': ['.3mf'],
          },
        },
      ],
    })
    expect(writeMock).toHaveBeenCalledWith(expect.any(Blob))
    expect(closeMock).toHaveBeenCalledTimes(1)
    expect(saveAsMock).not.toHaveBeenCalled()
  })

  it('passes the custom project name as the suggested filename to the save picker', async () => {
    writeProjectMock.mockResolvedValueOnce(new Blob(['3mf']))
    showSaveFilePickerMock.mockResolvedValueOnce({
      createWritable: vi.fn().mockResolvedValue({
        write: vi.fn(),
        close: vi.fn(),
      }),
    })
    globalThis.showSaveFilePicker = showSaveFilePickerMock

    const ProjectManager = await createProjectManager()
    const sceneApi = createSceneApi()
    sceneApi.getModels.mockReturnValueOnce([{ uuid: 'model-1' }])
    const manager = new ProjectManager(sceneApi, {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    })
    manager.setProjectName('Case A')

    await manager.save()

    expect(showSaveFilePickerMock).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: 'Case A.3mf' }),
    )
    expect(saveAsMock).not.toHaveBeenCalled()
  })

  it('opens the save picker before building the project blob', async () => {
    const callOrder = []
    writeProjectMock.mockImplementationOnce(async () => {
      callOrder.push('writeProject')
      return new Blob(['3mf'])
    })
    showSaveFilePickerMock.mockImplementationOnce(async () => {
      callOrder.push('showSaveFilePicker')
      return {
        createWritable: vi.fn().mockResolvedValue({
          write: vi.fn(),
          close: vi.fn(),
        }),
      }
    })
    globalThis.showSaveFilePicker = showSaveFilePickerMock

    const ProjectManager = await createProjectManager()
    const sceneApi = createSceneApi()
    sceneApi.getModels.mockReturnValueOnce([{ uuid: 'model-1' }])
    const manager = new ProjectManager(sceneApi, {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    })

    await manager.save()

    expect(callOrder).toEqual(['showSaveFilePicker', 'writeProject'])
  })

  it('falls back to browser download when the save picker is unavailable', async () => {
    writeProjectMock.mockResolvedValueOnce(new Blob(['3mf']))

    const ProjectManager = await createProjectManager()
    const sceneApi = createSceneApi()
    sceneApi.getModels.mockReturnValueOnce([{ uuid: 'model-1' }])
    const manager = new ProjectManager(sceneApi, {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    })
    manager.setProjectName('Case A')

    await manager.save()

    expect(saveAsMock).toHaveBeenCalledWith(expect.any(Blob), 'Case A.3mf')
  })

  it('keeps the project dirty when the user cancels the save dialog', async () => {
    showSaveFilePickerMock.mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
    globalThis.showSaveFilePicker = showSaveFilePickerMock

    const ProjectManager = await createProjectManager()
    const sceneApi = createSceneApi()
    sceneApi.getModels.mockReturnValueOnce([{ uuid: 'model-1' }])
    const manager = new ProjectManager(sceneApi, {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    })
    manager.markDirty()

    await expect(manager.save()).resolves.toBeNull()

    expect(manager.dirty).toBe(true)
    expect(writeProjectMock).not.toHaveBeenCalled()
    expect(saveAsMock).not.toHaveBeenCalled()
  })

  it('notifies subscribers when the project name changes', async () => {
    const ProjectManager = await createProjectManager()
    const manager = new ProjectManager(createSceneApi(), {
      showLoading: vi.fn(),
      hideLoading: vi.fn(),
    })
    const listener = vi.fn()

    manager.subscribeToProjectName(listener)
    manager.setProjectName('Case B')

    expect(listener).toHaveBeenCalledWith('Case B')
  })

  it('shows and hides loading around project file operations', async () => {
    const showLoading = vi.fn()
    const hideLoading = vi.fn()
    writeProjectMock.mockResolvedValueOnce(new Blob(['3mf']))
    readProjectMock.mockResolvedValueOnce({ ok: true })

    const ProjectManager = await createProjectManager()
    const sceneApi = createSceneApi()
    sceneApi.getModels.mockReturnValueOnce([{ uuid: 'model-1' }])
    const manager = new ProjectManager(sceneApi, {
      showLoading,
      hideLoading,
    })

    await manager.save()
    await manager.loadFile({ name: 'case-b.3mf' })

    expect(showLoading).toHaveBeenCalledTimes(2)
    expect(hideLoading).toHaveBeenCalledTimes(2)
  })

  it('shows a toast and skips export when there are no models', async () => {
    const showLoading = vi.fn()
    const hideLoading = vi.fn()
    const ProjectManager = await createProjectManager()
    const manager = new ProjectManager(createSceneApi(), {
      showLoading,
      hideLoading,
    })

    await expect(manager.save()).resolves.toBeNull()

    expect(errorKeyMock).toHaveBeenCalledWith('validation.projectFiles.noModelsToExport')
    expect(writeProjectMock).not.toHaveBeenCalled()
    expect(saveAsMock).not.toHaveBeenCalled()
    expect(showLoading).not.toHaveBeenCalled()
    expect(hideLoading).not.toHaveBeenCalled()
  })
})
