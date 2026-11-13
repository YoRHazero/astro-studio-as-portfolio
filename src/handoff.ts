import type { SectionId } from './content'

export interface ScreenRect {
  left: number
  top: number
  width: number
  height: number
}

/**
 * What the game hands to a page when the visitor enters it through an object, so the page can
 * continue the motion: which object it was, and where the framed photo sits on screen.
 * Empty when a page is opened any other way (plain home, direct link).
 */
export const handoff: { from: SectionId | null; photoRect: ScreenRect | null } = {
  from: null,
  photoRect: null,
}
