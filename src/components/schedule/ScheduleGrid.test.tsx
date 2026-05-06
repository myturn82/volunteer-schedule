import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScheduleGrid } from './ScheduleGrid'

const mockProps = {
  year: 2026,
  month: 4,
  assignments: [],
  slotSettings: [],
  scheduleRules: [],
  dateOverrides: [],
  highlightName: null,
  onCellClick: vi.fn(),
}

describe('ScheduleGrid', () => {
  it('renders day headers for April 2026', () => {
    render(<ScheduleGrid {...mockProps} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
  })

  it('renders time slot labels', () => {
    render(<ScheduleGrid {...mockProps} />)
    expect(screen.getByText('10-12')).toBeInTheDocument()
    expect(screen.getByText('20-22')).toBeInTheDocument()
  })

  it('renders BREAKTIME cells for 12-13 row', () => {
    render(<ScheduleGrid {...mockProps} />)
    const breaktimeCells = screen.getAllByText('BREAKTIME')
    expect(breaktimeCells.length).toBeGreaterThan(0)
  })
})
