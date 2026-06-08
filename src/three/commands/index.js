/**
 * Command factories for the undo/redo system.
 *
 * Every command object exposes:
 *   type, label, targetUuid, timestamp,
 *   apply(), undo(), canMerge(other), merge(other)
 *
 * Transform commands are synchronous.
 * Geometry commands are async (snapshot load may require decode).
 * Compound commands delegate to sub-commands.
 */

// ---------------------------------------------------------------------------
// Transform commands
// ---------------------------------------------------------------------------

export function createPositionCommand(object, oldPos, newPos, syncStore, render) {
  const cmd = {
    type: 'position',
    label: 'common.commandLabels.move',
    targetUuid: object.uuid,
    timestamp: Date.now(),
    _object: object,
    _oldValue: { x: oldPos.x, y: oldPos.y, z: oldPos.z },
    _newValue: { x: newPos.x, y: newPos.y, z: newPos.z },
    apply() {
      cmd._object.position.set(cmd._newValue.x, cmd._newValue.y, cmd._newValue.z)
      syncStore()
      render()
    },
    undo() {
      cmd._object.position.set(cmd._oldValue.x, cmd._oldValue.y, cmd._oldValue.z)
      syncStore()
      render()
    },
    canMerge(other) {
      return other.type === 'position'
        && other.targetUuid === cmd.targetUuid
        && (other.timestamp - cmd.timestamp) < 300
    },
    merge(other) {
      cmd._newValue = other._newValue
      cmd.timestamp = other.timestamp
    },
  }
  return cmd
}

export function createRotationCommand(object, oldRot, newRot, syncStore, render) {
  const cmd = {
    type: 'rotation',
    label: 'common.commandLabels.rotate',
    targetUuid: object.uuid,
    timestamp: Date.now(),
    _object: object,
    _oldValue: { x: oldRot.x, y: oldRot.y, z: oldRot.z, order: oldRot.order || 'XYZ' },
    _newValue: { x: newRot.x, y: newRot.y, z: newRot.z, order: newRot.order || 'XYZ' },
    apply() {
      cmd._object.rotation.set(cmd._newValue.x, cmd._newValue.y, cmd._newValue.z, cmd._newValue.order)
      syncStore()
      render()
    },
    undo() {
      cmd._object.rotation.set(cmd._oldValue.x, cmd._oldValue.y, cmd._oldValue.z, cmd._oldValue.order)
      syncStore()
      render()
    },
    canMerge(other) {
      return other.type === 'rotation'
        && other.targetUuid === cmd.targetUuid
        && (other.timestamp - cmd.timestamp) < 300
    },
    merge(other) {
      cmd._newValue = other._newValue
      cmd.timestamp = other.timestamp
    },
  }
  return cmd
}

export function createScaleCommand(object, oldScale, newScale, syncStore, render) {
  const cmd = {
    type: 'scale',
    label: 'common.commandLabels.scale',
    targetUuid: object.uuid,
    timestamp: Date.now(),
    _object: object,
    _oldValue: { x: oldScale.x, y: oldScale.y, z: oldScale.z },
    _newValue: { x: newScale.x, y: newScale.y, z: newScale.z },
    apply() {
      cmd._object.scale.set(cmd._newValue.x, cmd._newValue.y, cmd._newValue.z)
      syncStore()
      render()
    },
    undo() {
      cmd._object.scale.set(cmd._oldValue.x, cmd._oldValue.y, cmd._oldValue.z)
      syncStore()
      render()
    },
    canMerge(other) {
      return other.type === 'scale'
        && other.targetUuid === cmd.targetUuid
        && (other.timestamp - cmd.timestamp) < 300
    },
    merge(other) {
      cmd._newValue = other._newValue
      cmd.timestamp = other.timestamp
    },
  }
  return cmd
}

// ---------------------------------------------------------------------------
// Lifecycle commands  (add / remove model)
// ---------------------------------------------------------------------------

