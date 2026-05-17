import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScheduleGrid } from './ScheduleGrid'

const mockProps = {
  year: 2026,
  month: 4,
  timeSlots: ['10-12', '12-13', '20-22'] as string[],
  assignments: [],
  slotSettings: [],
  scheduleRules: [],
  dateOverrides: [],
  highlightName: null,
  onCellClick: vi.fn(),
}

describe('ScheduleGrid', () => {
  it('renders day-of-week headers', () => {
    render(<ScheduleGrid {...mockProps} />)
    expect(screen.getByText('월')).toBeInTheDocument()
    expect(screen.getByText('화')).toBeInTheDocument()
    expect(screen.getByText('일')).toBeInTheDocument()
    expect(screen.getByText('토')).toBeInTheDocument()
  })

  it('renders time slot labels in HH:MM~HH:MM format', () => {
    render(<ScheduleGrid {...mockProps} />)
    expect(screen.getAllByText('10:00~12:00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('20:00~22:00').length).toBeGreaterThan(0)
  })

  it('renders CLOSE cells for 12-13 row', () => {
    render(<ScheduleGrid {...mockProps} />)
    const closeCells = screen.getAllByText('CLOSE')
    expect(closeCells.length).toBeGreaterThan(0)
  })
})
