// Throwaway stress probe: spawn many boxes on one floor, measure scan cost,
// and screenshot so we can see how the current UI behaves at scale.
describe('single-floor scale probe', () => {
  it('spawns ~400 boxes and times a full scan', () => {
    cy.on('uncaught:exception', () => false)
    cy.visit('http://localhost:5273/')
    cy.get('canvas', { timeout: 15000 }).should('exist')
    cy.window({ timeout: 15000 }).its('__nexis').should('exist')

    cy.window().then((win) => {
      const api = win.__nexis
      const N = 20 // 20x20 = 400 boxes
      const spacing = 18 // 20-wide boxes 18 apart → overlap neighbours
      const t0 = performance.now()
      for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
          const m = api.addShape('Box', { width: 20, height: 20, depth: 20 })
          api.updatePosition({ x: i * spacing, y: j * spacing, z: m.position.z }, m)
        }
      }
      const tSpawn = performance.now() - t0

      const t1 = performance.now()
      const results = api.checkCollisions()
      const tScan = performance.now() - t1

      cy.writeFile('/tmp/nexis-stress.json', {
        boxes: N * N,
        spawnMs: Math.round(tSpawn),
        scanMs: Math.round(tScan),
        pairs: results.length,
      })
    })

    cy.screenshot('stress-400', { capture: 'viewport' })
  })
})
