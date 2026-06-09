// Doc screenshots for the README. Drives the real UI (Chinese, hard-coded
// button labels) against the built app. Run against the static prod server:
//   npx cypress run --spec cypress/e2e/_screenshots.cy.js \
//     --config baseUrl=http://localhost:8766,viewportWidth=1440,viewportHeight=900
// Output: cypress/screenshots/_screenshots.cy.js/*.png
describe('nexis README screenshots', () => {
  it('captures home, building, and collision views', () => {
    cy.on('uncaught:exception', () => false)
    cy.viewport(1440, 900)
    cy.visit('/')
    cy.get('canvas', { timeout: 20000 }).should('exist')
    cy.wait(3000) // let the scene, lighting and matcaps settle

    cy.screenshot('01-home', { capture: 'viewport', overwrite: true })

    // Procedural building
    cy.contains('button', '產生建築', { timeout: 10000 }).click()
    cy.wait(1800)
    cy.screenshot('02-building', { capture: 'viewport', overwrite: true })

    // Scatter test objects → interference appears in the floating panel
    cy.contains('button', '隨機生成物件', { timeout: 10000 }).click()
    cy.contains('干涉', { timeout: 12000 }).should('be.visible')
    cy.wait(1500)
    cy.screenshot('03-collision', { capture: 'viewport', overwrite: true })
  })
})
