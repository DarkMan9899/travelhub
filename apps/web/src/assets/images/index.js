/**
 * Centralized barrel for the app's local placeholder imagery — every
 * consumer imports from here rather than reaching for a file path
 * directly, so swapping a placeholder for a real production asset later
 * touches this one file, not each component.
 */

export { default as heroBackdrop } from './heroBackdrop.svg';
export { default as destinationMotif } from './destinationMotif.svg';
export { default as experienceMotif } from './experienceMotif.svg';
