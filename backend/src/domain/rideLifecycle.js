export const DRIVER_TRANSITIONS = {
  DRIVER_ARRIVED: ['MATCHED'],
  STARTED: ['DRIVER_ARRIVED'],
  COMPLETED: ['STARTED'],
}

export const PASSENGER_CANCELLABLE = ['REQUESTED', 'MATCHED', 'DRIVER_ARRIVED']

export function canTransition(fromStatus, toStatus, allowedFrom) {
  return allowedFrom[toStatus]?.includes(fromStatus) ?? false
}