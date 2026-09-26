import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateFarePaisa, distanceBetween, isPoolCompatible } from '../src/domain/fare.js'
import { canTransition, DRIVER_TRANSITIONS, PASSENGER_CANCELLABLE } from '../src/domain/rideLifecycle.js'

test('fare is deterministic and uses integer poisha', () => {
  assert.equal(calculateFarePaisa(3), 6100)
  assert.equal(calculateFarePaisa(3, true), 4880)
  assert.equal(calculateFarePaisa(5, true), 6800)
})

test('sample routes and pickup-zone matching are deterministic', () => {
  assert.equal(distanceBetween('Banani', 'Mohakhali'), 3)
  assert.equal(distanceBetween('Banani', 'Gulshan 1'), 5)
  assert.equal(distanceBetween('Banani', 'Banani'), null)
  assert.equal(isPoolCompatible('Banani', 'Banani'), true)
  assert.equal(isPoolCompatible('Banani', 'Dhanmondi'), false)
})

test('driver lifecycle accepts only the next legal transition', () => {
  assert.equal(canTransition('MATCHED', 'DRIVER_ARRIVED', DRIVER_TRANSITIONS), true)
  assert.equal(canTransition('MATCHED', 'STARTED', DRIVER_TRANSITIONS), false)
  assert.equal(canTransition('STARTED', 'COMPLETED', DRIVER_TRANSITIONS), true)
  assert.deepEqual(PASSENGER_CANCELLABLE, ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED'])
})