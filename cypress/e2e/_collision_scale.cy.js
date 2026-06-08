// Results summarization: many findings stay responsive via the virtual list.
describe('collision results at scale', () => {
  it('renders few DOM rows for many findings (virtual scroll) + filter', () => {
    cy.on('uncaught:exception', () => false)
    cy.visit('http://localhost:5273/')
    cy.get('canvas', { timeout: 15000 }).should('exist')
    cy.window({ timeout: 15000 }).its('__nexis').should('exist')

    cy.window().then((win) => {
      const api = win.__nexis
      // ~30 overlapping boxes at the origin → hundreds of interfering pairs.
      for (let i = 0; i < 30; i++)
        api.addShape('Box', { width: 60, height: 60, depth: 60 })
      const results = api.checkCollisions()
      expect(results.length, 'hundreds of pairs').to.be.greaterThan(100)
    })

    // Status shows a big count, but the virtual list only mounts a handful of rows.
    cy.contains('干涉', { timeout: 8000 }).should('be.visible')
    cy.get('[data-testid=collision-row]').its('length').should('be.lessThan', 20)
    cy.screenshot('collision-scale', { capture: 'viewport' })

    // Filter to 接近 (none at ε=0) → list empties without touching detection.
    cy.contains('button', '接近').click()
    cy.get('[data-testid=collision-row]').should('have.length', 0)
  })
})
