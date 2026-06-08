// Preview the procedural building generator via the Building panel UI.
describe('building generator preview', () => {
  it('generates via the Generate button', () => {
    cy.on('uncaught:exception', () => false)
    cy.visit('http://localhost:5273/')
    cy.get('canvas', { timeout: 15000 }).should('exist')
    cy.window({ timeout: 15000 }).its('__nexis').should('exist')

    cy.contains('button', 'Generate').click()
    cy.contains('rooms ·', { timeout: 8000 }).should('be.visible')
    cy.wait(400)
    cy.screenshot('building-ui', { capture: 'viewport' })

    // Zoom way out + rotate to verify near/far clip planes don't cut the building
    cy.window().then((win) => {
      win.__nexis.restoreCamera({
        position: { x: -3200, y: -1600, z: 2200 },
        target: { x: 0, y: 0, z: 130 },
      })
      win.__nexis.render()
    })
    cy.wait(300)
    cy.screenshot('building-zoomout', { capture: 'viewport' })
  })
})