export function createAddModelCommand(object, meshManager, render) {
  return {
    type: 'addModel',
    label: 'common.commandLabels.addModel',
    targetUuid: object.uuid,
    timestamp: Date.now(),
    _object: object,
    apply() {
      meshManager._softAddModel(this._object)
      render()
    },
    undo() {
      meshManager._softRemoveModel(this._object)
      render()
    },
    canMerge() { return false },
    merge() {},
  }
}

export function createRemoveModelCommand(object, meshManager, render) {
  return {
    type: 'removeModel',
    label: 'common.commandLabels.removeModel',
    targetUuid: object.uuid,
    timestamp: Date.now(),
    _object: object,
    apply() {
      meshManager._softRemoveModel(this._object)
      render()
    },
    undo() {
      meshManager._softAddModel(this._object)
      render()
    },
    canMerge() { return false },
    merge() {},
  }
}

// ---------------------------------------------------------------------------
// Support mesh commands
// ---------------------------------------------------------------------------

export function createAddSupportMeshCommand(mesh, parentObject, supportManager, backendStore) {
  return {
    type: 'addSupportMesh',
    label: 'common.commandLabels.addSupport',
    targetUuid: parentObject?.uuid || null,
    timestamp: Date.now(),
    apply() {
      supportManager._softAddSupportMesh(mesh, parentObject)
      // per-model: reflect the selected model's support status
      backendStore.updateSupportState({ hasSupportMesh: supportManager.hasSupportMesh() })
    },
    undo() {
      supportManager._softRemoveSupportMesh(mesh)
      backendStore.updateSupportState({ hasSupportMesh: supportManager.hasSupportMesh() })
      backendStore.clearJob('support')
    },
    canMerge() { return false },
    merge() {},
  }
}

export function createRemoveSupportMeshCommand(mesh, parentObject, supportManager, backendStore) {
  return {
    type: 'removeSupportMesh',
    label: 'common.commandLabels.removeSupport',
    targetUuid: parentObject?.uuid || null,
    timestamp: Date.now(),
    apply() {
      supportManager._softRemoveSupportMesh(mesh)
      backendStore.updateSupportState({ hasSupportMesh: supportManager.hasSupportMesh() })
      backendStore.clearJob('support')
    },
    undo() {
      supportManager._softAddSupportMesh(mesh, parentObject)
      backendStore.updateSupportState({ hasSupportMesh: supportManager.hasSupportMesh() })
    },
    canMerge() { return false },
    merge() {},
  }
}

// ---------------------------------------------------------------------------
// Drill visual hole commands
// ---------------------------------------------------------------------------

export function createAddVisualHoleCommand(cylinder, selectedObject, drill) {
  return {
    type: 'addVisualHole',
    label: 'common.commandLabels.placeDrillHole',
    targetUuid: selectedObject.uuid,
    timestamp: Date.now(),
    apply() {
      drill.restoreVisualHole(cylinder, selectedObject)
    },
    undo() {
      drill.removeVisualHole(cylinder, selectedObject)
    },
    canMerge() { return false },
    merge() {},
  }
}

// ---------------------------------------------------------------------------
// Text emboss preview commands
// ---------------------------------------------------------------------------

export function createTextEmbossPreviewCommand(textEmbossManager, oldState, newState, render) {
  return {
    type: 'textEmbossPreview',
    label: 'common.commandLabels.textEmboss',
    targetUuid: 'text-emboss-preview',
    timestamp: Date.now(),
    apply() {
      textEmbossManager.restorePreviewState(newState)
      render()
    },
    undo() {
      textEmbossManager.restorePreviewState(oldState)
      render()
    },
    canMerge() { return false },
    merge() {},
  }
}

// ---------------------------------------------------------------------------
// Geometry command  (async — may need decode from COLD store)
// ---------------------------------------------------------------------------

/**
 * Creates a command for geometry-changing operations (hollow, drill, replace, etc.).
 *
 * @param {object} opts
 * @param {string}       opts.label            Human-readable label
 * @param {Object3D}     opts.object           The target mesh
 * @param {object}       opts.oldSnapshot      { geometryRef, userData, originalGeometry (BufferGeometry|null) }
 * @param {object}       opts.newSnapshot      same shape
 * @param {GeometrySnapshotService} opts.snapshotService
 * @param {Function}     opts.syncStore
 * @param {Function}     opts.render
 */
