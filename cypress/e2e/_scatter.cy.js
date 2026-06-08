// Scatter test button: generate building, scatter random objects, see collisions.
describe('scatter random objects', () => {
  it('scatters objects and detects interference', () => {
    cy.on('uncaught:exception', () => false)
    cy.visit('http://localhost:5273/')
    cy.get('canvas', { timeout: 15000 }).should('exist')
    cy.window({ timeout: 15000 }).its('__nexis').should('exist')

    // Build a shell first so we also get object-vs-building hits.
    cy.window().then(win => win.__nexis.generateBuilding({ seed: 7 }))

    cy.contains('button', '隨機生成物件').click()

    cy.window().then((win) => {
      expect(win.__nexis.getModels().length, '20 objects placed').to.eq(20)
    })
    // Some interference is essentially certain with 20 boxes in the building.
    cy.contains('干涉', { timeout: 8000 }).should('be.visible')
    cy.screenshot('scatter', { capture: 'viewport' })

    cy.contains('button', '清空物件').click()
    cy.window().then((win) => {
      expect(win.__nexis.getModels().length, 'cleared').to.eq(0)
    })
  })
})
