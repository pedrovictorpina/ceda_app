import { describe, expect, it } from 'vitest'
import {
  BIRTHDAY_IMAGE_FORMATS,
  birthdayCardRegions,
  computeGrid,
  fitFontSize,
  fitNameToWidth,
  gridCellPositions,
  labelHeightFor,
  paginateEvenly,
  truncateToWidth,
  type BirthdayImageFormat,
  type Rect
} from '../app/utils/birthdayCardLayout'

/** Mede cada caractere como meia fonte, suficiente para testar a lógica. */
const measure = (text: string, size: number) => Array.from(text).length * size * 0.5

function inside(inner: Rect, outer: Rect) {
  return inner.x >= outer.x && inner.y >= outer.y
    && inner.x + inner.width <= outer.x + outer.width
    && inner.y + inner.height <= outer.y + outer.height
}

describe('birthday card regions', () => {
  it.each<BirthdayImageFormat>(['landscape', 'story'])('keeps %s content inside the safe area', (format) => {
    const spec = BIRTHDAY_IMAGE_FORMATS[format]
    const safe: Rect = {
      x: spec.safe.left,
      y: spec.safe.top,
      width: spec.width - spec.safe.left - spec.safe.right,
      height: spec.height - spec.safe.top - spec.safe.bottom
    }
    const regions = birthdayCardRegions(format)
    expect(inside(regions.header, safe)).toBe(true)
    expect(inside(regions.grid, safe)).toBe(true)
    expect(inside(regions.footer, safe)).toBe(true)
  })

  it('reserves the top and bottom 250px of the story for the Instagram interface', () => {
    const regions = birthdayCardRegions('story')
    expect(regions.header.y).toBeGreaterThanOrEqual(250)
    expect(regions.footer.y + regions.footer.height).toBeLessThanOrEqual(1920 - 250)
  })
})

describe('birthday grid', () => {
  const area = { width: 1000, height: 800 }

  it('gives a single person a large avatar capped by the format', () => {
    const grid = computeGrid(1, area, { maxAvatar: 360 })
    expect(grid).toMatchObject({ columns: 1, rows: 1, avatar: 360 })
  })

  it('shrinks avatars as more people are added', () => {
    const sizes = [1, 2, 4, 6, 9, 12].map(count => computeGrid(count, area).avatar)
    const sorted = [...sizes].sort((a, b) => b - a)
    expect(sizes).toEqual(sorted)
  })

  it('always fits every person inside the area', () => {
    for (let count = 1; count <= 12; count += 1) {
      const grid = computeGrid(count, area)
      expect(grid.columns * grid.rows).toBeGreaterThanOrEqual(count)
      const usedHeight = grid.rows * (grid.avatar + grid.labelHeight) + (grid.rows - 1) * grid.gap
      expect(usedHeight).toBeLessThanOrEqual(area.height + 1)
      expect(grid.avatar).toBeLessThanOrEqual(grid.cellWidth)
    }
  })

  it('keeps a readable label height for small avatars', () => {
    expect(labelHeightFor(100)).toBe(120)
    expect(labelHeightFor(300)).toBe(186)
  })

  it('centres an incomplete last row', () => {
    const rect: Rect = { x: 0, y: 0, ...area }
    const grid = computeGrid(5, area)
    const positions = gridCellPositions(5, grid, rect)
    expect(positions).toHaveLength(5)
    const lastRow = positions.slice(grid.columns)
    const middle = lastRow.reduce((sum, item) => sum + item.centerX, 0) / lastRow.length
    expect(middle).toBeCloseTo(area.width / 2)
    expect(positions[0]?.top).toBeGreaterThanOrEqual(0)
  })
})

describe('birthday pagination and text fitting', () => {
  it('splits into balanced pages', () => {
    const people = Array.from({ length: 13 }, (_, index) => index)
    expect(paginateEvenly(people, 12).map(page => page.length)).toEqual([7, 6])
    expect(paginateEvenly(people.slice(0, 12), 12)).toHaveLength(1)
    expect(paginateEvenly([], 12)).toEqual([])
    expect(paginateEvenly(Array.from({ length: 25 }, (_, index) => index), 12).map(page => page.length)).toEqual([9, 9, 7])
  })

  it('finds the largest font that fits and respects the minimum', () => {
    expect(fitFontSize('abcd', 100, measure, 80, 20)).toBe(50)
    expect(fitFontSize('abcdefghijklmnopqrstuvwxyz', 100, measure, 80, 20)).toBe(20)
  })

  it('truncates with an ellipsis only when needed', () => {
    expect(truncateToWidth('Ana', 100, measure, 20)).toBe('Ana')
    const truncated = truncateToWidth('Maria Aparecida', 100, measure, 20)
    expect(truncated.endsWith('…')).toBe(true)
    expect(measure(truncated, 20)).toBeLessThanOrEqual(100)
  })

  it('falls back to the first name before truncating', () => {
    expect(fitNameToWidth('Ana Lima', 100, measure, 20)).toBe('Ana Lima')
    expect(fitNameToWidth('Fernanda Albuquerque', 100, measure, 20)).toBe('Fernanda')
    expect(fitNameToWidth('Maximiliano Albuquerque', 100, measure, 20).endsWith('…')).toBe(true)
  })
})
