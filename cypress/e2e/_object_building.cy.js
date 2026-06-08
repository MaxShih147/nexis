// Object-vs-building interference (Problem 1, goal 1/3).
describe('object vs building', () => {
  it('flags an object that overlaps the building', () => {
    cy.on('uncaught:exception', () => false)
    cy.visit('http://localhost:5273/')
    cy.get('canvas', { timeout: 15000 }).should('exist')
    cy.window({ timeout: 15000 }).its('__nexis').should('exist')

    cy.window().then((win) => {
      const api = win.__nexis
      api.generateBuilding({ seed: 7 })
      // A large box at the origin overlaps the centre column / interior walls.
      api.addShape('Box', { width: 200, height: 200, depth: 200 })
      const results = api.checkCollisions()
      const names = results.flatMap(r => [r.aName, r.bName])
      expect(results.length, 'has interference').to.be.greaterThan(0)
      expect(names.some(n => n === '牆' || n === '柱'), 'hits a wall or column').to.be.true
    })
    cy.contains('Box ↔', { timeout: 8000 }).should('be.visible')
    cy.screenshot('object-vs-building', { capture: 'viewport' })
  })
})
