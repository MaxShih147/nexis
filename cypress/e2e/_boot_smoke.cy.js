describe('nexis boot smoke', () => {
  it('mounts and renders viewport', () => {
    const errors = []
    cy.on('uncaught:exception', (e) => { errors.push(e.message); return false })
    cy.visit('http://localhost:5273/')
    cy.get('#app', { timeout: 15000 }).children().should('have.length.greaterThan', 0)
    cy.get('canvas', { timeout: 15000 }).should('exist')
    cy.wait(2000)
    cy.screenshot('nexis-boot', { capture: 'viewport' })
    cy.then(() => { cy.log('UNCAUGHT:' + JSON.stringify(errors)) })
  })
})
