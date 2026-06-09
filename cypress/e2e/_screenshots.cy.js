// README doc screenshots. Driven through the dev-only window.__nexis scene API
// (temporarily exposed in the prod build while shooting) against the static
// prod server so matcaps render and there's no devtools overlay.
//   npx cypress run --spec cypress/e2e/_screenshots.cy.js \
//     --config baseUrl=http://localhost:8766,viewportWidth=1440,viewportHeight=900
const VIEW = { capture: 'viewport', overwrite: true }

function boot() {
  cy.on('uncaught:exception', () => false)
  cy.viewport(1440, 900)
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

  it('04 safety gap — near-miss within ε (building + objects)', () => {
    boot()
    cy.window().then((win) => {
      const api = win.__nexis
      api.generateBuilding({ seed: 7 })
      api.scatterRandomObjects(45)
      api.setCollisionTolerance(25) // generous ε → many pairs flagged "接近" (yellow)
      api.checkCollisions()
      api.render()
    })
    cy.contains('接近', { timeout: 12000 }).should('be.visible')
    cy.wait(1500)
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
