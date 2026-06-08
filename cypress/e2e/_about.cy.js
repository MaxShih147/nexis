// About dialog from the left footer.
describe('about dialog', () => {
  it('opens with project + author + github', () => {
    cy.on('uncaught:exception', () => false)
    cy.visit('http://localhost:5273/')
    cy.get('canvas', { timeout: 15000 }).should('exist')

    cy.contains('關於', { timeout: 10000 }).click()
    cy.contains('關於 nexis', { timeout: 8000 }).should('be.visible')
    cy.contains('Max Shih').should('be.visible')
    cy.get('a[href="https://github.com/MaxShih147"]').should('exist')
    cy.screenshot('about', { capture: 'viewport' })
  })
})