export function createGeometryCommand({ label, object, oldSnapshot, newSnapshot, snapshotService, syncStore, render }) {
  async function applySnapshot(snapshot) {
    const geometry = await snapshotService.loadGeometry(snapshot.geometryRef)
    geometry.computeVertexNormals()
    object.geometry.dispose()
    object.geometry = geometry

    // Sync back-face child mesh
    for (const child of object.children) {
      if (child.isMesh && child.material?.side === 1) { // BackSide === 1
        child.geometry = geometry
      }
    }

    // Restore userData flags
    if (snapshot.userData) {
      Object.assign(object.userData, snapshot.userData)
    }

    // Restore originalGeometry reference (used by hollow)
    if (snapshot.hasOriginalGeometry && snapshot.originalGeometryRef) {
      object.originalGeometry = await snapshotService.loadGeometry(snapshot.originalGeometryRef)
    }
    else {
      object.originalGeometry = snapshot.hasOriginalGeometry ? object.originalGeometry : null
    }

    // Handle offsetMesh child
    const existingOffset = object.getObjectByName('offsetMesh')
    if (snapshot.hasOffsetMesh && snapshot.offsetMeshRef) {
      const offsetGeom = await snapshotService.loadGeometry(snapshot.offsetMeshRef)
      if (existingOffset) {
        existingOffset.geometry.dispose()
        existingOffset.geometry = offsetGeom
      }
      // If there should be an offsetMesh but it was removed, we don't re-create it
      // because we'd need the material info too — the hollow operation handles that.
    }
    else if (!snapshot.hasOffsetMesh && existingOffset) {
      object.remove(existingOffset)
    }

    object.material.needsUpdate = true
    syncStore()
    render()
  }

  return {
    type: 'geometry',
    label,
    targetUuid: object.uuid,
    timestamp: Date.now(),
    async apply() { await applySnapshot(newSnapshot) },
    async undo() { await applySnapshot(oldSnapshot) },
    canMerge() { return false },
    merge() {},
  }
}

// ---------------------------------------------------------------------------
// Compound command  (wraps N sub-commands into one undo step)
// ---------------------------------------------------------------------------

export function createCompoundCommand(label, subCommands) {
  // targetUuid: use the first sub-command's uuid, or null
  const targetUuid = subCommands.length > 0 ? subCommands[0].targetUuid : null

  return {
    type: 'compound',
    label,
    targetUuid,
    timestamp: Date.now(),
    subCommands,
    async apply() {
      for (const cmd of subCommands) {
        await cmd.apply()
      }
    },
    async undo() {
      // Undo in reverse order
      for (let i = subCommands.length - 1; i >= 0; i--) {
        await subCommands[i].undo()
      }
    },
    canMerge() { return false },
    merge() {},
  }
}

// ---------------------------------------------------------------------------
// Helpers for capturing snapshot state before/after geometry ops
// ---------------------------------------------------------------------------

/**
 * Captures the current state of a model's geometry and related data
 * for use in a geometry command's oldSnapshot or newSnapshot.
 */
export async function captureGeometrySnapshot(object, snapshotService) {
  const geometryRef = await snapshotService.snapshotGeometry(object.geometry)

  const snapshot = {
    geometryRef,
    userData: { ...object.userData },
    hasOriginalGeometry: !!object.originalGeometry,
    originalGeometryRef: null,
    hasOffsetMesh: !!object.getObjectByName('offsetMesh'),
    offsetMeshRef: null,
  }

  if (object.originalGeometry) {
    snapshot.originalGeometryRef = await snapshotService.snapshotGeometry(object.originalGeometry)
  }

  const offsetMesh = object.getObjectByName('offsetMesh')
  if (offsetMesh?.geometry) {
    snapshot.offsetMeshRef = await snapshotService.snapshotGeometry(offsetMesh.geometry)
  }

  return snapshot
}
