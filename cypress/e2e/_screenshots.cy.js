// README doc screenshots. Driven through the dev-only window.__nexis scene API
// (temporarily exposed in the prod build while shooting) against the static
// prod server so matcaps render and there's no devtools overlay.
//   npx cypress run --spec cypress/e2e/_screenshots.cy.js \
//     --config baseUrl=http://localhost:8766,viewportWidth=1440,viewportHeight=900
const VIEW = { capture: 'viewport', overwrite: true }

// Viewport must match the headless capture window (1280×720 @2x) so the
// right-hand parameter sidebar (absolute right-0) lands inside the frame
// instead of being pushed off the edge by a too-wide layout.
function boot() {
  cy.on('uncaught:exception', () => false)
  cy.viewport(1280, 720)
  cy.visit('/')
  cy.get('canvas', { timeout: 20000 }).should('exist')
  cy.window({ timeout: 20000 }).its('__nexis').should('exist')
  cy.wait(1200)
}

describe('nexis README screenshots', () => {
  it('01 home — empty scene', () => {
    boot()
    cy.wait(1500)
    cy.screenshot('01-home', VIEW)
  })

  it('02 building — procedural generation', () => {
    boot()
    cy.window().then(win => win.__nexis.generateBuilding({ seed: 7 }))
    cy.wait(1500)
    cy.screenshot('02-building', VIEW)
  })

  it('03 scatter 100 — scale + interference', () => {
    boot()
    cy.window().then((win) => {
      win.__nexis.generateBuilding({ seed: 7 })
      win.__nexis.scatterRandomObjects(100)
    })
    cy.contains('干涉', { timeout: 15000 }).should('be.visible')
    cy.wait(1500)
    cy.screenshot('03-scatter-100', VIEW)
  })

  it('04 safety gap — near-miss against a building column', () => {
    boot()
    cy.window().then((win) => {
      const api = win.__nexis
      api.generateBuilding({ seed: 7 })
      api.scatterRandomObjects(16) // context objects elsewhere in the building
      // Find the most central column and drop a box ~10 cm beside it (a clean,
      // framed near-miss against a 柱) instead of relying on the random scatter.
      const scene = api.getScene()
      scene.updateMatrixWorld(true)
      const cols = []
      scene.traverse((o) => {
        if (o.isMesh && o.userData?.buildingPart === 'column') {
          const m = o.matrixWorld.elements
          cols.push({ x: m[12], y: m[13], z: m[14] })
        }
      })
      const col = cols.sort((a, b) => (a.x * a.x + a.y * a.y) - (b.x * b.x + b.y * b.y))[0]
      const box = api.addShape('Box', { width: 20, height: 20, depth: 20 })
      api.updatePosition({ x: col.x + 35, y: col.y, z: box.position.z }, box) // gap ~10 cm
      api.setCollisionTolerance(15) // 10 < 15 → "接近"
      api.checkCollisions()
      const fx = col.x + 17
      api.restoreCamera({
        position: { x: fx + 150, y: col.y - 235, z: 205 },
        target: { x: fx, y: col.y, z: 40 },
      })
      api.render()
    })
    // Select the "接近" filter tag so the panel lists only near-miss pairs.
    cy.contains('button', '接近', { timeout: 12000 }).click()
    cy.wait(1200)
    cy.screenshot('04-safety-gap', VIEW)
  })

  it('05 exact volume — CSG intersection', () => {
    boot()
    cy.window().then((win) => {
      const api = win.__nexis
      const a = api.addShape('Box', { width: 20, height: 20, depth: 20 })
      const b = api.addShape('Box', { width: 20, height: 20, depth: 20 })
      api.updatePosition({ x: 11, y: 6, z: b.position.z }, b) // overlapping
      void a
      api.setCollisionTolerance(0)
      api.checkCollisions()
      api.restoreCamera({ position: { x: 50, y: -76, z: 58 }, target: { x: 6, y: 3, z: 8 } })
      api.render()
    })
    // Clicking a row computes the exact CSG volume + draws the intersection overlay.
    cy.get('[data-testid="collision-row"]', { timeout: 8000 }).first().click()
    cy.contains('精確', { timeout: 8000 }).should('be.visible')
    cy.wait(1000)
    cy.screenshot('05-exact-volume', VIEW)
  })

  it('06 model edit — selection + transform gizmo + toolbar', () => {
    boot()
    cy.window().then((win) => {
      const api = win.__nexis
      const a = api.addShape('Box', { width: 24, height: 24, depth: 24 })
      const b = api.addShape('Box', { width: 18, height: 18, depth: 18 })
      const c = api.addShape('Box', { width: 20, height: 20, depth: 20 })
      api.updatePosition({ x: 45, y: 10, z: b.position.z }, b)
      api.updatePosition({ x: -42, y: -28, z: c.position.z }, c)
      api.selectModel(a) // select the centre box → transform gizmo appears
      api.setTransformMode('translate')
      api.restoreCamera({ position: { x: 70, y: -120, z: 92 }, target: { x: 0, y: -4, z: 10 } })
      api.render()
    })
    cy.wait(1500)
    cy.screenshot('06-model-edit', VIEW)
  })
})
