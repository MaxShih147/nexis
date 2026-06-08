// Live end-to-end check of nexis collision detection (Problem 1, Phase 0/1).
// Drives the dev-only window.__nexis scene API to spawn overlapping boxes,
// then asserts the engine + store + panel all reflect the interference.

describe('collision detection (single floor)', () => {
  beforeEach(() => {
    cy.on('uncaught:exception', () => false)
    cy.visit('http://localhost:5273/')
    cy.get('canvas', { timeout: 15000 }).should('exist')
    cy.window({ timeout: 15000 }).its('__nexis').should('exist')
  })

  it('detects two overlapping boxes, then clears when separated', () => {
    cy.window().then((win) => {
      const api = win.__nexis
      // Two 20mm boxes both spawned at origin → overlapping.
      const a = api.addShape('Box', { width: 20, height: 20, depth: 20 })
      const b = api.addShape('Box', { width: 20, height: 20, depth: 20 })
      expect(a, 'box A created').to.be.ok
      expect(b, 'box B created').to.be.ok

      const hits = api.checkCollisions()
      expect(hits.length, 'one interference pair').to.eq(1)
      expect(hits[0].magnitude, 'magnitude > 0').to.be.greaterThan(0)
      expect(hits[0].location, 'has location').to.not.be.null

      // Move B far away on the same floor → no interference.
      api.updatePosition({ x: 500, y: 0, z: b.position.z }, b)
      const after = api.checkCollisions()
      expect(after.length, 'no interference after separation').to.eq(0)
    })
  })

  it('surfaces the interference count in the CollisionPanel', () => {
    cy.window().then((win) => {
      const api = win.__nexis
      api.addShape('Box', { width: 20, height: 20, depth: 20 })
      api.addShape('Box', { width: 20, height: 20, depth: 20 })
      api.checkCollisions()
    })
    cy.contains('1 hit', { timeout: 8000 }).should('be.visible')
    cy.screenshot('collision-detected', { capture: 'viewport' })
  })

  it('flags a near-miss within the safety gap ε (scenario 2)', () => {
    cy.window().then((win) => {
      const api = win.__nexis
      const a = api.addShape('Box', { width: 20, height: 20, depth: 20 })
      const b = api.addShape('Box', { width: 20, height: 20, depth: 20 })
      // Separate B so faces are 3mm apart (10 + 13 → gap 3).
      api.updatePosition({ x: 23, y: 0, z: b.position.z }, b)
      void a

      // ε = 5 → 3mm gap is a near-miss.
      api.setCollisionTolerance(5)
      const near = api.getCollisionResults()
      expect(near.length, 'one near pair').to.eq(1)
      expect(near[0].status).to.eq('near')
      expect(near[0].gap, 'gap ≈ 3mm').to.be.closeTo(3, 0.5)

      // ε = 2 → 3mm gap is now within spec (no flag).
      api.setCollisionTolerance(2)
      expect(api.getCollisionResults().length, 'no flag when ε < gap').to.eq(0)

      // Back to ε = 5 for the screenshot.
      api.setCollisionTolerance(5)
    })
    cy.contains('1 near', { timeout: 8000 }).should('be.visible')
    cy.screenshot('collision-near-gap', { capture: 'viewport' })
  })
})
