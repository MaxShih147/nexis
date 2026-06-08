// Per-model parameters popover from the left model list.
describe('per-model params popover', () => {
  it('opens the safety-gap override panel from the model list', () => {
    cy.on('uncaught:exception', () => false)
    cy.visit('http://localhost:5273/')
    cy.get('canvas', { timeout: 15000 }).should('exist')
    cy.window({ timeout: 15000 }).its('__nexis').should('exist')

    cy.window().then((win) => {
      win.__nexis.addShape('Box', { width: 40, height: 40, depth: 40 })
    })

    // The new model appears in the left list; click its params (sliders) button.
    cy.get('[aria-label="模型參數"]', { timeout: 8000 }).first().click()
    cy.contains('自訂安全間隙', { timeout: 8000 }).should('be.visible')
    cy.screenshot('model-params', { capture: 'viewport' })
  })
})
